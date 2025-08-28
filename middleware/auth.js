const { extractUserFromToken, isValidTokenStructure, isTokenExpired } = require('../utils/supabaseJWT');

/**
 * Authentication middleware for Supabase JWT tokens
 * Note: This is a simplified version for development
 * In production, you should verify with Supabase directly
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: {
          message: 'Access token required',
          type: 'authentication_error',
          status: 401
        }
      });
    }

    // Validate token structure
    if (!isValidTokenStructure(token)) {
      return res.status(401).json({
        error: {
          message: 'Invalid token format',
          type: 'authentication_error',
          status: 401
        }
      });
    }

    // Check if token is expired
    if (isTokenExpired(token)) {
      return res.status(401).json({
        error: {
          message: 'Token expired',
          type: 'authentication_error',
          status: 401
        }
      });
    }

    // Extract user information from token
    const user = extractUserFromToken(token);
    if (!user) {
      return res.status(401).json({
        error: {
          message: 'Invalid token content',
          type: 'authentication_error',
          status: 401
        }
      });
    }

    // Add user to request object
    req.user = user;
    next();

  } catch (error) {
    console.error('Authentication error:', error);
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
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token && isValidTokenStructure(token) && !isTokenExpired(token)) {
      const user = extractUserFromToken(token);
      req.user = user;
    } else {
      req.user = null;
    }
    
    next();
  } catch (error) {
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
        error: {
          message: 'Authentication required',
          type: 'authentication_error',
          status: 401
        }
      });
    }

    if (req.user.role !== requiredRole && req.user.role !== 'admin') {
      return res.status(403).json({
        error: {
          message: 'Insufficient permissions',
          type: 'authorization_error',
          status: 403
        }
      });
    }

    next();
  };
};

/**
 * Verify user owns the resource or has admin role
 */
const requireOwnership = (resourceUserId) => {
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

    // Allow if user owns the resource or is admin
    if (req.user.id === resourceUserId || req.user.role === 'admin') {
      next();
    } else {
      return res.status(403).json({
        error: {
          message: 'Access denied to this resource',
          type: 'authorization_error',
          status: 403
        }
      });
    }
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireOwnership
};
