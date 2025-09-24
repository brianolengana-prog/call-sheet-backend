/**
 * API Key Authentication Middleware
 * 
 * Handles API key authentication for programmatic access
 */

const apiKeyService = require('../services/apiKeyService');

/**
 * API Key authentication middleware
 */
const authenticateAPIKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
        code: 'MISSING_API_KEY'
      });
    }

    const validation = await apiKeyService.validateAPIKey(apiKey);
    
    if (!validation.success) {
      console.warn('API key validation failed:', {
        error: validation.error,
        ip: req.ip,
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
      
      return res.status(401).json({
        success: false,
        error: validation.error,
        code: 'INVALID_API_KEY'
      });
    }

    // Add API key info to request
    req.apiKey = validation.keyRecord;
    req.user = {
      id: validation.keyRecord.userId,
      type: 'api_key',
      permissions: validation.keyRecord.permissions
    };

    console.log('✅ API key authentication successful:', {
      keyId: validation.keyRecord.id,
      userId: validation.keyRecord.userId,
      permissions: validation.keyRecord.permissions,
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    });

    next();
  } catch (error) {
    console.error('❌ API key authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'API key authentication service error',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

/**
 * Require specific API key permissions
 */
const requireAPIKeyPermission = (permission) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key authentication required',
        code: 'MISSING_API_KEY'
      });
    }

    if (!apiKeyService.hasPermission(req.apiKey, permission)) {
      console.warn('API key permission denied:', {
        keyId: req.apiKey.id,
        userId: req.apiKey.userId,
        requiredPermission: permission,
        userPermissions: req.apiKey.permissions,
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });

      return res.status(403).json({
        success: false,
        error: `Insufficient permissions. Required: ${permission}`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

/**
 * Optional API key authentication
 */
const optionalAPIKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (apiKey) {
      const validation = await apiKeyService.validateAPIKey(apiKey);
      if (validation.success) {
        req.apiKey = validation.keyRecord;
        req.user = {
          id: validation.keyRecord.userId,
          type: 'api_key',
          permissions: validation.keyRecord.permissions
        };
      }
    }
    
    next();
  } catch (error) {
    console.warn('Optional API key auth warning:', error.message);
    next();
  }
};

module.exports = {
  authenticateAPIKey,
  requireAPIKeyPermission,
  optionalAPIKeyAuth
};
