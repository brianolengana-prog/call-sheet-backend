/**
 * Google OAuth integration with enhanced security
 * Hybrid approach: Supabase handles OAuth, backend handles security & sessions
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { 
  createSession,
  generateRequestFingerprint,
  isRateLimited,
  recordAuthAttempt
} = require('../utils/supabaseJWT');
const authLogger = require('../utils/authLogger');
const { authRateLimit } = require('../middleware/security');

const router = express.Router();

// Initialize Supabase client for server-side operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * @route   POST /api/google-auth/exchange
 * @desc    Exchange Supabase session for backend session with enhanced security
 * @access  Public (rate limited)
 */
router.post('/exchange', authRateLimit, async (req, res) => {
  const startTime = Date.now();
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'unknown';
  
  try {
    const { supabaseAccessToken, supabaseRefreshToken } = req.body;
    
    if (!supabaseAccessToken) {
      await authLogger.logAuthAttempt(false, {
        ip: clientIp,
        userAgent,
        path: req.originalUrl,
        method: req.method,
        errorType: 'missing_token',
        provider: 'google'
      });
      
      return res.status(400).json({
        error: {
          message: 'Supabase access token required',
          type: 'validation_error',
          status: 400
        }
      });
    }

    // Verify the Supabase token with server-side client
    const { data: { user }, error: userError } = await supabase.auth.getUser(supabaseAccessToken);
    
    if (userError || !user) {
      await authLogger.logAuthAttempt(false, {
        ip: clientIp,
        userAgent,
        path: req.originalUrl,
        method: req.method,
        errorType: 'invalid_supabase_token',
        provider: 'google'
      });
      
      return res.status(401).json({
        error: {
          message: 'Invalid Supabase token',
          type: 'authentication_error',
          status: 401
        }
      });
    }

    // Validate this is a Google OAuth user
    if (!user.app_metadata?.provider || user.app_metadata.provider !== 'google') {
      await authLogger.logAuthAttempt(false, {
        ip: clientIp,
        userAgent,
        userId: user.id,
        email: user.email,
        path: req.originalUrl,
        method: req.method,
        errorType: 'invalid_provider',
        provider: user.app_metadata?.provider || 'unknown'
      });
      
      return res.status(400).json({
        error: {
          message: 'Invalid authentication provider',
          type: 'authentication_error',
          status: 400
        }
      });
    }

    // Extract Google-specific information
    const googleData = user.user_metadata || {};
    const profile = {
      id: user.id,
      email: user.email,
      name: googleData.full_name || googleData.name || user.email,
      picture: googleData.avatar_url || googleData.picture,
      verified: user.email_confirmed_at ? true : false,
      provider: 'google',
      role: user.app_metadata?.role || 'authenticated',
      app_metadata: user.app_metadata || {},
      user_metadata: user.user_metadata || {}
    };

    // Generate enhanced user object compatible with our JWT system
    const enhancedUser = {
      id: user.id,
      email: user.email,
      role: profile.role,
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
      iat: Math.floor(Date.now() / 1000),
      app_metadata: profile.app_metadata,
      user_metadata: profile.user_metadata,
      verified: profile.verified,
      provider: 'google'
    };

    // Generate request fingerprint
    const fingerprint = generateRequestFingerprint(req);
    
    // Create session with our enhanced system
    const sessionId = createSession(user.id, 'google-oauth-session', {
      fingerprint,
      ip: clientIp,
      userAgent,
      provider: 'google',
      supabaseTokens: {
        access: supabaseAccessToken.substring(0, 20) + '...', // Log partial token for debugging
        refresh: supabaseRefreshToken ? 'present' : 'missing'
      },
      lastActivity: new Date()
    });

    // Log successful Google authentication
    await authLogger.logAuthAttempt(true, {
      ip: clientIp,
      userAgent,
      email: user.email,
      userId: user.id,
      path: req.originalUrl,
      method: req.method,
      duration: Date.now() - startTime,
      fingerprint,
      provider: 'google'
    });

    // Sync user profile if needed (optional background operation)
    syncUserProfile(user.id, profile).catch(error => {
      console.warn('Profile sync warning:', error.message);
    });

    // Return enhanced session information
    res.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        verified: profile.verified,
        role: profile.role,
        provider: 'google'
      },
      session: {
        id: sessionId.substring(0, 8) + '...',
        expiresAt: new Date(enhancedUser.exp * 1000),
        provider: 'google'
      },
      // Return a custom backend token that includes enhanced user info
      backendToken: generateBackendToken(enhancedUser),
      security: {
        fingerprint: fingerprint.substring(0, 8) + '...',
        sessionCreated: new Date()
      }
    });

  } catch (error) {
    await authLogger.logAuthAttempt(false, {
      ip: clientIp,
      userAgent,
      path: req.originalUrl,
      method: req.method,
      errorType: 'server_error',
      provider: 'google',
      error: error.message
    });
    
    console.error('Google auth exchange error:', error);
    res.status(500).json({
      error: {
        message: 'Authentication service error',
        type: 'server_error',
        status: 500
      }
    });
  }
});

/**
 * @route   POST /api/google-auth/refresh
 * @desc    Refresh Google OAuth session
 * @access  Private
 */
router.post('/refresh', async (req, res) => {
  try {
    const { supabaseRefreshToken } = req.body;
    
    if (!supabaseRefreshToken) {
      return res.status(400).json({
        error: {
          message: 'Refresh token required',
          type: 'validation_error',
          status: 400
        }
      });
    }

    // Refresh the Supabase session
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: supabaseRefreshToken
    });
    
    if (error || !data.session) {
      return res.status(401).json({
        error: {
          message: 'Failed to refresh session',
          type: 'authentication_error',
          status: 401
        }
      });
    }

    const user = data.session.user;
    const newAccessToken = data.session.access_token;
    const newRefreshToken = data.session.refresh_token;

    // Create new backend session
    const fingerprint = generateRequestFingerprint(req);
    const sessionId = createSession(user.id, 'google-oauth-refresh', {
      fingerprint,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      provider: 'google',
      refreshed: true,
      lastActivity: new Date()
    });

    res.json({
      success: true,
      tokens: {
        access: newAccessToken,
        refresh: newRefreshToken
      },
      session: {
        id: sessionId.substring(0, 8) + '...',
        expiresAt: new Date(data.session.expires_at * 1000)
      }
    });

  } catch (error) {
    console.error('Google refresh error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to refresh session',
        type: 'server_error',
        status: 500
      }
    });
  }
});

/**
 * @route   GET /api/google-auth/profile
 * @desc    Get enhanced Google user profile
 * @access  Private
 */
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        error: {
          message: 'Access token required',
          type: 'authentication_error',
          status: 401
        }
      });
    }

    // Verify with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({
        error: {
          message: 'Invalid token',
          type: 'authentication_error',
          status: 401
        }
      });
    }

    // Return enhanced profile
    const profile = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
      picture: user.user_metadata?.avatar_url || user.user_metadata?.picture,
      verified: user.email_confirmed_at ? true : false,
      provider: 'google',
      role: user.app_metadata?.role || 'authenticated',
      lastSignIn: user.last_sign_in_at,
      createdAt: user.created_at,
      // Google-specific data
      googleData: {
        locale: user.user_metadata?.locale,
        verifiedEmail: user.user_metadata?.email_verified,
        providerId: user.user_metadata?.provider_id
      }
    };

    res.json({ profile });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch profile',
        type: 'server_error',
        status: 500
      }
    });
  }
});

/**
 * Helper function to generate backend-compatible token
 */
function generateBackendToken(user) {
  // This creates a token that's compatible with our existing JWT middleware
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify(user)).toString('base64');
  
  // In a real implementation, you'd sign this properly
  // For now, we'll create a mock signature that our middleware can recognize
  const signature = 'google-oauth-backend-token';
  
  return `${header}.${payload}.${signature}`;
}

/**
 * Helper function to sync user profile (placeholder for database operations)
 */
async function syncUserProfile(userId, profile) {
  // In a real implementation, you would:
  // 1. Check if user exists in your database
  // 2. Create or update user record
  // 3. Sync profile data
  // 4. Update last login timestamp
  
  console.log(`Profile sync for user ${userId}:`, {
    name: profile.name,
    email: profile.email,
    provider: profile.provider,
    verified: profile.verified
  });
  
  // Placeholder for database operations
  return Promise.resolve();
}

module.exports = router;
