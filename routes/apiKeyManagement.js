/**
 * API Key Management Routes
 * 
 * Handles API key creation, management, and billing
 */

const express = require('express');
const cors = require('cors');
const { authenticateToken } = require('../middleware/auth');
const { authenticateAPIKey } = require('../middleware/apiKeyAuth');
const apiKeyMonetizationService = require('../services/apiKeyMonetizationService');
const stripeService = require('../services/stripeService');

const router = express.Router();
const routeCors = cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With','Accept','Origin','X-API-Key']
});

/**
 * GET /api/api-keys
 * Get user's API keys
 */
router.get('/',
  routeCors,
  authenticateToken,
  async (req, res) => {
    try {
      const apiKeys = await prismaService.getUserAPIKeys(req.user.id);
      
      // Remove sensitive data
      const sanitizedKeys = apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        tier: key.tier,
        permissions: key.permissions,
        rateLimit: key.rateLimit,
        monthlyExtractions: key.monthlyExtractions,
        currentMonthExtractions: key.currentMonthExtractions,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt
      }));

      res.json({
        success: true,
        apiKeys: sanitizedKeys
      });
    } catch (error) {
      console.error('❌ Failed to get API keys:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve API keys'
      });
    }
  }
);

/**
 * POST /api/api-keys
 * Create a new API key
 */
router.post('/',
  routeCors,
  authenticateToken,
  async (req, res) => {
    try {
      const { name, tier = 'FREE' } = req.body;
      
      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'API key name is required'
        });
      }

      const result = await apiKeyMonetizationService.createAPIKey(
        req.user.id,
        tier,
        name
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        apiKey: result.apiKey,
        keyRecord: {
          id: result.keyRecord.id,
          name: result.keyRecord.name,
          tier: result.keyRecord.tier,
          permissions: result.keyRecord.permissions,
          rateLimit: result.keyRecord.rateLimit,
          monthlyExtractions: result.keyRecord.monthlyExtractions,
          createdAt: result.keyRecord.createdAt,
          expiresAt: result.keyRecord.expiresAt
        },
        tier: result.tier
      });
    } catch (error) {
      console.error('❌ Failed to create API key:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create API key'
      });
    }
  }
);

/**
 * GET /api/api-keys/:keyId/usage
 * Get usage statistics for an API key
 */
router.get('/:keyId/usage',
  routeCors,
  authenticateToken,
  async (req, res) => {
    try {
      const { keyId } = req.params;
      const apiKey = await prismaService.getAPIKeyById(keyId);
      
      if (!apiKey || apiKey.userId !== req.user.id) {
        return res.status(404).json({
          success: false,
          error: 'API key not found'
        });
      }

      const stats = await apiKeyMonetizationService.getUsageStats(apiKey.key);
      
      if (!stats.success) {
        return res.status(400).json({
          success: false,
          error: stats.error
        });
      }

      res.json({
        success: true,
        stats: stats.stats
      });
    } catch (error) {
      console.error('❌ Failed to get usage stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve usage statistics'
      });
    }
  }
);

/**
 * PUT /api/api-keys/:keyId/upgrade
 * Upgrade API key tier
 */
router.put('/:keyId/upgrade',
  routeCors,
  authenticateToken,
  async (req, res) => {
    try {
      const { keyId } = req.params;
      const { tier, paymentMethodId } = req.body;
      
      const apiKey = await prismaService.getAPIKeyById(keyId);
      if (!apiKey || apiKey.userId !== req.user.id) {
        return res.status(404).json({
          success: false,
          error: 'API key not found'
        });
      }

      // Check if upgrade is valid
      if (!apiKeyMonetizationService.canUpgrade(apiKey.tier, tier)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid upgrade path'
        });
      }

      // Create Stripe subscription if not free tier
      let stripeSubscriptionId = null;
      if (tier !== 'FREE') {
        const subscription = await stripeService.createSubscription(
          req.user.id,
          tier,
          paymentMethodId
        );
        
        if (!subscription.success) {
          return res.status(400).json({
            success: false,
            error: subscription.error
          });
        }
        
        stripeSubscriptionId = subscription.subscriptionId;
      }

      // Upgrade the API key
      const result = await apiKeyMonetizationService.upgradeAPIKey(
        apiKey.key,
        tier,
        stripeSubscriptionId
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        newTier: result.newTier,
        oldTier: result.oldTier,
        stripeSubscriptionId
      });
    } catch (error) {
      console.error('❌ Failed to upgrade API key:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upgrade API key'
      });
    }
  }
);

/**
 * DELETE /api/api-keys/:keyId
 * Delete an API key
 */
router.delete('/:keyId',
  routeCors,
  authenticateToken,
  async (req, res) => {
    try {
      const { keyId } = req.params;
      const apiKey = await prismaService.getAPIKeyById(keyId);
      
      if (!apiKey || apiKey.userId !== req.user.id) {
        return res.status(404).json({
          success: false,
          error: 'API key not found'
        });
      }

      // Cancel Stripe subscription if exists
      if (apiKey.stripeSubscriptionId) {
        await stripeService.cancelSubscription(apiKey.stripeSubscriptionId);
      }

      await prismaService.deleteAPIKey(keyId);

      res.json({
        success: true,
        message: 'API key deleted successfully'
      });
    } catch (error) {
      console.error('❌ Failed to delete API key:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete API key'
      });
    }
  }
);

/**
 * GET /api/api-keys/tiers
 * Get available API key tiers
 */
router.get('/tiers',
  routeCors,
  async (req, res) => {
    try {
      const tiers = apiKeyMonetizationService.getTiers();
      
      res.json({
        success: true,
        tiers
      });
    } catch (error) {
      console.error('❌ Failed to get tiers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve tiers'
      });
    }
  }
);

/**
 * GET /api/api-keys/validate
 * Validate API key (for external use)
 */
router.get('/validate',
  routeCors,
  authenticateAPIKey,
  async (req, res) => {
    try {
      const stats = await apiKeyMonetizationService.getUsageStats(req.apiKey.key);
      
      if (!stats.success) {
        return res.status(400).json({
          success: false,
          error: stats.error
        });
      }

      res.json({
        success: true,
        valid: true,
        stats: stats.stats
      });
    } catch (error) {
      console.error('❌ Failed to validate API key:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate API key'
      });
    }
  }
);

module.exports = router;
