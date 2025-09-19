#!/usr/bin/env node

/**
 * Stripe Configuration Debug Script
 * This script helps diagnose Stripe connection issues
 */

console.log('🔍 Stripe Configuration Debug\n');

// Check environment variables
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

console.log('📋 Environment Variables:');
console.log('  STRIPE_SECRET_KEY:', stripeSecretKey ? `${stripeSecretKey.substring(0, 7)}...` : '❌ NOT SET');
console.log('  STRIPE_PUBLISHABLE_KEY:', stripePublishableKey ? `${stripePublishableKey.substring(0, 7)}...` : '❌ NOT SET');
console.log('  STRIPE_WEBHOOK_SECRET:', stripeWebhookSecret ? `${stripeWebhookSecret.substring(0, 7)}...` : '❌ NOT SET');

// Validate Stripe secret key format
if (stripeSecretKey) {
  console.log('\n🔑 Stripe Secret Key Validation:');
  
  // Check if it starts with correct prefix
  if (stripeSecretKey.startsWith('sk_live_')) {
    console.log('  ✅ Format: Live key (sk_live_)');
  } else if (stripeSecretKey.startsWith('sk_test_')) {
    console.log('  ⚠️  Format: Test key (sk_test_)');
  } else {
    console.log('  ❌ Format: Invalid prefix - should start with sk_live_ or sk_test_');
  }
  
  // Check for invalid characters
  const invalidChars = stripeSecretKey.match(/[^a-zA-Z0-9_]/g);
  if (invalidChars) {
    console.log('  ❌ Invalid characters found:', invalidChars);
  } else {
    console.log('  ✅ No invalid characters found');
  }
  
  // Check length (should be around 107 characters)
  console.log('  📏 Length:', stripeSecretKey.length, 'characters');
  if (stripeSecretKey.length < 100 || stripeSecretKey.length > 120) {
    console.log('  ⚠️  Length seems unusual (expected ~107 characters)');
  }
}

// Test Stripe connection
if (stripeSecretKey) {
  console.log('\n🌐 Testing Stripe Connection:');
  
  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });
    
    // Test with a simple API call
    stripe.prices.list({ limit: 1 })
      .then(() => {
        console.log('  ✅ Stripe connection successful!');
        process.exit(0);
      })
      .catch((error) => {
        console.log('  ❌ Stripe connection failed:');
        console.log('     Error:', error.message);
        console.log('     Type:', error.type);
        if (error.raw) {
          console.log('     Raw error:', error.raw.message);
        }
        process.exit(1);
      });
      
  } catch (error) {
    console.log('  ❌ Failed to initialize Stripe:');
    console.log('     Error:', error.message);
    process.exit(1);
  }
} else {
  console.log('\n❌ Cannot test Stripe connection - STRIPE_SECRET_KEY not set');
  process.exit(1);
}
