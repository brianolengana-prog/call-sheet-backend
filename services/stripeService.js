/**
 * Enhanced Stripe Service
 * Handles all Stripe operations with optimal user experience
 */

const Stripe = require('stripe');
const prismaService = require('./prismaService');

class StripeService {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }

  /**
   * Create or retrieve Stripe customer
   */
  async getOrCreateCustomer(userId, userEmail, userName = null) {
    try {
      // First, check if we have a customer in our database
      const existingCustomer = await prismaService.getStripeCustomerByUserId(userId);
      if (existingCustomer) {
        // Verify customer still exists in Stripe
        try {
          const stripeCustomer = await this.stripe.customers.retrieve(existingCustomer.stripeCustomerId);
          return stripeCustomer;
        } catch (error) {
          console.warn(`Stripe customer ${existingCustomer.stripeCustomerId} not found, creating new one`);
        }
      }

      // Check if customer exists in Stripe by email
      const existingCustomers = await this.stripe.customers.list({
        email: userEmail,
        limit: 1
      });

      let customer;
      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
        // Update our database with the customer info
        await prismaService.createOrUpdateStripeCustomer({
          userId,
          stripeCustomerId: customer.id,
          email: customer.email,
          name: customer.name
        });
      } else {
        // Create new customer
        customer = await this.stripe.customers.create({
          email: userEmail,
          name: userName,
          metadata: {
            userId: userId
          }
        });

        // Store in our database
        await prismaService.createOrUpdateStripeCustomer({
          userId,
          stripeCustomerId: customer.id,
          email: customer.email,
          name: customer.name
        });
      }

      return customer;
    } catch (error) {
      console.error('❌ Error getting/creating Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Create checkout session for subscription
   */
  async createCheckoutSession(userId, userEmail, userName, params) {
    try {
      const { priceId, successUrl, cancelUrl, metadata = {} } = params;

      if (!priceId) {
        throw new Error('Price ID is required');
      }

      // Verify price exists
      try {
        await this.stripe.prices.retrieve(priceId);
      } catch (error) {
        throw new Error('Invalid price ID. Please refresh the page and try again.');
      }

      // Get or create customer
      const customer = await this.getOrCreateCustomer(userId, userEmail, userName);

      // Create checkout session
      const session = await this.stripe.checkout.sessions.create({
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
          userId: userId,
          planId: metadata.planId || 'unknown',
          ...metadata
        },
        subscription_data: {
          metadata: {
            userId: userId,
            planId: metadata.planId || 'unknown',
            ...metadata
          }
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        tax_id_collection: {
          enabled: true,
        }
      });

      return {
        id: session.id,
        url: session.url,
        amount_total: session.amount_total,
        currency: session.currency,
        customer_email: customer.email
      };
    } catch (error) {
      console.error('❌ Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Create customer portal session
   */
  async createPortalSession(userId, returnUrl) {
    try {
      // Get customer from our database
      const customer = await prismaService.getStripeCustomerByUserId(userId);
      if (!customer) {
        throw new Error('No Stripe customer found. Please create a subscription first.');
      }

      // Create portal session
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customer.stripeCustomerId,
        return_url: returnUrl || `${process.env.FRONTEND_URL}/billing`
      });

      return {
        url: session.url
      };
    } catch (error) {
      console.error('❌ Error creating portal session:', error);
      throw error;
    }
  }

  /**
   * Get customer information and subscription
   */
  async getCustomerInfo(userId) {
    try {
      let customer;
      try {
        customer = await prismaService.getStripeCustomerByUserId(userId);
      } catch (dbError) {
        console.error('❌ Database error in getCustomerInfo:', dbError);
        // Fallback: return free plan if database is unavailable
        return {
          hasSubscription: false,
          plan: 'free',
          status: 'inactive',
          error: 'Database temporarily unavailable'
        };
      }
      
      if (!customer) {
        return {
          hasSubscription: false,
          plan: 'free',
          status: 'inactive'
        };
      }

      // Get subscription from Stripe
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customer.stripeCustomerId,
        status: 'all',
        limit: 1
      });

      if (subscriptions.data.length === 0) {
        return {
          hasSubscription: false,
          plan: 'free',
          status: 'inactive'
        };
      }

      const subscription = subscriptions.data[0];
      const priceId = subscription.items.data[0].price.id;
      
      // Get plan from our database
      const plan = await prismaService.getPlanByStripePriceId(priceId);
      
      return {
        hasSubscription: true,
        plan: plan?.id || 'unknown',
        planName: plan?.name || 'Unknown Plan',
        status: subscription.status,
        subscriptionId: subscription.id,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        priceId: priceId,
        customer: {
          id: customer.stripeCustomerId,
          email: customer.email,
          name: customer.name
        }
      };
    } catch (error) {
      console.error('❌ Error getting customer info:', error);
      throw error;
    }
  }

  /**
   * Update subscription (change plan)
   */
  async updateSubscription(userId, subscriptionId, newPriceId) {
    try {
      // Verify subscription belongs to user
      const customer = await prismaService.getStripeCustomerByUserId(userId);
      if (!customer) {
        throw new Error('No Stripe customer found');
      }

      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      if (subscription.customer !== customer.stripeCustomerId) {
        throw new Error('Subscription not found or unauthorized');
      }

      // Get current subscription item
      const currentItem = subscription.items.data[0];
      
      // Update subscription
      const updatedSubscription = await this.stripe.subscriptions.update(subscriptionId, {
        items: [{
          id: currentItem.id,
          price: newPriceId,
        }],
        proration_behavior: 'create_prorations',
        metadata: {
          ...subscription.metadata,
          planId: newPriceId
        }
      });

      // Update our database
      const plan = await prismaService.getPlanByStripePriceId(newPriceId);
      if (plan) {
        await prismaService.updateSubscription(subscriptionId, {
          planId: plan.id,
          status: updatedSubscription.status,
          currentPeriodStart: new Date(updatedSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end
        });
      }

      return {
        success: true,
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          currentPeriodStart: updatedSubscription.current_period_start,
          currentPeriodEnd: updatedSubscription.current_period_end,
          cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end
        }
      };
    } catch (error) {
      console.error('❌ Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId, subscriptionId, immediately = false) {
    try {
      // Verify subscription belongs to user
      const customer = await prismaService.getStripeCustomerByUserId(userId);
      if (!customer) {
        throw new Error('No Stripe customer found');
      }

      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      if (subscription.customer !== customer.stripeCustomerId) {
        throw new Error('Subscription not found or unauthorized');
      }

      let updatedSubscription;
      if (immediately) {
        // Cancel immediately
        updatedSubscription = await this.stripe.subscriptions.cancel(subscriptionId);
      } else {
        // Cancel at period end
        updatedSubscription = await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true
        });
      }

      // Update our database
      await prismaService.updateSubscription(subscriptionId, {
        status: updatedSubscription.status,
        cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
        canceledAt: immediately ? new Date() : null
      });

      return {
        success: true,
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
          canceledAt: immediately ? new Date() : null
        }
      };
    } catch (error) {
      console.error('❌ Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Resume subscription
   */
  async resumeSubscription(userId, subscriptionId) {
    try {
      // Verify subscription belongs to user
      const customer = await prismaService.getStripeCustomerByUserId(userId);
      if (!customer) {
        throw new Error('No Stripe customer found');
      }

      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      if (subscription.customer !== customer.stripeCustomerId) {
        throw new Error('Subscription not found or unauthorized');
      }

      // Resume subscription
      const updatedSubscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false
      });

      // Update our database
      await prismaService.updateSubscription(subscriptionId, {
        status: updatedSubscription.status,
        cancelAtPeriodEnd: false,
        canceledAt: null
      });

      return {
        success: true,
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          cancelAtPeriodEnd: false
        }
      };
    } catch (error) {
      console.error('❌ Error resuming subscription:', error);
      throw error;
    }
  }

  /**
   * Get billing history
   */
  async getBillingHistory(userId, limit = 10) {
    try {
      const customer = await prismaService.getStripeCustomerByUserId(userId);
      if (!customer) {
        return [];
      }

      // Get invoices from Stripe
      const invoices = await this.stripe.invoices.list({
        customer: customer.stripeCustomerId,
        limit: limit
      });

      return invoices.data.map(invoice => ({
        id: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status,
        created: invoice.created,
        invoiceUrl: invoice.invoice_pdf,
        description: invoice.description || `Invoice for ${new Date(invoice.created * 1000).toLocaleDateString()}`,
        periodStart: invoice.period_start,
        periodEnd: invoice.period_end
      }));
    } catch (error) {
      console.error('❌ Error getting billing history:', error);
      throw error;
    }
  }

  /**
   * Get payment methods
   */
  async getPaymentMethods(userId) {
    try {
      const customer = await prismaService.getStripeCustomerByUserId(userId);
      if (!customer) {
        return [];
      }

      // Get payment methods from Stripe
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customer.stripeCustomerId,
        type: 'card'
      });

      return paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year
        },
        isDefault: false // Stripe doesn't have a default flag, we'd need to track this separately
      }));
    } catch (error) {
      console.error('❌ Error getting payment methods:', error);
      throw error;
    }
  }

  /**
   * Retry failed payment
   */
  async retryPayment(userId, invoiceId) {
    try {
      const customer = await prismaService.getStripeCustomerByUserId(userId);
      if (!customer) {
        throw new Error('No Stripe customer found');
      }

      // Get invoice and verify it belongs to customer
      const invoice = await this.stripe.invoices.retrieve(invoiceId);
      if (invoice.customer !== customer.stripeCustomerId) {
        throw new Error('Invoice not found or unauthorized');
      }

      // Retry payment
      const updatedInvoice = await this.stripe.invoices.pay(invoiceId);

      return {
        success: true,
        invoice: {
          id: updatedInvoice.id,
          status: updatedInvoice.status,
          amountPaid: updatedInvoice.amount_paid
        }
      };
    } catch (error) {
      console.error('❌ Error retrying payment:', error);
      throw error;
    }
  }

  /**
   * Get available plans from Stripe
   */
  async getAvailablePlans() {
    try {
      // First try to get from our database
      const plans = await prismaService.getPlans();
      if (plans && plans.length > 0) {
        return plans;
      }

      // If no plans in database, fetch directly from Stripe
      console.log('🔄 No plans in database, fetching directly from Stripe...');
      
      // Fetch all prices from Stripe
      const prices = await this.stripe.prices.list({
        active: true,
        limit: 100
      });

      console.log(`💰 Found ${prices.data.length} prices in Stripe`);

      // Convert Stripe prices to our plan format
      const stripePlans = prices.data.map(price => ({
        id: price.id,
        name: this.getPlanName(price.id, price.unit_amount || 0),
        price: price.unit_amount || 0,
        currency: price.currency,
        interval: price.recurring?.interval || 'month',
        features: this.getDefaultFeatures(price.unit_amount || 0),
        popular: this.isPopularPlan(price.unit_amount || 0)
      }));

      console.log(`✅ Converted ${stripePlans.length} plans from Stripe`);
      return stripePlans;
    } catch (error) {
      console.error('❌ Error getting available plans:', error);
      
      // Fallback to hardcoded plans if Stripe fails
      console.log('🔄 Falling back to hardcoded plans...');
      return this.getFallbackPlans();
    }
  }

  /**
   * Get plan name based on price ID and amount
   */
  getPlanName(priceId, price) {
    // Map known Stripe price IDs to plan names
    const priceIdMap = {
      'price_1S3fHn6NEzYIXIMoL50vVpQr': 'Free Trial',
      'price_1S3fG16NEzYIXIModekCNdYT': 'Starter Plan',
      'price_1S3fJQ6NEzYIXIMorYYqfFpW': 'Professional Plan'
    };

    if (priceIdMap[priceId]) {
      return priceIdMap[priceId];
    }

    // Fallback based on price
    if (price === 0) {
      return 'Free Trial';
    } else if (price < 5000) {
      return 'Starter Plan';
    } else {
      return 'Professional Plan';
    }
  }

  /**
   * Determine if plan is popular based on price
   */
  isPopularPlan(price) {
    // Starter plan is most popular
    return price >= 2000 && price < 5000;
  }

  /**
   * Get default features based on price
   */
  getDefaultFeatures(price) {
    if (price === 0) {
      return [
        '1 uploads per month',
        'All role filter',
        'CSV download',
        'No credit card required'
      ];
    } else if (price < 5000) {
      return [
        '50 uploads per month',
        'Up to 500 contacts',
        'Advanced role filtering',
        'Priority processing',
        'Basic analytics',
        'Email support'
      ];
    } else {
      return [
        '200 uploads per month',
        'Unlimited contacts',
        'Advanced role filtering',
        'Priority processing',
        'Basic analytics',
        'Email support'
      ];
    }
  }

  /**
   * Fallback plans if Stripe is unavailable
   */
  getFallbackPlans() {
    return [
      {
        id: 'price_free_trial',
        name: 'Free Trial',
        price: 0,
        currency: 'usd',
        interval: 'month',
        features: [
          '1 uploads per month',
          'All role filter',
          'CSV download',
          'No credit card required'
        ],
        popular: false
      },
      {
        id: 'price_starter',
        name: 'Starter Plan',
        price: 2999,
        currency: 'usd',
        interval: 'month',
        features: [
          '50 uploads per month',
          'Up to 500 contacts',
          'Advanced role filtering',
          'Priority processing',
          'Basic analytics',
          'Email support'
        ],
        popular: true
      },
      {
        id: 'price_professional',
        name: 'Professional Plan',
        price: 7999,
        currency: 'usd',
        interval: 'month',
        features: [
          '200 uploads per month',
          'Unlimited contacts',
          'Advanced role filtering',
          'Priority processing',
          'Basic analytics',
          'Email support'
        ],
        popular: false
      }
    ];
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(event) {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('❌ Error handling webhook:', error);
      throw error;
    }
  }

  /**
   * Handle checkout session completed
   */
  async handleCheckoutCompleted(session) {
    try {
      const userId = session.metadata.userId;
      const planId = session.metadata.planId;

      if (!userId || !planId) {
        console.warn('Missing metadata in checkout session:', session.id);
        return;
      }

      // Get subscription
      const subscription = await this.stripe.subscriptions.retrieve(session.subscription);
      
      // Create or update subscription in our database
      await prismaService.createOrUpdateSubscription({
        userId,
        planId,
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      });

      console.log(`✅ Checkout completed for user ${userId}, plan ${planId}`);
    } catch (error) {
      console.error('❌ Error handling checkout completed:', error);
    }
  }

  /**
   * Handle subscription updated
   */
  async handleSubscriptionUpdated(subscription) {
    try {
      const customer = await this.stripe.customers.retrieve(subscription.customer);
      const userId = customer.metadata.userId;

      if (!userId) {
        console.warn('No userId in customer metadata:', customer.id);
        return;
      }

      // Update subscription in our database
      await prismaService.updateSubscription(subscription.id, {
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      });

      console.log(`✅ Subscription updated for user ${userId}`);
    } catch (error) {
      console.error('❌ Error handling subscription updated:', error);
    }
  }

  /**
   * Handle subscription deleted
   */
  async handleSubscriptionDeleted(subscription) {
    try {
      const customer = await this.stripe.customers.retrieve(subscription.customer);
      const userId = customer.metadata.userId;

      if (!userId) {
        console.warn('No userId in customer metadata:', customer.id);
        return;
      }

      // Update subscription status in our database
      await prismaService.updateSubscription(subscription.id, {
        status: 'canceled',
        canceledAt: new Date()
      });

      console.log(`✅ Subscription canceled for user ${userId}`);
    } catch (error) {
      console.error('❌ Error handling subscription deleted:', error);
    }
  }

  /**
   * Handle payment succeeded
   */
  async handlePaymentSucceeded(invoice) {
    try {
      const customer = await this.stripe.customers.retrieve(invoice.customer);
      const userId = customer.metadata.userId;

      if (!userId) {
        console.warn('No userId in customer metadata:', customer.id);
        return;
      }

      // Log payment success
      console.log(`✅ Payment succeeded for user ${userId}, amount: ${invoice.amount_paid}`);
    } catch (error) {
      console.error('❌ Error handling payment succeeded:', error);
    }
  }

  /**
   * Handle payment failed
   */
  async handlePaymentFailed(invoice) {
    try {
      const customer = await this.stripe.customers.retrieve(invoice.customer);
      const userId = customer.metadata.userId;

      if (!userId) {
        console.warn('No userId in customer metadata:', customer.id);
        return;
      }

      // Log payment failure
      console.log(`❌ Payment failed for user ${userId}, amount: ${invoice.amount_due}`);
    } catch (error) {
      console.error('❌ Error handling payment failed:', error);
    }
  }
}

module.exports = new StripeService();
