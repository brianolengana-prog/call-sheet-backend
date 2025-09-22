require('dotenv').config();
const Stripe = require('stripe');

async function testStripe() {
  try {
    console.log('🔑 STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'Set' : 'Not set');
    
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    console.log('🔄 Testing Stripe connection...');
    const products = await stripe.products.list({ limit: 1 });
    console.log('✅ Stripe connection successful!');
    console.log('📦 Products found:', products.data.length);
    
    const prices = await stripe.prices.list({ limit: 5 });
    console.log('💰 Prices found:', prices.data.length);
    
    if (prices.data.length > 0) {
      console.log('📋 Sample price:', {
        id: prices.data[0].id,
        amount: prices.data[0].unit_amount,
        currency: prices.data[0].currency,
        interval: prices.data[0].recurring?.interval
      });
    }
    
  } catch (error) {
    console.error('❌ Stripe test failed:', error.message);
  }
}

testStripe();
