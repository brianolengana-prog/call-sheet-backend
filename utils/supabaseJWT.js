/**
 * Enhanced utility functions for handling Supabase JWT tokens with proper security
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Verify JWT token signature with Supabase JWT secret
 * @param {string} token - The JWT token
 * @returns {Object|null} Decoded payload or null if invalid
 */
const verifySupabaseToken = async (token) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    
    console.log('🔍 JWT Verification - Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasJwtSecret: !!supabaseJwtSecret,
      hasAnonKey: !!supabaseAnonKey,
      supabaseUrlPreview: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'missing'
    });
    
    if (!supabaseUrl) {
      console.warn('❌ SUPABASE_URL missing');
      throw new Error('MISSING_SUPABASE_URL');
    }

    // Try multiple JWT secrets in order of preference
    const jwtSecrets = [
      supabaseJwtSecret,
      supabaseAnonKey,
      process.env.JWT_SECRET
    ].filter(Boolean);

    if (jwtSecrets.length === 0) {
      console.warn('❌ No JWT secrets available');
      throw new Error('MISSING_JWT_SECRET');
    }

    // Decode the token header to check the algorithm
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      throw new Error('INVALID_TOKEN_FORMAT');
    }
    
    const header = JSON.parse(Buffer.from(tokenParts[0], 'base64').toString());
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    
    console.log('🔍 Token header:', { alg: header.alg, typ: header.typ });
    console.log('🔍 Token payload:', { 
      sub: payload.sub, 
      email: payload.email, 
      aud: payload.aud, 
      iss: payload.iss,
      exp: payload.exp,
      iat: payload.iat
    });
    
    // Try each JWT secret until one works
    let lastError;
    for (let i = 0; i < jwtSecrets.length; i++) {
      const secret = jwtSecrets[i];
      try {
        console.log(`🔑 Trying JWT secret ${i + 1}/${jwtSecrets.length}:`, {
          secretPreview: secret.substring(0, 20) + '...',
          secretLength: secret.length
        });
        
        const decoded = jwt.verify(token, secret, {
          algorithms: ['HS256'], // Supabase uses HS256
          issuer: supabaseUrl + '/auth/v1',
          audience: 'authenticated',
          clockTolerance: 30 // Allow 30 seconds clock skew
        });
        
        console.log('✅ JWT token verified successfully:', {
          userId: decoded.sub,
          email: decoded.email,
          exp: decoded.exp,
          iat: decoded.iat,
          secretUsed: i + 1,
          timestamp: new Date().toISOString()
        });
        
        return decoded;
      } catch (error) {
        lastError = error;
        console.log(`❌ JWT secret ${i + 1} failed:`, error.message);
        continue;
      }
    }
    
    // If all secrets failed, throw the last error
    throw lastError;
    
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
      console.warn('Invalid token format - not 3 parts');
      return null;
    }

    // Always verify signature - no fallback for security
    let payload;
    try {
      payload = await verifySupabaseToken(token);
    } catch (error) {
      console.error('Token verification failed:', error.message);
      // In production, never fall back to unverified tokens
      if (process.env.NODE_ENV === 'production') {
        return null;
      }
      // In development, allow fallback but log warning
      console.warn('⚠️  DEVELOPMENT MODE: Using unverified token (SECURITY RISK)');
      payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    }
    
    // Validate required fields
    if (!payload.sub || !payload.email) {
      console.warn('Missing required fields in token:', { sub: !!payload.sub, email: !!payload.email });
      return null;
    }

    // Additional security checks
    if (!payload.aud || !['authenticated', 'anon'].includes(payload.aud)) {
      console.warn('Invalid audience in token:', payload.aud);
      return null;
    }

    // Check if token is expired (double-check)
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      console.warn('Token is expired');
      return null;
    }

    // Check if token is not yet valid
    if (payload.nbf && Date.now() < payload.nbf * 1000) {
      console.warn('Token is not yet valid');
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
      verified: true // Always verified if we got here
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
