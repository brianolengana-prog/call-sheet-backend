# Stripe Webhook Setup Guide

## 🔄 **What are Webhooks?**

Webhooks are real-time notifications that Stripe sends to your backend when important events happen in your payment system. They ensure your database stays in sync with Stripe's data.

## 🏗️ **Webhook Architecture**

```
Stripe → Webhook → Your Backend → Database Update
   ↓
User sees updated subscription status
```

## 📋 **Required Webhook Events**

Configure these events in your Stripe Dashboard:

### **Essential Events:**
- `customer.subscription.created` - New subscription
- `customer.subscription.updated` - Plan changes, status updates
- `customer.subscription.deleted` - Subscription cancellation
- `invoice.payment_succeeded` - Successful payments
- `invoice.payment_failed` - Failed payments

### **Optional Events:**
- `customer.subscription.trial_will_end` - Trial ending notifications
- `checkout.session.completed` - Checkout completion
- `invoice.payment_action_required` - 3D Secure authentication

## 🛠️ **Setup Steps**

### **Step 1: Configure Webhook Endpoint in Stripe**

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Click **"Add endpoint"**
3. Set endpoint URL: `https://your-backend-domain.com/api/stripe/webhook`
4. Select events (see list above)
5. Copy the **Webhook Signing Secret** (starts with `whsec_`)

### **Step 2: Set Environment Variables**

Add to your backend `.env` file:
```bash
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### **Step 3: Test Webhook Delivery**

Use Stripe CLI for local testing:
```bash
# Install Stripe CLI
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3001/api/stripe/webhook

# Test specific events
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
```

## 🔐 **Security Features**

### **Webhook Signature Verification**
- All webhooks are verified using Stripe signatures
- Prevents malicious requests
- Ensures data integrity

### **Idempotency**
- Webhook handlers are idempotent
- Duplicate events won't cause issues
- Safe to retry failed webhooks

## 📊 **Database Schema**

The webhook system uses these tables:

### **`subscriptions` Table**
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key)
- stripe_subscription_id (Text, Unique)
- stripe_customer_id (Text)
- plan_id (Text)
- status (Text)
- current_period_start (Timestamp)
- current_period_end (Timestamp)
- cancel_at_period_end (Boolean)
```

### **`billing_records` Table**
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key)
- subscription_id (UUID, Foreign Key)
- stripe_invoice_id (Text, Unique)
- amount (Integer, in cents)
- currency (Text)
- status (Text)
- description (Text)
```

### **`usage_tracking` Table**
```sql
- user_id (UUID, Foreign Key)
- period_start (Date)
- period_end (Date)
- uploads_count (Integer)
- contacts_count (Integer)
- jobs_count (Integer)
```

## 🚀 **Webhook Flow Examples**

### **New Subscription Flow:**
1. User completes checkout
2. Stripe sends `customer.subscription.created`
3. Backend updates user's plan in database
4. User immediately has access to new features

### **Payment Success Flow:**
1. Stripe processes payment
2. Stripe sends `invoice.payment_succeeded`
3. Backend records payment in billing_records
4. User's subscription remains active

### **Payment Failure Flow:**
1. Payment fails (expired card, insufficient funds)
2. Stripe sends `invoice.payment_failed`
3. Backend records failed payment
4. User receives notification to update payment method

## 🔧 **Testing Webhooks**

### **Local Development:**
```bash
# Use Stripe CLI to forward webhooks
stripe listen --forward-to localhost:3001/api/stripe/webhook

# Test with real events
stripe trigger customer.subscription.created
```

### **Production Testing:**
1. Use Stripe's test mode
2. Create test subscriptions
3. Monitor webhook delivery in Stripe Dashboard
4. Check backend logs for processing

## 📈 **Monitoring & Debugging**

### **Stripe Dashboard:**
- Webhook delivery logs
- Success/failure rates
- Retry attempts
- Response times

### **Backend Logs:**
```javascript
// Webhook events are logged with emojis for easy identification
🔔 Webhook received: customer.subscription.created
✅ Subscription created: sub_1234567890
📝 Updating user subscription in database
✅ User john@example.com subscription created: professional
```

### **Common Issues:**
1. **Webhook not received**: Check endpoint URL and firewall
2. **Signature verification failed**: Verify webhook secret
3. **Database errors**: Check Supabase connection and schema
4. **Duplicate processing**: Implement idempotency checks

## 🎯 **Best Practices**

### **1. Always Verify Signatures**
```javascript
// Use validateStripeWebhook middleware
router.post('/webhook', validateStripeWebhook, async (req, res) => {
  // Webhook is verified and safe to process
});
```

### **2. Handle Errors Gracefully**
```javascript
try {
  await processWebhook(event);
  res.json({ received: true });
} catch (error) {
  console.error('Webhook processing failed:', error);
  res.status(500).json({ error: 'Processing failed' });
}
```

### **3. Implement Idempotency**
```javascript
// Check if event already processed
const existingRecord = await findExistingRecord(event.id);
if (existingRecord) {
  return res.json({ received: true, message: 'Already processed' });
}
```

### **4. Use Database Transactions**
```javascript
// Ensure data consistency
await supabase.rpc('process_subscription_webhook', {
  subscription_data: eventData
});
```

## 🚨 **Production Checklist**

- [ ] Webhook endpoint configured in Stripe Dashboard
- [ ] Webhook secret set in environment variables
- [ ] All required events selected
- [ ] Database schema matches webhook handlers
- [ ] Error handling and logging implemented
- [ ] Idempotency checks in place
- [ ] Monitoring and alerting set up
- [ ] Test webhook delivery in production
- [ ] Backup webhook processing strategy

## 📞 **Support**

If you encounter issues:
1. Check Stripe Dashboard webhook logs
2. Review backend logs for errors
3. Verify database schema and connections
4. Test with Stripe CLI locally
5. Check environment variables

---

**Remember**: Webhooks are critical for maintaining data consistency between Stripe and your application. Always test thoroughly before going live!
