/**
 * Cache Service
 * 
 * Intelligent caching system for AI models and results
 * Implements Redis-based caching with smart invalidation
 */

const Redis = require('ioredis');
const crypto = require('crypto');

class CacheService {
  constructor() {
    // Check if Redis should be disabled due to previous failures
    this.redisDisabled = process.env.REDIS_DISABLED === 'true';
    
    if (this.redisDisabled) {
      console.log('⚠️ Cache Redis: Disabled by environment variable');
      this.redis = null;
      this.redisConnected = false;
      return;
    }

    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 0, // Disable retry delays
      maxRetriesPerRequest: 0, // Disable retries to prevent loops
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 5000,
      commandTimeout: 2000,
      keepAlive: 30000,
      family: 4,
      retryDelayOnClusterDown: 0, // Disable cluster retry delays
      enableReadyCheck: false,
      maxLoadingTimeout: 5000,
      enableAutoPipelining: false // Disable auto pipelining
    });

    this.redisConnected = false;
    this.setupRedisHandlers();

    this.defaultTTL = {
      aiModel: 3600, // 1 hour
      aiResult: 1800, // 30 minutes
      documentAnalysis: 900, // 15 minutes
      patternExtraction: 600, // 10 minutes
      productionIntelligence: 1200, // 20 minutes
      userSession: 1800, // 30 minutes
      apiResponse: 300 // 5 minutes
    };

    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      totalRequests: 0
    };

    this.initializeCache();
  }

  /**
   * Setup Redis connection handlers
   */
  setupRedisHandlers() {
    let connectionFailures = 0;
    const maxFailures = 2; // Reduced to 2 failures

    this.redis.on('connect', () => {
      console.log('✅ Cache Redis connected');
      this.redisConnected = true;
      connectionFailures = 0; // Reset on successful connection
    });

    this.redis.on('error', (error) => {
      connectionFailures++;
      console.warn(`⚠️ Cache Redis connection error (${connectionFailures}/${maxFailures}):`, error.message);
      this.redisConnected = false;
      
      // If too many failures, disable Redis entirely and stop all reconnection attempts
      if (connectionFailures >= maxFailures) {
        console.warn('⚠️ Cache Redis: Too many connection failures, disabling Redis permanently');
        this.redis.disconnect();
        this.redis.removeAllListeners(); // Remove all event listeners
        this.redis = null; // Disable Redis entirely
        this.redisDisabled = true;
        
        // Set environment variable to disable Redis on next restart
        process.env.REDIS_DISABLED = 'true';
        console.log('⚠️ Cache Redis: Set REDIS_DISABLED=true for next restart');
      }
    });

    this.redis.on('close', () => {
      console.warn('⚠️ Cache Redis connection closed');
      this.redisConnected = false;
    });

    this.redis.on('reconnecting', () => {
      console.log('🔄 Cache Redis: Reconnecting...');
    });
  }

  /**
   * Initialize cache with default configurations
   */
  async initializeCache() {
    try {
      if (this.redisConnected) {
        await this.redis.ping();
        console.log('✅ Cache service connected to Redis');
      } else {
        console.warn('⚠️ Cache service running without Redis (fallback mode)');
      }
    } catch (error) {
      console.warn('⚠️ Cache service Redis connection failed, running in fallback mode:', error.message);
    }

    // Set up memory monitoring
    this.setupMemoryMonitoring();
  }

  /**
   * Setup memory monitoring to prevent connection issues
   */
  setupMemoryMonitoring() {
    let lastAlertTime = 0;
    const alertCooldown = 60000; // 1 minute between alerts
    
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const memoryPercentage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
      const now = Date.now();

      // Only alert if above 85% and enough time has passed since last alert
      if (memoryPercentage > 85 && (now - lastAlertTime) > alertCooldown) {
        console.warn(`🚨 Alert: High memory usage: ${memoryPercentage}% (${heapUsedMB}MB/${heapTotalMB}MB)`);
        lastAlertTime = now;
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          console.log('🧹 Forced garbage collection');
        }
        
        // Clear cache if memory is critically high
        if (memoryPercentage > 90) {
          this.clearAllCaches();
          console.log('🧹 Cleared all caches due to critical memory usage');
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Generate cache key with namespace
   * @param {string} namespace - Cache namespace
   * @param {string} key - Cache key
   * @param {Object} params - Additional parameters for key generation
   * @returns {string} Generated cache key
   */
  generateKey(namespace, key, params = {}) {
    const paramString = Object.keys(params).length > 0 
      ? crypto.createHash('md5').update(JSON.stringify(params)).digest('hex')
      : '';
    
    return `cache:${namespace}:${key}${paramString ? `:${paramString}` : ''}`;
  }

  /**
   * Get value from cache
   * @param {string} namespace - Cache namespace
   * @param {string} key - Cache key
   * @param {Object} params - Additional parameters
   * @returns {Promise<Object|null>} Cached value or null
   */
  async get(namespace, key, params = {}) {
    try {
      this.cacheStats.totalRequests++;
      
      if (!this.redis || !this.redisConnected) {
        this.cacheStats.misses++;
        return null;
      }
      
      const cacheKey = this.generateKey(namespace, key, params);
      const value = await this.redis.get(cacheKey);
      
      if (value) {
        this.cacheStats.hits++;
        return JSON.parse(value);
      } else {
        this.cacheStats.misses++;
        return null;
      }
    } catch (error) {
      console.error('❌ Cache get error:', error);
      this.cacheStats.misses++;
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {string} namespace - Cache namespace
   * @param {string} key - Cache key
   * @param {Object} value - Value to cache
   * @param {Object} params - Additional parameters
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} Success status
   */
  async set(namespace, key, value, params = {}, ttl = null) {
    try {
      this.cacheStats.sets++;
      
      if (!this.redis || !this.redisConnected) {
        return false;
      }
      
      const cacheKey = this.generateKey(namespace, key, params);
      const ttlToUse = ttl || this.defaultTTL[namespace] || 300;
      
      await this.redis.setex(cacheKey, ttlToUse, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('❌ Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   * @param {string} namespace - Cache namespace
   * @param {string} key - Cache key
   * @param {Object} params - Additional parameters
   * @returns {Promise<boolean>} Success status
   */
  async delete(namespace, key, params = {}) {
    try {
      this.cacheStats.deletes++;
      
      const cacheKey = this.generateKey(namespace, key, params);
      const result = await this.redis.del(cacheKey);
      return result > 0;
    } catch (error) {
      console.error('❌ Cache delete error:', error);
      return false;
    }
  }

  /**
   * Clear all cache entries for a namespace
   * @param {string} namespace - Cache namespace
   * @returns {Promise<number>} Number of keys deleted
   */
  async clearNamespace(namespace) {
    try {
      const pattern = `cache:${namespace}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        return await this.redis.del(...keys);
      }
      
      return 0;
    } catch (error) {
      console.error('❌ Cache clear namespace error:', error);
      return 0;
    }
  }

  /**
   * Cache AI model results
   * @param {string} modelType - Type of AI model
   * @param {Object} input - Model input
   * @param {Object} result - Model result
   * @param {number} ttl - Time to live
   * @returns {Promise<boolean>} Success status
   */
  async cacheAIModel(modelType, input, result, ttl = null) {
    const params = {
      modelType,
      inputHash: crypto.createHash('md5').update(JSON.stringify(input)).digest('hex')
    };
    
    return this.set('aiModel', modelType, result, params, ttl);
  }

  /**
   * Get cached AI model results
   * @param {string} modelType - Type of AI model
   * @param {Object} input - Model input
   * @returns {Promise<Object|null>} Cached result or null
   */
  async getCachedAIModel(modelType, input) {
    const params = {
      modelType,
      inputHash: crypto.createHash('md5').update(JSON.stringify(input)).digest('hex')
    };
    
    return this.get('aiModel', modelType, params);
  }

  /**
   * Cache document analysis results
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} mimeType - MIME type
   * @param {Object} result - Analysis result
   * @returns {Promise<boolean>} Success status
   */
  async cacheDocumentAnalysis(fileBuffer, mimeType, result) {
    const params = {
      fileHash: crypto.createHash('md5').update(fileBuffer).digest('hex'),
      mimeType
    };
    
    return this.set('documentAnalysis', 'analysis', result, params);
  }

  /**
   * Get cached document analysis
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} mimeType - MIME type
   * @returns {Promise<Object|null>} Cached result or null
   */
  async getCachedDocumentAnalysis(fileBuffer, mimeType) {
    const params = {
      fileHash: crypto.createHash('md5').update(fileBuffer).digest('hex'),
      mimeType
    };
    
    return this.get('documentAnalysis', 'analysis', params);
  }

  /**
   * Cache pattern extraction results
   * @param {string} text - Extracted text
   * @param {Object} documentAnalysis - Document analysis
   * @param {Array} contacts - Extracted contacts
   * @returns {Promise<boolean>} Success status
   */
  async cachePatternExtraction(text, documentAnalysis, contacts) {
    const params = {
      textHash: crypto.createHash('md5').update(text).digest('hex'),
      docType: documentAnalysis.type
    };
    
    return this.set('patternExtraction', 'contacts', contacts, params);
  }

  /**
   * Get cached pattern extraction
   * @param {string} text - Extracted text
   * @param {Object} documentAnalysis - Document analysis
   * @returns {Promise<Array|null>} Cached contacts or null
   */
  async getCachedPatternExtraction(text, documentAnalysis) {
    const params = {
      textHash: crypto.createHash('md5').update(text).digest('hex'),
      docType: documentAnalysis.type
    };
    
    return this.get('patternExtraction', 'contacts', params);
  }

  /**
   * Cache production intelligence results
   * @param {Array} contacts - Input contacts
   * @param {Object} documentAnalysis - Document analysis
   * @param {Array} enhancedContacts - Enhanced contacts
   * @returns {Promise<boolean>} Success status
   */
  async cacheProductionIntelligence(contacts, documentAnalysis, enhancedContacts) {
    const params = {
      contactsHash: crypto.createHash('md5').update(JSON.stringify(contacts)).digest('hex'),
      docType: documentAnalysis.type,
      productionType: documentAnalysis.productionType
    };
    
    return this.set('productionIntelligence', 'enhanced', enhancedContacts, params);
  }

  /**
   * Get cached production intelligence
   * @param {Array} contacts - Input contacts
   * @param {Object} documentAnalysis - Document analysis
   * @returns {Promise<Array|null>} Cached enhanced contacts or null
   */
  async getCachedProductionIntelligence(contacts, documentAnalysis) {
    const params = {
      contactsHash: crypto.createHash('md5').update(JSON.stringify(contacts)).digest('hex'),
      docType: documentAnalysis.type,
      productionType: documentAnalysis.productionType
    };
    
    return this.get('productionIntelligence', 'enhanced', params);
  }

  /**
   * Cache complete AI extraction results
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} mimeType - MIME type
   * @param {Object} options - Extraction options
   * @param {Object} result - Complete extraction result
   * @returns {Promise<boolean>} Success status
   */
  async cacheCompleteExtraction(fileBuffer, mimeType, options, result) {
    const params = {
      fileHash: crypto.createHash('md5').update(fileBuffer).digest('hex'),
      mimeType,
      optionsHash: crypto.createHash('md5').update(JSON.stringify(options)).digest('hex')
    };
    
    return this.set('aiResult', 'complete', result, params);
  }

  /**
   * Get cached complete AI extraction
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} mimeType - MIME type
   * @param {Object} options - Extraction options
   * @returns {Promise<Object|null>} Cached result or null
   */
  async getCachedCompleteExtraction(fileBuffer, mimeType, options) {
    const params = {
      fileHash: crypto.createHash('md5').update(fileBuffer).digest('hex'),
      mimeType,
      optionsHash: crypto.createHash('md5').update(JSON.stringify(options)).digest('hex')
    };
    
    return this.get('aiResult', 'complete', params);
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const hitRate = this.cacheStats.totalRequests > 0 
      ? (this.cacheStats.hits / this.cacheStats.totalRequests) * 100 
      : 0;
    
    return {
      ...this.cacheStats,
      hitRate: Math.round(hitRate * 100) / 100,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get cache health status
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus() {
    try {
      if (this.redisDisabled) {
        return {
          status: 'degraded',
          redis: 'disabled',
          message: 'Redis disabled by environment variable',
          timestamp: new Date().toISOString()
        };
      }
      
      if (!this.redis || !this.redisConnected) {
        return {
          status: 'degraded',
          redis: 'disconnected',
          error: 'Redis not connected',
          timestamp: new Date().toISOString()
        };
      }
      
      await this.redis.ping();
      const stats = this.getStats();
      
      return {
        status: 'healthy',
        redis: 'connected',
        stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'degraded',
        redis: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Clear all cache
   * @returns {Promise<boolean>} Success status
   */
  async clearAll() {
    try {
      await this.redis.flushdb();
      console.log('✅ All cache cleared');
      return true;
    } catch (error) {
      console.error('❌ Cache clear all error:', error);
      return false;
    }
  }

  /**
   * Emergency memory cleanup
   * @returns {Promise<boolean>} Success status
   */
  async emergencyCleanup() {
    try {
      console.log('🚨 Emergency memory cleanup initiated');
      
      // Clear all caches
      await this.clearAll();
      
      // Force garbage collection multiple times
      if (global.gc) {
        for (let i = 0; i < 3; i++) {
          global.gc();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log('🧹 Multiple garbage collection cycles completed');
      }
      
      // Log final memory usage
      const memUsage = process.memoryUsage();
      const memoryPercentage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
      console.log(`📊 Memory after cleanup: ${memoryPercentage}%`);
      
      return true;
    } catch (error) {
      console.error('❌ Emergency cleanup failed:', error);
      return false;
    }
  }

  /**
   * Close cache service
   * @returns {Promise<void>}
   */
  async close() {
    await this.redis.quit();
    console.log('✅ Cache service closed');
  }
}

module.exports = CacheService;