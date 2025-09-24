/**
 * API Key Management Routes
 * 
 * Routes for managing API keys
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { apiKeySchema } = require('../schemas/validation');
const apiKeyService = require('../services/apiKeyService');

const router = express.Router();

/**
 * POST /api/api-keys
 * Create a new API key
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Validate request body
    const validationResult = apiKeySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: validationResult.error.errors
      });
    }

    const keyData = validationResult.data;
    
    const result = await apiKeyService.createAPIKey(userId, keyData);
    
    if (result.success) {
      res.status(201).json({
        success: true,
        apiKey: result.apiKey,
        keyId: result.keyId,
        expiresAt: result.expiresAt,
        message: 'API key created successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ API key creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create API key'
    });
  }
});

/**
 * GET /api/api-keys
 * Get all API keys for the authenticated user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const apiKeys = await apiKeyService.getUserAPIKeys(userId);
    
    res.json({
      success: true,
      apiKeys: apiKeys
    });
  } catch (error) {
    console.error('❌ Error getting API keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve API keys'
    });
  }
});

/**
 * DELETE /api/api-keys/:keyId
 * Revoke an API key
 */
router.delete('/:keyId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const keyId = req.params.keyId;
    
    const result = await apiKeyService.revokeAPIKey(userId, keyId);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Error revoking API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke API key'
    });
  }
});

/**
 * GET /api/api-keys/usage
 * Get API key usage statistics
 */
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // For now, return basic usage info
    // In production, this would query usage tracking data
    res.json({
      success: true,
      usage: {
        totalRequests: 0,
        requestsThisMonth: 0,
        lastUsed: null,
        rateLimitRemaining: 1000
      }
    });
  } catch (error) {
    console.error('❌ Error getting API key usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve usage statistics'
    });
  }
});

module.exports = router;
