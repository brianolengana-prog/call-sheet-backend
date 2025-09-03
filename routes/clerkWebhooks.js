/**
 * Clerk Webhooks Integration
 * Bridges Clerk events with our enhanced security system
 */

const express = require('express');
const { Webhook } = require('svix');
const { 
  createSession,
  invalidateUserSessions,
  generateRequestFingerprint
} = require('../utils/supabaseJWT');
const authLogger = require('../utils/authLogger');

const router = express.Router();

/**
 * @route   POST /api/clerk/webhooks
 * @desc    Handle Clerk webhook events
 * @access  Public (with webhook verification)
 */
router.post('/webhooks', express.raw({ type: 'application/json' }), async (req, res) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  
  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET is not set');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  const headers = req.headers;
  const payload = req.body;

  // Verify the webhook signature
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt;

  try {
    evt = wh.verify(payload, headers);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  const { type, data } = evt;
  const eventId = headers['svix-id'];
  const timestamp = headers['svix-timestamp'];

  console.log(`Clerk webhook received: ${type} (${eventId})`);

  try {
    switch (type) {
      case 'user.created':
        await handleUserCreated(data, req);
        break;
        
      case 'session.created':
        await handleSessionCreated(data, req);
        break;
        
      case 'session.ended':
        await handleSessionEnded(data, req);
        break;
        
      case 'user.updated':
        await handleUserUpdated(data, req);
        break;
        
      case 'session.removed':
        await handleSessionRemoved(data, req);
        break;
        
      default:
        console.log(`Unhandled webhook type: ${type}`);
    }

    // Log the webhook event
    await authLogger.logSessionEvent('webhook_received', {
      sessionId: eventId,
      userId: data.user_id || data.id,
      ip: req.ip || 'webhook',
      userAgent: req.get('User-Agent') || 'Clerk-Webhook',
      metadata: {
        eventType: type,
        timestamp,
        eventId
      }
    });

    res.status(200).json({ received: true, eventId, type });

  } catch (error) {
    console.error(`Error handling webhook ${type}:`, error);
    
    await authLogger.logSecurityIncident('webhook_error', {
      severity: 'medium',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      description: `Failed to process ${type} webhook`,
      metadata: {
        eventType: type,
        eventId,
        error: error.message
      }
    });

    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle user creation event
 */
async function handleUserCreated(userData, req) {
  const userId = userData.id;
  const email = userData.email_addresses?.[0]?.email_address;
  const provider = userData.external_accounts?.[0]?.provider || 'email';

  console.log(`New user created: ${email} (${userId}) via ${provider}`);

  // Log user creation
  await authLogger.logAuthAttempt(true, {
    ip: req.ip || 'webhook',
    userAgent: 'Clerk-Webhook',
    email: email || 'unknown',
    userId,
    path: '/clerk/webhook',
    method: 'USER_CREATED',
    duration: 0,
    provider
  });

  // Here you could:
  // 1. Create user record in your database
  // 2. Send welcome email
  // 3. Set up default preferences
  // 4. Initialize user-specific data
}

/**
 * Handle session creation event
 */
async function handleSessionCreated(sessionData, req) {
  const sessionId = sessionData.id;
  const userId = sessionData.user_id;
  
  console.log(`Session created for user ${userId}: ${sessionId}`);

  // Generate fingerprint for the session
  const fingerprint = generateRequestFingerprint(req);
  
  // Create enhanced session
  const enhancedSessionId = createSession(userId, 'clerk-webhook-session', {
    fingerprint,
    ip: req.ip || 'webhook',
    userAgent: req.get('User-Agent') || 'Clerk-Webhook',
    provider: 'clerk',
    clerkSessionId: sessionId,
    lastActivity: new Date()
  });

  console.log(`Enhanced session created: ${enhancedSessionId}`);
}

/**
 * Handle session ended event
 */
async function handleSessionEnded(sessionData, req) {
  const sessionId = sessionData.id;
  const userId = sessionData.user_id;
  
  console.log(`Session ended for user ${userId}: ${sessionId}`);

  // Log session end
  await authLogger.logSessionEvent('ended', {
    sessionId,
    userId,
    ip: req.ip || 'webhook',
    userAgent: req.get('User-Agent') || 'Clerk-Webhook',
    metadata: {
      clerkSessionId: sessionId,
      endedBy: 'clerk'
    }
  });
}

/**
 * Handle user updated event
 */
async function handleUserUpdated(userData, req) {
  const userId = userData.id;
  const email = userData.email_addresses?.[0]?.email_address;
  
  console.log(`User updated: ${email} (${userId})`);

  // Here you could:
  // 1. Sync updated user data to your database
  // 2. Update user preferences
  // 3. Log profile changes
}

/**
 * Handle session removed event
 */
async function handleSessionRemoved(sessionData, req) {
  const sessionId = sessionData.id;
  const userId = sessionData.user_id;
  
  console.log(`Session removed for user ${userId}: ${sessionId}`);

  // Invalidate any related enhanced sessions
  invalidateUserSessions(userId);

  await authLogger.logSessionEvent('removed', {
    sessionId,
    userId,
    ip: req.ip || 'webhook',
    userAgent: req.get('User-Agent') || 'Clerk-Webhook',
    metadata: {
      clerkSessionId: sessionId,
      removedBy: 'clerk'
    }
  });
}

/**
 * @route   GET /api/clerk/health
 * @desc    Health check for Clerk integration
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Clerk Webhooks',
    timestamp: new Date().toISOString(),
    webhookEndpoint: '/api/clerk/webhooks',
    requiredEnvVars: {
      CLERK_WEBHOOK_SECRET: !!process.env.CLERK_WEBHOOK_SECRET
    }
  });
});

module.exports = router;


