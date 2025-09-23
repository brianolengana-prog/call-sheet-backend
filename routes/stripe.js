const express = require('express');
const Stripe = require('stripe');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validateStripeWebhook } = require('../middleware/stripeWebhook');
const { portalRateLimit } = require('../middleware/security');
const notificationService = require('../services/notificationService');

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
        success: false,
        error: 'Price ID is required'
      });
    }

    // Validate that the price ID exists in Stripe
    try {
      const price = await stripe.prices.retrieve(priceId);
      if (!price.active) {
        return res.status(400).json({
          success: false,
          error: 'Price ID is not active. Please refresh the page and try again.'
        });
      }
      console.log(`✅ Validated price ID: ${priceId} for product: ${price.product}`);
    } catch (priceError) {
      console.error('❌ Invalid price ID:', priceId, priceError.message);
      return res.status(400).json({
        success: false,
        error: 'Invalid price ID. Please refresh the page and try again.'
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
      success: true,
      id: session.id,
      url: session.url,
      amount_total: session.amount_total,
      currency: session.currency,
      customer_email: customer.email
    });

  } catch (error) {
    console.error('❌ Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session'
    });
  }
});

/**
 * @route   POST /api/stripe/create-portal-session
 * @desc    Create a Stripe customer portal session for subscription management
 * @access  Private
 */
router.post('/create-portal-session', portalRateLimit, authenticateToken, async (req, res) => {
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
    const { subscriptionId, cancelImmediately = false } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({
        error: {
          message: 'Subscription ID is required',
          type: 'validation_error',
          status: 400
        }
      });
    }

    let subscription;
    
    if (cancelImmediately) {
      // Cancel immediately
      subscription = await stripe.subscriptions.cancel(subscriptionId);
      
      console.log(`🚨 Subscription ${subscriptionId} cancelled immediately by user ${req.user.email}`);
      
      res.json({
        success: true,
        message: 'Subscription has been canceled immediately',
        subscription: {
          id: subscription.id,
          status: subscription.status,
          canceled_at: subscription.canceled_at,
          cancel_at_period_end: false
        }
      });
    } else {
      // Cancel at period end (default behavior)
      subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
      
      console.log(`⏰ Subscription ${subscriptionId} will be cancelled at period end by user ${req.user.email}`);
      
      res.json({
        success: true,
        message: 'Subscription will be canceled at the end of the current period',
        subscription: {
          id: subscription.id,
          status: subscription.status,
          cancel_at_period_end: subscription.cancel_at_period_end,
          current_period_end: subscription.current_period_end
        }
      });
    }

  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({
      error: {
        message: 'Failed to cancel subscription',
        type: 'server_error',
        status: 500,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
 * @route   GET /api/stripe/payment-methods
 * @desc    Get customer payment methods
 * @access  Private
 */
router.get('/payment-methods', authenticateToken, async (req, res) => {
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

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });

    const methods = paymentMethods.data.map(method => ({
      id: method.id,
      type: method.type,
      card: {
        brand: method.card.brand,
        last4: method.card.last4,
        exp_month: method.card.exp_month,
        exp_year: method.card.exp_year
      },
      is_default: false // This would need to be determined from customer's default payment method
    }));

    res.json(methods);

  } catch (error) {
    console.error('Error getting payment methods:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get payment methods',
        type: 'server_error',
        status: 500
      }
    });
  }
});

/**
 * @route   GET /api/stripe/health
 * @desc    Health check endpoint for CORS testing
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Stripe API',
    cors: {
      origin: req.headers.origin || 'No origin header',
      userAgent: req.headers['user-agent'] || 'No user agent',
      method: req.method,
      headers: req.headers
    }
  });
});

/**
 * @route   GET /api/stripe/plans
 * @desc    Get available subscription plans
 * @access  Public
 */
router.get('/plans', async (req, res) => {
  try {
    console.log('🔄 Fetching plans from Stripe...');
    
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product']
    });

    console.log(`📦 Found ${prices.data.length} prices from Stripe`);

    const plans = prices.data.map(price => {
      // Map features based on price ID if metadata is not available
      let features = [];
      let planId = price.id; // Use price ID as plan ID
      let uploadsPerMonth = 1;
      let maxContacts = 50;
      let aiProcessingMinutes = 0;
      let storageGB = 1;
      let apiCallsPerMonth = 100;
      let supportLevel = 'Email';
      let isPopular = false;
      
      if (price.product.metadata?.features) {
        try {
          features = JSON.parse(price.product.metadata.features);
        } catch (e) {
          console.warn('Failed to parse features metadata for price:', price.id);
        }
      }
      
      // If no features in metadata, map based on price ID
      if (features.length === 0) {
        if (price.id === 'price_1S3fHn6NEzYIXIMoL50vVpQr') {
          // Free plan
          planId = 'free';
          features = ['1 free upload per month', 'Up to 50 contacts', 'Basic role filtering', 'CSV export'];
          uploadsPerMonth = 1;
          maxContacts = 50;
          supportLevel = 'Email';
        } else if (price.id === 'price_1S12xbPbpfQlQm4ijVu9T1DJ') {
          // $199/month plan - Enterprise
          planId = 'enterprise';
          features = ['Unlimited uploads', 'Unlimited contacts', 'Advanced role filtering', 'Priority processing', 'Dedicated support', 'Advanced analytics', 'CSV export'];
          uploadsPerMonth = -1;
          maxContacts = -1;
          supportLevel = 'Dedicated';
          isPopular = true;
        } else if (price.id === 'price_1S3fJQ6NEzYIXIMorYYqfFpW') {
          // $79.99/month plan - Professional
          planId = 'professional';
          features = ['200 uploads per month', 'Unlimited contacts', 'Advanced role filtering', 'Priority processing', 'Priority support', 'Advanced analytics', 'CSV export'];
          uploadsPerMonth = 200;
          maxContacts = -1;
          supportLevel = 'Priority';
          isPopular = true;
        } else if (price.id === 'price_1S3fG16NEzYIXIModekCNdYT') {
          // $29.99/month plan - Starter
          planId = 'starter';
          features = ['50 uploads per month', 'Up to 500 contacts', 'Advanced role filtering', 'Priority processing', 'Email support', 'CSV export'];
          uploadsPerMonth = 50;
          maxContacts = 500;
          supportLevel = 'Email';
        } else {
          // Default features for unknown plans
          features = ['Standard features', 'CSV export'];
        }
      }
      
      return {
        id: planId,
        name: price.product.name,
        price: price.unit_amount,
        currency: price.currency,
        interval: price.recurring?.interval || 'month',
        stripePriceId: price.id,
        features: features,
        uploadsPerMonth: uploadsPerMonth,
        maxContacts: maxContacts,
        aiProcessingMinutes: aiProcessingMinutes,
        storageGB: storageGB,
        apiCallsPerMonth: apiCallsPerMonth,
        supportLevel: supportLevel,
        isPopular: isPopular,
        description: price.product.description || ''
      };
    });

    console.log(`✅ Returning ${plans.length} plans to frontend`);
    
    res.json({
      success: true,
      plans: plans
    });

  } catch (error) {
    console.error('❌ Error getting plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get available plans',
      plans: []
    });
  }
});

/**
 * @route   POST /api/stripe/activate-free-plan
 * @desc    Activate free plan for user (no payment required)
 * @access  Private
 */
router.post('/activate-free-plan', authenticateToken, async (req, res) => {
  try {
    const { planId } = req.body;

    if (!planId || planId !== 'free') {
      return res.status(400).json({
        error: {
          message: 'Invalid plan ID for free plan activation',
          type: 'validation_error',
          status: 400
        }
      });
    }

    console.log('🆓 Free plan activation request:', {
      userId: req.user.id,
      email: req.user.email,
      planId: planId,
      timestamp: new Date().toISOString()
    });

    // Here you would typically update the user's plan in your database
    // For now, we'll just return success since free plans don't require Stripe integration
    
    // TODO: Update user's plan in your database
    // Example: await updateUserPlanInDatabase(req.user.id, 'free');

    res.json({
      success: true,
      message: 'Free plan activated successfully',
      plan: {
        id: 'free',
        name: 'Free Plan',
        price: 0,
        features: [
          '1 upload per month',
          'Up to 50 contacts',
          'Basic contact extraction',
          'Email support'
        ]
      }
    });

  } catch (error) {
    console.error('Error activating free plan:', error);
    res.status(500).json({
      error: {
        message: 'Failed to activate free plan',
        type: 'server_error',
        status: 500
      }
    });
  }
});

/**
 * @route   POST /api/stripe/retry-payment
 * @desc    Retry a failed payment
 * @access  Private
 */
router.post('/retry-payment', authenticateToken, async (req, res) => {
  try {
    const { invoiceId } = req.body;

    if (!invoiceId) {
      return res.status(400).json({
        error: {
          message: 'Invoice ID is required',
          type: 'validation_error',
          status: 400
        }
      });
    }

    console.log('🔄 Retry payment request:', {
      invoiceId,
      userId: req.user?.id,
      email: req.user?.email,
      timestamp: new Date().toISOString()
    });

    // Get the invoice from Stripe
    const invoice = await stripe.invoices.retrieve(invoiceId);
    
    // Verify the invoice belongs to the user
    const customer = await stripe.customers.retrieve(invoice.customer);
    if (customer.metadata?.userId !== req.user.id) {
      return res.status(403).json({
        error: {
          message: 'Access denied to this invoice',
          type: 'authorization_error',
          status: 403
        }
      });
    }

    // Create a new payment intent for the invoice
    const paymentIntent = await stripe.paymentIntents.create({
      amount: invoice.amount_due,
      currency: invoice.currency,
      customer: customer.id,
      description: `Retry payment for ${invoice.lines.data[0]?.description || 'subscription'}`,
      metadata: {
        userId: req.user.id,
        invoiceId: invoice.id,
        retryAttempt: true
      }
    });

    // Create a checkout session for payment retry
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: invoice.currency,
          product_data: {
            name: `Retry Payment - ${invoice.lines.data[0]?.description || 'Subscription'}`,
          },
          unit_amount: invoice.amount_due,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/billing?retry_success=true&invoice=${invoice.id}`,
      cancel_url: `${process.env.FRONTEND_URL}/billing?retry_canceled=true&invoice=${invoice.id}`,
      metadata: {
        userId: req.user.id,
        invoiceId: invoice.id,
        type: 'payment_retry'
      }
    });

    console.log('✅ Payment retry session created:', session.id);

    res.json({
      id: session.id,
      url: session.url,
      amount_total: session.amount_total,
      currency: session.currency,
      invoiceId: invoice.id
    });

  } catch (error) {
    console.error('❌ Error creating payment retry session:', error);
    res.status(500).json({
      error: {
        message: 'Failed to create payment retry session',
        type: 'server_error',
        status: 500,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
});

/**
 * @route   GET /api/stripe/failed-payments
 * @desc    Get failed payments for the current user
 * @access  Private
 */
router.get('/failed-payments', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Getting failed payments for user:', req.user?.id);

    // Find customer by email
    const customers = await stripe.customers.list({
      email: req.user.email,
      limit: 1
    });

    if (customers.data.length === 0) {
      return res.json([]);
    }

    const customer = customers.data[0];
    
    // Get failed invoices
    const invoices = await stripe.invoices.list({
      customer: customer.id,
      status: 'open',
      limit: 10
    });

    const failedPayments = invoices.data
      .filter(invoice => invoice.amount_due > 0)
      .map(invoice => ({
        id: invoice.id,
        amount: invoice.amount_due,
        currency: invoice.currency,
        description: invoice.lines.data[0]?.description || 'Subscription payment',
        failureReason: invoice.last_payment_error?.message,
        failureCode: invoice.last_payment_error?.code,
        created: invoice.created,
        dueDate: invoice.due_date,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf
      }));

    console.log(`📋 Found ${failedPayments.length} failed payments for ${req.user.email}`);

    res.json(failedPayments);

  } catch (error) {
    console.error('❌ Error getting failed payments:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get failed payments',
        type: 'server_error',
        status: 500,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
    console.log('🔄 Sync subscription request from user:', {
      userId: req.user?.id,
      email: req.user?.email,
      timestamp: new Date().toISOString()
    });

    // Validate user data
    if (!req.user || !req.user.email) {
      console.error('❌ No user data in request');
      return res.status(401).json({
        error: {
          message: 'User authentication data missing',
          type: 'authentication_error',
          status: 401
        }
      });
    }

    // Find customer by email
    const customers = await stripe.customers.list({
      email: req.user.email,
      limit: 1
    });

    console.log(`🔍 Found ${customers.data.length} customers for email: ${req.user.email}`);

    if (customers.data.length === 0) {
      console.log('📝 No Stripe customer found, returning free plan');
      return res.json({
        hasSubscription: false,
        plan: 'free',
        status: 'active'
      });
    }

    const customer = customers.data[0];
    console.log(`👤 Found customer: ${customer.id}`);
    
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all'
    });

    console.log(`📋 Found ${subscriptions.data.length} subscriptions for customer`);

    const activeSubscription = subscriptions.data.find(sub => 
      ['active', 'trialing', 'past_due'].includes(sub.status)
    );

    if (!activeSubscription) {
      console.log('📝 No active subscription found, returning free plan');
      return res.json({
        hasSubscription: false,
        plan: 'free',
        status: 'active'
      });
    }

    // Determine plan type from price ID or metadata
    let planType = 'unknown';
    const priceId = activeSubscription.items.data[0]?.price?.id;
    
    console.log(`💳 Active subscription found: ${activeSubscription.id}, price ID: ${priceId}`);
    
    if (priceId) {
      if (priceId.includes('starter') || priceId.includes('basic')) {
        planType = 'starter';
      } else if (priceId.includes('professional') || priceId.includes('pro')) {
        planType = 'professional';
      } else if (priceId.includes('enterprise')) {
        planType = 'enterprise';
      }
    }

    const result = {
      hasSubscription: true,
      plan: planType,
      status: activeSubscription.status,
      subscriptionId: activeSubscription.id,
      currentPeriodEnd: activeSubscription.current_period_end,
      cancelAtPeriodEnd: activeSubscription.cancel_at_period_end
    };

    console.log('✅ Sync subscription result:', result);
    res.json(result);

  } catch (error) {
    console.error('❌ Error syncing subscription:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      email: req.user?.email,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      error: {
        message: 'Failed to sync subscription',
        type: 'server_error',
        status: 500,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
});

// Webhook idempotency tracking
const webhookIdempotency = new Map();

/**
 * Process webhook with retry logic and idempotency
 */
async function processWebhookWithRetry(event, maxRetries = 3) {
  const key = `${event.id}_${event.type}`;
  
  // Check if webhook was already processed
  if (webhookIdempotency.has(key)) {
    const cached = webhookIdempotency.get(key);
    console.log(`✅ Webhook ${event.id} already processed at ${new Date(cached.timestamp).toISOString()}`);
    return { processed: true, fromCache: true, timestamp: cached.timestamp };
  }
  
  // Process with retry logic
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Processing webhook ${event.id} (attempt ${attempt}/${maxRetries})`);
      await processWebhookEvent(event);
      
      // Mark as processed
      webhookIdempotency.set(key, { 
        processed: true, 
        timestamp: Date.now(),
        attempt 
      });
      
      console.log(`✅ Webhook ${event.id} processed successfully on attempt ${attempt}`);
      return { processed: true, attempt, timestamp: Date.now() };
      
    } catch (error) {
      console.error(`❌ Webhook ${event.id} attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        console.error(`💥 Webhook ${event.id} failed after ${maxRetries} attempts`);
        throw error;
      }
      
      // Exponential backoff
      const delay = 1000 * Math.pow(2, attempt - 1);
      console.log(`⏳ Retrying webhook ${event.id} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Process individual webhook event
 */
async function processWebhookEvent(event) {
  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object);
      break;
      
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object);
      break;
      
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;
      
    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object);
      break;
      
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
      
    case 'invoice.payment_action_required':
      await handlePaymentActionRequired(event.data.object);
      break;
      
    case 'customer.subscription.past_due':
      await handleSubscriptionPastDue(event.data.object);
      break;
      
    case 'customer.subscription.trial_will_end':
      await handleTrialWillEnd(event.data.object);
      break;
      
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;
      
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object);
      break;
      
    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event.data.object);
      break;
      
    case 'invoice.upcoming':
      await handleInvoiceUpcoming(event.data.object);
      break;
      
    default:
      console.log(`⚠️ Unhandled webhook event type: ${event.type}`);
  }
}

/**
 * @route   POST /api/stripe/webhook
 * @desc    Handle Stripe webhook events for real-time subscription updates
 * @access  Public
 */
router.post('/webhook', validateStripeWebhook, async (req, res) => {
  const event = req.stripeEvent;
  
  console.log(`🔔 Webhook received: ${event.type}`, {
    id: event.id,
    type: event.type,
    created: new Date(event.created * 1000).toISOString()
  });

  try {
    const result = await processWebhookWithRetry(event);
    
    res.json({ 
      received: true,
      processed: result.processed,
      fromCache: result.fromCache || false,
      attempt: result.attempt,
      timestamp: result.timestamp
    });
    
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ 
      error: 'Webhook processing failed',
      message: error.message,
      webhookId: event.id,
      webhookType: event.type
    });
  }
});

// Webhook Event Handlers
async function handleSubscriptionCreated(subscription) {
  console.log('✅ Subscription created:', subscription.id);
  
  try {
    // Get customer info
    const customer = await stripe.customers.retrieve(subscription.customer);
    
    // Determine plan type from price ID
    const priceId = subscription.items.data[0]?.price?.id;
    const planType = getPlanTypeFromPriceId(priceId);
    
    // Update user subscription in database
    await updateUserSubscription({
      userId: customer.metadata?.userId,
      customerEmail: customer.email,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      planId: planType,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });
    
    console.log(`✅ User ${customer.email} subscription created: ${planType}`);
    
  } catch (error) {
    console.error('❌ Error handling subscription created:', error);
    throw error;
  }
}

async function handleSubscriptionUpdated(subscription) {
  console.log('🔄 Subscription updated:', subscription.id);
  
  try {
    const customer = await stripe.customers.retrieve(subscription.customer);
    const priceId = subscription.items.data[0]?.price?.id;
    const planType = getPlanTypeFromPriceId(priceId);
    
    await updateUserSubscription({
      userId: customer.metadata?.userId,
      customerEmail: customer.email,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      planId: planType,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });
    
    console.log(`✅ User ${customer.email} subscription updated: ${planType}`);
    
  } catch (error) {
    console.error('❌ Error handling subscription updated:', error);
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription) {
  console.log('❌ Subscription deleted:', subscription.id);
  
  try {
    const customer = await stripe.customers.retrieve(subscription.customer);
    
    await updateUserSubscription({
      userId: customer.metadata?.userId,
      customerEmail: customer.email,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      planId: 'free',
      status: 'canceled',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false
    });
    
    console.log(`✅ User ${customer.email} subscription canceled`);
    
  } catch (error) {
    console.error('❌ Error handling subscription deleted:', error);
    throw error;
  }
}

async function handlePaymentSucceeded(invoice) {
  console.log('💰 Payment succeeded:', invoice.id);
  
  try {
    const customer = await stripe.customers.retrieve(invoice.customer);
    
    // Record successful payment
    await recordPayment({
      userId: customer.metadata?.userId,
      customerEmail: customer.email,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: 'succeeded',
      description: `Payment for ${invoice.lines.data[0]?.description || 'subscription'}`
    });
    
    console.log(`✅ Payment recorded for ${customer.email}: $${invoice.amount_paid / 100}`);
    
  } catch (error) {
    console.error('❌ Error handling payment succeeded:', error);
    throw error;
  }
}

async function handlePaymentFailed(invoice) {
  console.log('💳 Payment failed:', invoice.id);
  
  try {
    const customer = await stripe.customers.retrieve(invoice.customer);
    
    // Record failed payment with detailed error information
    await recordPayment({
      userId: customer.metadata?.userId,
      customerEmail: customer.email,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_due,
      currency: invoice.currency,
      status: 'failed',
      description: `Failed payment for ${invoice.lines.data[0]?.description || 'subscription'}`,
      failureReason: invoice.last_payment_error?.message,
      failureCode: invoice.last_payment_error?.code,
      failureType: invoice.last_payment_error?.type,
      metadata: {
        invoiceId: invoice.id,
        customerId: customer.id,
        failureDetails: invoice.last_payment_error
      }
    });
    
    // Update subscription status if needed
    if (invoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      if (subscription.status === 'past_due') {
        await updateUserSubscription({
          userId: customer.metadata?.userId,
          customerEmail: customer.email,
          stripeCustomerId: customer.id,
          stripeSubscriptionId: subscription.id,
          planId: getPlanTypeFromPriceId(subscription.items.data[0]?.price?.id),
          status: 'past_due',
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end
        });
      }
    }
    
    // Send notification email to user
    await notificationService.sendPaymentFailureNotification(customer.email, {
      amount: invoice.amount_due,
      failureReason: invoice.last_payment_error?.message,
      retryUrl: `${process.env.FRONTEND_URL}/billing?retry_payment=${invoice.id}`
    });
    
    console.log(`⚠️ Payment failed for ${customer.email}: $${invoice.amount_due / 100} - ${invoice.last_payment_error?.message}`);
    
  } catch (error) {
    console.error('❌ Error handling payment failed:', error);
    throw error;
  }
}

async function handleTrialWillEnd(subscription) {
  console.log('⏰ Trial will end:', subscription.id);
  
  try {
    const customer = await stripe.customers.retrieve(subscription.customer);
    
    // Send trial ending notification email
    await notificationService.sendTrialEndingNotification(customer.email, {
      daysLeft: Math.ceil((subscription.trial_end - Date.now() / 1000) / (24 * 60 * 60)),
      upgradeUrl: `${process.env.FRONTEND_URL}/billing`
    });
    
    console.log(`⏰ Trial ending soon for ${customer.email}`);
    
  } catch (error) {
    console.error('❌ Error handling trial will end:', error);
    throw error;
  }
}

async function handleCheckoutCompleted(session) {
  console.log('🛒 Checkout completed:', session.id);
  
  try {
    // This is handled by subscription.created, but we can log it
    console.log(`🛒 Checkout completed for session: ${session.id}`);
    
  } catch (error) {
    console.error('❌ Error handling checkout completed:', error);
    throw error;
  }
}

async function handlePaymentActionRequired(invoice) {
  console.log('⚠️ Payment action required:', invoice.id);
  
  try {
    const customer = await stripe.customers.retrieve(invoice.customer);
    
    // Record the payment action required event
    await recordPayment({
      userId: customer.metadata?.userId,
      customerEmail: customer.email,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_due,
      currency: invoice.currency,
      status: 'action_required',
      description: `Payment action required for ${invoice.lines.data[0]?.description || 'subscription'}`,
      failureReason: invoice.last_payment_error?.message,
      failureCode: invoice.last_payment_error?.code
    });
    
    // Send notification email to user about required action
    await notificationService.sendPaymentActionRequiredNotification(customer.email, {
      amount: invoice.amount_due,
      failureReason: invoice.last_payment_error?.message,
      actionUrl: `${process.env.FRONTEND_URL}/billing?action_required=${invoice.id}`
    });
    
    console.log(`⚠️ Payment action required for ${customer.email}: $${invoice.amount_due / 100}`);
    
  } catch (error) {
    console.error('❌ Error handling payment action required:', error);
    throw error;
  }
}

async function handleSubscriptionPastDue(subscription) {
  console.log('🚨 Subscription past due:', subscription.id);
  
  try {
    const customer = await stripe.customers.retrieve(subscription.customer);
    
    // Update subscription status to past_due
    await updateUserSubscription({
      userId: customer.metadata?.userId,
      customerEmail: customer.email,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      planId: getPlanTypeFromPriceId(subscription.items.data[0]?.price?.id),
      status: 'past_due',
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });
    
    // Send urgent notification email
    await notificationService.sendPaymentFailureNotification(customer.email, {
      amount: 0, // We don't have the specific amount here
      failureReason: 'Subscription is past due',
      retryUrl: `${process.env.FRONTEND_URL}/billing`
    });
    
    console.log(`🚨 Subscription past due for ${customer.email}`);
    
  } catch (error) {
    console.error('❌ Error handling subscription past due:', error);
    throw error;
  }
}

async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log('💳 Payment intent succeeded:', paymentIntent.id);
  
  try {
    // This is typically handled by invoice.payment_succeeded, but we can log it
    console.log(`💳 Payment intent succeeded: ${paymentIntent.id}, amount: $${paymentIntent.amount / 100}`);
    
  } catch (error) {
    console.error('❌ Error handling payment intent succeeded:', error);
    throw error;
  }
}

async function handlePaymentIntentFailed(paymentIntent) {
  console.log('💳 Payment intent failed:', paymentIntent.id);
  
  try {
    const customer = await stripe.customers.retrieve(paymentIntent.customer);
    
    // Record failed payment intent
    await recordPayment({
      userId: customer.metadata?.userId,
      customerEmail: customer.email,
      stripeInvoiceId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'failed',
      description: `Failed payment intent: ${paymentIntent.description || 'subscription payment'}`,
      failureReason: paymentIntent.last_payment_error?.message,
      failureCode: paymentIntent.last_payment_error?.code
    });
    
    console.log(`💳 Payment intent failed for ${customer.email}: $${paymentIntent.amount / 100}`);
    
  } catch (error) {
    console.error('❌ Error handling payment intent failed:', error);
    throw error;
  }
}

async function handleInvoiceUpcoming(invoice) {
  console.log('📅 Invoice upcoming:', invoice.id);
  
  try {
    const customer = await stripe.customers.retrieve(invoice.customer);
    
    // TODO: Send upcoming invoice notification
    console.log(`📅 Upcoming invoice for ${customer.email}: $${invoice.amount_due / 100} due ${new Date(invoice.period_end * 1000).toLocaleDateString()}`);
    
  } catch (error) {
    console.error('❌ Error handling invoice upcoming:', error);
    throw error;
  }
}

// Helper function to determine plan type from Stripe price ID
function getPlanTypeFromPriceId(priceId) {
  if (!priceId) return 'free';
  
  // Map your actual Stripe price IDs to plan types (updated with correct IDs)
  if (priceId === 'price_1S3fHn6NEzYIXIMoL50vVpQr') return 'free';
  if (priceId === 'price_1S3fG16NEzYIXIModekCNdYT') return 'starter';
  if (priceId === 'price_1S3fJQ6NEzYIXIMorYYqfFpW') return 'professional';
  if (priceId === 'price_1S12xbPbpfQlQm4ijVu9T1DJ') return 'enterprise';
  
  return 'unknown';
}

// Import database utility functions
const { updateUserSubscription, recordPayment } = require('../utils/database');

module.exports = router;
