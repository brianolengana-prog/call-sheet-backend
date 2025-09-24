/**
 * API Key Management Service
 * 
 * Handles API key generation, validation, and management
 */

const crypto = require('crypto');
const prismaService = require('./prismaService');

class APIKeyService {
  constructor() {
    this.keyPrefix = 'sk_';
    this.keyLength = 32;
  }

  /**
   * Generate a new API key
   */
  generateAPIKey() {
    const randomBytes = crypto.randomBytes(this.keyLength);
    const key = randomBytes.toString('hex');
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Create a new API key for a user
   */
  async createAPIKey(userId, keyData) {
    try {
      const apiKey = this.generateAPIKey();
      const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

      // Store in database (we'll need to add this to Prisma schema)
      const keyRecord = {
        id: crypto.randomUUID(),
        userId: userId,
        name: keyData.name,
        keyHash: hashedKey,
        permissions: keyData.permissions,
        expiresAt: keyData.expiresAt ? new Date(keyData.expiresAt) : null,
        isActive: true,
        createdAt: new Date(),
        lastUsedAt: null
      };

      // For now, we'll use a simple in-memory store
      // In production, this should be stored in the database
      if (!global.apiKeys) {
        global.apiKeys = new Map();
      }
      global.apiKeys.set(apiKey, keyRecord);

      return {
        success: true,
        apiKey: apiKey,
        keyId: keyRecord.id,
        expiresAt: keyRecord.expiresAt
      };
    } catch (error) {
      console.error('Error creating API key:', error);
      return {
        success: false,
        error: 'Failed to create API key'
      };
    }
  }

  /**
   * Validate an API key
   */
  async validateAPIKey(apiKey) {
    try {
      if (!apiKey || !apiKey.startsWith(this.keyPrefix)) {
        return {
          success: false,
          error: 'Invalid API key format'
        };
      }

      // Check if key exists in our store
      if (!global.apiKeys || !global.apiKeys.has(apiKey)) {
        return {
          success: false,
          error: 'API key not found'
        };
      }

      const keyRecord = global.apiKeys.get(apiKey);

      // Check if key is active
      if (!keyRecord.isActive) {
        return {
          success: false,
          error: 'API key is inactive'
        };
      }

      // Check if key has expired
      if (keyRecord.expiresAt && new Date() > keyRecord.expiresAt) {
        return {
          success: false,
          error: 'API key has expired'
        };
      }

      // Update last used timestamp
      keyRecord.lastUsedAt = new Date();
      global.apiKeys.set(apiKey, keyRecord);

      return {
        success: true,
        keyRecord: keyRecord
      };
    } catch (error) {
      console.error('Error validating API key:', error);
      return {
        success: false,
        error: 'API key validation failed'
      };
    }
  }

  /**
   * Get all API keys for a user
   */
  async getUserAPIKeys(userId) {
    try {
      if (!global.apiKeys) {
        return [];
      }

      const userKeys = [];
      for (const [key, record] of global.apiKeys.entries()) {
        if (record.userId === userId) {
          userKeys.push({
            id: record.id,
            name: record.name,
            permissions: record.permissions,
            expiresAt: record.expiresAt,
            isActive: record.isActive,
            createdAt: record.createdAt,
            lastUsedAt: record.lastUsedAt,
            // Don't return the actual key for security
            keyPreview: key.substring(0, 8) + '...' + key.substring(key.length - 4)
          });
        }
      }

      return userKeys;
    } catch (error) {
      console.error('Error getting user API keys:', error);
      return [];
    }
  }

  /**
   * Revoke an API key
   */
  async revokeAPIKey(userId, keyId) {
    try {
      if (!global.apiKeys) {
        return {
          success: false,
          error: 'No API keys found'
        };
      }

      // Find the key to revoke
      for (const [key, record] of global.apiKeys.entries()) {
        if (record.id === keyId && record.userId === userId) {
          record.isActive = false;
          global.apiKeys.set(key, record);
          return {
            success: true,
            message: 'API key revoked successfully'
          };
        }
      }

      return {
        success: false,
        error: 'API key not found or access denied'
      };
    } catch (error) {
      console.error('Error revoking API key:', error);
      return {
        success: false,
        error: 'Failed to revoke API key'
      };
    }
  }

  /**
   * Check if API key has required permissions
   */
  hasPermission(keyRecord, requiredPermission) {
    if (!keyRecord || !keyRecord.permissions) {
      return false;
    }

    return keyRecord.permissions.includes(requiredPermission) || 
           keyRecord.permissions.includes('admin');
  }
}

module.exports = new APIKeyService();
