/**
 * Phase 3 Tests: Advanced AI Integration and Production Optimization
 * 
 * Comprehensive tests for queue system, caching, monitoring, and optimization
 */

const request = require('supertest');
const app = require('./testServer');
const fs = require('fs').promises;
const path = require('path');

// Mock external services
jest.mock('../services/queueService');
jest.mock('../services/cacheService');
jest.mock('../services/monitoringService');
jest.mock('../services/optimizedAIExtractionService');

describe('Phase 3: Advanced AI Integration and Production Optimization', () => {
  let testUser;
  let jwtToken;
  let testApiKey;
  let testFilePath;

  beforeAll(async () => {
    // Setup test user
    testUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'user'
    };
    jwtToken = 'mock-jwt-token';

    // Create test file
    testFilePath = path.join(__dirname, 'test-file.txt');
    await fs.writeFile(testFilePath, 'Test content for extraction');
  });

  afterAll(async () => {
    // Clean up test file
    try {
      await fs.unlink(testFilePath);
    } catch (error) {
      // File might not exist
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Queue System Integration', () => {
    test('should queue AI extraction job', async () => {
      const mockQueueService = require('../services/queueService');
      mockQueueService.prototype.addCompleteExtractionJob = jest.fn().mockResolvedValue({
        id: 'job-123',
        data: { fileName: 'test.txt' }
      });

      const response = await request(app)
        .post('/api/optimized-extraction/upload')
        .set('Authorization', `Bearer ${jwtToken}`)
        .attach('file', testFilePath)
        .field('rolePreferences', JSON.stringify(['Director', 'Producer']));

      expect(response.statusCode).toEqual(200);
      expect(response.body.success).toBe(true);
      expect(response.body.jobId).toBe('job-123');
      expect(response.body.status).toBe('queued');
    });

    test('should get job status', async () => {
      const mockOptimizedService = require('../services/optimizedAIExtractionService');
      mockOptimizedService.prototype.getJobStatus = jest.fn().mockResolvedValue({
        id: 'job-123',
        status: 'completed',
        progress: 100,
        result: { contacts: [], metadata: {} }
      });

      const response = await request(app)
        .get('/api/optimized-extraction/status/job-123')
        .set('Authorization', `Bearer ${jwtToken}`);

      expect(response.statusCode).toEqual(200);
      expect(response.body.success).toBe(true);
      expect(response.body.jobId).toBe('job-123');
      expect(response.body.status).toBe('completed');
    });
  });

  describe('Caching System', () => {
    test('should return cached results when available', async () => {
      const mockOptimizedService = require('../services/optimizedAIExtractionService');
      mockOptimizedService.prototype.extractContacts = jest.fn().mockResolvedValue({
        success: true,
        contacts: [{ name: 'John Doe', email: 'john@example.com' }],
        cached: true,
        processingTime: 100
      });

      const response = await request(app)
        .post('/api/optimized-extraction/sync-upload')
        .set('Authorization', `Bearer ${jwtToken}`)
        .attach('file', testFilePath);

      expect(response.statusCode).toEqual(200);
      expect(response.body.success).toBe(true);
      expect(response.body.cached).toBe(true);
    });

    test('should clear cache successfully', async () => {
      const mockOptimizedService = require('../services/optimizedAIExtractionService');
      mockOptimizedService.prototype.clearCaches = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .post('/api/optimized-extraction/clear-cache')
        .set('Authorization', `Bearer ${jwtToken}`);

      expect(response.statusCode).toEqual(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cleared');
    });
  });

  describe('Batch Processing', () => {
    test('should process batch of files', async () => {
      const mockOptimizedService = require('../services/optimizedAIExtractionService');
      mockOptimizedService.prototype.processBatchExtraction = jest.fn().mockResolvedValue({
        success: true,
        jobId: 'batch-job-123',
        status: 'queued',
        fileCount: 3,
        estimatedWaitTime: 30
      });

      const response = await request(app)
        .post('/api/optimized-extraction/batch')
        .set('Authorization', `Bearer ${jwtToken}`)
        .attach('files', testFilePath)
        .attach('files', testFilePath)
        .attach('files', testFilePath);

      expect(response.statusCode).toEqual(200);
      expect(response.body.success).toBe(true);
      expect(response.body.jobId).toBe('batch-job-123');
      expect(response.body.fileCount).toBe(3);
    });
  });

  describe('Monitoring and Health Checks', () => {
    test('should return health status', async () => {
      const mockOptimizedService = require('../services/optimizedAIExtractionService');
      mockOptimizedService.prototype.getHealthStatus = jest.fn().mockResolvedValue({
        status: 'healthy',
        services: {
          queue: { status: 'healthy' },
          cache: { status: 'healthy' },
          monitoring: { status: 'healthy' }
        },
        timestamp: new Date().toISOString()
      });

      const response = await request(app)
        .get('/api/optimized-extraction/health');

      expect(response.statusCode).toEqual(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.services).toBeDefined();
    });

    test('should return service statistics', async () => {
      const mockOptimizedService = require('../services/optimizedAIExtractionService');
      mockOptimizedService.prototype.getStats = jest.fn().mockReturnValue({
        processing: {
          totalJobs: 100,
          completedJobs: 95,
          failedJobs: 5,
          averageProcessingTime: 2500
        },
        cache: {
          hits: 50,
          misses: 30,
          hitRate: 62.5
        },
        monitoring: {
          system: { uptime: 3600 },
          ai: { totalRequests: 100 }
        }
      });
      mockOptimizedService.prototype.getQueueStats = jest.fn().mockResolvedValue({
        'ai-complete-extraction': { waiting: 5, active: 2, completed: 90, failed: 3 }
      });

      const response = await request(app)
        .get('/api/optimized-extraction/stats')
        .set('Authorization', `Bearer ${jwtToken}`);

      expect(response.statusCode).toEqual(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats).toBeDefined();
      expect(response.body.stats.processing).toBeDefined();
      expect(response.body.stats.cache).toBeDefined();
      expect(response.body.stats.queues).toBeDefined();
    });
  });

  describe('Performance Optimization', () => {
    test('should handle high load with queue system', async () => {
      const mockQueueService = require('../services/queueService');
      mockQueueService.prototype.addCompleteExtractionJob = jest.fn().mockResolvedValue({
        id: 'job-' + Math.random(),
        data: { fileName: 'test.txt' }
      });

      // Simulate multiple concurrent requests
      const promises = Array(10).fill().map(() => 
        request(app)
          .post('/api/optimized-extraction/upload')
          .set('Authorization', `Bearer ${jwtToken}`)
          .attach('file', testFilePath)
      );

      const responses = await Promise.all(promises);

      // All requests should be queued successfully
      responses.forEach(response => {
        expect(response.statusCode).toEqual(200);
        expect(response.body.success).toBe(true);
        expect(response.body.status).toBe('queued');
      });
    });

    test('should handle cache misses gracefully', async () => {
      const mockOptimizedService = require('../services/optimizedAIExtractionService');
      mockOptimizedService.prototype.extractContacts = jest.fn().mockResolvedValue({
        success: true,
        contacts: [{ name: 'Jane Doe', email: 'jane@example.com' }],
        cached: false,
        processingTime: 3000
      });

      const response = await request(app)
        .post('/api/optimized-extraction/sync-upload')
        .set('Authorization', `Bearer ${jwtToken}`)
        .attach('file', testFilePath);

      expect(response.statusCode).toEqual(200);
      expect(response.body.success).toBe(true);
      expect(response.body.cached).toBe(false);
      expect(response.body.processingTime).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle queue service failures', async () => {
      const mockQueueService = require('../services/queueService');
      mockQueueService.prototype.addCompleteExtractionJob = jest.fn().mockRejectedValue(
        new Error('Queue service unavailable')
      );

      const response = await request(app)
        .post('/api/optimized-extraction/upload')
        .set('Authorization', `Bearer ${jwtToken}`)
        .attach('file', testFilePath);

      expect(response.statusCode).toEqual(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Queue service unavailable');
    });

    test('should handle cache service failures', async () => {
      const mockOptimizedService = require('../services/optimizedAIExtractionService');
      mockOptimizedService.prototype.extractContacts = jest.fn().mockRejectedValue(
        new Error('Cache service unavailable')
      );

      const response = await request(app)
        .post('/api/optimized-extraction/sync-upload')
        .set('Authorization', `Bearer ${jwtToken}`)
        .attach('file', testFilePath);

      expect(response.statusCode).toEqual(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Cache service unavailable');
    });

    test('should handle monitoring service failures', async () => {
      const mockOptimizedService = require('../services/optimizedAIExtractionService');
      mockOptimizedService.prototype.getHealthStatus = jest.fn().mockRejectedValue(
        new Error('Monitoring service unavailable')
      );

      const response = await request(app)
        .get('/api/optimized-extraction/health');

      expect(response.statusCode).toEqual(500);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.error).toContain('Monitoring service unavailable');
    });
  });

  describe('API Key Authentication', () => {
    test('should work with API key authentication', async () => {
      const mockQueueService = require('../services/queueService');
      mockQueueService.prototype.addCompleteExtractionJob = jest.fn().mockResolvedValue({
        id: 'job-api-key',
        data: { fileName: 'test.txt' }
      });

      const response = await request(app)
        .post('/api/optimized-extraction/upload')
        .set('X-API-Key', 'sk_test_api_key')
        .attach('file', testFilePath);

      expect(response.statusCode).toEqual(200);
      expect(response.body.success).toBe(true);
      expect(response.body.jobId).toBe('job-api-key');
    });

    test('should require admin permission for cache clearing', async () => {
      const response = await request(app)
        .post('/api/optimized-extraction/clear-cache')
        .set('Authorization', `Bearer ${jwtToken}`);

      // Should fail without admin permission
      expect(response.statusCode).toEqual(403);
    });
  });

  describe('Resource Management', () => {
    test('should handle large file uploads', async () => {
      // Create a larger test file
      const largeFilePath = path.join(__dirname, 'large-test-file.txt');
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB
      await fs.writeFile(largeFilePath, largeContent);

      const mockQueueService = require('../services/queueService');
      mockQueueService.prototype.addCompleteExtractionJob = jest.fn().mockResolvedValue({
        id: 'job-large',
        data: { fileName: 'large-test-file.txt' }
      });

      const response = await request(app)
        .post('/api/optimized-extraction/upload')
        .set('Authorization', `Bearer ${jwtToken}`)
        .attach('file', largeFilePath);

      expect(response.statusCode).toEqual(200);
      expect(response.body.success).toBe(true);

      // Clean up
      await fs.unlink(largeFilePath);
    });

    test('should handle multiple file types in batch', async () => {
      const mockOptimizedService = require('../services/optimizedAIExtractionService');
      mockOptimizedService.prototype.processBatchExtraction = jest.fn().mockResolvedValue({
        success: true,
        jobId: 'batch-multi-type',
        status: 'queued',
        fileCount: 2
      });

      const response = await request(app)
        .post('/api/optimized-extraction/batch')
        .set('Authorization', `Bearer ${jwtToken}`)
        .attach('files', testFilePath)
        .attach('files', testFilePath);

      expect(response.statusCode).toEqual(200);
      expect(response.body.success).toBe(true);
      expect(response.body.fileCount).toBe(2);
    });
  });
});
