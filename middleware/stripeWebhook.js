const Stripe = require('stripe');

/**
 * Middleware to validate Stripe webhook signatures
 */
const validateStripeWebhook = (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !endpointSecret) {
    return res.status(400).json({
      error: {
        message: 'Missing webhook signature or secret',
        type: 'webhook_error',
        status: 400
      }
    });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    // Verify the webhook signature
    const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    
    // Add the verified event to the request
    req.stripeEvent = event;
    next();
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({
      error: {
        message: 'Invalid webhook signature',
        type: 'webhook_error',
        status: 400
      }
    });
  }
};

module.exports = { validateStripeWebhook };
