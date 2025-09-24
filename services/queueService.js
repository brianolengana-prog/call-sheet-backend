/**
 * Queue Service
 * 
 * Redis-based queue system for async AI processing
 * Handles job queuing, processing, and monitoring
 */

const Queue = require('bull');
const Redis = require('ioredis');
const path = require('path');

class QueueService {
  constructor() {
    // Check if Redis should be disabled due to previous failures
    this.redisDisabled = process.env.REDIS_DISABLED === 'true';
    
    if (this.redisDisabled) {
      console.log('⚠️ Queue Redis: Disabled by environment variable');
      this.redis = null;
      this.redisConnected = false;
      this.queues = new Map();
      this.workers = new Map();
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
      family: 4
    });

    this.queues = new Map();
    this.workers = new Map();
    this.redisConnected = false;
    
    this.setupRedisHandlers();
    this.initializeQueues();
  }

  /**
   * Setup Redis connection handlers
   */
  setupRedisHandlers() {
    this.redis.on('connect', () => {
      console.log('✅ Redis connected');
      this.redisConnected = true;
    });

    this.redis.on('error', (error) => {
      console.warn('⚠️ Redis connection error:', error.message);
      this.redisConnected = false;
    });

    this.redis.on('close', () => {
      console.warn('⚠️ Redis connection closed');
      this.redisConnected = false;
    });
  }

  /**
   * Initialize all processing queues
   */
  initializeQueues() {
    // AI Document Analysis Queue
    this.queues.set('ai-document-analysis', new Queue('ai-document-analysis', {
      redis: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    }));

    // AI Pattern Extraction Queue
    this.queues.set('ai-pattern-extraction', new Queue('ai-pattern-extraction', {
      redis: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    }));

    // AI Production Intelligence Queue
    this.queues.set('ai-production-intelligence', new Queue('ai-production-intelligence', {
      redis: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    }));

    // Complete AI Extraction Queue (orchestrates all AI components)
    this.queues.set('ai-complete-extraction', new Queue('ai-complete-extraction', {
      redis: this.redis,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      }
    }));

    // Batch Processing Queue
    this.queues.set('batch-processing', new Queue('batch-processing', {
      redis: this.redis,
      defaultJobOptions: {
        removeOnComplete: 20,
        removeOnFail: 10,
        attempts: 1,
        delay: 0
      }
    }));

    console.log('✅ Queue system initialized with 5 queues');
  }

  /**
   * Add a job to a specific queue
   * @param {string} queueName - Name of the queue
   * @param {string} jobType - Type of job
   * @param {Object} data - Job data
   * @param {Object} options - Job options
   * @returns {Promise<Object>} Job instance
   */
  async addJob(queueName, jobType, data, options = {}) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const jobOptions = {
      priority: options.priority || 0,
      delay: options.delay || 0,
      ...options
    };

    const job = await queue.add(jobType, data, jobOptions);
    
    console.log(`📝 Job added to ${queueName}: ${job.id} (${jobType})`);
    return job;
  }

  /**
   * Add AI document analysis job
   * @param {Object} data - Document analysis data
   * @param {Object} options - Job options
   * @returns {Promise<Object>} Job instance
   */
  async addDocumentAnalysisJob(data, options = {}) {
    return this.addJob('ai-document-analysis', 'analyze-document', data, {
      priority: 1,
      ...options
    });
  }

  /**
   * Add AI pattern extraction job
   * @param {Object} data - Pattern extraction data
   * @param {Object} options - Job options
   * @returns {Promise<Object>} Job instance
   */
  async addPatternExtractionJob(data, options = {}) {
    return this.addJob('ai-pattern-extraction', 'extract-patterns', data, {
      priority: 1,
      ...options
    });
  }

  /**
   * Add AI production intelligence job
   * @param {Object} data - Production intelligence data
   * @param {Object} options - Job options
   * @returns {Promise<Object>} Job instance
   */
  async addProductionIntelligenceJob(data, options = {}) {
    return this.addJob('ai-production-intelligence', 'process-intelligence', data, {
      priority: 2,
      ...options
    });
  }

  /**
   * Add complete AI extraction job
   * @param {Object} data - Complete extraction data
   * @param {Object} options - Job options
   * @returns {Promise<Object>} Job instance
   */
  async addCompleteExtractionJob(data, options = {}) {
    return this.addJob('ai-complete-extraction', 'complete-extraction', data, {
      priority: 0, // Highest priority
      ...options
    });
  }

  /**
   * Add batch processing job
   * @param {Object} data - Batch processing data
   * @param {Object} options - Job options
   * @returns {Promise<Object>} Job instance
   */
  async addBatchProcessingJob(data, options = {}) {
    return this.addJob('batch-processing', 'process-batch', data, {
      priority: 3,
      ...options
    });
  }

  /**
   * Get job status
   * @param {string} queueName - Name of the queue
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job status
   */
  async getJobStatus(queueName, jobId) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    return {
      id: job.id,
      status: state,
      progress: job.progress(),
      data: job.data,
      result: job.returnvalue,
      error: job.failedReason,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : null
    };
  }

  /**
   * Get queue statistics
   * @param {string} queueName - Name of the queue
   * @returns {Promise<Object>} Queue statistics
   */
  async getQueueStats(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();

    return {
      queueName,
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length
    };
  }

  /**
   * Get all queue statistics
   * @returns {Promise<Object>} All queue statistics
   */
  async getAllQueueStats() {
    const stats = {};
    for (const [queueName] of this.queues) {
      stats[queueName] = await this.getQueueStats(queueName);
    }
    return stats;
  }

  /**
   * Clean completed jobs from a queue
   * @param {string} queueName - Name of the queue
   * @param {number} count - Number of jobs to keep
   * @returns {Promise<void>}
   */
  async cleanQueue(queueName, count = 100) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.clean(5000, 'completed', count);
    await queue.clean(5000, 'failed', count);
  }

  /**
   * Pause a queue
   * @param {string} queueName - Name of the queue
   * @returns {Promise<void>}
   */
  async pauseQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.pause();
    console.log(`⏸️ Queue ${queueName} paused`);
  }

  /**
   * Resume a queue
   * @param {string} queueName - Name of the queue
   * @returns {Promise<void>}
   */
  async resumeQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.resume();
    console.log(`▶️ Queue ${queueName} resumed`);
  }

  /**
   * Get queue health status
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
      
      if (!this.redisConnected) {
        return {
          status: 'degraded',
          redis: 'disconnected',
          error: 'Redis not connected',
          timestamp: new Date().toISOString()
        };
      }

      await this.redis.ping();
      const stats = await this.getAllQueueStats();
      
      return {
        status: 'healthy',
        redis: 'connected',
        queues: Object.keys(stats).length,
        timestamp: new Date().toISOString(),
        stats
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        redis: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Close all queues and Redis connection
   * @returns {Promise<void>}
   */
  async close() {
    console.log('🔄 Closing queue system...');
    
    // Close all queues
    for (const [queueName, queue] of this.queues) {
      await queue.close();
      console.log(`✅ Queue ${queueName} closed`);
    }
    
    // Close Redis connection
    await this.redis.quit();
    console.log('✅ Redis connection closed');
  }
}

module.exports = QueueService;