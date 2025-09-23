/**
 * Custom Extraction Routes
 * 
 * Routes for testing and using the custom extraction service
 */

const express = require('express');
const multer = require('multer');
const CustomExtractionService = require('../services/customExtractionService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const customExtractionService = new CustomExtractionService();

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
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const userId = req.user?.id;
    const { rolePreferences, options } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    console.log('📁 Custom extraction file upload received:', req.file.originalname);
    console.log('📁 File type:', req.file.mimetype);
    console.log('📁 File size:', req.file.size);

    // Read file into buffer
    const fileBuffer = await require('fs').promises.readFile(req.file.path);
    
    // Parse options
    const parsedOptions = typeof options === 'string' ? JSON.parse(options) : options || {};
    const parsedRolePreferences = typeof rolePreferences === 'string' ? JSON.parse(rolePreferences) : rolePreferences || [];

    // Extract contacts using custom service
    const result = await customExtractionService.extractContacts(
      fileBuffer,
      req.file.mimetype,
      req.file.originalname,
      {
        ...parsedOptions,
        rolePreferences: parsedRolePreferences,
        userId: userId
      }
    );

    // Clean up uploaded file
    await require('fs').promises.unlink(req.file.path);

    if (result.success) {
      console.log(`✅ Custom extraction successful: ${result.contacts.length} contacts found`);
      res.json({
        success: true,
        contacts: result.contacts,
        metadata: result.metadata,
        usage: result.usage
      });
    } else {
      console.log('❌ Custom extraction failed:', result.error);
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
 */
router.post('/test', async (req, res) => {
  try {
    const { text, documentType, productionType } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required for testing'
      });
    }

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

module.exports = router;
