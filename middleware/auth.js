const { 
  extractUserFromToken, 
  isValidTokenStructure, 
  isTokenExpired,
  createSession,
  getSession,
  generateRequestFingerprint,
  isRateLimited,
  recordAuthAttempt
} = require('../utils/supabaseJWT');

/**
 * Enhanced authentication middleware with comprehensive security
 */
const authenticateToken = async (req, res, next) => {
  const startTime = Date.now();
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'unknown';
  
  try {
    // Rate limiting check
    const rateLimitKey = `auth:${clientIp}`;
    if (isRateLimited(rateLimitKey)) {
      recordAuthAttempt(rateLimitKey);
      
      // Log security event
      console.warn(`Rate limit exceeded for authentication attempt`, {
        ip: clientIp,
        userAgent,
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
      
      return res.status(429).json({
        error: {
          message: 'Too many authentication attempts. Please try again later.',
          type: 'rate_limit_error',
          status: 429,
          retryAfter: 900 // 15 minutes
        }
      });
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      recordAuthAttempt(rateLimitKey);
      return res.status(401).json({
        error: {
          message: 'Access token required',
          type: 'authentication_error',
          status: 401
        }
      });
    }

    // Validate token structure first (fast check)
    if (!isValidTokenStructure(token)) {
      recordAuthAttempt(rateLimitKey);
      
      console.warn('Invalid token structure attempt', {
        ip: clientIp,
        userAgent,
        tokenPreview: token.substring(0, 20) + '...',
        timestamp: new Date().toISOString()
      });
      
      return res.status(401).json({
        error: {
          message: 'Invalid token format',
          type: 'authentication_error',
          status: 401
        }
      });
    }

    // Check if token is expired (fast check)
    if (isTokenExpired(token)) {
      recordAuthAttempt(rateLimitKey);
      
      return res.status(401).json({
        error: {
          message: 'Token expired',
          type: 'authentication_error', 
          status: 401
        }
      });
    }

    // Extract user information with signature verification
    const user = await extractUserFromToken(token);
    if (!user) {
      recordAuthAttempt(rateLimitKey);
      
      console.warn('Token extraction failed', {
        ip: clientIp,
        userAgent,
        timestamp: new Date().toISOString()
      });
      
      return res.status(401).json({
        error: {
          message: 'Invalid token content',
          type: 'authentication_error',
          status: 401
        }
      });
    }

    // Generate request fingerprint for additional security
    const fingerprint = generateRequestFingerprint(req);
    
    // Create or update session
    const sessionId = createSession(user.id, user.token_hash, {
      fingerprint,
      ip: clientIp,
      userAgent,
      lastActivity: new Date()
    });

    // Add enhanced user and security context to request
    req.user = {
      ...user,
      sessionId,
      fingerprint,
      authTime: new Date(),
      authDuration: Date.now() - startTime
    };

    // Add security headers for authenticated requests
    res.set({
      'X-Auth-Time': new Date().toISOString(),
      'X-Session-ID': sessionId.substring(0, 8) + '...' // Partial session ID for debugging
    });

    // Log successful authentication (in development only)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Authentication successful for user ${user.id} (${user.email})`);
    }

    next();

  } catch (error) {
    recordAuthAttempt(rateLimitKey);
    
    console.error('Authentication service error:', {
      error: error.message,
      stack: error.stack,
      ip: clientIp,
      userAgent,
      timestamp: new Date().toISOString()
    });
    
    return res.status(500).json({
      error: {
        message: 'Authentication service error',
        type: 'server_error',
        status: 500
      }
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token provided
 * Enhanced with better error handling
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token && isValidTokenStructure(token) && !isTokenExpired(token)) {
      const user = await extractUserFromToken(token);
      if (user) {
        const fingerprint = generateRequestFingerprint(req);
        req.user = {
          ...user,
          fingerprint,
          authType: 'optional',
          authTime: new Date()
        };
      } else {
        req.user = null;
      }
    } else {
      req.user = null;
    }
    
    next();
  } catch (error) {
    console.warn('Optional auth warning:', error.message);
    req.user = null;
    next();
  }
};

/**
 * Enhanced role-based access control with detailed logging
 */
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required',
          type: 'authentication_error',
          status: 401
        }
      });
    }

    const userRole = req.user.role;
    const hasPermission = userRole === requiredRole || userRole === 'admin' || userRole === 'super_admin';

    if (!hasPermission) {
      // Log authorization failure
      console.warn('Authorization failed:', {
        userId: req.user.id,
        userEmail: req.user.email,
        userRole,
        requiredRole,
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      return res.status(403).json({
        error: {
          message: `Insufficient permissions. Required role: ${requiredRole}`,
          type: 'authorization_error',
          status: 403,
          details: {
            userRole,
            requiredRole
          }
        }
      });
    }

    // Log successful authorization (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Authorization successful: ${userRole} accessing ${requiredRole} endpoint`);
    }

    next();
  };
};

/**
 * Verify user owns the resource or has admin role
 * Enhanced with dynamic resource ID extraction
 */
const requireOwnership = (resourceUserIdGetter) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required',
          type: 'authentication_error',
          status: 401
        }
      });
    }

    try {
      // Extract resource user ID (can be function, string, or from req params)
      let resourceUserId;
      if (typeof resourceUserIdGetter === 'function') {
        resourceUserId = await resourceUserIdGetter(req);
      } else if (typeof resourceUserIdGetter === 'string') {
        resourceUserId = req.params[resourceUserIdGetter] || req.body[resourceUserIdGetter];
      } else {
        resourceUserId = resourceUserIdGetter;
      }

      const isOwner = req.user.id === resourceUserId;
      const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

      if (!isOwner && !isAdmin) {
        console.warn('Ownership check failed:', {
          userId: req.user.id,
          userEmail: req.user.email,
          resourceUserId,
          userRole: req.user.role,
          path: req.originalUrl,
          method: req.method,
          timestamp: new Date().toISOString()
        });

        return res.status(403).json({
          error: {
            message: 'Access denied to this resource',
            type: 'authorization_error',
            status: 403
          }
        });
      }

      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      return res.status(500).json({
        error: {
          message: 'Authorization service error',
          type: 'server_error',
          status: 500
        }
      });
    }
  };
};

/**
 * Session validation middleware
 */
const validateSession = (req, res, next) => {
  if (!req.user || !req.user.sessionId) {
    return next(); // Skip if no user or session
  }

  const session = getSession(req.user.sessionId);
  if (!session) {
    return res.status(401).json({
      error: {
        message: 'Session expired or invalid',
        type: 'session_error',
        status: 401
      }
    });
  }

  // Validate fingerprint for additional security
  const currentFingerprint = generateRequestFingerprint(req);
  if (session.metadata.fingerprint !== currentFingerprint) {
    console.warn('Session fingerprint mismatch:', {
      userId: req.user.id,
      sessionId: req.user.sessionId,
      storedFingerprint: session.metadata.fingerprint,
      currentFingerprint,
      timestamp: new Date().toISOString()
    });

    return res.status(401).json({
      error: {
        message: 'Session security validation failed',
        type: 'session_error',
        status: 401
      }
    });
  }

  next();
};

/**
 * Require specific permissions beyond role
 */
const requirePermissions = (permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required',
          type: 'authentication_error',
          status: 401
        }
      });
    }

    const userPermissions = req.user.app_metadata?.permissions || [];
    const hasAllPermissions = permissions.every(permission => 
      userPermissions.includes(permission) || req.user.role === 'admin'
    );

    if (!hasAllPermissions) {
      return res.status(403).json({
        error: {
          message: 'Insufficient permissions',
          type: 'authorization_error',
          status: 403,
          details: {
            required: permissions,
            userPermissions
          }
        }
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireOwnership,
  validateSession,
  requirePermissions
};
