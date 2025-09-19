const express = require('express');
const { google } = require('googleapis');
const router = express.Router();

// Google OAuth configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL}/auth/callback`
);

// Handle Google OAuth callback
router.post('/google/callback', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // Set secure HTTP-only cookies for tokens
    console.log('🍪 Setting cookies for user:', userInfo.email);
    console.log('🔒 Environment:', process.env.NODE_ENV);
    
    res.cookie('google_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600000 // 1 hour
    });
    
    if (tokens.refresh_token) {
      res.cookie('google_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
    }
    
    console.log('✅ Cookies set successfully');
    
    // Return user info and token (for cross-origin compatibility)
    res.json({
      success: true,
      access_token: tokens.access_token, // Include token for cross-origin requests
      refresh_token: tokens.refresh_token,
      user: {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture
      }
    });

  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      message: error.message 
    });
  }
});

// Get current user info from cookies or Authorization header
router.get('/me', async (req, res) => {
  try {
    console.log('🍪 Cookies received:', req.cookies);
    console.log('🔍 Headers:', req.headers);
    
    // Try to get token from cookies first, then from Authorization header
    let accessToken = req.cookies.google_access_token;
    
    if (!accessToken) {
      // Check Authorization header for Bearer token
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7);
        console.log('🔑 Token found in Authorization header');
      }
    } else {
      console.log('🍪 Token found in cookies');
    }
    
    if (!accessToken) {
      console.log('❌ No access token found in cookies or headers');
      return res.status(401).json({ error: 'Not authenticated - no access token' });
    }

    console.log('✅ Access token found, verifying with Google...');

    // Verify token with Google
    oauth2Client.setCredentials({ access_token: accessToken });
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    console.log('✅ User verified:', userInfo.email);

    res.json({
      user: {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture
      }
    });

  } catch (error) {
    console.error('❌ Get user info error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Sign out - clear cookies
router.post('/signout', (req, res) => {
  res.clearCookie('google_access_token');
  res.clearCookie('google_refresh_token');
  res.json({ success: true });
});

module.exports = router;