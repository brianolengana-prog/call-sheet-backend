/**
 * Stripe Webhook Middleware
 * Validates Stripe webhook signatures
 */

const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

/**
 * Validate Stripe webhook signature
 */
const validateStripeWebhook = (req, res, next) => {
  try {
    const signature = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing Stripe signature'
      });
    }

    if (!webhookSecret) {
      console.warn('⚠️ STRIPE_WEBHOOK_SECRET not configured, skipping signature validation');
      return next();
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).json({
        success: false,
        error: 'Invalid signature'
      });
    }

    // Attach the verified event to the request
    req.body = event;
    next();

  } catch (error) {
    console.error('❌ Webhook validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Webhook validation failed'
    });
  }
};

module.exports = {
  validateStripeWebhook
};