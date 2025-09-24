/**
 * Structured Logging Middleware
 * 
 * Provides correlation IDs and structured logging for all requests
 */

const crypto = require('crypto');

/**
 * Generate correlation ID for request tracking
 */
const generateCorrelationId = () => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Structured logging middleware
 */
const structuredLogging = (req, res, next) => {
  // Generate correlation ID
  const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  req.correlationId = correlationId;
  
  // Add correlation ID to response headers
  res.set('X-Correlation-ID', correlationId);
  
  // Create logger context
  const logger = {
    correlationId,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    method: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  };

  // Add logger to request
  req.logger = logger;

  // Log request start
  console.log('📝 Request started:', {
    ...logger,
    event: 'request_start'
  });

  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(body) {
    const duration = Date.now() - req.startTime;
    
    // Log response
    console.log('📝 Request completed:', {
      ...logger,
      event: 'request_complete',
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      success: res.statusCode < 400
    });

    // Log errors
    if (res.statusCode >= 400) {
      console.error('❌ Request error:', {
        ...logger,
        event: 'request_error',
        statusCode: res.statusCode,
        error: body?.error || 'Unknown error',
        duration: `${duration}ms`
      });
    }

    return originalJson.call(this, body);
  };

  // Track request start time
  req.startTime = Date.now();
  
  next();
};

/**
 * Log extraction events
 */
const logExtractionEvent = (req, event, data = {}) => {
  console.log('🔍 Extraction event:', {
    correlationId: req.correlationId,
    userId: req.user?.id,
    event: event,
    timestamp: new Date().toISOString(),
    ...data
  });
};

/**
 * Log API key usage
 */
const logAPIKeyUsage = (req, operation, data = {}) => {
  console.log('🔑 API key usage:', {
    correlationId: req.correlationId,
    userId: req.user?.id,
    apiKeyId: req.apiKey?.id,
    operation: operation,
    timestamp: new Date().toISOString(),
    ...data
  });
};

/**
 * Log security events
 */
const logSecurityEvent = (req, event, data = {}) => {
  console.warn('🛡️ Security event:', {
    correlationId: req.correlationId,
    userId: req.user?.id,
    ip: req.ip,
    event: event,
    timestamp: new Date().toISOString(),
    ...data
  });
};

module.exports = {
  structuredLogging,
  logExtractionEvent,
  logAPIKeyUsage,
  logSecurityEvent
};
