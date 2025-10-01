/**
 * Secure API Key Management Routes
 * 
 * Server-side API key creation and management
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');

/**
 * Generate a secure API key
 */
function generateSecureAPIKey() {
  const prefix = 'sk_';
  const randomBytes = crypto.randomBytes(32);
  const key = prefix + randomBytes.toString('hex');
  return key;
}

/**
 * POST /api/api-keys/create
 * Create a new API key for the authenticated user
 */
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { name, tier = 'free' } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'API key name is required'
      });
    }

    // Generate secure API key
    const apiKey = generateSecureAPIKey();
    
    // Store in database (you'll need to implement this)
    // For now, we'll just return the key
    const keyData = {
      id: crypto.randomUUID(),
      name,
      key: apiKey,
      tier,
      userId: req.user.id,
      createdAt: new Date().toISOString(),
      isActive: true
    };

    console.log('🔑 API key created for user:', req.user.id, 'Name:', name);

    res.json({
      success: true,
      data: {
        id: keyData.id,
        name: keyData.name,
        key: keyData.key, // Only returned once during creation
        tier: keyData.tier,
        createdAt: keyData.createdAt
      },
      message: 'API key created successfully. Store it securely - it will not be shown again.'
    });

  } catch (error) {
    console.error('❌ Failed to create API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create API key'
    });
  }
});

/**
 * GET /api/api-keys
 * Get user's API keys (without the actual key values)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    // In a real implementation, fetch from database
    // For now, return mock data
    const mockKeys = [
      {
        id: 'key_1',
        name: 'My Integration',
        tier: 'free',
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        isActive: true
      }
    ];

    res.json({
      success: true,
      data: mockKeys
    });
  } catch (error) {
    console.error('❌ Failed to get API keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve API keys'
    });
  }
});

/**
 * DELETE /api/api-keys/:id
 * Revoke an API key
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // In a real implementation, revoke in database
    console.log('🗑️ API key revoked:', id, 'for user:', req.user.id);
    
    res.json({
      success: true,
      message: 'API key revoked successfully'
    });
  } catch (error) {
    console.error('❌ Failed to revoke API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke API key'
    });
  }
});

/**
 * GET /api/api-keys/usage/:id
 * Get API key usage statistics
 */
router.get('/usage/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Mock usage data
    const usageData = {
      apiCalls: 45,
      uploads: 12,
      contactsExtracted: 234,
      thisMonth: {
        apiCalls: 23,
        uploads: 8,
        contactsExtracted: 156
      },
      limits: {
        apiCalls: 100,
        uploads: 50
      }
    };
    
    res.json({
      success: true,
      data: usageData
    });
  } catch (error) {
    console.error('❌ Failed to get API key usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve usage statistics'
    });
  }
});

module.exports = router;