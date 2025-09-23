/**
 * Validation Middleware
 * 
 * Input validation and sanitization middleware using Zod and express-validator
 */

import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { z } from 'zod';
import { 
  fileUploadSchema, 
  contactSchema, 
  extractionRequestSchema,
  sanitizeString,
  allowedMimeTypes,
  maxFileSize,
  ValidationError,
  ValidationResult
} from '../schemas/validation';

// Error handling for validation failures
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors: ValidationError[] = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      code: 'VALIDATION_ERROR'
    }));

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: formattedErrors
    });
  }
  
  next();
};

// Sanitize request body
export const sanitizeBody = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
};

// Sanitize query parameters
export const sanitizeQuery = (req: Request, res: Response, next: NextFunction) => {
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  next();
};

// Sanitize object recursively
const sanitizeObject = (obj: any): any => {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
};

// File upload validation
export const validateFileUpload = [
  body('extractionMethod')
    .optional()
    .isIn(['ai', 'custom', 'auto'])
    .withMessage('Invalid extraction method'),
  
  body('rolePreferences')
    .optional()
    .isArray()
    .withMessage('Role preferences must be an array'),
  
  body('rolePreferences.*')
    .optional()
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each role preference must be a string between 1-50 characters'),
  
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),
  
  handleValidationErrors
];

// Contact validation
export const validateContact = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1-100 characters')
    .matches(/^[a-zA-Z\s\-'\.]+$/)
    .withMessage('Name contains invalid characters'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format')
    .isLength({ max: 255 })
    .withMessage('Email cannot exceed 255 characters'),
  
  body('phone')
    .optional()
    .matches(/^[\+]?[\d\s\-\(\)]{10,}$/)
    .withMessage('Invalid phone number format')
    .isLength({ max: 20 })
    .withMessage('Phone number cannot exceed 20 characters'),
  
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Role must be between 1-50 characters')
    .matches(/^[a-zA-Z\s\-]+$/)
    .withMessage('Role contains invalid characters'),
  
  body('department')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Department cannot exceed 50 characters')
    .matches(/^[a-zA-Z\s\-]+$/)
    .withMessage('Department contains invalid characters'),
  
  body('company')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Company name cannot exceed 100 characters')
    .matches(/^[a-zA-Z0-9\s&.,\-]+$/)
    .withMessage('Company name contains invalid characters'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  
  handleValidationErrors
];

// ID parameter validation
export const validateId = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
  
  handleValidationErrors
];

// Pagination validation
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1-100'),
  
  handleValidationErrors
];

// Search validation
export const validateSearch = [
  query('q')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1-100 characters')
    .matches(/^[a-zA-Z0-9\s\-]+$/)
    .withMessage('Search query contains invalid characters'),
  
  handleValidationErrors
];

// Zod schema validation middleware
export const validateWithZod = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors: ValidationError[] = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: 'ZOD_VALIDATION_ERROR'
        }));

        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: formattedErrors
        });
      }
      
      next(error);
    }
  };
};

// File type validation
export const validateFileType = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded'
    });
  }

  if (!allowedMimeTypes.includes(req.file.mimetype as any)) {
    return res.status(400).json({
      success: false,
      error: 'Unsupported file type',
      details: {
        allowedTypes: allowedMimeTypes,
        receivedType: req.file.mimetype
      }
    });
  }

  if (req.file.size > maxFileSize) {
    return res.status(400).json({
      success: false,
      error: 'File size exceeds limit',
      details: {
        maxSize: maxFileSize,
        receivedSize: req.file.size
      }
    });
  }

  next();
};

// Rate limiting validation
export const validateRateLimit = (req: Request, res: Response, next: NextFunction) => {
  // This would integrate with your rate limiting middleware
  // For now, just pass through
  next();
};

// Security headers validation
export const validateSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Check for suspicious headers
  const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-forwarded-proto'];
  
  for (const header of suspiciousHeaders) {
    if (req.headers[header] && Array.isArray(req.headers[header])) {
      return res.status(400).json({
        success: false,
        error: 'Invalid header format'
      });
    }
  }
  
  next();
};

// SQL injection prevention
export const preventSQLInjection = (req: Request, res: Response, next: NextFunction) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\b(OR|AND)\s+['"]\s*=\s*['"])/i,
    /(\bUNION\s+SELECT\b)/i,
    /(\bDROP\s+TABLE\b)/i,
    /(\bINSERT\s+INTO\b)/i,
    /(\bUPDATE\s+SET\b)/i,
    /(\bDELETE\s+FROM\b)/i
  ];

  const checkForSQLInjection = (obj: any, path: string = ''): boolean => {
    if (typeof obj === 'string') {
      for (const pattern of sqlPatterns) {
        if (pattern.test(obj)) {
          console.warn(`Potential SQL injection detected in ${path}: ${obj}`);
          return true;
        }
      }
    } else if (Array.isArray(obj)) {
      return obj.some((item, index) => checkForSQLInjection(item, `${path}[${index}]`));
    } else if (obj && typeof obj === 'object') {
      return Object.entries(obj).some(([key, value]) => 
        checkForSQLInjection(value, path ? `${path}.${key}` : key)
      );
    }
    return false;
  };

  if (checkForSQLInjection(req.body, 'body') || 
      checkForSQLInjection(req.query, 'query') || 
      checkForSQLInjection(req.params, 'params')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid input detected'
    });
  }

  next();
};

// XSS prevention
export const preventXSS = (req: Request, res: Response, next: NextFunction) => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    /<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi,
    /<meta\b[^<]*(?:(?!<\/meta>)<[^<]*)*<\/meta>/gi,
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi
  ];

  const checkForXSS = (obj: any, path: string = ''): boolean => {
    if (typeof obj === 'string') {
      for (const pattern of xssPatterns) {
        if (pattern.test(obj)) {
          console.warn(`Potential XSS detected in ${path}: ${obj}`);
          return true;
        }
      }
    } else if (Array.isArray(obj)) {
      return obj.some((item, index) => checkForXSS(item, `${path}[${index}]`));
    } else if (obj && typeof obj === 'object') {
      return Object.entries(obj).some(([key, value]) => 
        checkForXSS(value, path ? `${path}.${key}` : key)
      );
    }
    return false;
  };

  if (checkForXSS(req.body, 'body') || 
      checkForXSS(req.query, 'query') || 
      checkForXSS(req.params, 'params')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid input detected'
    });
  }

  next();
};
