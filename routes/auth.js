/**
 * Authentication Routes
 * Unified authentication endpoints
 */

const express = require('express');
const authService = require('../services/authService');
const router = express.Router();

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    console.log('🔐 Login attempt for:', email);

    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';

    const result = await authService.loginWithPassword(email, password, ip, userAgent);

    if (!result.success) {
      return res.status(401).json(result);
    }

    // Set secure HTTP-only cookies
    res.cookie('auth_access_token', result.session.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    if (result.session.refreshToken) {
      res.cookie('auth_refresh_token', result.session.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
    }

    console.log('✅ Login successful for:', email);

    res.json({
      success: true,
      user: result.user,
      session: result.session
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

/**
 * POST /api/auth/register
 * Register new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and name are required'
      });
    }

    console.log('📝 Registration attempt for:', email);

    const result = await authService.registerUser({ email, password, name });

    if (!result.success) {
      return res.status(400).json(result);
    }

    console.log('✅ Registration successful for:', email);

    res.json({
      success: true,
      message: 'Registration successful. Please check your email for verification.',
      user: result.user
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', async (req, res) => {
  try {
    console.log('🔍 Auth check request received');
    
    // Get token from Authorization header or cookies
    let token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      token = req.cookies.auth_access_token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No authentication token provided'
      });
    }

    // Verify token
    const result = await authService.verifyAccessToken(token);
    
    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: result.error
      });
    }

    // Create session object for response
    const session = {
      user: result.user,
      accessToken: token,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      isActive: true
    };

    console.log('✅ User authenticated:', result.user.email);
    
    res.json({
      success: true,
      user: result.user,
      session
    });
  } catch (error) {
    console.error('❌ Auth check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', async (req, res) => {
  try {
    console.log('🚪 Logout request received');
    
    // Clear cookies
    res.clearCookie('auth_access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    res.clearCookie('auth_refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    console.log('✅ Logout successful');
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required'
      });
    }

    const result = await authService.refreshAccessToken(refreshToken);
    
    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Token refresh failed'
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    console.log('🔐 Forgot password request for:', email);

    const result = await authService.forgotPassword(email);

    res.json(result);
  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request'
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and password are required'
      });
    }

    console.log('🔐 Password reset attempt with token:', token.substring(0, 8) + '...');

    const result = await authService.resetPassword(token, password);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
});

/**
 * POST /api/auth/verify-email
 * Verify email with token
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required'
      });
    }

    console.log('📧 Email verification attempt with token:', token.substring(0, 8) + '...');

    const result = await authService.verifyEmail(token);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('❌ Email verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify email'
    });
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    console.log('📧 Resend verification request for:', email);

    const result = await authService.resendVerificationEmail(email);

    res.json(result);
  } catch (error) {
    console.error('❌ Resend verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resend verification email'
    });
  }
});

/**
 * GET /api/auth/security-audit
 * Get security audit log (admin only)
 */
router.get('/security-audit', async (req, res) => {
  try {
    const { email } = req.query;
    
    console.log('🔒 Security audit request for:', email || 'all users');

    const auditLog = authService.getSecurityAuditLog(email);

    res.json({
      success: true,
      auditLog
    });
  } catch (error) {
    console.error('❌ Security audit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security audit log'
    });
  }
});

module.exports = router;