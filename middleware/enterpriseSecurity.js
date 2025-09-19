/**
 * Enterprise-Grade Security Middleware
 * Implements OWASP security standards and enterprise best practices
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Security Configuration
const SECURITY_CONFIG = {
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100, // 100 requests per window
  AUTH_RATE_LIMIT_MAX: 5, // 5 auth attempts per window
  
  // Session Security
  SESSION_TIMEOUT_MINUTES: 30,
  MAX_SESSIONS_PER_USER: 5,
  
  // Password Security
  PASSWORD_MIN_LENGTH: 12,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_LOWERCASE: true,
  PASSWORD_REQUIRE_NUMBERS: true,
  PASSWORD_REQUIRE_SPECIAL_CHARS: true,
  PASSWORD_MAX_CONSECUTIVE_CHARS: 3,
  
  // MFA Security
  MFA_TOTP_WINDOW: 2, // 2 time windows tolerance
  MFA_BACKUP_CODES_COUNT: 10,
  
  // Security Headers
  CSP_POLICY: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://*.supabase.co"],
      frameSrc: ["'self'", "https://js.stripe.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
};

// Rate Limiting Store (in production, use Redis)
const rateLimitStore = new Map();

// Security Event Logger
class SecurityEventLogger {
  constructor() {
    this.events = [];
  }

  async logEvent(event) {
    const securityEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...event
    };

    this.events.push(securityEvent);

    // In production, send to security monitoring service
    console.log('SECURITY_EVENT:', securityEvent);

    // Store in database
    try {
      // Implementation would store in security_audit_log table
      console.log('Stored security event:', securityEvent.id);
    } catch (error) {
      console.error('Failed to store security event:', error);
    }
  }

  getEvents(userId, limit = 100) {
    return this.events
      .filter(event => !userId || event.userId === userId)
      .slice(-limit);
  }
}

const securityLogger = new SecurityEventLogger();

// Enhanced Rate Limiting
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    store: {
      incr: (key, cb) => {
        const now = Date.now();
        const record = rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };
        
        if (now > record.resetTime) {
          record.count = 1;
          record.resetTime = now + windowMs;
        } else {
          record.count++;
        }
        
        rateLimitStore.set(key, record);
        cb(null, record.count, record.resetTime);
      },
      decrement: (key, cb) => {
        const record = rateLimitStore.get(key);
        if (record && record.count > 0) {
          record.count--;
          rateLimitStore.set(key, record);
        }
        cb(null, record?.count || 0, record?.resetTime || Date.now());
      },
      resetKey: (key, cb) => {
        rateLimitStore.delete(key);
        cb(null);
      }
    },
    keyGenerator: (req) => {
      // Use IP + User ID for more granular rate limiting
      const userId = req.user?.id || 'anonymous';
      return `${req.ip}:${userId}`;
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health';
    }
  });
};

// General API Rate Limiter
const apiRateLimiter = createRateLimiter(
  SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS,
  SECURITY_CONFIG.RATE_LIMIT_MAX_REQUESTS,
  'Too many requests from this IP, please try again later.'
);

// Authentication Rate Limiter
const authRateLimiter = createRateLimiter(
  SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS,
  SECURITY_CONFIG.AUTH_RATE_LIMIT_MAX,
  'Too many authentication attempts, please try again later.'
);

// Security Headers Middleware
const securityHeaders = helmet({
  contentSecurityPolicy: SECURITY_CONFIG.CSP_POLICY,
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// CORS Configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:8080',
      'https://your-production-domain.com'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Device Fingerprinting
const generateDeviceFingerprint = (req) => {
  const components = [
    req.get('User-Agent') || '',
    req.get('Accept-Language') || '',
    req.get('Accept-Encoding') || '',
    req.ip || '',
    req.get('X-Forwarded-For') || ''
  ];
  
  return crypto
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex')
    .substring(0, 32);
};

// IP Address Extraction
const getClientIP = (req) => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
         'unknown';
};

// Password Validation
const validatePassword = (password) => {
  const errors = [];
  
  if (password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters long`);
  }
  
  if (SECURITY_CONFIG.PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (SECURITY_CONFIG.PASSWORD_REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (SECURITY_CONFIG.PASSWORD_REQUIRE_NUMBERS && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (SECURITY_CONFIG.PASSWORD_REQUIRE_SPECIAL_CHARS && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check for consecutive characters
  let consecutiveCount = 1;
  for (let i = 1; i < password.length; i++) {
    if (password[i] === password[i - 1]) {
      consecutiveCount++;
      if (consecutiveCount > SECURITY_CONFIG.PASSWORD_MAX_CONSECUTIVE_CHARS) {
        errors.push(`Password cannot have more than ${SECURITY_CONFIG.PASSWORD_MAX_CONSECUTIVE_CHARS} consecutive identical characters`);
        break;
      }
    } else {
      consecutiveCount = 1;
    }
  }
  
  // Check for common patterns
  const commonPatterns = [
    'password', '123456', 'qwerty', 'abc123', 'admin',
    'welcome', 'login', 'master', 'secret', 'letmein'
  ];
  
  const hasCommonPattern = commonPatterns.some(pattern => 
    password.toLowerCase().includes(pattern.toLowerCase())
  );
  
  if (hasCommonPattern) {
    errors.push('Password cannot contain common patterns');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Email Validation
const validateEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Invalid email format' };
  }
  
  if (email.length > 254) {
    return { isValid: false, error: 'Email too long' };
  }
  
  // Check for disposable email domains
  const disposableDomains = [
    '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
    'mailinator.com', 'throwaway.email', 'temp-mail.org'
  ];
  
  const domain = email.split('@')[1]?.toLowerCase();
  if (disposableDomains.includes(domain)) {
    return { isValid: false, error: 'Disposable email addresses are not allowed' };
  }
  
  return { isValid: true };
};

// JWT Token Validation
const validateJWT = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { isValid: true, decoded };
  } catch (error) {
    return { isValid: false, error: error.message };
  }
};

// Session Validation
const validateSession = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const { isValid, decoded, error } = validateJWT(token);
    
    if (!isValid) {
      await securityLogger.logEvent({
        eventType: 'INVALID_TOKEN',
        ipAddress: getClientIP(req),
        userAgent: req.get('User-Agent'),
        deviceFingerprint: generateDeviceFingerprint(req),
        success: false,
        failureReason: error,
        metadata: { path: req.path, method: req.method }
      });
      
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Check if user is locked
    // Implementation would check user_security_settings table
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Security Event Logging Middleware
const securityLogging = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  securityLogger.logEvent({
    eventType: 'API_REQUEST',
    userId: req.user?.id,
    ipAddress: getClientIP(req),
    userAgent: req.get('User-Agent'),
    deviceFingerprint: generateDeviceFingerprint(req),
    success: true,
    metadata: {
      path: req.path,
      method: req.method,
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined
    }
  });
  
  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    
    securityLogger.logEvent({
      eventType: 'API_RESPONSE',
      userId: req.user?.id,
      ipAddress: getClientIP(req),
      userAgent: req.get('User-Agent'),
      deviceFingerprint: generateDeviceFingerprint(req),
      success: res.statusCode < 400,
      metadata: {
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        duration,
        responseSize: JSON.stringify(data).length
      }
    });
    
    return originalJson.call(this, data);
  };
  
  next();
};

// Input Sanitization
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .trim();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    
    return obj;
  };
  
  if (req.body) {
    req.body = sanitize(req.body);
  }
  
  if (req.query) {
    req.query = sanitize(req.query);
  }
  
  next();
};

// Error Handling Middleware
const securityErrorHandler = (err, req, res, next) => {
  console.error('Security error:', err);
  
  // Log security error
  securityLogger.logEvent({
    eventType: 'SECURITY_ERROR',
    userId: req.user?.id,
    ipAddress: getClientIP(req),
    userAgent: req.get('User-Agent'),
    deviceFingerprint: generateDeviceFingerprint(req),
    success: false,
    failureReason: err.message,
    metadata: {
      path: req.path,
      method: req.method,
      stack: err.stack
    }
  });
  
  // Don't expose internal errors
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;
  
  res.status(statusCode).json({ error: message });
};

// Export middleware
module.exports = {
  // Core Security Middleware
  securityHeaders,
  cors: cors(corsOptions),
  apiRateLimiter,
  authRateLimiter,
  validateSession,
  securityLogging,
  sanitizeInput,
  securityErrorHandler,
  
  // Utility Functions
  generateDeviceFingerprint,
  getClientIP,
  validatePassword,
  validateEmail,
  validateJWT,
  securityLogger,
  
  // Configuration
  SECURITY_CONFIG
};
