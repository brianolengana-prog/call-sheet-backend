/**
 * Caching Service for Document Processing
 * Implements multi-level caching for performance optimization
 */

const Redis = require('ioredis');
const NodeCache = require('node-cache');

class CacheService {
  constructor() {
    // Redis for distributed caching
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    
    // In-memory cache for frequently accessed data
    this.memoryCache = new NodeCache({
      stdTTL: 300, // 5 minutes
      checkperiod: 120, // 2 minutes
      useClones: false
    });
    
    this.setupCacheStrategies();
  }

  /**
   * Setup caching strategies
   */
  setupCacheStrategies() {
    // Document text caching
    this.documentCache = {
      key: 'doc:text:',
      ttl: 3600, // 1 hour
      strategy: 'redis'
    };
    
    // AI extraction results caching
    this.extractionCache = {
      key: 'ai:extraction:',
      ttl: 1800, // 30 minutes
      strategy: 'redis'
    };
    
    // User preferences caching
    this.preferencesCache = {
      key: 'user:prefs:',
      ttl: 1800, // 30 minutes
      strategy: 'memory'
    };
  }

  /**
   * Cache document text
   */
  async cacheDocumentText(fileHash, text) {
    const key = `${this.documentCache.key}${fileHash}`;
    await this.redis.setex(key, this.documentCache.ttl, text);
  }

  /**
   * Get cached document text
   */
  async getCachedDocumentText(fileHash) {
    const key = `${this.documentCache.key}${fileHash}`;
    return await this.redis.get(key);
  }

  /**
   * Cache AI extraction results
   */
  async cacheExtractionResults(textHash, contacts) {
    const key = `${this.extractionCache.key}${textHash}`;
    await this.redis.setex(key, this.extractionCache.ttl, JSON.stringify(contacts));
  }

  /**
   * Get cached extraction results
   */
  async getCachedExtractionResults(textHash) {
    const key = `${this.extractionCache.key}${textHash}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Cache user preferences
   */
  cacheUserPreferences(userId, preferences) {
    const key = `${this.preferencesCache.key}${userId}`;
    this.memoryCache.set(key, preferences);
  }

  /**
   * Get cached user preferences
   */
  getCachedUserPreferences(userId) {
    const key = `${this.preferencesCache.key}${userId}`;
    return this.memoryCache.get(key);
  }

  /**
   * Generate cache keys
   */
  generateFileHash(buffer) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  generateTextHash(text) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(text).digest('hex');
  }

  /**
   * Cache statistics
   */
  async getCacheStats() {
    const memoryStats = this.memoryCache.getStats();
    const redisInfo = await this.redis.info('memory');
    
    return {
      memory: memoryStats,
      redis: redisInfo,
      strategies: {
        document: this.documentCache,
        extraction: this.extractionCache,
        preferences: this.preferencesCache
      }
    };
  }
}

module.exports = new CacheService();
