/**
 * Usage Routes
 * Handles usage tracking, limits, and plan management
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const usageService = require('../services/usageService');
const prismaService = require('../services/prismaService');
const router = express.Router();

// All usage routes require authentication
router.use(authenticateToken);

/**
 * GET /api/usage/current
 * Get current user's usage and plan information
 */
router.get('/current', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const planInfo = await usageService.getUserPlanInfo(userId);
    
    res.json({
      success: true,
      data: planInfo
    });
  } catch (error) {
    console.error('❌ Error getting current usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage information'
    });
  }
});

/**
 * POST /api/usage/check
 * Check if user can perform a specific action
 */
router.post('/check', async (req, res) => {
  try {
    const userId = req.user.id;
    const { actionType, amount = 1 } = req.body;
    
    if (!actionType) {
      return res.status(400).json({
        success: false,
        error: 'Action type is required'
      });
    }
    
    const result = await usageService.canPerformAction(userId, actionType, amount);
    
    res.json({
      success: true,
      canPerform: result.canPerform,
      reason: result.reason
    });
  } catch (error) {
    console.error('❌ Error checking usage limits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check usage limits'
    });
  }
});

/**
 * POST /api/usage/increment
 * Increment usage for a specific action
 */
router.post('/increment', async (req, res) => {
  try {
    const userId = req.user.id;
    const { actionType, amount = 1 } = req.body;
    
    if (!actionType) {
      return res.status(400).json({
        success: false,
        error: 'Action type is required'
      });
    }
    
    // First check if user can perform the action
    const canPerform = await usageService.canPerformAction(userId, actionType, amount);
    
    if (!canPerform.canPerform) {
      return res.status(403).json({
        success: false,
        error: canPerform.reason,
        requiresUpgrade: true
      });
    }
    
    // Increment usage
    await usageService.incrementUsage(userId, actionType, amount);
    
    res.json({
      success: true,
      message: 'Usage incremented successfully'
    });
  } catch (error) {
    console.error('❌ Error incrementing usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to increment usage'
    });
  }
});

/**
 * GET /api/usage/upgrade-prompt
 * Check if user should see upgrade prompt
 */
router.get('/upgrade-prompt', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await usageService.shouldShowUpgradePrompt(userId);
    
    res.json({
      success: true,
      shouldUpgrade: result.shouldUpgrade,
      reason: result.reason,
      planInfo: result.planInfo
    });
  } catch (error) {
    console.error('❌ Error checking upgrade prompt:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check upgrade prompt'
    });
  }
});

/**
 * GET /api/usage/history
 * Get usage history for the user
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const { months = 6 } = req.query;
    
    // Get usage history for the specified number of months
    const history = [];
    const currentDate = new Date();
    
    for (let i = 0; i < months; i++) {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const month = monthDate.toISOString().slice(0, 7);
      
      try {
        const usage = await prismaService.getUserUsageForMonth(userId, month);
        if (usage) {
          history.push({
            month,
            uploadsUsed: usage.uploadsUsed,
            uploadsLimit: usage.uploadsLimit,
            aiMinutesUsed: usage.aiMinutesUsed,
            aiMinutesLimit: usage.aiMinutesLimit,
            storageUsedGB: usage.storageUsedGB,
            storageLimitGB: usage.storageLimitGB,
            apiCallsUsed: usage.apiCallsUsed,
            apiCallsLimit: usage.apiCallsLimit
          });
        }
      } catch (error) {
        // Skip months with no usage data
        console.warn(`No usage data for month ${month}:`, error.message);
      }
    }
    
    res.json({
      success: true,
      history: history.reverse() // Most recent first
    });
  } catch (error) {
    console.error('❌ Error getting usage history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage history'
    });
  }
});

/**
 * POST /api/usage/reset-monthly
 * Reset monthly usage (admin only)
 */
router.post('/reset-monthly', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if user is admin (you can implement admin check here)
    // For now, allow any authenticated user to reset their own usage
    
    await usageService.resetMonthlyUsage(userId);
    
    res.json({
      success: true,
      message: 'Monthly usage reset successfully'
    });
  } catch (error) {
    console.error('❌ Error resetting monthly usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset monthly usage'
    });
  }
});

/**
 * GET /api/usage/statistics
 * Get usage statistics (admin only)
 */
router.get('/statistics', async (req, res) => {
  try {
    // Check if user is admin (you can implement admin check here)
    // For now, allow any authenticated user to see statistics
    
    const stats = await usageService.getUsageStatistics();
    
    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('❌ Error getting usage statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage statistics'
    });
  }
});

/**
 * GET /api/usage/limits
 * Get current plan limits for the user
 */
router.get('/limits', async (req, res) => {
  try {
    const userId = req.user.id;
    const planInfo = await usageService.getUserPlanInfo(userId);
    
    res.json({
      success: true,
      limits: planInfo.limits,
      planId: planInfo.planId,
      planName: planInfo.planName
    });
  } catch (error) {
    console.error('❌ Error getting plan limits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get plan limits'
    });
  }
});

module.exports = router;

