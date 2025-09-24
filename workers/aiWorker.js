/**
 * AI Worker
 * 
 * Background worker for processing AI extraction jobs
 * Handles document analysis, pattern extraction, and production intelligence
 */

const Queue = require('bull');
const Redis = require('ioredis');
const path = require('path');

// Import AI services
const AIDocumentAnalyzer = require('../services/extraction/aiDocumentAnalyzer');
const AIPatternExtractor = require('../services/extraction/aiPatternExtractor');
const AIProductionIntelligence = require('../services/extraction/aiProductionIntelligence');
const AIEnhancedExtractionService = require('../services/aiEnhancedExtractionService');

class AIWorker {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.queues = new Map();
    this.aiServices = this.initializeAIServices();
    this.metrics = {
      processedJobs: 0,
      failedJobs: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0
    };

    this.initializeQueues();
    this.setupEventHandlers();
  }

  /**
   * Initialize AI services
   */
  initializeAIServices() {
    return {
      documentAnalyzer: new AIDocumentAnalyzer(),
      patternExtractor: new AIPatternExtractor(),
      productionIntelligence: new AIProductionIntelligence(),
      enhancedExtraction: new AIEnhancedExtractionService()
    };
  }

  /**
   * Initialize processing queues
   */
  initializeQueues() {
    const queueNames = [
      'ai-document-analysis',
      'ai-pattern-extraction', 
      'ai-production-intelligence',
      'ai-complete-extraction',
      'batch-processing'
    ];

    queueNames.forEach(queueName => {
      const queue = new Queue(queueName, {
        redis: this.redis,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50
        }
      });

      this.queues.set(queueName, queue);
    });

    console.log('✅ AI Worker initialized with 5 queues');
  }

  /**
   * Setup event handlers for all queues
   */
  setupEventHandlers() {
    for (const [queueName, queue] of this.queues) {
      // Process jobs
      queue.process(this.getProcessorFunction(queueName));

      // Event handlers
      queue.on('completed', (job, result) => {
        this.metrics.processedJobs++;
        console.log(`✅ Job ${job.id} completed in queue ${queueName}`);
      });

      queue.on('failed', (job, err) => {
        this.metrics.failedJobs++;
        console.error(`❌ Job ${job.id} failed in queue ${queueName}:`, err.message);
      });

      queue.on('stalled', (job) => {
        console.warn(`⚠️ Job ${job.id} stalled in queue ${queueName}`);
      });

      queue.on('error', (error) => {
        console.error(`❌ Queue ${queueName} error:`, error);
      });
    }
  }

  /**
   * Get processor function for a specific queue
   * @param {string} queueName - Name of the queue
   * @returns {Function} Processor function
   */
  getProcessorFunction(queueName) {
    switch (queueName) {
      case 'ai-document-analysis':
        return this.processDocumentAnalysis.bind(this);
      
      case 'ai-pattern-extraction':
        return this.processPatternExtraction.bind(this);
      
      case 'ai-production-intelligence':
        return this.processProductionIntelligence.bind(this);
      
      case 'ai-complete-extraction':
        return this.processCompleteExtraction.bind(this);
      
      case 'batch-processing':
        return this.processBatchProcessing.bind(this);
      
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }
  }

  /**
   * Process document analysis job
   * @param {Object} job - Bull job object
   * @returns {Promise<Object>} Analysis result
   */
  async processDocumentAnalysis(job) {
    const startTime = Date.now();
    const { fileBuffer, mimeType, fileName, options = {} } = job.data;

    try {
      job.progress(10);
      
      const result = await this.aiServices.documentAnalyzer.analyzeDocument(
        Buffer.from(fileBuffer),
        mimeType,
        fileName
      );

      job.progress(90);
      
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime);

      job.progress(100);
      
      return {
        success: true,
        result,
        processingTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Document analysis failed:', error);
      throw error;
    }
  }

  /**
   * Process pattern extraction job
   * @param {Object} job - Bull job object
   * @returns {Promise<Object>} Extraction result
   */
  async processPatternExtraction(job) {
    const startTime = Date.now();
    const { text, documentAnalysis, options = {} } = job.data;

    try {
      job.progress(10);
      
      const contacts = await this.aiServices.patternExtractor.extractContacts(
        text,
        documentAnalysis
      );

      job.progress(90);
      
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime);

      job.progress(100);
      
      return {
        success: true,
        contacts,
        count: contacts.length,
        processingTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Pattern extraction failed:', error);
      throw error;
    }
  }

  /**
   * Process production intelligence job
   * @param {Object} job - Bull job object
   * @returns {Promise<Object>} Intelligence result
   */
  async processProductionIntelligence(job) {
    const startTime = Date.now();
    const { contacts, documentAnalysis, options = {} } = job.data;

    try {
      job.progress(10);
      
      const enhancedContacts = await this.aiServices.productionIntelligence.processContacts(
        contacts,
        documentAnalysis,
        options
      );

      job.progress(90);
      
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime);

      job.progress(100);
      
      return {
        success: true,
        contacts: enhancedContacts,
        count: enhancedContacts.length,
        processingTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Production intelligence failed:', error);
      throw error;
    }
  }

  /**
   * Process complete AI extraction job
   * @param {Object} job - Bull job object
   * @returns {Promise<Object>} Complete extraction result
   */
  async processCompleteExtraction(job) {
    const startTime = Date.now();
    const { fileBuffer, mimeType, fileName, options = {} } = job.data;

    try {
      job.progress(5);
      
      const result = await this.aiServices.enhancedExtraction.extractContacts(
        Buffer.from(fileBuffer),
        mimeType,
        fileName,
        options
      );

      job.progress(95);
      
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime);

      job.progress(100);
      
      return {
        success: true,
        ...result,
        processingTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Complete AI extraction failed:', error);
      throw error;
    }
  }

  /**
   * Process batch processing job
   * @param {Object} job - Bull job object
   * @returns {Promise<Object>} Batch processing result
   */
  async processBatchProcessing(job) {
    const startTime = Date.now();
    const { files, options = {} } = job.data;

    try {
      job.progress(5);
      
      const results = [];
      const totalFiles = files.length;
      
      for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        job.progress(Math.round((i / totalFiles) * 90));
        
        const result = await this.aiServices.enhancedExtraction.extractContacts(
          Buffer.from(file.buffer),
          file.mimeType,
          file.fileName,
          options
        );
        
        results.push({
          fileName: file.fileName,
          success: result.success,
          contacts: result.contacts,
          metadata: result.metadata
        });
      }

      job.progress(95);
      
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime);

      job.progress(100);
      
      return {
        success: true,
        results,
        totalFiles,
        successfulFiles: results.filter(r => r.success).length,
        processingTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Batch processing failed:', error);
      throw error;
    }
  }

  /**
   * Update worker metrics
   * @param {number} processingTime - Processing time in milliseconds
   */
  updateMetrics(processingTime) {
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.averageProcessingTime = 
      this.metrics.totalProcessingTime / this.metrics.processedJobs;
  }

  /**
   * Get worker metrics
   * @returns {Object} Worker metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      queues: Array.from(this.queues.keys()),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>} Queue statistics
   */
  async getQueueStats() {
    const stats = {};
    
    for (const [queueName, queue] of this.queues) {
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();

      stats[queueName] = {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        total: waiting.length + active.length + completed.length + failed.length
      };
    }
    
    return stats;
  }

  /**
   * Start the worker
   * @returns {Promise<void>}
   */
  async start() {
    console.log('🚀 AI Worker starting...');
    
    // Test Redis connection
    try {
      await this.redis.ping();
      console.log('✅ Redis connection established');
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      throw error;
    }

    console.log('✅ AI Worker started successfully');
    console.log(`📊 Monitoring ${this.queues.size} queues`);
  }

  /**
   * Stop the worker
   * @returns {Promise<void>}
   */
  async stop() {
    console.log('🔄 Stopping AI Worker...');
    
    // Close all queues
    for (const [queueName, queue] of this.queues) {
      await queue.close();
      console.log(`✅ Queue ${queueName} closed`);
    }
    
    // Close Redis connection
    await this.redis.quit();
    console.log('✅ AI Worker stopped');
  }
}

module.exports = AIWorker;
