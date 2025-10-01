/**
 * Custom Extraction Routes
 * 
 * Routes for testing and using the custom extraction service
 */

const express = require('express');
const multer = require('multer');
const CustomExtractionService = require('../services/customExtractionService');
const AIEnhancedExtractionService = require('../services/aiEnhancedExtractionService');
const { authenticateToken } = require('../middleware/auth');
const { authenticateAPIKey, requireAPIKeyPermission } = require('../middleware/apiKeyAuth');
const { customExtractionUploadSchema, customExtractionTestSchema } = require('../schemas/validation');
const { logExtractionEvent, logAPIKeyUsage } = require('../middleware/logging');
const antivirusService = require('../services/antivirusService');

const router = express.Router();
const customExtractionService = new CustomExtractionService();
const aiEnhancedExtractionService = new AIEnhancedExtractionService();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common document and image formats
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
 * POST /api/custom-extraction/upload
 * Upload and extract contacts using custom extraction
 * Supports both JWT and API key authentication
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
  requireAPIKeyPermission('extract'),
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

    // Validate request body
    const validationResult = customExtractionUploadSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: validationResult.error.errors
      });
    }

    const { rolePreferences, options } = validationResult.data;

    logExtractionEvent(req, 'upload_started', {
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

      // Clean up uploaded file
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
    
    // Options are already validated and parsed by Zod

        // Extract contacts using AI-enhanced service
        const result = await aiEnhancedExtractionService.extractContacts(
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
      logExtractionEvent(req, 'extraction_success', {
        contactsFound: result.contacts.length,
        processingTime: result.metadata.processingTime,
        documentType: result.metadata.documentType,
        userId: userId
      });
      
      // Log API key usage if applicable
      if (req.apiKey) {
        logAPIKeyUsage(req, 'extract', {
          contactsExtracted: result.contacts.length,
          processingTime: result.metadata.processingTime
        });
      }
      
      res.json({
        success: true,
        contacts: result.contacts,
        metadata: result.metadata,
        usage: result.usage
      });
    } else {
      logExtractionEvent(req, 'extraction_failed', {
        error: result.error,
        userId: userId
      });
      
      res.status(500).json({
        success: false,
        error: result.error,
        contacts: []
      });
    }

  } catch (error) {
    console.error('❌ Custom extraction route error:', error);
    
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
      error: error.message || 'Custom extraction failed'
    });
  }
});

/**
 * GET /api/custom-extraction/health
 * Health check for extraction services
 */
router.get('/health', async (req, res) => {
  try {
    // Check if extraction service is ready
    const isReady = customExtractionService && 
                   customExtractionService.documentAnalyzer &&
                   customExtractionService.patternExtractor &&
                   customExtractionService.validator;
    
    if (isReady) {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'custom-extraction',
        version: '1.0.0',
        components: {
          documentAnalyzer: 'ready',
          patternExtractor: 'ready',
          validator: 'ready',
          productionIntelligence: 'ready',
          confidenceScorer: 'ready',
          ocrProcessor: 'ready'
        }
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'custom-extraction',
        error: 'Service components not initialized'
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'custom-extraction',
      error: error.message
    });
  }
});

/**
 * GET /api/custom-extraction/capabilities
 * Get custom extraction capabilities
 */
router.get('/capabilities', (req, res) => {
  try {
    const capabilities = {
      supportedFormats: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/jpeg',
        'image/png',
        'image/tiff',
        'image/bmp'
      ],
      features: [
        'Pattern-based extraction',
        'Document type detection',
        'Production intelligence',
        'Contact validation',
        'Confidence scoring',
        'OCR processing',
        'Deduplication',
        'Quality control'
      ],
      performance: {
        maxFileSize: '50MB',
        processingTime: '1-60 seconds',
        accuracy: '80-95%',
        reliability: '99.9%'
      },
      ocr: customExtractionService.ocrProcessor.getCapabilities()
    };

    res.json({
      success: true,
      capabilities: capabilities
    });
  } catch (error) {
    console.error('❌ Capabilities error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/custom-extraction/test
 * Test custom extraction with sample data
 * Supports both JWT and API key authentication
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
  requireAPIKeyPermission('test'),
  async (req, res) => {
  try {
    // Validate request body
    const validationResult = customExtractionTestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: validationResult.error.errors
      });
    }

    const { text, documentType, productionType } = validationResult.data;

    // Create a mock document analysis
    const mockAnalysis = {
      type: documentType || 'unknown',
      productionType: productionType || 'unknown',
      hasTableStructure: false,
      hasContactSections: true,
      estimatedContacts: 0,
      confidence: 0.8
    };

    // Extract contacts using pattern extractor
    const contacts = await customExtractionService.patternExtractor.extractContacts(text, mockAnalysis);
    
    // Process with production intelligence
    const processedContacts = await customExtractionService.productionIntelligence.processContacts(contacts, mockAnalysis);
    
    // Validate contacts
    const validatedContacts = await customExtractionService.validator.validateContacts(processedContacts);
    
    // Score contacts
    const scoredContacts = await customExtractionService.confidenceScorer.scoreContacts(validatedContacts, mockAnalysis);

    res.json({
      success: true,
      contacts: scoredContacts,
      metadata: {
        extractionMethod: 'custom',
        documentType: documentType || 'unknown',
        productionType: productionType || 'unknown',
        totalContacts: scoredContacts.length
      }
    });

  } catch (error) {
    console.error('❌ Test extraction error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/custom-extraction/ai-upload
 * Upload and extract contacts using AI-enhanced extraction
 * Supports both JWT and API key authentication
 */
router.post('/ai-upload',
  // Try API key auth first, then JWT auth
  async (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    if (apiKey && apiKey.startsWith('sk_')) {
      return authenticateAPIKey(req, res, next);
    } else {
      return authenticateToken(req, res, next);
    }
  },
  requireAPIKeyPermission('extract'),
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

      // Validate request body
      const validationResult = customExtractionUploadSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request parameters',
          details: validationResult.error.errors
        });
      }

      const { rolePreferences, options } = validationResult.data;

      logExtractionEvent(req, 'ai_upload_started', {
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

        // Clean up uploaded file
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

      // Extract contacts using AI-enhanced service
      const result = await aiEnhancedExtractionService.extractContacts(
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
        logExtractionEvent(req, 'ai_extraction_success', {
          contactsFound: result.contacts.length,
          processingTime: result.metadata.processingTime,
          documentType: result.metadata.documentType,
          aiInsights: result.metadata.aiInsights,
          userId: userId
        });

        // Log API key usage if applicable
        if (req.apiKey) {
          logAPIKeyUsage(req, 'extract', {
            contactsExtracted: result.contacts.length,
            processingTime: result.metadata.processingTime
          });
        }

        res.json({
          success: true,
          contacts: result.contacts,
          metadata: result.metadata,
          usage: result.usage
        });
      } else {
        logExtractionEvent(req, 'ai_extraction_failed', {
          error: result.error,
          userId: userId
        });

        res.status(500).json({
          success: false,
          error: result.error,
          contacts: []
        });
      }

    } catch (error) {
      console.error('❌ AI-enhanced extraction route error:', error);

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
        error: error.message || 'AI-enhanced extraction failed'
      });
    }
  }
);

/**
 * GET /api/custom-extraction/health
 * Health check for custom extraction service
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'custom-extraction',
    timestamp: new Date().toISOString(),
    components: {
      documentAnalyzer: 'operational',
      patternExtractor: 'operational',
      productionIntelligence: 'operational',
      contactValidator: 'operational',
      confidenceScorer: 'operational',
      ocrProcessor: 'operational',
      aiDocumentAnalyzer: 'operational',
      aiPatternExtractor: 'operational',
      aiProductionIntelligence: 'operational'
    }
  });
});

module.exports = router;
