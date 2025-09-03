/**
 * Enhanced utility functions for handling Supabase JWT tokens with proper security
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Verify JWT token signature with Supabase public key
 * @param {string} token - The JWT token
 * @returns {Object|null} Decoded payload or null if invalid
 */
const verifySupabaseToken = async (token) => {
  try {
    // For Supabase tokens, we need to fetch the public key from Supabase
    // In production, cache this key and refresh periodically
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('🔍 JWT Verification - Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasJwtSecret: !!process.env.JWT_SECRET,
      supabaseUrlPreview: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'missing'
    });
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('❌ Supabase configuration missing - falling back to basic validation');
      return null;
    }

    // For now, we'll use the service role key for verification
    // In production, you should use the actual JWT secret from Supabase
    const jwtSecret = process.env.JWT_SECRET || supabaseServiceKey;
    
    console.log('🔑 Using JWT secret for verification:', {
      hasJwtSecret: !!jwtSecret,
      secretPreview: jwtSecret ? jwtSecret.substring(0, 20) + '...' : 'missing'
    });
    
    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256', 'RS256'],
      issuer: supabaseUrl,
      audience: 'authenticated'
    });
    
    console.log('✅ JWT token verified successfully:', {
      userId: decoded.sub,
      email: decoded.email,
      exp: decoded.exp,
      timestamp: new Date().toISOString()
    });
    
    return decoded;
  } catch (error) {
    console.error('❌ JWT verification failed:', {
      error: error.message,
      name: error.name,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'no token',
      timestamp: new Date().toISOString()
    });
    
    if (error.name === 'TokenExpiredError') {
      throw new Error('TOKEN_EXPIRED');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('TOKEN_INVALID');
    } else if (error.name === 'NotBeforeError') {
      throw new Error('TOKEN_NOT_ACTIVE');
    }
    throw new Error('TOKEN_VERIFICATION_FAILED');
  }
};

/**
 * Extract user information from a Supabase JWT token with enhanced security
 * @param {string} token - The JWT token
 * @returns {Object|null} User object or null if invalid
 */
const extractUserFromToken = async (token) => {
  try {
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      return null;
    }

    // First try signature verification
    let payload;
    try {
      payload = await verifySupabaseToken(token);
    } catch (error) {
      // If signature verification fails, fall back to basic extraction for development
      if (process.env.NODE_ENV === 'development') {
        console.warn('Token verification failed, using development mode:', error.message);
        payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      } else {
        console.error('Token verification failed in production:', error.message);
        return null;
      }
    }
    
    // Validate required fields
    if (!payload.sub || !payload.email) {
      return null;
    }

    // Additional security checks
    if (!payload.aud || !['authenticated', 'anon'].includes(payload.aud)) {
      console.warn('Invalid audience in token:', payload.aud);
      return null;
    }

    // Check if token is expired (double-check)
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    // Check if token is not yet valid
    if (payload.nbf && Date.now() < payload.nbf * 1000) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.app_metadata?.role || payload.role || 'authenticated',
      aud: payload.aud,
      exp: payload.exp,
      iat: payload.iat,
      nbf: payload.nbf,
      app_metadata: payload.app_metadata || {},
      user_metadata: payload.user_metadata || {},
      // Add security context
      token_hash: crypto.createHash('sha256').update(token).digest('hex').substring(0, 16),
      verified: process.env.NODE_ENV === 'production' ? true : payload._verified !== false
    };
  } catch (error) {
    console.error('Error extracting user from token:', error);
    return null;
  }
};

/**
 * Validate Supabase JWT token structure
 * @param {string} token - The JWT token
 * @returns {boolean} True if valid structure
 */
const isValidTokenStructure = (token) => {
  try {
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      return false;
    }

    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    
    // Check for required Supabase JWT fields
    return !!(payload.sub && payload.email && payload.aud);
  } catch (error) {
    return false;
  }
};

/**
 * Get token expiration time
 * @param {string} token - The JWT token
 * @returns {Date|null} Expiration date or null if invalid
 */
const getTokenExpiration = (token) => {
  try {
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    
    if (payload.exp) {
      return new Date(payload.exp * 1000);
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Check if token is expired with enhanced validation
 * @param {string} token - The JWT token
 * @returns {boolean} True if expired
 */
const isTokenExpired = (token) => {
  const expiration = getTokenExpiration(token);
  if (!expiration) {
    return true; // Consider invalid tokens as expired
  }
  
  // Add a small buffer (30 seconds) to account for clock skew
  const bufferMs = 30 * 1000;
  return Date.now() >= (expiration.getTime() - bufferMs);
};

/**
 * Get user ID from token (async version)
 * @param {string} token - The JWT token
 * @returns {string|null} User ID or null if invalid
 */
const getUserIdFromToken = async (token) => {
  const user = await extractUserFromToken(token);
  return user ? user.id : null;
};

/**
 * Get user email from token (async version)
 * @param {string} token - The JWT token
 * @returns {string|null} User email or null if invalid
 */
const getUserEmailFromToken = async (token) => {
  const user = await extractUserFromToken(token);
  return user ? user.email : null;
};

/**
 * Session management utilities
 */
const sessions = new Map(); // In production, use Redis or database

/**
 * Create a session for a user
 * @param {string} userId - User ID
 * @param {string} tokenHash - Hash of the JWT token
 * @param {Object} metadata - Additional session metadata
 * @returns {string} Session ID
 */
const createSession = (userId, tokenHash, metadata = {}) => {
  const sessionId = crypto.randomUUID();
  const session = {
    id: sessionId,
    userId,
    tokenHash,
    createdAt: new Date(),
    lastAccessedAt: new Date(),
    metadata,
    active: true
  };
  
  sessions.set(sessionId, session);
  
  // Cleanup old sessions for the user (keep max 5 active sessions)
  const userSessions = Array.from(sessions.values())
    .filter(s => s.userId === userId && s.active)
    .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
  
  if (userSessions.length > 5) {
    userSessions.slice(5).forEach(s => {
      s.active = false;
      sessions.set(s.id, s);
    });
  }
  
  return sessionId;
};

/**
 * Get session by ID
 * @param {string} sessionId - Session ID
 * @returns {Object|null} Session object or null
 */
const getSession = (sessionId) => {
  const session = sessions.get(sessionId);
  if (session && session.active) {
    session.lastAccessedAt = new Date();
    sessions.set(sessionId, session);
    return session;
  }
  return null;
};

/**
 * Invalidate session
 * @param {string} sessionId - Session ID
 */
const invalidateSession = (sessionId) => {
  const session = sessions.get(sessionId);
  if (session) {
    session.active = false;
    sessions.set(sessionId, session);
  }
};

/**
 * Invalidate all sessions for a user
 * @param {string} userId - User ID
 */
const invalidateUserSessions = (userId) => {
  sessions.forEach((session, id) => {
    if (session.userId === userId) {
      session.active = false;
      sessions.set(id, session);
    }
  });
};

/**
 * Validate request fingerprint for additional security
 * @param {Object} req - Express request object
 * @returns {string} Request fingerprint
 */
const generateRequestFingerprint = (req) => {
  const components = [
    req.ip,
    req.get('User-Agent') || '',
    req.get('Accept-Language') || '',
    req.get('Accept-Encoding') || ''
  ];
  
  return crypto.createHash('sha256')
    .update(components.join('|'))
    .digest('hex')
    .substring(0, 16);
};

/**
 * Rate limiting for authentication attempts
 */
const authAttempts = new Map();

/**
 * Check if user has exceeded authentication rate limit
 * @param {string} identifier - IP or user identifier
 * @returns {boolean} True if rate limited
 */
const isRateLimited = (identifier) => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;
  
  const attempts = authAttempts.get(identifier) || [];
  const recentAttempts = attempts.filter(time => now - time < windowMs);
  
  authAttempts.set(identifier, recentAttempts);
  
  return recentAttempts.length >= maxAttempts;
};

/**
 * Record authentication attempt
 * @param {string} identifier - IP or user identifier
 */
const recordAuthAttempt = (identifier) => {
  const attempts = authAttempts.get(identifier) || [];
  attempts.push(Date.now());
  authAttempts.set(identifier, attempts);
};

module.exports = {
  extractUserFromToken,
  verifySupabaseToken,
  isValidTokenStructure,
  getTokenExpiration,
  isTokenExpired,
  getUserIdFromToken,
  getUserEmailFromToken,
  // Session management
  createSession,
  getSession,
  invalidateSession,
  invalidateUserSessions,
  generateRequestFingerprint,
  // Rate limiting
  isRateLimited,
  recordAuthAttempt
};
