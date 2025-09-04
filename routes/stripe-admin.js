const express = require('express');
const Stripe = require('stripe');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * @route   POST /api/stripe-admin/create-plan
 * @desc    Create a new subscription plan dynamically
 * @access  Private (Admin only)
 */
router.post('/create-plan', authenticateToken, async (req, res) => {
  try {
    const { name, description, amount, currency, interval, features } = req.body;

    // Create the product
    const product = await stripe.products.create({
      name,
      description: description || '',
      metadata: {
        features: JSON.stringify(features || [])
      }
    });

    // Create the price
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amount, // Amount in cents
      currency: currency || 'usd',
      recurring: {
        interval: interval || 'month'
      }
    });

    res.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        description: product.description
      },
      price: {
        id: price.id,
        amount: price.unit_amount,
        currency: price.currency,
        interval: price.recurring?.interval
      }
    });

  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({
      error: {
        message: 'Failed to create plan',
        type: 'server_error',
        status: 500
      }
    });
  }
});

/**
 * @route   PUT /api/stripe-admin/update-plan
 * @desc    Update an existing plan (creates new price)
 * @access  Private (Admin only)
 */
router.put('/update-plan', authenticateToken, async (req, res) => {
  try {
    const { productId, name, description, newAmount, currency, interval, features } = req.body;

    // Update the product
    const updatedProduct = await stripe.products.update(productId, {
      name,
      description: description || '',
      metadata: {
        features: JSON.stringify(features || [])
      }
    });

    // Create new price (prices are immutable)
    const newPrice = await stripe.prices.create({
      product: productId,
      unit_amount: newAmount,
      currency: currency || 'usd',
      recurring: {
        interval: interval || 'month'
      }
    });

    res.json({
      success: true,
      product: updatedProduct,
      newPrice: {
        id: newPrice.id,
        amount: newPrice.unit_amount,
        currency: newPrice.currency,
        interval: newPrice.recurring?.interval
      }
    });

  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({
      error: {
        message: 'Failed to update plan',
        type: 'server_error',
        status: 500
      }
    });
  }
});

/**
 * @route   GET /api/stripe-admin/plans
 * @desc    Get all plans with their current pricing
 * @access  Private (Admin only)
 */
router.get('/plans', authenticateToken, async (req, res) => {
  try {
    // Get all active products
    const products = await stripe.products.list({ active: true });
    
    const plansWithPricing = await Promise.all(
      products.data.map(async (product) => {
        // Get the current price for each product
        const prices = await stripe.prices.list({
          product: product.id,
          active: true,
          limit: 1
        });

        return {
          productId: product.id,
          name: product.name,
          description: product.description,
          features: product.metadata?.features ? JSON.parse(product.metadata.features) : [],
          currentPrice: prices.data[0] ? {
            id: prices.data[0].id,
            amount: prices.data[0].unit_amount,
            currency: prices.data[0].currency,
            interval: prices.data[0].recurring?.interval
          } : null
        };
      })
    );

    res.json(plansWithPricing);

  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch plans',
        type: 'server_error',
        status: 500
      }
    });
  }
});

/**
 * @route   POST /api/stripe-admin/create-promo-price
 * @desc    Create a promotional price for existing plan
 * @access  Private (Admin only)
 */
router.post('/create-promo-price', authenticateToken, async (req, res) => {
  try {
    const { productId, discountAmount, currency, interval, promoName, validUntil } = req.body;

    // Create promotional price
    const promoPrice = await stripe.prices.create({
      product: productId,
      unit_amount: discountAmount,
      currency: currency || 'usd',
      recurring: {
        interval: interval || 'month'
      },
      metadata: {
        isPromo: 'true',
        promoName: promoName || 'Promotional Price',
        validUntil: validUntil || ''
      }
    });

    res.json({
      success: true,
      promoPrice: {
        id: promoPrice.id,
        amount: promoPrice.unit_amount,
        currency: promoPrice.currency,
        interval: promoPrice.recurring?.interval,
        metadata: promoPrice.metadata
      }
    });

  } catch (error) {
    console.error('Error creating promo price:', error);
    res.status(500).json({
      error: {
        message: 'Failed to create promotional price',
        type: 'server_error',
        status: 500
      }
    });
  }
});

module.exports = router;

