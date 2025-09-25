/**
 * API Key Monetization Service
 * 
 * Handles API key creation, validation, usage tracking, and billing
 */

const crypto = require('crypto');
const prismaService = require('./prismaService');

class APIKeyMonetizationService {
  constructor() {
    this.tiers = {
      FREE: {
        name: 'Free',
        price: 0,
        monthlyExtractions: 10,
        rateLimit: 10, // per hour
        features: ['Basic extraction', 'Email support'],
        stripePriceId: null
      },
      STARTER: {
        name: 'Starter',
        price: 29,
        monthlyExtractions: 1000,
        rateLimit: 100, // per hour
        features: ['Smart extraction', 'Priority support', 'Webhooks'],
        stripePriceId: process.env.STRIPE_STARTER_PRICE_ID
      },
      PROFESSIONAL: {
        name: 'Professional',
        price: 99,
        monthlyExtractions: 10000,
        rateLimit: 500, // per hour
        features: ['All extraction methods', 'Custom models', 'Dedicated support'],
        stripePriceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID
      },
      ENTERPRISE: {
        name: 'Enterprise',
        price: 299,
        monthlyExtractions: 100000,
        rateLimit: 2000, // per hour
        features: ['Unlimited', 'Custom deployment', 'SLA', 'Phone support'],
        stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID
      }
    };
  }

  /**
   * Generate a new API key
   */
  generateAPIKey() {
    const prefix = 'sk_';
    const randomBytes = crypto.randomBytes(32);
    const key = prefix + randomBytes.toString('hex');
    return key;
  }

  /**
   * Create a new API key for a user
   */
  async createAPIKey(userId, tier = 'FREE', name = 'Default API Key') {
    try {
      const apiKey = this.generateAPIKey();
      const tierConfig = this.tiers[tier];
      
      if (!tierConfig) {
        throw new Error(`Invalid tier: ${tier}`);
      }

      const keyRecord = await prismaService.createAPIKey({
        userId,
        key: apiKey,
        name,
        tier,
        permissions: this.getTierPermissions(tier),
        rateLimit: tierConfig.rateLimit,
        monthlyExtractions: tierConfig.monthlyExtractions,
        currentMonthExtractions: 0,
        expiresAt: tier === 'FREE' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null // 30 days for free
      });

      console.log('✅ API key created:', {
        userId,
        tier,
        keyId: keyRecord.id,
        keyPrefix: apiKey.substring(0, 10) + '...'
      });

      return {
        success: true,
        apiKey,
        keyRecord,
        tier: tierConfig
      };
    } catch (error) {
      console.error('❌ Failed to create API key:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate API key and check usage limits
   */
  async validateAPIKey(apiKey) {
    try {
      const keyRecord = await prismaService.getAPIKey(apiKey);
      
      if (!keyRecord) {
        return {
          success: false,
          error: 'Invalid API key',
          code: 'INVALID_API_KEY'
        };
      }

      // Check if key is expired
      if (keyRecord.expiresAt && new Date() > keyRecord.expiresAt) {
        return {
          success: false,
          error: 'API key expired',
          code: 'API_KEY_EXPIRED'
        };
      }

      // Check monthly usage limit
      const tierConfig = this.tiers[keyRecord.tier];
      if (keyRecord.currentMonthExtractions >= tierConfig.monthlyExtractions) {
        return {
          success: false,
          error: 'Monthly extraction limit reached',
          code: 'USAGE_LIMIT_EXCEEDED',
          resetDate: this.getNextMonthReset()
        };
      }

      return {
        success: true,
        keyRecord,
        tier: tierConfig,
        remainingExtractions: tierConfig.monthlyExtractions - keyRecord.currentMonthExtractions
      };
    } catch (error) {
      console.error('❌ API key validation error:', error);
      return {
        success: false,
        error: 'API key validation failed',
        code: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * Track API usage
   */
  async trackUsage(apiKey, extractionCount = 1, processingTime = 0) {
    try {
      await prismaService.incrementAPIKeyUsage(apiKey, extractionCount, processingTime);
      
      console.log('📊 API usage tracked:', {
        apiKey: apiKey.substring(0, 10) + '...',
        extractions: extractionCount,
        processingTime
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Failed to track API usage:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get usage statistics for an API key
   */
  async getUsageStats(apiKey) {
    try {
      const keyRecord = await prismaService.getAPIKey(apiKey);
      if (!keyRecord) {
        return { success: false, error: 'API key not found' };
      }

      const tierConfig = this.tiers[keyRecord.tier];
      const usage = await prismaService.getAPIKeyUsage(keyRecord.id);

      return {
        success: true,
        stats: {
          tier: keyRecord.tier,
          tierName: tierConfig.name,
          monthlyLimit: tierConfig.monthlyExtractions,
          used: keyRecord.currentMonthExtractions,
          remaining: tierConfig.monthlyExtractions - keyRecord.currentMonthExtractions,
          rateLimit: tierConfig.rateLimit,
          features: tierConfig.features,
          usage: usage,
          resetDate: this.getNextMonthReset()
        }
      };
    } catch (error) {
      console.error('❌ Failed to get usage stats:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Upgrade API key tier
   */
  async upgradeAPIKey(apiKey, newTier, stripeSubscriptionId = null) {
    try {
      const keyRecord = await prismaService.getAPIKey(apiKey);
      if (!keyRecord) {
        return { success: false, error: 'API key not found' };
      }

      const newTierConfig = this.tiers[newTier];
      if (!newTierConfig) {
        return { success: false, error: 'Invalid tier' };
      }

      await prismaService.updateAPIKey(keyRecord.id, {
        tier: newTier,
        permissions: this.getTierPermissions(newTier),
        rateLimit: newTierConfig.rateLimit,
        monthlyExtractions: newTierConfig.monthlyExtractions,
        stripeSubscriptionId
      });

      console.log('⬆️ API key upgraded:', {
        apiKey: apiKey.substring(0, 10) + '...',
        oldTier: keyRecord.tier,
        newTier
      });

      return {
        success: true,
        newTier: newTierConfig,
        oldTier: this.tiers[keyRecord.tier]
      };
    } catch (error) {
      console.error('❌ Failed to upgrade API key:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get tier permissions
   */
  getTierPermissions(tier) {
    const permissions = {
      FREE: ['extract'],
      STARTER: ['extract', 'webhook', 'priority'],
      PROFESSIONAL: ['extract', 'webhook', 'priority', 'custom_models', 'analytics'],
      ENTERPRISE: ['extract', 'webhook', 'priority', 'custom_models', 'analytics', 'unlimited', 'custom_deployment']
    };
    return permissions[tier] || permissions.FREE;
  }

  /**
   * Get next month reset date
   */
  getNextMonthReset() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth;
  }

  /**
   * Get all available tiers
   */
  getTiers() {
    return Object.entries(this.tiers).map(([key, config]) => ({
      id: key,
      ...config
    }));
  }

  /**
   * Check if user can upgrade
   */
  canUpgrade(currentTier, targetTier) {
    const tierOrder = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
    const currentIndex = tierOrder.indexOf(currentTier);
    const targetIndex = tierOrder.indexOf(targetTier);
    return targetIndex > currentIndex;
  }
}

module.exports = new APIKeyMonetizationService();
