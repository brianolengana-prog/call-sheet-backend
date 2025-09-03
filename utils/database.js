/**
 * Database utility functions for Stripe webhook processing
 * This file handles all database operations related to subscriptions and billing
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client for server-side operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Update user subscription in the database
 * @param {Object} data - Subscription data from Stripe webhook
 */
async function updateUserSubscription(data) {
  try {
    console.log('📝 Updating user subscription:', data);

    // First, try to find the user by email or userId
    let userQuery = supabase.from('users').select('*');
    
    if (data.userId) {
      userQuery = userQuery.eq('id', data.userId);
    } else if (data.customerEmail) {
      userQuery = userQuery.eq('email', data.customerEmail);
    } else {
      throw new Error('No userId or customerEmail provided');
    }

    const { data: users, error: userError } = await userQuery;
    
    if (userError) {
      console.error('❌ Error finding user:', userError);
      throw userError;
    }

    if (!users || users.length === 0) {
      console.log('⚠️ User not found, creating new user record');
      // Create user if doesn't exist
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: data.customerEmail,
          stripe_customer_id: data.stripeCustomerId,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating user:', createError);
        throw createError;
      }
      
      data.userId = newUser.id;
    } else {
      data.userId = users[0].id;
    }

    // Update or create subscription record
    const subscriptionData = {
      user_id: data.userId,
      stripe_subscription_id: data.stripeSubscriptionId,
      stripe_customer_id: data.stripeCustomerId,
      plan_id: data.planId,
      plan_name: data.planId.charAt(0).toUpperCase() + data.planId.slice(1) + ' Plan',
      status: data.status,
      current_period_start: data.currentPeriodStart?.toISOString(),
      current_period_end: data.currentPeriodEnd?.toISOString(),
      cancel_at_period_end: data.cancelAtPeriodEnd || false,
      updated_at: new Date().toISOString()
    };

    // Check if subscription already exists
    const { data: existingSub, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('stripe_subscription_id', data.stripeSubscriptionId)
      .single();

    let result;
    if (existingSub) {
      // Update existing subscription
      const { data: updatedSub, error: updateError } = await supabase
        .from('subscriptions')
        .update(subscriptionData)
        .eq('stripe_subscription_id', data.stripeSubscriptionId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error updating subscription:', updateError);
        throw updateError;
      }
      
      result = updatedSub;
      console.log('✅ Subscription updated:', updatedSub.id);
    } else {
      // Create new subscription
      const { data: newSub, error: createError } = await supabase
        .from('subscriptions')
        .insert({
          ...subscriptionData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating subscription:', createError);
        throw createError;
      }
      
      result = newSub;
      console.log('✅ Subscription created:', newSub.id);
    }

    // Update user's subscription_id reference
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ 
        subscription_id: result.id,
        stripe_customer_id: data.stripeCustomerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', data.userId);

    if (userUpdateError) {
      console.error('❌ Error updating user subscription reference:', userUpdateError);
      // Don't throw here, subscription was created successfully
    }

    return result;

  } catch (error) {
    console.error('❌ Database error in updateUserSubscription:', error);
    throw error;
  }
}

/**
 * Record a payment in the billing_records table
 * @param {Object} data - Payment data from Stripe webhook
 */
async function recordPayment(data) {
  try {
    console.log('📝 Recording payment:', data);

    // Find user by email or userId
    let userQuery = supabase.from('users').select('id, subscription_id');
    
    if (data.userId) {
      userQuery = userQuery.eq('id', data.userId);
    } else if (data.customerEmail) {
      userQuery = userQuery.eq('email', data.customerEmail);
    } else {
      throw new Error('No userId or customerEmail provided for payment record');
    }

    const { data: users, error: userError } = await userQuery;
    
    if (userError) {
      console.error('❌ Error finding user for payment:', userError);
      throw userError;
    }

    if (!users || users.length === 0) {
      console.log('⚠️ User not found for payment record');
      return null;
    }

    const user = users[0];

    // Check if payment record already exists
    const { data: existingPayment, error: paymentError } = await supabase
      .from('billing_records')
      .select('*')
      .eq('stripe_invoice_id', data.stripeInvoiceId)
      .single();

    if (existingPayment) {
      console.log('⚠️ Payment record already exists:', data.stripeInvoiceId);
      return existingPayment;
    }

    // Create new payment record
    const paymentData = {
      user_id: user.id,
      subscription_id: user.subscription_id,
      stripe_invoice_id: data.stripeInvoiceId,
      amount: data.amount,
      currency: data.currency,
      status: data.status,
      description: data.description,
      metadata: {
        failureReason: data.failureReason,
        failureCode: data.failureCode,
        failureType: data.failureType,
        ...data.metadata
      },
      created_at: new Date().toISOString()
    };

    const { data: newPayment, error: createError } = await supabase
      .from('billing_records')
      .insert(paymentData)
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating payment record:', createError);
      throw createError;
    }

    console.log('✅ Payment record created:', newPayment.id);
    return newPayment;

  } catch (error) {
    console.error('❌ Database error in recordPayment:', error);
    throw error;
  }
}

/**
 * Get user subscription status
 * @param {string} userId - User ID
 * @returns {Object} User subscription data
 */
async function getUserSubscription(userId) {
  try {
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        users!inner(id, email, stripe_customer_id)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error getting user subscription:', error);
      throw error;
    }

    return subscription;
  } catch (error) {
    console.error('❌ Database error in getUserSubscription:', error);
    throw error;
  }
}

/**
 * Update usage tracking for a user
 * @param {string} userId - User ID
 * @param {Object} usage - Usage data
 */
async function updateUsageTracking(userId, usage) {
  try {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const usageData = {
      user_id: userId,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      uploads_count: usage.uploadsCount || 0,
      contacts_count: usage.contactsCount || 0,
      jobs_count: usage.jobsCount || 0,
      updated_at: new Date().toISOString()
    };

    const { data: existingUsage, error: usageError } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('period_start', usageData.period_start)
      .single();

    let result;
    if (existingUsage) {
      // Update existing usage
      const { data: updatedUsage, error: updateError } = await supabase
        .from('usage_tracking')
        .update(usageData)
        .eq('user_id', userId)
        .eq('period_start', usageData.period_start)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error updating usage tracking:', updateError);
        throw updateError;
      }
      
      result = updatedUsage;
    } else {
      // Create new usage record
      const { data: newUsage, error: createError } = await supabase
        .from('usage_tracking')
        .insert({
          ...usageData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating usage tracking:', createError);
        throw createError;
      }
      
      result = newUsage;
    }

    return result;
  } catch (error) {
    console.error('❌ Database error in updateUsageTracking:', error);
    throw error;
  }
}

module.exports = {
  updateUserSubscription,
  recordPayment,
  getUserSubscription,
  updateUsageTracking
};
