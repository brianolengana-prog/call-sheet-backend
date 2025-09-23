/**
 * Extraction Routes
 * Handles call sheet contact extraction
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken } = require('../middleware/auth');
const extractionService = require('../services/extractionService');
const customExtractionService = require('../services/customExtractionService');
const extractionServiceManager = require('../services/extractionServiceManager');
const secureExtractionService = require('../services/secureExtractionService');
const prismaService = require('../services/prismaService');
const usageService = require('../services/usageService');
const { 
  validateFileUpload, 
  validateContact, 
  sanitizeBody, 
  sanitizeQuery,
  preventSQLInjection,
  preventXSS,
  validateSecurityHeaders
} = require('../middleware/validation');
const { 
  secureUpload, 
  handleUploadError, 
  validateUploadedFile, 
  cleanupUploadedFile 
} = require('../middleware/secureUpload');
const router = express.Router();

// All extraction routes require authentication
router.use(authenticateToken);

// Apply security middleware to all routes
router.use(sanitizeBody);
router.use(sanitizeQuery);
router.use(preventSQLInjection);
router.use(preventXSS);
router.use(validateSecurityHeaders);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now - we'll handle validation in the service
    cb(null, true);
  }
});

// Ensure upload directory exists
const ensureUploadDir = async () => {
  const uploadDir = path.join(__dirname, '../uploads');
  try {
    await fs.access(uploadDir);
  } catch {
    await fs.mkdir(uploadDir, { recursive: true });
  }
};

ensureUploadDir();

/**
 * POST /api/extraction/upload
 * Upload and extract contacts from call sheet file
 */
router.post('/upload', 
  secureUpload.single('file'),
  handleUploadError,
  validateUploadedFile,
  validateFileUpload,
  cleanupUploadedFile,
  async (req, res) => {
  try {
    const userId = req.user.id;
    const { rolePreferences, options } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    console.log('📁 File upload received:', req.file.originalname);
    console.log('📁 File type:', req.file.mimetype);
    console.log('📁 File size:', req.file.size);

    // Process the uploaded file
    const fileBuffer = await fs.readFile(req.file.path);
    const extractedText = await extractionService.processFile(fileBuffer, req.file.mimetype, req.file.originalname);
    
    if (!extractedText || extractedText.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Could not extract text from file or file is too short'
      });
    }

    console.log('📄 Text extracted, length:', extractedText.length);

    // Parse role preferences and options from JSON strings if needed
    const parsedRolePreferences = typeof rolePreferences === 'string' 
      ? JSON.parse(rolePreferences) 
      : rolePreferences || [];
    
    const parsedOptions = typeof options === 'string' 
      ? JSON.parse(options) 
      : options || {};

    // Check usage limits before processing
    const canProcess = await usageService.canPerformAction(userId, 'upload', 1);
    if (!canProcess.canPerform) {
      return res.status(403).json({
        success: false,
        error: canProcess.reason,
        requiresUpgrade: true
      });
    }

    // Extract contacts using the secure service
    const result = await secureExtractionService.extractContacts(
      fileBuffer,
      req.file.mimetype,
      req.file.originalname,
      { ...parsedOptions, rolePreferences: parsedRolePreferences, userId }
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    // Save extracted contacts to database
    let jobId = null;
    if (result.contacts && result.contacts.length > 0) {
      try {
        // Create a job record for this extraction
        const job = await prismaService.createJob({
          userId,
          title: `File Upload - ${req.file.originalname}`,
          fileName: req.file.originalname,
          status: 'completed'
        });

        jobId = job.id;

        // Save contacts to database
        const contactsToSave = result.contacts.map(contact => ({
          ...contact,
          jobId: job.id,
          userId
        }));

        await prismaService.createContacts(contactsToSave);

        // Update usage tracking
        await usageService.incrementUsage(userId, 'upload', 1);

        console.log('✅ Contacts saved to database:', result.contacts.length);

      } catch (dbError) {
        console.error('❌ Database save error:', dbError);
        return res.status(500).json({
          success: false,
          error: 'Failed to save contacts to database'
        });
      }
    }

    // Clean up uploaded file
    try {
      await fs.unlink(req.file.path);
    } catch (cleanupError) {
      console.warn('⚠️ Failed to clean up uploaded file:', cleanupError.message);
    }

    res.json({
      success: true,
      contacts: result.contacts,
      jobId: jobId,
      usage: result.usage,
      processedChunks: result.processedChunks,
      documentType: result.documentType,
      productionType: result.productionType
    });

  } catch (error) {
    console.error('❌ File upload extraction error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.warn('⚠️ Failed to clean up uploaded file after error:', cleanupError.message);
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'File processing failed'
    });
  }
});

/**
 * POST /api/extraction/extract
 * Extract contacts from call sheet text
 */
router.post('/extract', async (req, res) => {
  try {
    const { text, rolePreferences, options } = req.body;
    const userId = req.user.id;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text content is required'
      });
    }

    console.log('🔍 Extraction request from user:', userId);
    console.log('📄 Text length:', text.length);

    // Check if text is too large for single processing
    const estimatedTokens = Math.ceil(text.length / 4);
    
    let result;
    if (estimatedTokens > 120000) {
      console.log('📚 Large document detected, using chunked processing');
      result = await extractionService.processLargeDocument(text, rolePreferences, options);
    } else {
      result = await extractionService.extractContacts(text, rolePreferences, options);
    }

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    // Save extracted contacts to database
    if (result.contacts && result.contacts.length > 0) {
      try {
        // Create a job record for this extraction
        const job = await prismaService.createJob({
          userId,
          title: `Call Sheet Extraction - ${new Date().toLocaleDateString()}`,
          status: 'completed'
        });

        // Save contacts to database
        const contactsToSave = result.contacts.map(contact => ({
          ...contact,
          jobId: job.id,
          userId
        }));

        await prismaService.createContacts(contactsToSave);

        // Update usage tracking
        await prismaService.incrementUsage(userId, {
          jobsProcessed: 1,
          contactsExtracted: result.contacts.length,
          aiMinutesUsed: Math.ceil(estimatedTokens / 1000) // Rough estimate
        });

        console.log('✅ Contacts saved to database:', result.contacts.length);

      } catch (dbError) {
        console.error('❌ Database save error:', dbError);
        // Don't fail the extraction if database save fails
      }
    }

    res.json({
      success: true,
      contacts: result.contacts,
      usage: result.usage,
      processedChunks: result.processedChunks
    });

  } catch (error) {
    console.error('❌ Extraction route error:', error);
    res.status(500).json({
      success: false,
      error: 'Extraction failed'
    });
  }
});

/**
 * GET /api/extraction/history
 * Get extraction history for the user
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const jobs = await prismaService.getJobsByUser(userId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      jobs
    });

  } catch (error) {
    console.error('❌ History route error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch extraction history'
    });
  }
});

/**
 * GET /api/extraction/contacts/:jobId
 * Get contacts for a specific job
 */
router.get('/contacts/:jobId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { jobId } = req.params;

    // Verify job belongs to user
    const job = await prismaService.getJobById(jobId);
    if (!job || job.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    const contacts = await prismaService.getContactsByJob(jobId);

    res.json({
      success: true,
      contacts
    });

  } catch (error) {
    console.error('❌ Contacts route error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contacts'
    });
  }
});

/**
 * DELETE /api/extraction/job/:jobId
 * Delete a job and its contacts
 */
router.delete('/job/:jobId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { jobId } = req.params;

    // Verify job belongs to user
    const job = await prismaService.getJobById(jobId);
    if (!job || job.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // Delete job (contacts will be deleted via cascade)
    await prismaService.deleteJob(jobId);

    res.json({
      success: true,
      message: 'Job deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete job error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete job'
    });
  }
});

/**
 * POST /api/extraction/upload-with-method
 * Upload and extract contacts with method selection (AI, Custom, or Auto)
 */
router.post('/upload-with-method', 
  secureUpload.single('file'),
  handleUploadError,
  validateUploadedFile,
  validateFileUpload,
  cleanupUploadedFile,
  async (req, res) => {
  try {
    const userId = req.user.id;
    const { rolePreferences, options, extractionMethod = 'auto' } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    console.log('📁 File upload with method received:', req.file.originalname);
    console.log('📁 File type:', req.file.mimetype);
    console.log('📁 File size:', req.file.size);
    console.log('🎯 Extraction method:', extractionMethod);

    // Process the uploaded file
    const fileBuffer = await fs.readFile(req.file.path);
    
    // Parse role preferences and options from JSON strings if needed
    const parsedRolePreferences = typeof rolePreferences === 'string' 
      ? JSON.parse(rolePreferences) 
      : rolePreferences || [];
    
    const parsedOptions = typeof options === 'string' 
      ? JSON.parse(options) 
      : options || {};

    // Check usage limits before processing
    const canProcess = await usageService.canPerformAction(userId, 'upload', 1);
    if (!canProcess.canPerform) {
      return res.status(403).json({
        success: false,
        error: canProcess.reason,
        requiresUpgrade: true
      });
    }

    let result;

    // Use secure extraction service with method selection
    result = await secureExtractionService.extractContacts(
      fileBuffer,
      req.file.mimetype,
      req.file.originalname,
      { 
        ...parsedOptions, 
        rolePreferences: parsedRolePreferences, 
        userId,
        extractionMethod 
      }
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Extraction failed'
      });
    }

    // Save extracted contacts to database
    let jobId = null;
    if (result.contacts && result.contacts.length > 0) {
      try {
        // Create a job record for this extraction
        const job = await prismaService.createJob({
          userId,
          title: `File Upload - ${req.file.originalname} (${extractionMethod})`,
          fileName: req.file.originalname,
          status: 'completed'
        });

        jobId = job.id;

        // Save contacts to database
        const contactsToSave = result.contacts.map(contact => ({
          ...contact,
          jobId: job.id,
          userId
        }));

        await prismaService.createContacts(contactsToSave);

        // Update usage tracking
        await usageService.incrementUsage(userId, 'upload', 1);

        console.log('✅ Contacts saved to database:', result.contacts.length);

      } catch (dbError) {
        console.error('❌ Database save error:', dbError);
        return res.status(500).json({
          success: false,
          error: 'Failed to save contacts to database'
        });
      }
    }

    // Clean up uploaded file
    try {
      await fs.unlink(req.file.path);
    } catch (cleanupError) {
      console.warn('⚠️ Failed to clean up uploaded file:', cleanupError.message);
    }

    res.json({
      success: true,
      contacts: result.contacts,
      jobId: jobId,
      usage: result.usage,
      metadata: {
        ...result.metadata,
        extractionMethod: extractionMethod,
        processingTime: result.metadata?.processingTime || 0
      }
    });

  } catch (error) {
    console.error('❌ File upload with method extraction error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.warn('⚠️ Failed to clean up uploaded file after error:', cleanupError.message);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'File processing failed'
    });
  }
});

/**
 * GET /api/extraction/methods
 * Get available extraction methods and their capabilities
 */
router.get('/methods', (req, res) => {
  try {
    const manager = new extractionServiceManager();
    const serviceStatus = manager.getServiceStatus();
    
    const methods = {
      ai: {
        name: 'AI Extraction',
        description: 'OpenAI-powered extraction with advanced context understanding',
        available: serviceStatus.aiService.available,
        capabilities: serviceStatus.aiService.capabilities,
        bestFor: ['Large documents', 'Complex layouts', 'Context-heavy content'],
        processingTime: '5-60 seconds',
        accuracy: '90-95%'
      },
      custom: {
        name: 'Custom Extraction',
        description: 'Pattern-based extraction optimized for production documents',
        available: serviceStatus.customService.available,
        capabilities: serviceStatus.customService.capabilities,
        bestFor: ['Call sheets', 'Contact lists', 'Production documents'],
        processingTime: '1-10 seconds',
        accuracy: '85-95%'
      },
      auto: {
        name: 'Intelligent Selection',
        description: 'Automatically chooses the best method based on document characteristics',
        available: serviceStatus.aiService.available || serviceStatus.customService.available,
        capabilities: ['Best of both worlds', 'Automatic optimization', 'Fallback handling'],
        bestFor: ['Any document type', 'Optimal performance', 'Reliability'],
        processingTime: '1-60 seconds',
        accuracy: '90-95%'
      }
    };

    res.json({
      success: true,
      methods: methods,
      recommended: serviceStatus.aiService.available ? 'auto' : 'custom'
    });

  } catch (error) {
    console.error('❌ Methods endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
