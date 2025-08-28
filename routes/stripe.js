const express = require('express');
const Stripe = require('stripe');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validateStripeWebhook } = require('../middleware/stripeWebhook');

const router = express.Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

/**
 * @route   POST /api/stripe/create-checkout-session
 * @desc    Create a Stripe checkout session for subscription signup
 * @access  Private
 */
router.post('/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { priceId, successUrl, cancelUrl, customerEmail, metadata = {} } = req.body;

    if (!priceId) {
      return res.status(400).json({
        error: {
          message: 'Price ID is required',
          type: 'validation_error',
          status: 400
        }
      });
    }

    // Create or retrieve Stripe customer
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: customerEmail || req.user.email,
      limit: 1
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: customerEmail || req.user.email,
        name: req.user.name || req.user.email,
        metadata: {
          userId: req.user.id,
          ...metadata
        }
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${process.env.FRONTEND_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/billing?canceled=true`,
      metadata: {
        userId: req.user.id,
        planId: metadata.planId || 'unknown',
        ...metadata
      },
      subscription_data: {
        metadata: {
          userId: req.user.id,
          planId: metadata.planId || 'unknown',
          ...metadata
        }
      }
    });

    res.json({
      id: session.id,
      url: session.url,
      amount_total: session.amount_total,
      currency: session.currency,
      customer_email: customer.email
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      error: {
        message: 'Failed to create checkout session',
        type: 'server_error',
        status: 500
      }
    });
  }
});

/**
 * @route   POST /api/stripe/create-portal-session
 * @desc    Create a Stripe customer portal session for subscription management
 * @access  Private
 */
router.post('/create-portal-session', authenticateToken, async (req, res) => {
  try {
    const { returnUrl } = req.body;

    // Get customer ID from user's subscription or create one
    let customerId = req.user.stripeCustomerId;

    if (!customerId) {
      // Try to find customer by email
      const customers = await stripe.customers.list({
        email: req.user.email,
        limit: 1
      });

      if (customers.data.length === 0) {
        return res.status(404).json({
          error: {
            message: 'No Stripe customer found',
            type: 'not_found_error',
            status: 404
          }
        });
      }
      customerId = customers.data[0].id;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${process.env.FRONTEND_URL}/billing`,
    });

    res.json({ url: session.url });

  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({
      error: {
        message: 'Failed to create portal session',
        type: 'server_error',
        status: 500
      }
    });
  }
});

/**
 * @route   GET /api/stripe/customer
 * @desc    Get customer information and subscription details
 * @access  Private
 */
router.get('/customer', authenticateToken, async (req, res) => {
  try {
    let customerId = req.user.stripeCustomerId;

    if (!customerId) {
      // Try to find customer by email
      const customers = await stripe.customers.list({
        email: req.user.email,
        limit: 1
      });

      if (customers.data.length === 0) {
        return res.status(404).json({
          error: {
            message: 'No Stripe customer found',
            type: 'not_found_error',
            status: 404
          }
        });
      }
      customerId = customers.data[0].id;
    }

    const customer = await stripe.customers.retrieve(customerId, {
      expand: ['subscriptions', 'subscriptions.data.default_payment_method']
    });

    const subscriptions = customer.subscriptions?.data || [];
    const activeSubscription = subscriptions.find(sub => 
      ['active', 'trialing', 'past_due'].includes(sub.status)
    );

    res.json({
      id: customer.id,
      email: customer.email,
      name: customer.name,
      subscription: activeSubscription ? {
        id: activeSubscription.id,
        status: activeSubscription.status,
        current_period_start: activeSubscription.current_period_start,
        current_period_end: activeSubscription.current_period_end,
        cancel_at_period_end: activeSubscription.cancel_at_period_end,
        plan: {
          id: activeSubscription.items.data[0]?.price?.id,
          name: activeSubscription.items.data[0]?.price?.nickname || 'Unknown Plan',
          amount: activeSubscription.items.data[0]?.price?.unit_amount,
          currency: activeSubscription.items.data[0]?.price?.currency,
          interval: activeSubscription.items.data[0]?.price?.recurring?.interval
        }
      } : null
    });

  } catch (error) {
    console.error('Error getting customer info:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get customer information',
        type: 'server_error',
        status: 500
      }
    });
  }
});

/**
 * @route   POST /api/stripe/cancel-subscription
 * @desc    Cancel a user's subscription
 * @access  Private
 */
router.post('/cancel-subscription', authenticateToken, async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({
        error: {
          message: 'Subscription ID is required',
          type: 'validation_error',
          status: 400
        }
      });
    }

    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true
    });

    res.json({
      success: true,
      message: 'Subscription will be canceled at the end of the current period',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end
      }
    });

  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({
      error: {
        message: 'Failed to cancel subscription',
        type: 'server_error',
        status: 500
      }
    });
  }
});

/**
 * @route   POST /api/stripe/update-subscription
 * @desc    Change a user's subscription plan
 * @access  Private
 */
router.post('/update-subscription', authenticateToken, async (req, res) => {
  try {
    const { subscriptionId, newPriceId } = req.body;

    if (!subscriptionId || !newPriceId) {
      return res.status(400).json({
        error: {
          message: 'Subscription ID and new price ID are required',
          type: 'validation_error',
          status: 400
        }
      });
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: newPriceId,
      }],
      proration_behavior: 'create_prorations',
    });

    res.json({
      success: true,
      message: 'Subscription updated successfully',
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        current_period_end: updatedSubscription.current_period_end
      }
    });

  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({
      error: {
        message: 'Failed to update subscription',
        type: 'server_error',
        status: 500
      }
    });
  }
});

/**
 * @route   GET /api/stripe/billing-history
 * @desc    Get customer billing history
 * @access  Private
 */
router.get('/billing-history', authenticateToken, async (req, res) => {
  try {
    let customerId = req.user.stripeCustomerId;

    if (!customerId) {
      const customers = await stripe.customers.list({
        email: req.user.email,
        limit: 1
      });

      if (customers.data.length === 0) {
        return res.json([]);
      }
      customerId = customers.data[0].id;
    }

    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 50
    });

    const billingHistory = invoices.data.map(invoice => ({
      id: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      created: invoice.created,
      invoice_pdf: invoice.invoice_pdf,
      description: invoice.description,
      period_start: invoice.period_start,
      period_end: invoice.period_end
    }));

    res.json(billingHistory);

  } catch (error) {
    console.error('Error getting billing history:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get billing history',
        type: 'server_error',
        status: 500
      }
    });
  }
});

/**
 * @route   GET /api/stripe/plans
 * @desc    Get available subscription plans
 * @access  Public
 */
router.get('/plans', async (req, res) => {
  try {
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product']
    });

    const plans = prices.data.map(price => {
      // Map features based on price ID if metadata is not available
      let features = [];
      if (price.product.metadata?.features) {
        try {
          features = JSON.parse(price.product.metadata.features);
        } catch (e) {
          console.warn('Failed to parse features metadata for price:', price.id);
        }
      }
      
      // If no features in metadata, map based on price ID
      if (features.length === 0) {
        if (price.id === 'price_1S12zqPbpfQlQm4ifa35bog2') {
          // Free plan
          features = ['1 free upload per month', 'Up to 50 contacts', 'Basic role filtering', 'CSV export'];
        } else if (price.id === 'price_1S12xbPbpfQlQm4ijVu9T1DJ') {
          // $199/month plan
          features = ['50 uploads per month', 'Up to 500 contacts', 'Advanced role filtering', 'Priority processing', 'Email support', 'CSV export'];
        } else if (price.id === 'price_1S12w4PbpfQlQm4iAJOHdUEy') {
          // $79.99/month plan
          features = ['200 uploads per month', 'Unlimited contacts', 'Advanced role filtering', 'Priority processing', 'Priority support', 'Advanced analytics', 'CSV export'];
        } else if (price.id === 'price_1S12qRPbpfQlQm4iwqRdSTbt') {
          // $29.99/month plan
          features = ['25 uploads per month', 'Up to 250 contacts', 'Basic role filtering', 'Standard processing', 'Email support', 'CSV export'];
        } else {
          // Default features for unknown plans
          features = ['Standard features', 'CSV export'];
        }
      }
      
      return {
        id: price.id,
        name: price.product.name,
        price: price.unit_amount,
        currency: price.currency,
        interval: price.recurring?.interval,
        features: features
      };
    });

    res.json(plans);

  } catch (error) {
    console.error('Error getting plans:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get available plans',
        type: 'server_error',
        status: 500
      }
    });
  }
});

/**
 * @route   POST /api/stripe/sync-subscription
 * @desc    Manually sync subscription status (alternative to webhooks)
 * @access  Private
 */
router.post('/sync-subscription', authenticateToken, async (req, res) => {
  try {
    // Find customer by email
    const customers = await stripe.customers.list({
      email: req.user.email,
      limit: 1
    });

    if (customers.data.length === 0) {
      return res.json({
        hasSubscription: false,
        plan: 'free',
        status: 'active'
      });
    }

    const customer = customers.data[0];
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all'
    });

    const activeSubscription = subscriptions.data.find(sub => 
      ['active', 'trialing', 'past_due'].includes(sub.status)
    );

    if (!activeSubscription) {
      return res.json({
        hasSubscription: false,
        plan: 'free',
        status: 'active'
      });
    }

    // Determine plan type from price ID or metadata
    let planType = 'unknown';
    const priceId = activeSubscription.items.data[0]?.price?.id;
    
    if (priceId) {
      if (priceId.includes('starter') || priceId.includes('basic')) {
        planType = 'starter';
      } else if (priceId.includes('professional') || priceId.includes('pro')) {
        planType = 'professional';
      } else if (priceId.includes('enterprise')) {
        planType = 'enterprise';
      }
    }

    res.json({
      hasSubscription: true,
      plan: planType,
      status: activeSubscription.status,
      subscriptionId: activeSubscription.id,
      currentPeriodEnd: activeSubscription.current_period_end,
      cancelAtPeriodEnd: activeSubscription.cancel_at_period_end
    });

  } catch (error) {
    console.error('Error syncing subscription:', error);
    res.status(500).json({
      error: {
        message: 'Failed to sync subscription',
        type: 'server_error',
        status: 500
      }
    });
  }
});

/**
 * @route   POST /api/stripe/webhook
 * @desc    Handle Stripe webhook events (optional for development)
 * @access  Public
 */
router.post('/webhook', async (req, res) => {
  // For development without webhooks, just acknowledge receipt
  console.log('Webhook received (development mode):', req.body);
  
  res.json({ 
    received: true, 
    message: 'Webhook received in development mode - no processing needed' 
  });
});

module.exports = router;
