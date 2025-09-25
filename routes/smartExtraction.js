/**
 * Smart Extraction Routes
 * 
 * Routes for intelligent extraction routing between custom and AI methods
 * Handles diverse call sheet structures with optimal performance
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { authenticateAPIKey, requireAPIKeyPermission } = require('../middleware/apiKeyAuth');
const { logExtractionEvent, logAPIKeyUsage } = require('../middleware/logging');
const antivirusService = require('../services/antivirusService');
const SmartExtractionRouter = require('../services/smartExtractionRouter');
const usageService = require('../services/usageService');
const prismaService = require('../services/prismaService');

const router = express.Router();
const routeCors = cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true,
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With','Accept','Origin']
});
const smartRouter = new SmartExtractionRouter();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
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
 * POST /api/smart-extraction/upload
 * Smart extraction with intelligent routing
 */
router.options('/upload', routeCors);
router.post('/upload',
  routeCors,
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
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      // Usage pre-check
      try {
        const permission = await usageService.canPerformAction(userId, 'upload', 1);
        if (!permission.canPerform) {
          await require('fs').promises.unlink(req.file.path).catch(() => {});
          return res.status(402).json({ success: false, error: permission.reason || 'Upload limit reached' });
        }
      } catch (permErr) {
        console.warn('⚠️ Usage pre-check failed:', permErr.message);
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      // Parse options from request body
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
      }

      logExtractionEvent(req, 'smart_extraction_started', {
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        userId: userId,
        options: options
      });

      // Antivirus scanning
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

      // Process with smart router
      const result = await smartRouter.extractContacts(
        fileBuffer,
        req.file.mimetype,
        req.file.originalname,
        {
          ...options,
          rolePreferences: rolePreferences,
          userId: userId
        }
      );

      // Clean up uploaded file
      await require('fs').promises.unlink(req.file.path);

      if (result.success) {
        // Persist job and contacts
        let jobId = null;
        try {
          const job = await prismaService.createJob({
            userId,
            title: 'Smart Extraction',
            fileName: req.file.originalname,
            status: 'COMPLETED'
          });
          jobId = job?.id || null;

          const contactsToCreate = (Array.isArray(result.contacts) ? result.contacts : []).map((c) => ({
            jobId,
            userId,
            name: c?.name || 'Unknown',
            email: typeof c?.email === 'string' ? c.email : null,
            phone: typeof c?.phone === 'string' ? c.phone : null,
            role: c?.role || null,
            company: c?.company || null,
            isSelected: false
          }));
          if (contactsToCreate.length > 0 && jobId) {
            await prismaService.createContactsInChunks(contactsToCreate, 500);
          }
        } catch (persistError) {
          console.warn('⚠️ Failed to persist contacts/job:', persistError.message);
        }

        // Increment usage counters
        try {
          await usageService.incrementUsage(userId, 'upload', 1);
          await usageService.incrementUsage(userId, 'api_call', 1);
        } catch (uErr) {
          console.warn('⚠️ Failed to increment usage:', uErr.message);
        }

        logExtractionEvent(req, 'smart_extraction_success', {
          contactsFound: result.contacts.length,
          processingTime: result.metadata.processingTime,
          extractionMethod: result.metadata.extractionMethod,
          routingStrategy: result.metadata.routingStrategy,
          userId: userId
        });

        // Log API key usage if applicable
        if (req.apiKey) {
          logAPIKeyUsage(req, 'extract', {
            contactsExtracted: result.contacts.length,
            processingTime: result.metadata.processingTime,
            extractionMethod: result.metadata.extractionMethod
          });
        }

        res.json({
          success: true,
          contacts: result.contacts,
          metadata: result.metadata,
          usage: result.usage,
          processingTime: result.metadata.processingTime,
          jobId: jobId,
          timestamp: result.timestamp
        });
      } else {
        logExtractionEvent(req, 'smart_extraction_failed', {
          error: result.error,
          userId: userId
        });

        res.status(500).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('❌ Smart extraction route error:', error);

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
        error: error.message || 'Smart extraction failed'
      });
    }
  }
);

/**
 * GET /api/smart-extraction/health
 * Get smart extraction service health
 */
router.get('/health', async (req, res) => {
  try {
    const metrics = smartRouter.getMetrics();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      metrics: metrics
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
 * GET /api/smart-extraction/stats
 * Get smart extraction statistics
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
      const metrics = smartRouter.getMetrics();
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        metrics: metrics
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
 * POST /api/smart-extraction/test
 * Test smart extraction with sample data
 */
router.post('/test',
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
      const { text, documentType, productionType, options = {} } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'Text is required for testing'
        });
      }

      // Create mock document analysis
      const mockAnalysis = {
        type: documentType || 'call_sheet',
        productionType: productionType || 'commercial',
        hasTableStructure: false,
        hasContactSections: true,
        estimatedContacts: 0,
        confidence: 0.8
      };

      // Test smart extraction
      const result = await smartRouter.extractContacts(
        Buffer.from(text),
        'text/plain',
        'test.txt',
        options
      );

      res.json({
        success: true,
        contacts: result.contacts,
        metadata: result.metadata,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Test route error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Test extraction failed'
      });
    }
  }
);

module.exports = router;
