/**
 * Google OAuth Routes
 * Handles Google OAuth authentication
 */

const express = require('express');
const authService = require('../services/authService');
const router = express.Router();

/**
 * GET /api/google-auth/url
 * Get Google OAuth authorization URL
 */
router.get('/url', (req, res) => {
  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const redirectUri = process.env.NODE_ENV === 'production' 
      ? 'https://www.callsheetconvert.com/auth/callback'
      : `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback`;
    
    if (!clientId) {
      return res.status(500).json({
        success: false,
        error: 'Google OAuth client ID not configured'
      });
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=email profile&` +
      `access_type=offline&` +
      `prompt=consent`;

    res.json({
      success: true,
      authUrl
    });
  } catch (error) {
    console.error('❌ Google OAuth URL generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate Google OAuth URL'
    });
  }
});

// Handle Google OAuth callback
router.post('/google/callback', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ 
        success: false,
        error: 'Authorization code is required' 
      });
    }

    console.log('🔐 Processing Google OAuth callback');

    // Use auth service to handle Google OAuth
    const result = await authService.handleGoogleCallback(code);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    const { user, session } = result;

    // Set secure HTTP-only cookies for tokens
    console.log('🍪 Setting cookies for user:', user.email);
    res.cookie('auth_access_token', session.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    if (session.refreshToken) {
      res.cookie('auth_refresh_token', session.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
    }

    console.log('✅ Google OAuth successful for:', user.email);

    // Return user info and tokens for cross-origin compatibility
    res.json({
      success: true,
      user,
      session
    });
  } catch (error) {
    console.error('❌ Google OAuth error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Google OAuth failed' 
    });
  }
});

// Get current user info from cookies or Authorization header
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

    // Verify token using auth service
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

// Sign out - clear cookies
router.post('/signout', (req, res) => {
  try {
    console.log('🚪 Google OAuth signout request');
    
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

    console.log('✅ Google OAuth signout successful');
    
    res.json({ 
      success: true,
      message: 'Signed out successfully'
    });
  } catch (error) {
    console.error('❌ Google OAuth signout error:', error);
    res.status(500).json({
      success: false,
      error: 'Signout failed'
    });
  }
});

module.exports = router;