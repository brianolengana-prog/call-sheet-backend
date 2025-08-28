/**
 * Utility functions for handling Supabase JWT tokens
 */

/**
 * Extract user information from a Supabase JWT token
 * @param {string} token - The JWT token
 * @returns {Object|null} User object or null if invalid
 */
const extractUserFromToken = (token) => {
  try {
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    
    // Validate required fields
    if (!payload.sub || !payload.email) {
      return null;
    }

    // Check if token is expired
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.app_metadata?.role || payload.role || 'authenticated',
      aud: payload.aud,
      exp: payload.exp,
      iat: payload.iat,
      app_metadata: payload.app_metadata || {},
      user_metadata: payload.user_metadata || {}
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
 * Check if token is expired
 * @param {string} token - The JWT token
 * @returns {boolean} True if expired
 */
const isTokenExpired = (token) => {
  const expiration = getTokenExpiration(token);
  if (!expiration) {
    return true; // Consider invalid tokens as expired
  }
  
  return Date.now() >= expiration.getTime();
};

/**
 * Get user ID from token
 * @param {string} token - The JWT token
 * @returns {string|null} User ID or null if invalid
 */
const getUserIdFromToken = (token) => {
  const user = extractUserFromToken(token);
  return user ? user.id : null;
};

/**
 * Get user email from token
 * @param {string} token - The JWT token
 * @returns {string|null} User email or null if invalid
 */
const getUserEmailFromToken = (token) => {
  const user = extractUserFromToken(token);
  return user ? user.email : null;
};

module.exports = {
  extractUserFromToken,
  isValidTokenStructure,
  getTokenExpiration,
  isTokenExpired,
  getUserIdFromToken,
  getUserEmailFromToken
};
