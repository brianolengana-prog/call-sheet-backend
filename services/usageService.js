/**
 * Enhanced Usage Service
 * Handles usage tracking, limits, and plan management
 */

const prismaService = require('./prismaService');

class UsageService {
  constructor() {
    // Default fallback limits for free plan only
    this.defaultFreeLimits = {
      uploadsPerMonth: 1,
      maxContacts: 50,
      aiMinutesPerMonth: 60,
      storageGB: 1,
      apiCallsPerMonth: 100,
      features: ['Basic extraction', 'Email support']
    };
  }

  /**
   * Get plan limits from Stripe data
   */
  async getPlanLimits(planId) {
    try {
      if (planId === 'free') {
        return this.defaultFreeLimits;
      }
      
      const plan = await prismaService.getPlanById(planId);
      if (!plan) {
        console.warn(`⚠️ Plan ${planId} not found, falling back to free plan limits`);
        return this.defaultFreeLimits;
      }
      
      return {
        uploadsPerMonth: plan.uploadsPerMonth || -1,
        maxContacts: plan.maxContacts || -1,
        aiMinutesPerMonth: plan.aiProcessingMinutes || -1,
        storageGB: plan.storageGB || -1,
        apiCallsPerMonth: plan.apiCallsPerMonth || -1,
        features: plan.features || []
      };
    } catch (error) {
      console.error('❌ Error getting plan limits:', error);
      return this.defaultFreeLimits;
    }
  }

  /**
   * Get current month usage for a user
   */
  async getUserUsage(userId) {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      
      let usage = await prismaService.getUserUsage(userId);
      
      // If no usage record exists for current month, create one
      if (!usage || usage.month !== currentMonth) {
        const subscription = await prismaService.getUserSubscription(userId);
        const planId = subscription ? subscription.planId : 'free';
        const planLimits = await this.getPlanLimits(planId);
        
        usage = await prismaService.updateUserUsage(userId, {
          month: currentMonth,
          uploadsUsed: 0,
          uploadsLimit: planLimits.uploadsPerMonth,
          storageUsedGB: 0,
          storageLimitGB: planLimits.storageGB,
          aiMinutesUsed: 0,
          aiMinutesLimit: planLimits.aiMinutesPerMonth,
          apiCallsUsed: 0
        });
      }
      
      return usage;
    } catch (error) {
      console.error('❌ Error getting user usage:', error);
      throw error;
    }
  }

  /**
   * Check if user can perform an action based on their plan limits
   */
  async canPerformAction(userId, actionType, amount = 1) {
    try {
      const usage = await this.getUserUsage(userId);
      const subscription = await prismaService.getUserSubscription(userId);
      const planId = subscription ? subscription.planId : 'free';
      const limits = await this.getPlanLimits(planId);
      
      switch (actionType) {
        case 'upload':
          if (limits.uploadsPerMonth === -1) return { canPerform: true, reason: '' };
          const canUpload = usage.uploadsUsed + amount <= usage.uploadsLimit;
          return {
            canPerform: canUpload,
            reason: canUpload ? '' : `Upload limit reached. You have used ${usage.uploadsUsed}/${usage.uploadsLimit} uploads this month.`
          };
          
        case 'ai_processing':
          if (limits.aiMinutesPerMonth === -1) return { canPerform: true, reason: '' };
          const canProcess = usage.aiMinutesUsed + amount <= usage.aiMinutesLimit;
          return {
            canPerform: canProcess,
            reason: canProcess ? '' : `AI processing limit reached. You have used ${usage.aiMinutesUsed}/${usage.aiMinutesLimit} minutes this month.`
          };
          
        case 'api_call':
          if (limits.apiCallsPerMonth === -1) return { canPerform: true, reason: '' };
          const planLimits = await this.getPlanLimits(planId);
          const canCall = usage.apiCallsUsed + amount <= planLimits.apiCallsPerMonth;
          return {
            canPerform: canCall,
            reason: canCall ? '' : `API call limit reached. You have used ${usage.apiCallsUsed}/${planLimits.apiCallsPerMonth} calls this month.`
          };
          
        case 'storage':
          if (limits.storageGB === -1) return { canPerform: true, reason: '' };
          const canStore = usage.storageUsedGB + amount <= usage.storageLimitGB;
          return {
            canPerform: canStore,
            reason: canStore ? '' : `Storage limit reached. You have used ${usage.storageUsedGB}/${usage.storageLimitGB} GB this month.`
          };
          
        default:
          return { canPerform: false, reason: 'Unknown action type' };
      }
    } catch (error) {
      console.error('❌ Error checking action limits:', error);
      return { canPerform: false, reason: 'Error checking limits' };
    }
  }

  /**
   * Increment usage for a specific action
   */
  async incrementUsage(userId, actionType, amount = 1) {
    try {
      const usage = await this.getUserUsage(userId);
      
      const updateData = {};
      switch (actionType) {
        case 'upload':
          updateData.uploadsUsed = usage.uploadsUsed + amount;
          break;
        case 'ai_processing':
          updateData.aiMinutesUsed = usage.aiMinutesUsed + amount;
          break;
        case 'api_call':
          updateData.apiCalls = usage.apiCalls + amount;
          break;
        case 'storage':
          updateData.storageUsedGB = usage.storageUsedGB + amount;
          break;
        default:
          throw new Error(`Unknown action type: ${actionType}`);
      }
      
      await prismaService.updateUserUsage(userId, updateData);
      
      console.log(`✅ Usage incremented for user ${userId}: ${actionType} +${amount}`);
      return true;
    } catch (error) {
      console.error('❌ Error incrementing usage:', error);
      throw error;
    }
  }

  /**
   * Get user's current plan information
   */
  async getUserPlanInfo(userId) {
    try {
      const subscription = await prismaService.getUserSubscription(userId);
      const planId = subscription ? subscription.planId : 'free';
      const plan = subscription ? await prismaService.getPlanById(planId) : null;
      const usage = await this.getUserUsage(userId);
      const limits = await this.getPlanLimits(planId);
      
      // Check if user can upload based on their plan and usage
      const canUpload = usage.uploadsUsed < usage.uploadsLimit;
      const reason = canUpload ? null : 'You have reached your upload limit for this month';
      
      return {
        uploadsUsed: usage.uploadsUsed,
        uploadsLimit: usage.uploadsLimit,
        planId,
        planName: plan?.name || 'Free Plan',
        canUpload,
        reason,
        totalContacts: usage.totalContacts || 0,
        totalJobs: usage.totalJobs || 0
      };
    } catch (error) {
      console.error('❌ Error getting user plan info:', error);
      throw error;
    }
  }

  /**
   * Reset usage for a new month (called by cron job)
   */
  async resetMonthlyUsage(userId) {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const subscription = await prismaService.getUserSubscription(userId);
      const planId = subscription ? subscription.planId : 'free';
      const limits = await this.getPlanLimits(planId);
      
      await prismaService.updateUserUsage(userId, {
        month: currentMonth,
        uploadsUsed: 0,
        uploadsLimit: limits.uploadsPerMonth,
        storageUsedGB: 0,
        storageLimitGB: limits.storageGB,
        aiMinutesUsed: 0,
        aiMinutesLimit: limits.aiMinutesPerMonth,
        apiCallsUsed: 0
      });
      
      console.log(`✅ Monthly usage reset for user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Error resetting monthly usage:', error);
      throw error;
    }
  }

  /**
   * Get usage statistics for admin dashboard
   */
  async getUsageStatistics() {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Get all users with usage data for current month
      const allUsage = await prismaService.getAllUsageForMonth(currentMonth);
      
      const stats = {
        totalUsers: allUsage.length,
        totalUploads: allUsage.reduce((sum, usage) => sum + usage.uploadsUsed, 0),
        totalAiMinutes: allUsage.reduce((sum, usage) => sum + usage.aiMinutesUsed, 0),
        totalStorage: allUsage.reduce((sum, usage) => sum + usage.storageUsedGB, 0),
        totalApiCalls: allUsage.reduce((sum, usage) => sum + usage.apiCallsUsed, 0),
        planDistribution: {},
        averageUsage: {}
      };
      
      // Calculate plan distribution
      for (const usage of allUsage) {
        const subscription = await prismaService.getUserSubscription(usage.userId);
        const planId = subscription ? subscription.planId : 'free';
        
        stats.planDistribution[planId] = (stats.planDistribution[planId] || 0) + 1;
      }
      
      // Calculate average usage
      if (allUsage.length > 0) {
        stats.averageUsage = {
          uploads: Math.round(stats.totalUploads / allUsage.length),
          aiMinutes: Math.round(stats.totalAiMinutes / allUsage.length),
          storage: Math.round(stats.totalStorage / allUsage.length),
          apiCalls: Math.round(stats.totalApiCalls / allUsage.length)
        };
      }
      
      return stats;
    } catch (error) {
      console.error('❌ Error getting usage statistics:', error);
      throw error;
    }
  }

  /**
   * Check if user needs to upgrade (for frontend notifications)
   */
  async shouldShowUpgradePrompt(userId) {
    try {
      const planInfo = await this.getUserPlanInfo(userId);
      
      // Show upgrade prompt if:
      // 1. User is on free plan and has used 80%+ of their limits
      // 2. User is on paid plan but has used 90%+ of their limits
      const isFreePlan = planInfo.planId === 'free';
      const threshold = isFreePlan ? 0.8 : 0.9;
      
      const shouldUpgrade = Object.values(planInfo.usage).some(usage => 
        usage.percentage >= (threshold * 100)
      );
      
      return {
        shouldUpgrade,
        reason: shouldUpgrade ? 'You are approaching your plan limits' : '',
        planInfo
      };
    } catch (error) {
      console.error('❌ Error checking upgrade prompt:', error);
      return { shouldUpgrade: false, reason: '', planInfo: null };
    }
  }
}

module.exports = new UsageService();
