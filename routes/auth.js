/**
 * Authentication routes with enhanced security
 */

const express = require('express');
const { 
  authenticateToken, 
  validateSession,
  requireRole 
} = require('../middleware/auth');
const { 
  invalidateSession, 
  invalidateUserSessions,
  getSession 
} = require('../utils/supabaseJWT');
const authLogger = require('../utils/authLogger');

const router = express.Router();

/**
 * @route   POST /api/auth/validate
 * @desc    Validate current authentication token
 * @access  Private
 */
router.post('/validate', authenticateToken, validateSession, async (req, res) => {
  try {
    const user = req.user;
    
    // Log successful validation
    await authLogger.logAuthAttempt(true, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      email: user.email,
      userId: user.id,
      path: req.originalUrl,
      method: req.method,
      duration: user.authDuration,
      fingerprint: user.fingerprint
    });

    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        verified: user.verified,
        app_metadata: user.app_metadata,
        user_metadata: user.user_metadata
      },
      session: {
        id: user.sessionId.substring(0, 8) + '...',
        authTime: user.authTime,
        expiresAt: new Date(user.exp * 1000)
      }
    });

  } catch (error) {
    console.error('Token validation error:', error);
    
    await authLogger.logAuthAttempt(false, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.originalUrl,
      method: req.method,
      errorType: 'validation_error'
    });
    
    res.status(500).json({
      error: {
        message: 'Token validation failed',
        type: 'validation_error',
        status: 500
      }
    });
  }
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh authentication session
 * @access  Private
 */
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // In a real implementation, you would:
    // 1. Validate the refresh token
    // 2. Check if the user is still active
    // 3. Generate new access token
    // 4. Update session
    
    res.json({
      message: 'Session refreshed successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      sessionExtended: true
    });

  } catch (error) {
    console.error('Session refresh error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to refresh session',
        type: 'refresh_error',
        status: 500
      }
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout and invalidate session
 * @access  Private
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // Invalidate current session
    if (user.sessionId) {
      invalidateSession(user.sessionId);
      
      await authLogger.logSessionEvent('logout', {
        sessionId: user.sessionId,
        userId: user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        fingerprint: user.fingerprint
      });
    }

    res.json({
      message: 'Logged out successfully',
      sessionInvalidated: true
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: {
        message: 'Logout failed',
        type: 'logout_error',
        status: 500
      }
    });
  }
});

/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout from all devices (invalidate all sessions)
 * @access  Private
 */
router.post('/logout-all', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // Invalidate all user sessions
    invalidateUserSessions(user.id);
    
    await authLogger.logSessionEvent('logout_all', {
      userId: user.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      fingerprint: user.fingerprint
    });

    res.json({
      message: 'Logged out from all devices successfully',
      allSessionsInvalidated: true
    });

  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to logout from all devices',
        type: 'logout_all_error',
        status: 500
      }
    });
  }
});

/**
 * @route   GET /api/auth/sessions
 * @desc    Get active sessions for current user
 * @access  Private
 */
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // In a real implementation, you would fetch from database
    // For now, we'll return the current session info
    const currentSession = getSession(user.sessionId);
    
    const sessions = currentSession ? [{
      id: currentSession.id.substring(0, 8) + '...',
      createdAt: currentSession.createdAt,
      lastAccessedAt: currentSession.lastAccessedAt,
      ip: currentSession.metadata.ip,
      userAgent: currentSession.metadata.userAgent,
      current: true
    }] : [];

    res.json({
      sessions,
      total: sessions.length
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve sessions',
        type: 'sessions_error',
        status: 500
      }
    });
  }
});

/**
 * @route   GET /api/auth/security-log
 * @desc    Get security events for current user (admin only)
 * @access  Admin
 */
router.get('/security-log', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          message: 'Start date and end date are required',
          type: 'validation_error',
          status: 400
        }
      });
    }

    const report = await authLogger.generateSecurityReport(startDate, endDate);
    
    res.json(report);

  } catch (error) {
    console.error('Security log error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to generate security report',
        type: 'security_log_error',
        status: 500
      }
    });
  }
});

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile with security info
 * @access  Private
 */
router.get('/profile', authenticateToken, validateSession, async (req, res) => {
  try {
    const user = req.user;
    const session = getSession(user.sessionId);
    
    res.json({
      profile: {
        id: user.id,
        email: user.email,
        role: user.role,
        verified: user.verified,
        app_metadata: user.app_metadata,
        user_metadata: user.user_metadata
      },
      security: {
        sessionCreated: session?.createdAt,
        lastActivity: session?.lastAccessedAt,
        tokenExpiration: new Date(user.exp * 1000),
        verificationLevel: user.verified ? 'verified' : 'unverified'
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve profile',
        type: 'profile_error',
        status: 500
      }
    });
  }
});

module.exports = router;
