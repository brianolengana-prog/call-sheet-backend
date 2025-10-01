/**
 * Public API Extraction Routes
 * 
 * External API endpoints for third-party integration
 * Requires API key authentication
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateAPIKey } = require('../middleware/apiKeyAuth');
const { logExtractionEvent } = require('../middleware/logging');
const usageService = require('../services/usageService');

// Import extraction services
const optimizedExtractionService = require('../services/optimizedExtractionService');
const smartExtractionRouter = require('../services/smartExtractionRouter');

// Configure multer for API usage (using disk storage to prevent memory issues)
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
    }
  }
});

/**
 * POST /api/extract
 * Main extraction endpoint for external API users
 */
router.post('/extract', authenticateAPIKey, upload.single('file'), async (req, res) => {
  try {
    console.log('🔑 API extraction request received:', {
      apiKey: req.apiKey.id,
      userId: req.apiKey.userId,
      fileName: req.file?.originalname
    });
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided',
        code: 'MISSING_FILE'
      });
    }

    const { file } = req;
    const options = {
      apiKeyId: req.apiKey.id,
      userId: req.apiKey.userId,
      ...req.body
    };

    // Log extraction event
    logExtractionEvent(req.apiKey.userId, 'api_extraction_started', {
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      apiKeyId: req.apiKey.id
    });

    // Perform extraction using smart router
    const result = await smartExtractionRouter.extractContacts(
      file.buffer,
      file.mimetype,
      file.originalname,
      options
    );

    console.log('✅ API extraction completed:', {
      contacts: result.contacts.length,
      method: result.metadata.extractionMethod,
      time: result.metadata.processingTime
    });

    // Update usage
    try {
      await usageService.incrementUsage(req.apiKey.userId, 'apiCalls', 1);
    } catch (usageError) {
      console.warn('⚠️ Usage tracking failed:', usageError.message);
    }

    // Log successful extraction
    logExtractionEvent(req.apiKey.userId, 'api_extraction_completed', {
      contactsFound: result.contacts.length,
      extractionMethod: result.metadata.extractionMethod,
      processingTime: result.metadata.processingTime,
      apiKeyId: req.apiKey.id
    });

    // Return standardized API response
    res.json({
      success: true,
      data: {
        contacts: result.contacts,
        metadata: {
          extraction_method: result.metadata.extractionMethod,
          processing_time: result.metadata.processingTime,
          document_type: result.metadata.documentType,
          contacts_found: result.contacts.length
        }
      },
      usage: {
        api_calls_used: 1,
        remaining_calls: req.apiKey.remainingCalls || 'unlimited'
      }
    });

  } catch (error) {
    console.error('❌ API extraction failed:', error);
    
    // Log extraction failure
    logExtractionEvent(req.apiKey.userId, 'api_extraction_failed', {
      error: error.message,
      fileName: req.file?.originalname,
      apiKeyId: req.apiKey.id
    });

    res.status(500).json({
      success: false,
      error: 'Extraction failed',
      code: 'EXTRACTION_ERROR',
      details: error.message
    });
  }
});

/**
 * POST /api/extract/optimized
 * Optimized extraction endpoint for high-performance needs
 */
router.post('/extract/optimized', authenticateAPIKey, upload.single('file'), async (req, res) => {
  try {
    console.log('⚡ Optimized API extraction request received');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided',
        code: 'MISSING_FILE'
      });
    }

    const { file } = req;
    const options = {
      apiKeyId: req.apiKey.id,
      userId: req.apiKey.userId,
      ...req.body
    };

    // Perform optimized extraction
    const result = await optimizedExtractionService.extractContacts(
      file.buffer,
      file.mimetype,
      file.originalname,
      options
    );

    console.log('✅ Optimized API extraction completed:', {
      contacts: result.contacts.length,
      method: result.metadata.extractionMethod,
      time: result.metadata.processingTime
    });

    // Update usage
    try {
      await usageService.incrementUsage(req.apiKey.userId, 'apiCalls', 1);
    } catch (usageError) {
      console.warn('⚠️ Usage tracking failed:', usageError.message);
    }

    res.json({
      success: true,
      data: {
        contacts: result.contacts,
        metadata: {
          extraction_method: result.metadata.extractionMethod,
          processing_time: result.metadata.processingTime,
          document_type: result.metadata.documentType,
          memory_optimized: result.metadata.memoryOptimized,
          contacts_found: result.contacts.length
        }
      },
      usage: {
        api_calls_used: 1,
        remaining_calls: req.apiKey.remainingCalls || 'unlimited'
      }
    });

  } catch (error) {
    console.error('❌ Optimized API extraction failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Extraction failed',
      code: 'EXTRACTION_ERROR',
      details: error.message
    });
  }
});

/**
 * GET /api/usage
 * Get API usage statistics
 */
router.get('/usage', authenticateAPIKey, async (req, res) => {
  try {
    const usage = await usageService.getUsage(req.apiKey.userId);
    
    res.json({
      success: true,
      data: {
        api_calls_used: usage.apiCalls || 0,
        uploads_used: usage.uploads || 0,
        contacts_extracted: usage.contactsExtracted || 0,
        plan: req.apiKey.tier || 'free',
        limits: {
          api_calls: req.apiKey.limits?.apiCalls || 'unlimited',
          uploads: req.apiKey.limits?.uploads || 'unlimited'
        }
      }
    });
  } catch (error) {
    console.error('❌ Usage retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve usage',
      code: 'USAGE_ERROR'
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const memoryPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
      percent: Math.round(memoryPercent * 100) + '%'
    }
  });
});

/**
 * GET /api/docs
 * API documentation endpoint
 */
router.get('/docs', (req, res) => {
  res.json({
    success: true,
    data: {
      title: 'CallSheet AI Extraction API',
      version: '1.0.0',
      description: 'AI-powered contact extraction from call sheets and documents',
      endpoints: {
        'POST /api/extract': {
          description: 'Extract contacts from documents using smart routing',
          authentication: 'API Key in Authorization header',
          parameters: {
            file: 'Multipart file upload (PDF, DOCX, XLSX, TXT)',
            options: 'JSON string with extraction options'
          },
          response: {
            success: 'boolean',
            data: {
              contacts: 'array of contact objects',
              metadata: 'extraction metadata'
            },
            usage: 'usage statistics'
          }
        },
        'POST /api/extract/optimized': {
          description: 'High-performance extraction with memory optimization',
          authentication: 'API Key in Authorization header',
          parameters: 'Same as /api/extract',
          response: 'Same as /api/extract with additional memory optimization metadata'
        },
        'GET /api/usage': {
          description: 'Get current API usage statistics',
          authentication: 'API Key in Authorization header',
          response: {
            success: 'boolean',
            data: 'usage statistics and limits'
          }
        },
        'GET /api/health': {
          description: 'Health check endpoint',
          authentication: 'None required',
          response: 'Service health status'
        }
      },
      authentication: {
        type: 'API Key',
        header: 'Authorization: Bearer YOUR_API_KEY',
        description: 'Include your API key in the Authorization header'
      },
      rate_limits: {
        free: '100 requests/month',
        professional: '1000 requests/month',
        enterprise: 'unlimited'
      },
      examples: {
        curl: {
          extract: 'curl -X POST -H "Authorization: Bearer YOUR_API_KEY" -F "file=@document.pdf" https://your-domain.com/api/extract',
          usage: 'curl -X GET -H "Authorization: Bearer YOUR_API_KEY" https://your-domain.com/api/usage'
        },
        javascript: {
          extract: `
fetch('https://your-domain.com/api/extract', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: formData
})
.then(response => response.json())
.then(data => console.log(data));`
        }
      }
    }
  });
});

module.exports = router;


