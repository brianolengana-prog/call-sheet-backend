/**
 * Subscription Routes
 * Handles subscription management, billing, and usage tracking
 */

const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const prismaService = require('../services/prismaService');
const { authenticateToken } = require('../middleware/auth');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Middleware to verify authentication
router.use(authenticateToken);

/**
 * GET /api/subscription/plans
 * Get all available subscription plans
 */
router.get('/plans', async (req, res) => {
  try {
    console.log('📋 Fetching subscription plans');
    
    // Get plans from database
    const plans = await prismaService.getPlans();
    
    // If no plans in database, create default plans
    if (plans.length === 0) {
      console.log('📋 No plans found, creating default plans');
      await createDefaultPlans();
      const defaultPlans = await prismaService.getPlans();
      return res.json({ success: true, plans: defaultPlans });
    }
    
    res.json({ success: true, plans });
  } catch (error) {
    console.error('❌ Error fetching plans:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch plans' });
  }
});

/**
 * GET /api/subscription/current
 * Get current user's subscription
 */
router.get('/current', async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📋 Fetching current subscription for user:', userId);
    
    const subscription = await prismaService.getUserSubscription(userId);
    
    if (!subscription) {
      return res.json({ success: true, subscription: null });
    }
    
    // Get plan details
    const plan = await prismaService.getPlanById(subscription.planId);
    
    res.json({ 
      success: true, 
      subscription: {
        ...subscription,
        plan
      }
    });
  } catch (error) {
    console.error('❌ Error fetching current subscription:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch subscription' });
  }
});

/**
 * POST /api/subscription/create
 * Create a new subscription
 */
router.post('/create', async (req, res) => {
  try {
    const { planId, paymentMethodId, trialDays } = req.body;
    const userId = req.user.id;
    
    console.log('📋 Creating subscription for user:', userId, 'plan:', planId);
    
    // Get plan details
    const plan = await prismaService.getPlanById(planId);
    if (!plan) {
      return res.status(400).json({ success: false, error: 'Invalid plan ID' });
    }
    
    // Check if user already has a subscription
    const existingSubscription = await prismaService.getUserSubscription(userId);
    if (existingSubscription) {
      return res.status(400).json({ success: false, error: 'User already has a subscription' });
    }
    
    // Create or get Stripe customer
    let customer;
    try {
      const existingCustomers = await stripe.customers.list({
        email: req.user.email,
        limit: 1
      });
      
      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
      } else {
        customer = await stripe.customers.create({
          email: req.user.email,
          name: req.user.name,
          metadata: { userId }
        });
      }
    } catch (stripeError) {
      console.error('❌ Stripe customer creation error:', stripeError);
      return res.status(500).json({ success: false, error: 'Failed to create customer' });
    }
    
    // Handle free plan
    if (plan.type === 'free') {
      const subscription = await prismaService.createSubscription({
        userId,
        planId,
        stripeCustomerId: customer.id,
        status: 'active',
        priceId: plan.stripePriceId || 'free',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        cancelAtPeriodEnd: false
      });
      
      return res.json({ 
        success: true, 
        subscription,
        message: 'Free plan activated successfully'
      });
    }
    
    // Handle paid plans
    if (!plan.stripePriceId) {
      return res.status(400).json({ success: false, error: 'Plan not configured for payments' });
    }
    
    // Create Stripe subscription
    const subscriptionData = {
      customer: customer.id,
      items: [{ price: plan.stripePriceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: { userId }
    };
    
    // Add trial if specified
    if (trialDays && trialDays > 0) {
      subscriptionData.trial_period_days = trialDays;
    }
    
    const stripeSubscription = await stripe.subscriptions.create(subscriptionData);
    
    // Create subscription in database
    const subscription = await prismaService.createSubscription({
      userId,
      planId,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: stripeSubscription.id,
      status: stripeSubscription.status,
      priceId: plan.stripePriceId,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
      trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null
    });
    
    res.json({ 
      success: true, 
      subscription,
      clientSecret: stripeSubscription.latest_invoice.payment_intent.client_secret
    });
  } catch (error) {
    console.error('❌ Error creating subscription:', error);
    res.status(500).json({ success: false, error: 'Failed to create subscription' });
  }
});

/**
 * PUT /api/subscription/update
 * Update existing subscription
 */
router.put('/update', async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.user.id;
    
    console.log('📋 Updating subscription for user:', userId, 'to plan:', planId);
    
    // Get current subscription
    const currentSubscription = await prismaService.getUserSubscription(userId);
    if (!currentSubscription) {
      return res.status(404).json({ success: false, error: 'No subscription found' });
    }
    
    // Get new plan
    const newPlan = await prismaService.getPlanById(planId);
    if (!newPlan) {
      return res.status(400).json({ success: false, error: 'Invalid plan ID' });
    }
    
    // Update Stripe subscription
    if (currentSubscription.stripeSubscriptionId) {
      const stripeSubscription = await stripe.subscriptions.retrieve(currentSubscription.stripeSubscriptionId);
      const currentItemId = stripeSubscription.items.data[0].id;
      
      await stripe.subscriptions.update(currentSubscription.stripeSubscriptionId, {
        items: [{
          id: currentItemId,
          price: newPlan.stripePriceId,
        }],
        proration_behavior: 'create_prorations',
      });
    }
    
    // Update database
    const updatedSubscription = await prismaService.updateSubscription(currentSubscription.id, {
      planId,
      priceId: newPlan.stripePriceId,
      updatedAt: new Date()
    });
    
    res.json({ success: true, subscription: updatedSubscription });
  } catch (error) {
    console.error('❌ Error updating subscription:', error);
    res.status(500).json({ success: false, error: 'Failed to update subscription' });
  }
});

/**
 * POST /api/subscription/cancel
 * Cancel subscription
 */
router.post('/cancel', async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('📋 Canceling subscription for user:', userId);
    
    const subscription = await prismaService.getUserSubscription(userId);
    if (!subscription) {
      return res.status(404).json({ success: false, error: 'No subscription found' });
    }
    
    // Cancel Stripe subscription
    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true
      });
    }
    
    // Update database
    const updatedSubscription = await prismaService.updateSubscription(subscription.id, {
      cancelAtPeriodEnd: true,
      canceledAt: new Date(),
      updatedAt: new Date()
    });
    
    res.json({ success: true, subscription: updatedSubscription });
  } catch (error) {
    console.error('❌ Error canceling subscription:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel subscription' });
  }
});

/**
 * POST /api/subscription/resume
 * Resume canceled subscription
 */
router.post('/resume', async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('📋 Resuming subscription for user:', userId);
    
    const subscription = await prismaService.getUserSubscription(userId);
    if (!subscription) {
      return res.status(404).json({ success: false, error: 'No subscription found' });
    }
    
    // Resume Stripe subscription
    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false
      });
    }
    
    // Update database
    const updatedSubscription = await prismaService.updateSubscription(subscription.id, {
      cancelAtPeriodEnd: false,
      canceledAt: null,
      updatedAt: new Date()
    });
    
    res.json({ success: true, subscription: updatedSubscription });
  } catch (error) {
    console.error('❌ Error resuming subscription:', error);
    res.status(500).json({ success: false, error: 'Failed to resume subscription' });
  }
});

/**
 * GET /api/subscription/usage
 * Get current usage
 */
router.get('/usage', async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('📋 Fetching usage for user:', userId);
    
    const usage = await prismaService.getUserUsage(userId);
    
    res.json({ success: true, usage });
  } catch (error) {
    console.error('❌ Error fetching usage:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch usage' });
  }
});

/**
 * POST /api/subscription/check-usage
 * Check if user can perform an action
 */
router.post('/check-usage', async (req, res) => {
  try {
    const { action } = req.body;
    const userId = req.user.id;
    
    console.log('📋 Checking usage for user:', userId, 'action:', action);
    
    const usage = await prismaService.getUserUsage(userId);
    const subscription = await prismaService.getUserSubscription(userId);
    
    if (!subscription) {
      return res.json({ 
        success: true, 
        canPerform: false, 
        reason: 'No active subscription found' 
      });
    }
    
    const plan = await prismaService.getPlanById(subscription.planId);
    
    let canPerform = false;
    let reason = '';
    
    switch (action) {
      case 'upload':
        canPerform = usage.uploadsUsed < usage.uploadsLimit;
        reason = canPerform ? '' : 'Upload limit reached for this month';
        break;
      case 'ai_processing':
        canPerform = usage.aiMinutesUsed < usage.aiMinutesLimit;
        reason = canPerform ? '' : 'AI processing limit reached for this month';
        break;
      case 'api_call':
        canPerform = usage.apiCalls < plan.apiCallsPerMonth;
        reason = canPerform ? '' : 'API call limit reached for this month';
        break;
      default:
        canPerform = false;
        reason = 'Unknown action';
    }
    
    res.json({ 
      success: true, 
      canPerform, 
      reason,
      usage: canPerform ? usage : null
    });
  } catch (error) {
    console.error('❌ Error checking usage:', error);
    res.status(500).json({ success: false, error: 'Failed to check usage' });
  }
});

/**
 * GET /api/subscription/billing
 * Get billing information
 */
router.get('/billing', async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('📋 Fetching billing info for user:', userId);
    
    const subscription = await prismaService.getUserSubscription(userId);
    if (!subscription) {
      return res.json({ success: true, billingInfo: null });
    }
    
    // Get Stripe customer
    const customer = await stripe.customers.retrieve(subscription.stripeCustomerId);
    
    const billingInfo = {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      address: customer.address,
      paymentMethod: customer.invoice_settings?.default_payment_method
    };
    
    res.json({ success: true, billingInfo });
  } catch (error) {
    console.error('❌ Error fetching billing info:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch billing info' });
  }
});

/**
 * GET /api/subscription/invoices
 * Get billing history
 */
router.get('/invoices', async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('📋 Fetching invoices for user:', userId);
    
    const subscription = await prismaService.getUserSubscription(userId);
    if (!subscription) {
      return res.json({ success: true, invoices: [] });
    }
    
    // Get Stripe invoices
    const invoices = await stripe.invoices.list({
      customer: subscription.stripeCustomerId,
      limit: 50
    });
    
    const formattedInvoices = invoices.data.map(invoice => ({
      id: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      paidAt: invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
      dueDate: new Date(invoice.due_date * 1000),
      periodStart: new Date(invoice.period_start * 1000),
      periodEnd: new Date(invoice.period_end * 1000),
      invoicePdf: invoice.invoice_pdf
    }));
    
    res.json({ success: true, invoices: formattedInvoices });
  } catch (error) {
    console.error('❌ Error fetching invoices:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch invoices' });
  }
});

/**
 * Create default plans if none exist
 */
async function createDefaultPlans() {
  const defaultPlans = [
    {
      name: 'Free',
      type: 'free',
      description: 'Perfect for trying out CallSheet AI',
      price: 0,
      interval: 'month',
      stripePriceId: null,
      isActive: true,
      isPopular: false,
      isEnterprise: false,
      uploadsPerMonth: 1,
      maxFileSize: 10,
      maxFilesPerUpload: 1,
      aiProcessingMinutes: 30,
      storageGB: 1,
      apiCallsPerMonth: 10,
      supportLevel: 'community',
      customBranding: false,
      advancedAnalytics: false,
      webhookSupport: false,
      ssoSupport: false
    },
    {
      name: 'Starter',
      type: 'starter',
      description: 'Great for small teams and freelancers',
      price: 2900, // $29.00
      interval: 'month',
      stripePriceId: process.env.STRIPE_STARTER_PRICE_ID,
      isActive: true,
      isPopular: true,
      isEnterprise: false,
      uploadsPerMonth: 50,
      maxFileSize: 50,
      maxFilesPerUpload: 10,
      aiProcessingMinutes: 300,
      storageGB: 10,
      apiCallsPerMonth: 1000,
      supportLevel: 'email',
      customBranding: false,
      advancedAnalytics: false,
      webhookSupport: false,
      ssoSupport: false
    },
    {
      name: 'Professional',
      type: 'professional',
      description: 'Perfect for growing businesses',
      price: 9900, // $99.00
      interval: 'month',
      stripePriceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
      isActive: true,
      isPopular: false,
      isEnterprise: false,
      uploadsPerMonth: 200,
      maxFileSize: 100,
      maxFilesPerUpload: 25,
      aiProcessingMinutes: 1000,
      storageGB: 50,
      apiCallsPerMonth: 5000,
      supportLevel: 'priority',
      customBranding: true,
      advancedAnalytics: true,
      webhookSupport: true,
      ssoSupport: false
    },
    {
      name: 'Enterprise',
      type: 'enterprise',
      description: 'For large organizations with custom needs',
      price: 29900, // $299.00
      interval: 'month',
      stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
      isActive: true,
      isPopular: false,
      isEnterprise: true,
      uploadsPerMonth: 1000,
      maxFileSize: 500,
      maxFilesPerUpload: 100,
      aiProcessingMinutes: 5000,
      storageGB: 200,
      apiCallsPerMonth: 25000,
      supportLevel: 'dedicated',
      customBranding: true,
      advancedAnalytics: true,
      webhookSupport: true,
      ssoSupport: true
    }
  ];
  
  for (const plan of defaultPlans) {
    await prismaService.createPlan(plan);
  }
  
  console.log('✅ Default plans created successfully');
}

module.exports = router;
