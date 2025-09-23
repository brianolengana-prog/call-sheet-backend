/**
 * Document Processing Queue Service
 * Handles scalable document processing with job queues
 */

const Queue = require('bull');
const Redis = require('ioredis');
const extractionService = require('./extractionService');
const prismaService = require('./prismaService');
const usageService = require('./usageService');

class QueueService {
  constructor() {
    // Redis connection for queue
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    
    // Create processing queues
    this.documentQueue = new Queue('document processing', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD
      }
    });
    
    this.aiQueue = new Queue('ai processing', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD
      }
    });
    
    this.setupProcessors();
  }

  /**
   * Setup queue processors
   */
  setupProcessors() {
    // Document processing processor
    this.documentQueue.process('extract-text', 5, async (job) => {
      const { fileBuffer, mimeType, fileName, userId } = job.data;
      
      try {
        console.log(`🔄 Processing document: ${fileName} (Job: ${job.id})`);
        
        // Extract text from document
        const extractedText = await extractionService.processFile(fileBuffer, mimeType, fileName);
        
        // Queue AI processing
        await this.aiQueue.add('extract-contacts', {
          text: extractedText,
          userId,
          fileName,
          jobId: job.id
        });
        
        return { success: true, extractedText };
      } catch (error) {
        console.error(`❌ Document processing failed (Job: ${job.id}):`, error);
        throw error;
      }
    });

    // AI processing processor
    this.aiQueue.process('extract-contacts', 10, async (job) => {
      const { text, userId, fileName, jobId } = job.data;
      
      try {
        console.log(`🤖 AI processing document: ${fileName} (Job: ${job.id})`);
        
        // Extract contacts using AI
        const result = await extractionService.extractContacts(text, [], {}, userId);
        
        if (result.success && result.contacts.length > 0) {
          // Save contacts to database
          await this.saveContacts(result.contacts, userId, fileName);
        }
        
        return { success: true, contacts: result.contacts };
      } catch (error) {
        console.error(`❌ AI processing failed (Job: ${job.id}):`, error);
        throw error;
      }
    });

    // Error handling
    this.documentQueue.on('failed', (job, err) => {
      console.error(`❌ Document processing job failed:`, err);
    });

    this.aiQueue.on('failed', (job, err) => {
      console.error(`❌ AI processing job failed:`, err);
    });
  }

  /**
   * Add document to processing queue
   */
  async queueDocument(fileBuffer, mimeType, fileName, userId) {
    const job = await this.documentQueue.add('extract-text', {
      fileBuffer,
      mimeType,
      fileName,
      userId
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });

    return {
      jobId: job.id,
      status: 'queued'
    };
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId) {
    const job = await this.documentQueue.getJob(jobId);
    if (!job) return null;

    return {
      id: job.id,
      status: await job.getState(),
      progress: job.progress(),
      data: job.data,
      result: job.returnvalue,
      error: job.failedReason
    };
  }

  /**
   * Save contacts to database
   */
  async saveContacts(contacts, userId, fileName) {
    try {
      // Create job record
      const job = await prismaService.createJob({
        userId,
        title: `File Upload - ${fileName}`,
        fileName,
        status: 'completed'
      });

      // Save contacts
      const contactsToSave = contacts.map(contact => ({
        ...contact,
        jobId: job.id,
        userId
      }));

      await prismaService.createContacts(contactsToSave);
      
      // Update usage
      await usageService.incrementUsage(userId, 'upload', 1);
      
      console.log(`✅ Saved ${contacts.length} contacts to database`);
    } catch (error) {
      console.error('❌ Failed to save contacts:', error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const documentStats = await this.documentQueue.getJobCounts();
    const aiStats = await this.aiQueue.getJobCounts();
    
    return {
      documentQueue: documentStats,
      aiQueue: aiStats,
      workers: {
        document: 5,
        ai: 10
      }
    };
  }
}

module.exports = new QueueService();
