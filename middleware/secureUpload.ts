/**
 * Secure File Upload Middleware
 * 
 * Enhanced multer configuration with security measures
 */

import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { allowedMimeTypes, maxFileSize } from '../schemas/validation';

// Configure secure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Generate secure filename with timestamp and random hash
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(16).toString('hex');
    const sanitizedName = file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
      .substring(0, 50); // Limit length
    
    const extension = path.extname(file.originalname);
    const filename = `${timestamp}-${randomHash}-${sanitizedName}${extension}`;
    
    cb(null, filename);
  }
});

// File filter for security
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check MIME type
  if (!allowedMimeTypes.includes(file.mimetype as any)) {
    const error = new Error('Unsupported file type') as any;
    error.code = 'UNSUPPORTED_FILE_TYPE';
    return cb(error, false);
  }

  // Check file extension
  const allowedExtensions = ['.pdf', '.docx', '.xlsx', '.xls', '.pptx', '.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.txt'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (!allowedExtensions.includes(fileExtension)) {
    const error = new Error('Unsupported file extension') as any;
    error.code = 'UNSUPPORTED_FILE_EXTENSION';
    return cb(error, false);
  }

  // Check for suspicious filenames
  const suspiciousPatterns = [
    /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|php|asp|aspx|jsp)$/i,
    /\.(sh|bash|zsh|fish|ps1|psm1)$/i,
    /\.(sql|db|sqlite|mdb|accdb)$/i,
    /\.(log|tmp|temp)$/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(file.originalname)) {
      const error = new Error('Suspicious file type detected') as any;
      error.code = 'SUSPICIOUS_FILE_TYPE';
      return cb(error, false);
    }
  }

  cb(null, true);
};

// Configure multer with security settings
export const secureUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: maxFileSize, // 10MB limit
    files: 1, // Only one file at a time
    fieldSize: 1024 * 1024, // 1MB field size limit
    fieldNameSize: 100, // 100 character field name limit
    fieldValueSize: 1024 * 1024, // 1MB field value limit
    parts: 10, // Maximum 10 parts (fields + files)
    headerPairs: 2000 // Maximum 2000 header pairs
  },
  preservePath: false // Don't preserve full path
});

// Error handling middleware
export const handleUploadError = (error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          error: 'File size exceeds limit',
          details: {
            maxSize: maxFileSize,
            code: 'FILE_TOO_LARGE'
          }
        });
      
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Too many files uploaded',
          details: {
            maxFiles: 1,
            code: 'TOO_MANY_FILES'
          }
        });
      
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'Unexpected file field',
          details: {
            code: 'UNEXPECTED_FILE_FIELD'
          }
        });
      
      default:
        return res.status(400).json({
          success: false,
          error: 'File upload error',
          details: {
            code: error.code,
            message: error.message
          }
        });
    }
  }

  if (error.code === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      error: 'Unsupported file type',
      details: {
        allowedTypes: allowedMimeTypes,
        code: 'UNSUPPORTED_FILE_TYPE'
      }
    });
  }

  if (error.code === 'UNSUPPORTED_FILE_EXTENSION') {
    return res.status(400).json({
      success: false,
      error: 'Unsupported file extension',
      details: {
        code: 'UNSUPPORTED_FILE_EXTENSION'
      }
    });
  }

  if (error.code === 'SUSPICIOUS_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      error: 'Suspicious file type detected',
      details: {
        code: 'SUSPICIOUS_FILE_TYPE'
      }
    });
  }

  next(error);
};

// File validation middleware
export const validateUploadedFile = (req: any, res: any, next: any) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded',
      code: 'NO_FILE_UPLOADED'
    });
  }

  // Additional security checks
  const file = req.file;
  
  // Check file size again (double-check)
  if (file.size > maxFileSize) {
    return res.status(400).json({
      success: false,
      error: 'File size exceeds limit',
      details: {
        maxSize: maxFileSize,
        receivedSize: file.size,
        code: 'FILE_TOO_LARGE'
      }
    });
  }

  // Check for empty files
  if (file.size === 0) {
    return res.status(400).json({
      success: false,
      error: 'File is empty',
      code: 'EMPTY_FILE'
    });
  }

  // Check for minimum file size (prevent tiny files that might be malicious)
  if (file.size < 10) {
    return res.status(400).json({
      success: false,
      error: 'File too small',
      details: {
        minSize: 10,
        receivedSize: file.size,
        code: 'FILE_TOO_SMALL'
      }
    });
  }

  // Log file upload for security monitoring
  console.log('📁 Secure file upload:', {
    originalName: file.originalname,
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size,
    timestamp: new Date().toISOString()
  });

  next();
};

// Cleanup uploaded files middleware
export const cleanupUploadedFile = (req: any, res: any, next: any) => {
  // Store original res.json to intercept response
  const originalJson = res.json;
  
  res.json = function(data: any) {
    // Clean up file after response
    if (req.file && req.file.path) {
      const fs = require('fs');
      fs.unlink(req.file.path, (err: any) => {
        if (err) {
          console.warn('⚠️ Failed to clean up uploaded file:', err.message);
        } else {
          console.log('🗑️ Cleaned up uploaded file:', req.file.filename);
        }
      });
    }
    
    // Call original json method
    return originalJson.call(this, data);
  };
  
  next();
};
