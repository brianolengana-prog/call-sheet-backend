/**
 * Optimized Extraction Routes
 * 
 * High-performance extraction endpoints with intelligent routing
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { authenticateAPIKey } = require('../middleware/apiKeyAuth');
const { logExtractionEvent } = require('../middleware/logging');

// Import optimized service
const optimizedExtractionService = require('../services/optimizedExtractionService');

// Configure multer for disk storage (prevents memory issues)
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
 * POST /api/optimized-extraction/upload
 * Upload file for optimized extraction
 */
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    console.log('📤 Optimized extraction request received');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    const { file } = req;
    const options = {
      userId: req.user.id,
      ...req.body
    };

    console.log('📁 Processing file:', {
      name: file.originalname,
      size: file.size,
      type: file.mimetype
    });

    // Log extraction event
    logExtractionEvent(req.user.id, 'optimized_extraction_started', {
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype
    });

    // Perform optimized extraction
    const result = await optimizedExtractionService.extractContacts(
      file.buffer,
      file.mimetype,
      file.originalname,
      options
    );

    console.log('✅ Optimized extraction completed:', {
      contacts: result.contacts.length,
      method: result.metadata.extractionMethod,
      time: result.metadata.processingTime
    });

    // Log successful extraction
    logExtractionEvent(req.user.id, 'optimized_extraction_completed', {
      contactsFound: result.contacts.length,
      extractionMethod: result.metadata.extractionMethod,
      processingTime: result.metadata.processingTime
    });

    res.json({
      success: true,
      contacts: result.contacts,
      metadata: result.metadata
    });

  } catch (error) {
    console.error('❌ Optimized extraction failed:', error);
    
    // Log extraction failure
    logExtractionEvent(req.user.id, 'optimized_extraction_failed', {
      error: error.message,
      fileName: req.file?.originalname
    });

    res.status(500).json({
      success: false,
      error: 'Extraction failed',
      details: error.message
    });
  }
});

/**
 * POST /api/optimized-extraction/upload-api
 * API key authenticated extraction
 */
router.post('/upload-api', authenticateAPIKey, upload.single('file'), async (req, res) => {
  try {
    console.log('🔑 API key extraction request received');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    const { file } = req;
    const options = {
      apiKeyId: req.apiKey.id,
      userId: req.apiKey.userId,
      ...req.body
    };

    console.log('📁 Processing API file:', {
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      apiKey: req.apiKey.id
    });

    // Log API extraction event
    logExtractionEvent(req.apiKey.userId, 'api_extraction_started', {
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      apiKeyId: req.apiKey.id
    });

    // Perform optimized extraction
    const result = await optimizedExtractionService.extractContacts(
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

    // Log successful API extraction
    logExtractionEvent(req.apiKey.userId, 'api_extraction_completed', {
      contactsFound: result.contacts.length,
      extractionMethod: result.metadata.extractionMethod,
      processingTime: result.metadata.processingTime,
      apiKeyId: req.apiKey.id
    });

    res.json({
      success: true,
      contacts: result.contacts,
      metadata: result.metadata
    });

  } catch (error) {
    console.error('❌ API extraction failed:', error);
    
    // Log API extraction failure
    logExtractionEvent(req.apiKey.userId, 'api_extraction_failed', {
      error: error.message,
      fileName: req.file?.originalname,
      apiKeyId: req.apiKey.id
    });

    res.status(500).json({
      success: false,
      error: 'Extraction failed',
      details: error.message
    });
  }
});

/**
 * GET /api/optimized-extraction/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const memoryPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
      percent: Math.round(memoryPercent * 100) + '%'
    },
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

/**
 * GET /api/optimized-extraction/stats
 * Get extraction statistics
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // This would integrate with your existing stats service
    res.json({
      success: true,
      stats: {
        totalExtractions: 0,
        averageProcessingTime: 0,
        memoryOptimized: true
      }
    });
  } catch (error) {
    console.error('❌ Stats retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve stats'
    });
  }
});

module.exports = router;