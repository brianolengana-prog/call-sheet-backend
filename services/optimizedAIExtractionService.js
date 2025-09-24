/**
 * Optimized AI Extraction Service
 * 
 * Production-optimized AI extraction with queue system, caching, and monitoring
 * Integrates all Phase 3 components for maximum performance and scalability
 */

const QueueService = require('./queueService');
const CacheService = require('./cacheService');
const MonitoringService = require('./monitoringService');
const AIEnhancedExtractionService = require('./aiEnhancedExtractionService');

class OptimizedAIExtractionService {
  constructor() {
    this.queueService = new QueueService();
    this.cacheService = new CacheService();
    this.monitoringService = new MonitoringService();
    this.aiService = new AIEnhancedExtractionService();
    
    this.processingStats = {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageProcessingTime: 0,
      cacheHitRate: 0,
      queueUtilization: 0
    };

    this.initializeService();
  }

  /**
   * Initialize the optimized service
   */
  async initializeService() {
    console.log('🚀 Initializing Optimized AI Extraction Service...');
    
    try {
      // Test all service connections
      await this.testConnections();
      
      // Setup monitoring
      this.setupMonitoring();
      
      console.log('✅ Optimized AI Extraction Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Optimized AI Extraction Service:', error);
      throw error;
    }
  }

  /**
   * Test all service connections
   */
  async testConnections() {
    // Test queue service
    const queueHealth = await this.queueService.getHealthStatus();
    if (queueHealth.status !== 'healthy') {
      console.warn('⚠️ Queue service not healthy, running in fallback mode');
    }
    
    // Test cache service
    const cacheHealth = await this.cacheService.getHealthStatus();
    if (cacheHealth.status !== 'healthy') {
      console.warn('⚠️ Cache service not healthy, running in fallback mode');
    }
    
    console.log('✅ Service connections verified (with fallbacks if needed)');
  }

  /**
   * Setup monitoring for the service
   */
  setupMonitoring() {
    // Update monitoring with initial stats
    this.monitoringService.updateAIMetrics({
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalProcessingTime: 0
    });
    
    console.log('📊 Monitoring setup complete');
  }

  /**
   * Process AI extraction with optimization
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} mimeType - MIME type
   * @param {string} fileName - File name
   * @param {Object} options - Extraction options
   * @param {boolean} async - Whether to process asynchronously
   * @returns {Promise<Object>} Extraction result
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}, async = false) {
    const startTime = Date.now();
    this.processingStats.totalJobs++;
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(fileBuffer, mimeType, options);
      const cachedResult = await this.cacheService.getCachedCompleteExtraction(
        fileBuffer, mimeType, options
      );
      
      if (cachedResult) {
        this.processingStats.cacheHitRate = 
          (this.processingStats.cacheHitRate * (this.processingStats.totalJobs - 1) + 1) / this.processingStats.totalJobs;
        
        console.log('💾 Cache hit for AI extraction');
        return {
          ...cachedResult,
          cached: true,
          processingTime: Date.now() - startTime
        };
      }
      
      // Process based on async flag
      if (async) {
        return await this.processAsyncExtraction(fileBuffer, mimeType, fileName, options);
      } else {
        return await this.processSyncExtraction(fileBuffer, mimeType, fileName, options);
      }
      
    } catch (error) {
      this.processingStats.failedJobs++;
      this.monitoringService.updateAIMetrics({
        failedRequests: this.processingStats.failedJobs
      });
      
      console.error('❌ Optimized AI extraction failed:', error);
      throw error;
    }
  }

  /**
   * Process extraction asynchronously using queue
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} mimeType - MIME type
   * @param {string} fileName - File name
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} Job information
   */
  async processAsyncExtraction(fileBuffer, mimeType, fileName, options) {
    try {
      const job = await this.queueService.addCompleteExtractionJob({
        fileBuffer: fileBuffer.toString('base64'),
        mimeType,
        fileName,
        options
      }, {
        priority: options.priority || 0,
        delay: options.delay || 0
      });
      
      console.log(`📝 AI extraction job queued: ${job.id}`);
      
      return {
        success: true,
        jobId: job.id,
        status: 'queued',
        message: 'AI extraction job queued for processing',
        estimatedWaitTime: await this.estimateWaitTime(),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Failed to queue AI extraction:', error);
      throw error;
    }
  }

  /**
   * Process extraction synchronously with caching
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} mimeType - MIME type
   * @param {string} fileName - File name
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} Extraction result
   */
  async processSyncExtraction(fileBuffer, mimeType, fileName, options) {
    const startTime = Date.now();
    
    try {
      const isSpreadsheet = (
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mimeType === 'application/vnd.ms-excel' ||
        mimeType?.includes('spreadsheet') ||
        fileName?.toLowerCase().endsWith('.xlsx') ||
        fileName?.toLowerCase().endsWith('.xls') ||
        fileName?.toLowerCase().endsWith('.csv')
      );
      const isImage = (
        mimeType?.startsWith('image/')
      );

      const useCustomFirst = Boolean(options?.forceCustom) || isSpreadsheet || isImage;

      let result;
      if (useCustomFirst) {
        try {
          const CustomExtractionService = require('./customExtractionService');
          const customService = new CustomExtractionService();
          const customResult = await customService.extractContactsFromBuffer(fileBuffer, fileName, mimeType, options);
          if (customResult && Array.isArray(customResult.contacts) && customResult.contacts.length > 0) {
            result = { ...customResult, metadata: { ...(customResult.metadata || {}), primary: 'custom' } };
          }
        } catch (e) {
          console.warn('⚠️ Custom-first extraction failed:', e.message);
        }

        // If custom produced nothing and not explicitly forced custom-only, try AI next
        if ((!result || !result.contacts || result.contacts.length === 0) && !options?.customOnly) {
          result = await this.aiService.extractContacts(
            fileBuffer,
            mimeType,
            fileName,
            options
          );
        }
      } else {
        // Use the enhanced AI service for processing first
        result = await this.aiService.extractContacts(
          fileBuffer,
          mimeType,
          fileName,
          options
        );
      }
      
      // Fallback: if AI returns 0 contacts or analyzer reports tabular data, try custom extractor
      const shouldFallbackToCustom = (
        !result?.contacts || result.contacts.length === 0 ||
        result?.metadata?.documentStructure === 'tabular' ||
        mimeType?.includes('spreadsheet') ||
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      let finalResult = result;
      if (shouldFallbackToCustom) {
        try {
          // Lazy-require to avoid loading cost unless needed
          const CustomExtractionService = require('./customExtractionService');
          const customService = new CustomExtractionService();
          const customResult = await customService.extractContactsFromBuffer(fileBuffer, fileName, mimeType, options);
          if (customResult && Array.isArray(customResult.contacts) && customResult.contacts.length > 0) {
            finalResult = {
              ...customResult,
              metadata: { ...(customResult.metadata || {}), fallbackUsed: 'custom' }
            };
          }
        } catch (fallbackError) {
          console.warn('⚠️ Custom fallback extraction failed:', fallbackError.message);
        }
      }

      const processingTime = Date.now() - startTime;
      
      // Update statistics
      this.processingStats.completedJobs++;
      this.processingStats.averageProcessingTime = 
        (this.processingStats.averageProcessingTime * (this.processingStats.completedJobs - 1) + processingTime) / this.processingStats.completedJobs;
      
      // Update monitoring
      this.monitoringService.updateAIMetrics({
        successfulRequests: this.processingStats.completedJobs,
        totalProcessingTime: this.processingStats.averageProcessingTime * this.processingStats.completedJobs
      });
      
      // Cache the result
      await this.cacheService.cacheCompleteExtraction(fileBuffer, mimeType, options, finalResult);
      
      return {
        ...finalResult,
        processingTime,
        cached: false,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Sync AI extraction failed:', error);
      throw error;
    }
  }

  /**
   * Get job status
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job status
   */
  async getJobStatus(jobId) {
    try {
      const jobStatus = await this.queueService.getJobStatus('ai-complete-extraction', jobId);
      
      // If job is completed, cache the result
      if (jobStatus.status === 'completed' && jobStatus.result) {
        const { fileBuffer, mimeType, options } = jobStatus.data;
        await this.cacheService.cacheCompleteExtraction(
          Buffer.from(fileBuffer, 'base64'),
          mimeType,
          options,
          jobStatus.result
        );
      }
      
      return jobStatus;
    } catch (error) {
      console.error('❌ Failed to get job status:', error);
      throw error;
    }
  }

  /**
   * Process batch extraction
   * @param {Array} files - Array of file objects
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} Batch processing result
   */
  async processBatchExtraction(files, options = {}) {
    try {
      const job = await this.queueService.addBatchProcessingJob({
        files: files.map(file => ({
          buffer: file.buffer.toString('base64'),
          mimeType: file.mimeType,
          fileName: file.fileName
        })),
        options
      });
      
      console.log(`📝 Batch processing job queued: ${job.id}`);
      
      return {
        success: true,
        jobId: job.id,
        status: 'queued',
        message: 'Batch processing job queued',
        fileCount: files.length,
        estimatedWaitTime: await this.estimateWaitTime(files.length),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Failed to queue batch processing:', error);
      throw error;
    }
  }

  /**
   * Estimate wait time for queue processing
   * @param {number} jobCount - Number of jobs
   * @returns {Promise<number>} Estimated wait time in seconds
   */
  async estimateWaitTime(jobCount = 1) {
    try {
      const queueStats = await this.queueService.getQueueStats('ai-complete-extraction');
      const averageProcessingTime = this.processingStats.averageProcessingTime || 5000; // Default 5 seconds
      
      const waitTime = (queueStats.waiting + queueStats.active) * (averageProcessingTime / 1000);
      return Math.round(waitTime);
    } catch (error) {
      return 30; // Default 30 seconds
    }
  }

  /**
   * Generate cache key for extraction
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} mimeType - MIME type
   * @param {Object} options - Extraction options
   * @returns {string} Cache key
   */
  generateCacheKey(fileBuffer, mimeType, options) {
    const crypto = require('crypto');
    const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const optionsHash = crypto.createHash('md5').update(JSON.stringify(options)).digest('hex');
    return `${fileHash}:${mimeType}:${optionsHash}`;
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStats() {
    return {
      processing: this.processingStats,
      cache: this.cacheService.getStats(),
      monitoring: this.monitoringService.getMetrics(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get service health status
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus() {
    try {
      const queueHealth = await this.queueService.getHealthStatus();
      const cacheHealth = await this.cacheService.getHealthStatus();
      const monitoringHealth = this.monitoringService.getHealthStatus();
      
      // Core service is healthy if monitoring is healthy (queue and cache are optional)
      const coreHealthy = monitoringHealth.status === 'healthy';
      const queueHealthy = queueHealth.status === 'healthy' || queueHealth.status === 'degraded';
      const cacheHealthy = cacheHealth.status === 'healthy' || cacheHealth.status === 'degraded';
      
      const overallStatus = coreHealthy ? 'healthy' : 'unhealthy';
      const degradedServices = [];
      
      if (queueHealth.status !== 'healthy') degradedServices.push('queue');
      if (cacheHealth.status !== 'healthy') degradedServices.push('cache');
      
      return {
        status: overallStatus,
        degraded: degradedServices,
        services: {
          queue: queueHealth,
          cache: cacheHealth,
          monitoring: monitoringHealth
        },
        stats: this.getStats(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Clear all caches
   * @returns {Promise<boolean>} Success status
   */
  async clearCaches() {
    try {
      await this.cacheService.clearAll();
      console.log('✅ All caches cleared');
      return true;
    } catch (error) {
      console.error('❌ Failed to clear caches:', error);
      return false;
    }
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>} Queue statistics
   */
  async getQueueStats() {
    return await this.queueService.getAllQueueStats();
  }

  /**
   * Pause all queues
   * @returns {Promise<void>}
   */
  async pauseQueues() {
    const queueNames = ['ai-document-analysis', 'ai-pattern-extraction', 'ai-production-intelligence', 'ai-complete-extraction', 'batch-processing'];
    
    for (const queueName of queueNames) {
      await this.queueService.pauseQueue(queueName);
    }
    
    console.log('⏸️ All queues paused');
  }

  /**
   * Resume all queues
   * @returns {Promise<void>}
   */
  async resumeQueues() {
    const queueNames = ['ai-document-analysis', 'ai-pattern-extraction', 'ai-production-intelligence', 'ai-complete-extraction', 'batch-processing'];
    
    for (const queueName of queueNames) {
      await this.queueService.resumeQueue(queueName);
    }
    
    console.log('▶️ All queues resumed');
  }

  /**
   * Close the optimized service
   * @returns {Promise<void>}
   */
  async close() {
    console.log('🔄 Closing Optimized AI Extraction Service...');
    
    this.monitoringService.stop();
    await this.cacheService.close();
    await this.queueService.close();
    
    console.log('✅ Optimized AI Extraction Service closed');
  }
}

module.exports = OptimizedAIExtractionService;
