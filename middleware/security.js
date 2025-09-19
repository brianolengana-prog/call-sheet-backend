/**
 * Comprehensive security middleware for the application
 */

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

/**
 * Enhanced security headers middleware
 */
const securityHeaders = (req, res, next) => {
  // Generate nonce for CSP
  const nonce = crypto.randomBytes(16).toString('base64');
  req.nonce = nonce;

  // Set comprehensive security headers
  res.set({
    // Prevent XSS attacks
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    
    // HTTPS enforcement
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    
    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Permissions policy
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
    
    // Content Security Policy
    'Content-Security-Policy': [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://api.stripe.com",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'"
    ].join('; '),
    
    // Additional security headers
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin'
  });

  next();
};

/**
 * CSRF protection middleware
 */
const csrfProtection = (req, res, next) => {
  // Skip CSRF for GET requests, webhook endpoints, and OAuth callbacks
  if (req.method === 'GET' || 
      req.path.includes('/webhook') || 
      req.path.includes('/google/callback') ||
      req.path.includes('/oauth/callback') ||
      req.path.includes('/google-auth/me')) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    // For API endpoints, we'll use a more lenient approach
    // In production, you might want stricter CSRF protection
    if (req.headers['content-type']?.includes('application/json')) {
      // For JSON APIs, check for custom header as CSRF protection
      const customHeader = req.headers['x-requested-with'];
      if (!customHeader) {
        return res.status(403).json({
          error: {
            message: 'CSRF protection: Missing required header',
            type: 'csrf_error',
            status: 403
          }
        });
      }
    }
  }

  next();
};

/**
 * Rate limiting for different endpoint types
 */
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: {
        message,
        type: 'rate_limit_error',
        status: 429
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Fix trust proxy issue by being more specific about trusted proxies
    trustProxy: process.env.NODE_ENV === 'production' ? 1 : false,
    // Use a more specific key generator that works with proxies
    keyGenerator: (req) => {
      // Only use X-Forwarded-For if trust proxy is enabled
      if (process.env.NODE_ENV === 'production') {
        const forwarded = req.get('X-Forwarded-For');
        const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip;
        return ip;
      }
      // In development, just use the direct IP
      return req.ip;
    },
    handler: (req, res) => {
      console.warn('Rate limit exceeded:', {
        ip: req.ip,
        forwardedFor: req.get('X-Forwarded-For'),
        path: req.path,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      
      res.status(429).json({
        error: {
          message,
          type: 'rate_limit_error',
          status: 429,
          retryAfter: Math.ceil(windowMs / 1000)
        }
      });
    }
  });
};

// Different rate limits for different types of operations
const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  'Too many authentication attempts. Please try again later.'
);

// More lenient rate limit for auth status checks
const authStatusRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  30, // 30 requests per minute
  'Too many authentication status checks. Please slow down.'
);

const apiRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  60, // 60 requests
  'Too many API requests. Please slow down.'
);

const stripeRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  30, // 30 requests per minute (more reasonable for billing operations)
  'Too many payment requests. Please try again later.'
);

const portalRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  5, // 5 portal sessions per minute (more restrictive for security)
  'Too many portal session requests. Please wait before trying again.'
);

/**
 * Request validation middleware
 */
const validateRequest = (req, res, next) => {
  // Check for suspicious patterns
  const suspicious = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /\beval\s*\(/i,
    /\bdocument\./i,
    /\bwindow\./i
  ];

  const checkString = (str) => {
    if (typeof str !== 'string') return false;
    return suspicious.some(pattern => pattern.test(str));
  };

  const checkObject = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    
    for (const key in obj) {
      if (checkString(key) || checkString(obj[key])) {
        return true;
      }
      if (typeof obj[key] === 'object' && checkObject(obj[key])) {
        return true;
      }
    }
    return false;
  };

  // Check URL parameters
  if (req.query && checkObject(req.query)) {
    console.warn('Suspicious query parameters detected:', {
      ip: req.ip,
      path: req.path,
      query: req.query,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    
    return res.status(400).json({
      error: {
        message: 'Invalid request parameters',
        type: 'validation_error',
        status: 400
      }
    });
  }

  // Check request body
  if (req.body && checkObject(req.body)) {
    console.warn('Suspicious request body detected:', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    
    return res.status(400).json({
      error: {
        message: 'Invalid request content',
        type: 'validation_error',
        status: 400
      }
    });
  }

  next();
};

/**
 * Request logging middleware for security monitoring
 */
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log security-relevant requests
  const securityPaths = ['/auth', '/login', '/register', '/admin', '/stripe'];
  const isSecurityPath = securityPaths.some(path => req.path.includes(path));
  
  if (isSecurityPath || req.method !== 'GET') {
    console.log('Security request:', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
  }

  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(body) {
    const duration = Date.now() - startTime;
    
    // Log failed authentication/authorization attempts
    if (body?.error && (body.error.type === 'authentication_error' || body.error.type === 'authorization_error')) {
      console.warn('Security event:', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        errorType: body.error.type,
        errorMessage: body.error.message,
        duration,
        timestamp: new Date().toISOString()
      });
    }
    
    return originalJson.call(this, body);
  };

  next();
};

/**
 * IP whitelist/blacklist middleware
 */
const ipFilter = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  // In production, you might want to implement IP blacklisting
  const blacklistedIPs = process.env.BLACKLISTED_IPS ? 
    process.env.BLACKLISTED_IPS.split(',') : [];
  
  if (blacklistedIPs.includes(clientIp)) {
    console.warn('Blocked blacklisted IP:', {
      ip: clientIp,
      path: req.path,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    
    return res.status(403).json({
      error: {
        message: 'Access denied',
        type: 'access_denied',
        status: 403
      }
    });
  }

  next();
};

/**
 * Suspicious activity detection
 */
const suspiciousActivityDetector = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || '';
  
  // Check for suspicious user agents
  const suspiciousUAs = [
    /bot/i,
    /crawl/i,
    /spider/i,
    /scrape/i,
    /curl/i,
    /wget/i,
    /python/i,
    /scanner/i
  ];
  
  const isSuspiciousUA = suspiciousUAs.some(pattern => pattern.test(userAgent));
  
  // Check for rapid requests (basic check)
  const requestKey = `requests:${clientIp}`;
  const now = Date.now();
  const window = 60 * 1000; // 1 minute
  
  if (!req.app.locals.requestTimes) {
    req.app.locals.requestTimes = new Map();
  }
  
  const times = req.app.locals.requestTimes.get(requestKey) || [];
  const recentTimes = times.filter(time => now - time < window);
  recentTimes.push(now);
  req.app.locals.requestTimes.set(requestKey, recentTimes);
  
  // Flag suspicious activity
  if (isSuspiciousUA && recentTimes.length > 10) {
    console.warn('Suspicious activity detected:', {
      ip: clientIp,
      userAgent,
      requestCount: recentTimes.length,
      path: req.path,
      timestamp: new Date().toISOString()
    });
    
    // Don't block, but log for monitoring
  }
  
  next();
};

module.exports = {
  securityHeaders,
  csrfProtection,
  authRateLimit,
  authStatusRateLimit,
  apiRateLimit,
  stripeRateLimit,
  portalRateLimit,
  validateRequest,
  securityLogger,
  ipFilter,
  suspiciousActivityDetector
};
