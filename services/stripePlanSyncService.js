/**
 * Stripe Plan Sync Service
 * Syncs plan data from Stripe to our database
 */

const Stripe = require('stripe');
const prismaService = require('./prismaService');

class StripePlanSyncService {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }

  /**
   * Sync all plans from Stripe to database
   */
  async syncPlansFromStripe() {
    try {
      console.log('🔄 Starting plan sync from Stripe...');
      
      // Fetch all products from Stripe
      const products = await this.stripe.products.list({
        active: true,
        limit: 100,
        expand: ['data.default_price']
      });

      console.log(`📦 Found ${products.data.length} products in Stripe`);

      // Fetch all prices
      const prices = await this.stripe.prices.list({
        active: true,
        limit: 100
      });

      console.log(`💰 Found ${prices.data.length} prices in Stripe`);

      const syncedPlans = [];

      for (const product of products.data) {
        try {
          // Find the default price for this product
          const defaultPrice = product.default_price;
          if (!defaultPrice) {
            console.warn(`⚠️ Product ${product.name} has no default price, skipping`);
            continue;
          }

          // Extract plan data from Stripe product metadata
          const planData = {
            id: product.metadata.plan_id || product.name.toLowerCase().replace(/\s+/g, '_'),
            name: product.name,
            description: product.description || '',
            price: defaultPrice.unit_amount ? defaultPrice.unit_amount / 100 : 0,
            interval: defaultPrice.recurring?.interval || 'month',
            stripeProductId: product.id,
            stripePriceId: defaultPrice.id,
            uploadsPerMonth: this.parseMetadataNumber(product.metadata.uploads_per_month, -1),
            maxContacts: this.parseMetadataNumber(product.metadata.max_contacts, -1),
            storageGB: this.parseMetadataNumber(product.metadata.storage_gb, -1),
            aiProcessingMinutes: this.parseMetadataNumber(product.metadata.ai_minutes, -1),
            apiCallsPerMonth: this.parseMetadataNumber(product.metadata.api_calls, -1),
            features: this.parseMetadataArray(product.metadata.features, []),
            popular: product.metadata.popular === 'true',
            isActive: product.active,
            sortOrder: this.parseMetadataNumber(product.metadata.sort_order, 0)
          };

          // Create or update plan in database
          const plan = await prismaService.createOrUpdatePlan(planData);
          syncedPlans.push(plan);
          
          console.log(`✅ Synced plan: ${plan.name} (${plan.id})`);
        } catch (error) {
          console.error(`❌ Error syncing product ${product.name}:`, error);
        }
      }

      console.log(`🎯 Successfully synced ${syncedPlans.length} plans from Stripe`);
      return syncedPlans;

    } catch (error) {
      console.error('❌ Error syncing plans from Stripe:', error);
      throw error;
    }
  }

  /**
   * Parse metadata number value
   */
  parseMetadataNumber(value, defaultValue = 0) {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Parse metadata array value
   */
  parseMetadataArray(value, defaultValue = []) {
    if (!value) return defaultValue;
    
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : defaultValue;
    } catch {
      // Fallback to pipe or comma separated values
      const parts = value.includes('|') ? value.split('|') : value.split(',');
      return parts.map(s => s.trim()).filter(Boolean);
    }
  }

  /**
   * Get plan by Stripe price ID
   */
  async getPlanByStripePriceId(stripePriceId) {
    try {
      return await prismaService.getPlanByStripePriceId(stripePriceId);
    } catch (error) {
      console.error('❌ Error getting plan by Stripe price ID:', error);
      throw error;
    }
  }

  /**
   * Update plan limits from Stripe metadata
   */
  async updatePlanLimitsFromStripe(planId) {
    try {
      const plan = await prismaService.getPlanById(planId);
      if (!plan || !plan.stripeProductId) {
        throw new Error(`Plan ${planId} not found or has no Stripe product ID`);
      }

      // Fetch updated product data from Stripe
      const stripeProduct = await this.stripe.products.retrieve(plan.stripeProductId);
      
      const updatedData = {
        uploadsPerMonth: this.parseMetadataNumber(stripeProduct.metadata.uploads_per_month, plan.uploadsPerMonth),
        maxContacts: this.parseMetadataNumber(stripeProduct.metadata.max_contacts, plan.maxContacts),
        storageGB: this.parseMetadataNumber(stripeProduct.metadata.storage_gb, plan.storageGB),
        aiProcessingMinutes: this.parseMetadataNumber(stripeProduct.metadata.ai_minutes, plan.aiProcessingMinutes),
        apiCallsPerMonth: this.parseMetadataNumber(stripeProduct.metadata.api_calls, plan.apiCallsPerMonth),
        features: this.parseMetadataArray(stripeProduct.metadata.features, plan.features),
        popular: stripeProduct.metadata.popular === 'true',
        isActive: stripeProduct.active
      };

      const updatedPlan = await prismaService.updatePlan(planId, updatedData);
      console.log(`✅ Updated plan limits for ${plan.name} from Stripe metadata`);
      
      return updatedPlan;
    } catch (error) {
      console.error('❌ Error updating plan limits from Stripe:', error);
      throw error;
    }
  }

  /**
   * Sync specific plan by Stripe product ID
   */
  async syncPlanByStripeProductId(stripeProductId) {
    try {
      const stripeProduct = await this.stripe.products.retrieve(stripeProductId);
      const defaultPrice = stripeProduct.default_price;
      
      if (!defaultPrice) {
        throw new Error(`Product ${stripeProductId} has no default price`);
      }

      const planData = {
        id: stripeProduct.metadata.plan_id || stripeProduct.name.toLowerCase().replace(/\s+/g, '_'),
        name: stripeProduct.name,
        description: stripeProduct.description || '',
        price: defaultPrice.unit_amount ? defaultPrice.unit_amount / 100 : 0,
        interval: defaultPrice.recurring?.interval || 'month',
        stripeProductId: stripeProduct.id,
        stripePriceId: defaultPrice.id,
        uploadsPerMonth: this.parseMetadataNumber(stripeProduct.metadata.uploads_per_month, -1),
        maxContacts: this.parseMetadataNumber(stripeProduct.metadata.max_contacts, -1),
        storageGB: this.parseMetadataNumber(stripeProduct.metadata.storage_gb, -1),
        aiProcessingMinutes: this.parseMetadataNumber(stripeProduct.metadata.ai_minutes, -1),
        apiCallsPerMonth: this.parseMetadataNumber(stripeProduct.metadata.api_calls, -1),
        features: this.parseMetadataArray(stripeProduct.metadata.features, []),
        popular: stripeProduct.metadata.popular === 'true',
        isActive: stripeProduct.active,
        sortOrder: this.parseMetadataNumber(stripeProduct.metadata.sort_order, 0)
      };

      const plan = await prismaService.createOrUpdatePlan(planData);
      console.log(`✅ Synced plan: ${plan.name} (${plan.id})`);
      
      return plan;
    } catch (error) {
      console.error('❌ Error syncing plan by Stripe product ID:', error);
      throw error;
    }
  }
}

module.exports = new StripePlanSyncService();

