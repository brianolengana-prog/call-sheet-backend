/**
 * Enhanced Stripe Routes
 * Replaces all Supabase Edge Functions with optimal backend implementation
 */

const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validateStripeWebhook } = require('../middleware/stripeWebhook');
const { portalRateLimit, stripeRateLimit } = require('../middleware/security');
const stripeService = require('../services/stripeService');
const prismaService = require('../services/prismaService');
const router = express.Router();

/**
 * POST /api/stripe/checkout
 * Create checkout session (replaces stripe-checkout Edge Function)
 */
router.post('/checkout', authenticateToken, stripeRateLimit, async (req, res) => {
  try {
    const { priceId, successUrl, cancelUrl, metadata = {} } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;
    const userName = req.user.name;

    if (!priceId) {
      return res.status(400).json({
        success: false,
        error: 'Price ID is required'
      });
    }

    const session = await stripeService.createCheckoutSession(userId, userEmail, userName, {
      priceId,
      successUrl,
      cancelUrl,
      metadata
    });

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
      amount_total: session.amount_total,
      currency: session.currency,
      customer_email: session.customer_email
    });

  } catch (error) {
    console.error('❌ Checkout session creation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create checkout session'
    });
  }
});

/**
 * POST /api/stripe/portal
 * Create customer portal session (replaces stripe-portal Edge Function)
 */
router.post('/portal', authenticateToken, portalRateLimit, async (req, res) => {
  try {
    const { returnUrl } = req.body;
    const userId = req.user.id;

    const session = await stripeService.createPortalSession(userId, returnUrl);

    res.json({
      success: true,
      url: session.url
    });

  } catch (error) {
    console.error('❌ Portal session creation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create portal session'
    });
  }
});

/**
 * GET /api/stripe/customer
 * Get customer info and subscription (replaces get-subscription-status Edge Function)
 */
router.get('/customer', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const customerInfo = await stripeService.getCustomerInfo(userId);

    res.json({
      success: true,
      ...customerInfo
    });

  } catch (error) {
    console.error('❌ Customer info retrieval error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get customer information'
    });
  }
});

/**
 * GET /api/stripe/plans
 * Get available plans (replaces plans Edge Function)
 */
router.get('/plans', optionalAuth, async (req, res) => {
  try {
    const plans = await stripeService.getAvailablePlans();

    res.json({
      success: true,
      plans: plans
    });

  } catch (error) {
    console.error('❌ Plans retrieval error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get available plans'
    });
  }
});

/**
 * PUT /api/stripe/subscription
 * Update subscription (replaces update-subscription Edge Function)
 */
router.put('/subscription', authenticateToken, async (req, res) => {
  try {
    const { subscriptionId, newPriceId } = req.body;
    const userId = req.user.id;

    if (!subscriptionId || !newPriceId) {
      return res.status(400).json({
        success: false,
        error: 'Subscription ID and new price ID are required'
      });
    }

    const result = await stripeService.updateSubscription(userId, subscriptionId, newPriceId);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Subscription update error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update subscription'
    });
  }
});

/**
 * DELETE /api/stripe/subscription
 * Cancel subscription (replaces cancel-subscription Edge Function)
 */
router.delete('/subscription', authenticateToken, async (req, res) => {
  try {
    const { subscriptionId, immediately = false } = req.body;
    const userId = req.user.id;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        error: 'Subscription ID is required'
      });
    }

    const result = await stripeService.cancelSubscription(userId, subscriptionId, immediately);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Subscription cancellation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel subscription'
    });
  }
});

/**
 * POST /api/stripe/subscription/resume
 * Resume subscription
 */
router.post('/subscription/resume', authenticateToken, async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    const userId = req.user.id;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        error: 'Subscription ID is required'
      });
    }

    const result = await stripeService.resumeSubscription(userId, subscriptionId);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Subscription resume error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to resume subscription'
    });
  }
});

/**
 * GET /api/stripe/billing-history
 * Get billing history
 */
router.get('/billing-history', authenticateToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const userId = req.user.id;

    const history = await stripeService.getBillingHistory(userId, parseInt(limit));

    res.json({
      success: true,
      history: history
    });

  } catch (error) {
    console.error('❌ Billing history retrieval error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get billing history'
    });
  }
});

/**
 * GET /api/stripe/payment-methods
 * Get payment methods
 */
router.get('/payment-methods', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const paymentMethods = await stripeService.getPaymentMethods(userId);

    res.json({
      success: true,
      paymentMethods: paymentMethods
    });

  } catch (error) {
    console.error('❌ Payment methods retrieval error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get payment methods'
    });
  }
});

/**
 * POST /api/stripe/retry-payment
 * Retry failed payment (replaces retry-payment Edge Function)
 */
router.post('/retry-payment', authenticateToken, async (req, res) => {
  try {
    const { invoiceId } = req.body;
    const userId = req.user.id;

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        error: 'Invoice ID is required'
      });
    }

    const result = await stripeService.retryPayment(userId, invoiceId);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Payment retry error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retry payment'
    });
  }
});

/**
 * GET /api/stripe/failed-payments
 * Get failed payments (replaces failed-payments Edge Function)
 */
router.get('/failed-payments', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get customer info to find failed payments
    const customerInfo = await stripeService.getCustomerInfo(userId);
    if (!customerInfo.hasSubscription) {
      return res.json({
        success: true,
        failedPayments: []
      });
    }

    // Get billing history and filter for failed payments
    const history = await stripeService.getBillingHistory(userId, 50);
    const failedPayments = history.filter(payment => payment.status === 'open' || payment.status === 'void');

    res.json({
      success: true,
      failedPayments: failedPayments
    });

  } catch (error) {
    console.error('❌ Failed payments retrieval error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get failed payments'
    });
  }
});

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhooks (replaces stripe-webhooks Edge Function)
 */
router.post('/webhook', validateStripeWebhook, async (req, res) => {
  try {
    const event = req.body;

    await stripeService.handleWebhook(event);

    res.json({
      success: true,
      received: true
    });

  } catch (error) {
    console.error('❌ Webhook handling error:', error);
    res.status(500).json({
      success: false,
      error: 'Webhook handling failed'
    });
  }
});

/**
 * POST /api/stripe/sync-plans
 * Sync plans from Stripe to database
 */
router.post('/sync-plans', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin (you can implement admin check here)
    const stripePlanSyncService = require('../services/stripePlanSyncService');
    const plans = await stripePlanSyncService.syncPlansFromStripe();

    res.json({
      success: true,
      plans: plans,
      message: `Successfully synced ${plans.length} plans from Stripe`
    });

  } catch (error) {
    console.error('❌ Plan sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync plans from Stripe'
    });
  }
});

/**
 * GET /api/stripe/subscription/usage
 * Get subscription usage and limits
 */
router.get('/subscription/usage', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get customer info
    const customerInfo = await stripeService.getCustomerInfo(userId);
    
    // Get usage from our usage service
    const usageService = require('../services/usageService');
    const usage = await usageService.getUserUsage(userId);
    const planInfo = await usageService.getUserPlanInfo(userId);

    res.json({
      success: true,
      subscription: customerInfo,
      usage: {
        uploads: {
          used: usage.uploadsUsed,
          limit: usage.uploadsLimit,
          percentage: Math.round((usage.uploadsUsed / usage.uploadsLimit) * 100)
        },
        aiMinutes: {
          used: usage.aiMinutesUsed,
          limit: usage.aiMinutesLimit,
          percentage: Math.round((usage.aiMinutesUsed / usage.aiMinutesLimit) * 100)
        },
        storage: {
          used: usage.storageUsedGB,
          limit: usage.storageLimitGB,
          percentage: Math.round((usage.storageUsedGB / usage.storageLimitGB) * 100)
        },
        apiCalls: {
          used: usage.apiCallsUsed,
          limit: planInfo.limits.apiCallsPerMonth,
          percentage: Math.round((usage.apiCallsUsed / planInfo.limits.apiCallsPerMonth) * 100)
        }
      },
      planInfo: planInfo
    });

  } catch (error) {
    console.error('❌ Subscription usage retrieval error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get subscription usage'
    });
  }
});

module.exports = router;
