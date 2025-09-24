/**
 * Optimized Extraction Routes
 * 
 * Phase 3 routes for production-optimized AI extraction
 * Includes queue system, caching, monitoring, and batch processing
 */

const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { authenticateAPIKey, requireAPIKeyPermission } = require('../middleware/apiKeyAuth');
const { customExtractionUploadSchema } = require('../schemas/validation');
const { logExtractionEvent, logAPIKeyUsage } = require('../middleware/logging');
const antivirusService = require('../services/antivirusService');
const OptimizedAIExtractionService = require('../services/optimizedAIExtractionService');

const router = express.Router();
const optimizedService = new OptimizedAIExtractionService();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit for optimized processing
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'image/bmp'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
    }
  }
});

/**
 * POST /api/optimized-extraction/upload
 * Optimized AI extraction with queue system and caching
 */
router.post('/upload',
  // Try API key auth first, then JWT auth
  async (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    if (apiKey && apiKey.startsWith('sk_')) {
      return authenticateAPIKey(req, res, next);
    } else {
      return authenticateToken(req, res, next);
    }
  },
  upload.single('file'),
  async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      // Parse options from request body (frontend sends as JSON string)
      let options = {};
      let rolePreferences = [];
      
      try {
        if (req.body.options) {
          options = typeof req.body.options === 'string' 
            ? JSON.parse(req.body.options) 
            : req.body.options;
        }
        if (req.body.rolePreferences) {
          rolePreferences = Array.isArray(req.body.rolePreferences) 
            ? req.body.rolePreferences 
            : JSON.parse(req.body.rolePreferences);
        }
      } catch (parseError) {
        console.warn('⚠️ Failed to parse request options:', parseError.message);
        // Continue with empty options
      }

      logExtractionEvent(req, 'optimized_upload_started', {
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        userId: userId
      });

      // Antivirus scanning
      logExtractionEvent(req, 'antivirus_scan_started', {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        userId: userId
      });

      const scanResult = await antivirusService.scanFile(req.file.path, 'clamav');

      if (!scanResult.clean) {
        logExtractionEvent(req, 'antivirus_scan_failed', {
          fileName: req.file.originalname,
          threats: scanResult.threats,
          userId: userId
        });

        await require('fs').promises.unlink(req.file.path);
        return res.status(400).json({
          success: false,
          error: 'File failed security scan',
          details: {
            threats: scanResult.threats,
            scanMethod: scanResult.method
          }
        });
      }

      logExtractionEvent(req, 'antivirus_scan_passed', {
        fileName: req.file.originalname,
        scanMethod: scanResult.method,
        userId: userId
      });

      // Read file into buffer
      const fileBuffer = await require('fs').promises.readFile(req.file.path);

      // Process with optimized service (async by default for production)
      const result = await optimizedService.extractContacts(
        fileBuffer,
        req.file.mimetype,
        req.file.originalname,
        {
          ...options,
          rolePreferences: rolePreferences,
          userId: userId,
          priority: options.priority || 0
        },
        true // async processing
      );

      // Clean up uploaded file
      await require('fs').promises.unlink(req.file.path);

      if (result.success) {
        logExtractionEvent(req, 'optimized_extraction_queued', {
          jobId: result.jobId,
          estimatedWaitTime: result.estimatedWaitTime,
          userId: userId
        });

        // Log API key usage if applicable
        if (req.apiKey) {
          logAPIKeyUsage(req, 'extract', {
            jobId: result.jobId,
            processingMode: 'async'
          });
        }

        res.json({
          success: true,
          jobId: result.jobId,
          status: result.status,
          message: result.message,
          estimatedWaitTime: result.estimatedWaitTime,
          timestamp: result.timestamp
        });
      } else {
        logExtractionEvent(req, 'optimized_extraction_failed', {
          error: result.error,
          userId: userId
        });

        res.status(500).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('❌ Optimized extraction route error:', error);

      // Clean up uploaded file if it exists
      if (req.file) {
        try {
          await require('fs').promises.unlink(req.file.path);
        } catch (cleanupError) {
          console.error('❌ File cleanup failed:', cleanupError);
        }
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Optimized extraction failed'
      });
    }
  }
);

/**
 * POST /api/optimized-extraction/sync-upload
 * Synchronous optimized AI extraction (for immediate results)
 */
router.post('/sync-upload',
  // Try API key auth first, then JWT auth
  async (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    if (apiKey && apiKey.startsWith('sk_')) {
      return authenticateAPIKey(req, res, next);
    } else {
      return authenticateToken(req, res, next);
    }
  },
  upload.single('file'),
  async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      // Parse options from request body (frontend sends as JSON string)
      let options = {};
      let rolePreferences = [];
      
      try {
        if (req.body.options) {
          options = typeof req.body.options === 'string' 
            ? JSON.parse(req.body.options) 
            : req.body.options;
        }
        if (req.body.rolePreferences) {
          rolePreferences = Array.isArray(req.body.rolePreferences) 
            ? req.body.rolePreferences 
            : JSON.parse(req.body.rolePreferences);
        }
      } catch (parseError) {
        console.warn('⚠️ Failed to parse request options:', parseError.message);
        // Continue with empty options
      }

      logExtractionEvent(req, 'sync_optimized_upload_started', {
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        userId: userId,
        strategy: options?.forceCustom ? 'custom_first' : 'smart'
      });

      // Antivirus scanning
      const scanResult = await antivirusService.scanFile(req.file.path, 'clamav');

      if (!scanResult.clean) {
        await require('fs').promises.unlink(req.file.path);
        return res.status(400).json({
          success: false,
          error: 'File failed security scan',
          details: {
            threats: scanResult.threats,
            scanMethod: scanResult.method
          }
        });
      }

      // Read file into buffer
      const fileBuffer = await require('fs').promises.readFile(req.file.path);

      // Process with optimized service (synchronous) - honors forceCustom/custom-first routing
      const result = await optimizedService.extractContacts(
        fileBuffer,
        req.file.mimetype,
        req.file.originalname,
        {
          ...options,
          rolePreferences: rolePreferences,
          userId: userId
        },
        false // sync processing
      );

      // Clean up uploaded file
      await require('fs').promises.unlink(req.file.path);

      if (result.success) {
        logExtractionEvent(req, 'sync_optimized_extraction_success', {
          contactsFound: result.contacts.length,
          processingTime: result.processingTime,
          cached: result.cached,
          userId: userId
        });

        // Log API key usage if applicable
        if (req.apiKey) {
          logAPIKeyUsage(req, 'extract', {
            contactsExtracted: result.contacts.length,
            processingTime: result.processingTime,
            processingMode: 'sync'
          });
        }

        res.json({
          success: true,
          contacts: result.contacts,
          metadata: result.metadata,
          usage: result.usage,
          processingTime: result.processingTime,
          cached: result.cached,
          timestamp: result.timestamp
        });
      } else {
        logExtractionEvent(req, 'sync_optimized_extraction_failed', {
          error: result.error,
          userId: userId
        });

        res.status(500).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('❌ Sync optimized extraction route error:', error);

      // Clean up uploaded file if it exists
      if (req.file) {
        try {
          await require('fs').promises.unlink(req.file.path);
        } catch (cleanupError) {
          console.error('❌ File cleanup failed:', cleanupError);
        }
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Sync optimized extraction failed'
      });
    }
  }
);

/**
 * POST /api/optimized-extraction/batch
 * Batch processing for multiple files
 */
router.post('/batch',
  // Try API key auth first, then JWT auth
  async (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    if (apiKey && apiKey.startsWith('sk_')) {
      return authenticateAPIKey(req, res, next);
    } else {
      return authenticateToken(req, res, next);
    }
  },
  upload.array('files', 10), // Max 10 files
  async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded'
        });
      }

      // Parse options from request body (frontend sends as JSON string)
      let options = {};
      let rolePreferences = [];
      
      try {
        if (req.body.options) {
          options = typeof req.body.options === 'string' 
            ? JSON.parse(req.body.options) 
            : req.body.options;
        }
        if (req.body.rolePreferences) {
          rolePreferences = Array.isArray(req.body.rolePreferences) 
            ? req.body.rolePreferences 
            : JSON.parse(req.body.rolePreferences);
        }
      } catch (parseError) {
        console.warn('⚠️ Failed to parse request options:', parseError.message);
        // Continue with empty options
      }

      logExtractionEvent(req, 'batch_processing_started', {
        fileCount: req.files.length,
        userId: userId
      });

      // Process batch
      const result = await optimizedService.processBatchExtraction(
        req.files.map(file => ({
          buffer: require('fs').readFileSync(file.path),
          mimeType: file.mimetype,
          fileName: file.originalname
        })),
        {
          ...options,
          rolePreferences: rolePreferences,
          userId: userId
        }
      );

      // Clean up uploaded files
      for (const file of req.files) {
        await require('fs').promises.unlink(file.path);
      }

      if (result.success) {
        logExtractionEvent(req, 'batch_processing_queued', {
          jobId: result.jobId,
          fileCount: result.fileCount,
          estimatedWaitTime: result.estimatedWaitTime,
          userId: userId
        });

        // Log API key usage if applicable
        if (req.apiKey) {
          logAPIKeyUsage(req, 'extract', {
            jobId: result.jobId,
            fileCount: result.fileCount,
            processingMode: 'batch'
          });
        }

        res.json({
          success: true,
          jobId: result.jobId,
          status: result.status,
          message: result.message,
          fileCount: result.fileCount,
          estimatedWaitTime: result.estimatedWaitTime,
          timestamp: result.timestamp
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('❌ Batch processing route error:', error);

      // Clean up uploaded files if they exist
      if (req.files) {
        for (const file of req.files) {
          try {
            await require('fs').promises.unlink(file.path);
          } catch (cleanupError) {
            console.error('❌ File cleanup failed:', cleanupError);
          }
        }
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Batch processing failed'
      });
    }
  }
);

/**
 * GET /api/optimized-extraction/status/:jobId
 * Get job status
 */
router.get('/status/:jobId',
  // Try API key auth first, then JWT auth
  async (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    if (apiKey && apiKey.startsWith('sk_')) {
      return authenticateAPIKey(req, res, next);
    } else {
      return authenticateToken(req, res, next);
    }
  },
  async (req, res) => {
    try {
      const { jobId } = req.params;
      const status = await optimizedService.getJobStatus(jobId);

      res.json({
        success: true,
        jobId,
        status: status.status,
        progress: status.progress,
        result: status.result,
        error: status.error,
        createdAt: status.createdAt,
        processedAt: status.processedAt,
        finishedAt: status.finishedAt
      });

    } catch (error) {
      console.error('❌ Job status route error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get job status'
      });
    }
  }
);

/**
 * GET /api/optimized-extraction/health
 * Get service health status
 */
router.get('/health', async (req, res) => {
  try {
    const health = await optimizedService.getHealthStatus();
    
    res.json({
      status: health.status,
      services: health.services,
      timestamp: health.timestamp
    });

  } catch (error) {
    console.error('❌ Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/optimized-extraction/stats
 * Get service statistics
 */
router.get('/stats',
  // Try API key auth first, then JWT auth
  async (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    if (apiKey && apiKey.startsWith('sk_')) {
      return authenticateAPIKey(req, res, next);
    } else {
      return authenticateToken(req, res, next);
    }
  },
  async (req, res) => {
    try {
      const stats = optimizedService.getStats();
      const queueStats = await optimizedService.getQueueStats();
      
      // Safely extract metrics with fallbacks
      const monitoringMetrics = stats.monitoring || {};
      const processingMetrics = stats.processing || {};
      const cacheMetrics = stats.cache || {};
      
      // Extract AI and API metrics safely
      const aiMetrics = monitoringMetrics.ai || {};
      const apiMetrics = monitoringMetrics.api || {};
      const systemMetrics = monitoringMetrics.system || {};
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        processing: {
          totalJobs: (processingMetrics && processingMetrics.totalJobs) || 0,
          completedJobs: (processingMetrics && processingMetrics.completedJobs) || 0,
          failedJobs: (processingMetrics && processingMetrics.failedJobs) || 0,
          activeJobs: (processingMetrics && processingMetrics.activeJobs) || 0,
          averageProcessingTime: (processingMetrics && processingMetrics.averageProcessingTime) || 0
        },
        cache: {
          hits: (cacheMetrics && cacheMetrics.hits) || 0,
          misses: (cacheMetrics && cacheMetrics.misses) || 0,
          totalRequests: (cacheMetrics && cacheMetrics.totalRequests) || 0
        },
        ai: {
          totalRequests: (aiMetrics && aiMetrics.totalRequests) || 0,
          successfulRequests: (aiMetrics && aiMetrics.successfulRequests) || 0,
          failedRequests: (aiMetrics && aiMetrics.failedRequests) || 0,
          averageProcessingTime: (aiMetrics && aiMetrics.averageProcessingTime) || 0
        },
        api: {
          totalRequests: (apiMetrics && apiMetrics.totalRequests) || 0,
          successfulRequests: (apiMetrics && apiMetrics.successfulRequests) || 0,
          failedRequests: (apiMetrics && apiMetrics.failedRequests) || 0,
          averageResponseTime: (apiMetrics && apiMetrics.averageResponseTime) || 0
        },
        queues: queueStats || {},
        system: {
          cpuUsage: (systemMetrics && systemMetrics.cpuUsage) || 0,
          memoryUsage: (systemMetrics && systemMetrics.memoryUsage) || 0,
          uptime: (systemMetrics && systemMetrics.uptime) || 0
        }
      });

    } catch (error) {
      console.error('❌ Stats route error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get statistics'
      });
    }
  }
);

/**
 * POST /api/optimized-extraction/clear-cache
 * Clear all caches
 */
router.post('/clear-cache',
  // Try API key auth first, then JWT auth
  async (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    if (apiKey && apiKey.startsWith('sk_')) {
      return authenticateAPIKey(req, res, next);
    } else {
      return authenticateToken(req, res, next);
    }
  },
  requireAPIKeyPermission('admin'),
  async (req, res) => {
    try {
      const success = await optimizedService.clearCaches();
      
      res.json({
        success,
        message: success ? 'All caches cleared successfully' : 'Failed to clear caches',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Clear cache error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to clear caches'
      });
    }
  }
);

module.exports = router;
