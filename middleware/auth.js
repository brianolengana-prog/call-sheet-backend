/**
 * Authentication Middleware
 * Works with our custom authentication service
 */

const authService = require('../services/authService');

/**
 * Main authentication middleware
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      // Also check cookies
      const cookieToken = req.cookies.auth_access_token;
      if (!cookieToken) {
        console.log('❌ No token provided in request:', {
          path: req.originalUrl,
          method: req.method,
          ip: req.ip,
          timestamp: new Date().toISOString()
        });
        return res.status(401).json({
          success: false,
          error: 'No authentication token provided'
        });
      }
      
      // Use cookie token
      const result = await authService.verifyAccessToken(cookieToken);
      if (!result.success) {
        return res.status(401).json({
          success: false,
          error: result.error
        });
      }
      
      req.user = result.user;
      return next();
    }

    // Verify token
    const result = await authService.verifyAccessToken(token);
    
    if (!result.success) {
      console.log('❌ Token verification failed:', {
        error: result.error,
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      return res.status(401).json({
        success: false,
        error: result.error
      });
    }

    // Add user to request
    req.user = result.user;
    
    console.log('✅ Authentication successful for user:', {
      userId: result.user.id,
      email: result.user.email,
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    });

    next();
  } catch (error) {
    console.error('❌ Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication service error'
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const cookieToken = req.cookies.auth_access_token;

    const tokenToUse = token || cookieToken;

    if (tokenToUse) {
      const result = await authService.verifyAccessToken(tokenToUse);
      if (result.success) {
        req.user = result.user;
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
 * Role-based access control
 */
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRole = req.user.role || 'user';
    const hasPermission = userRole === requiredRole || userRole === 'admin' || userRole === 'super_admin';

    if (!hasPermission) {
      console.warn('Authorization failed:', {
        userId: req.user.id,
        userEmail: req.user.email,
        userRole,
        requiredRole,
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });

      return res.status(403).json({
        success: false,
        error: `Insufficient permissions. Required role: ${requiredRole}`
      });
    }

    next();
  };
};

/**
 * Verify user owns the resource or has admin role
 */
const requireOwnership = (resourceUserIdGetter) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    try {
      // Extract resource user ID
      let resourceUserId;
      if (typeof resourceUserIdGetter === 'function') {
        resourceUserId = await resourceUserIdGetter(req);
      } else if (typeof resourceUserIdGetter === 'string') {
        resourceUserId = req.params[resourceUserIdGetter] || req.body[resourceUserIdGetter];
      } else {
        resourceUserId = resourceUserIdGetter;
      }

      const isOwner = req.user.id === resourceUserId;
      const isAdmin = ['admin', 'super_admin'].includes(req.user.role || 'user');

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
          success: false,
          error: 'Access denied to this resource'
        });
      }

      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authorization service error'
      });
    }
  };
};

/**
 * Require specific permissions
 */
const requirePermissions = (permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userPermissions = req.user.permissions || [];
    const hasAllPermissions = permissions.every(permission => 
      userPermissions.includes(permission) || req.user.role === 'admin'
    );

    if (!hasAllPermissions) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        details: {
          required: permissions,
          userPermissions
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
  requirePermissions
};