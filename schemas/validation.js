/**
 * Validation Schemas
 * 
 * Zod schemas for input validation across all endpoints
 */

const { z } = require('zod');

// File upload validation
const fileUploadSchema = z.object({
  file: z.object({
    fieldname: z.string(),
    originalname: z.string().min(1, 'File name is required'),
    encoding: z.string(),
    mimetype: z.enum([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'image/bmp',
      'text/plain'
    ]).refine(
      (mimetype) => allowedMimeTypes.includes(mimetype),
      {
        message: 'Unsupported file type'
      }
    ),
    size: z.number()
      .min(1, 'File cannot be empty')
      .max(10 * 1024 * 1024, 'File size cannot exceed 10MB'),
    destination: z.string(),
    filename: z.string(),
    path: z.string()
  })
});

// Contact validation
const contactSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name cannot exceed 100 characters')
    .refine((name) => {
      // Reject obvious header rows
      const headerKeywords = ['first name', 'last name', 'name', 'email', 'phone', 'website', 'address', 'category', 'representative'];
      const lowerName = name.toLowerCase();
      const isHeader = headerKeywords.some(keyword => lowerName.includes(keyword));
      return !isHeader;
    }, 'Name appears to be a header row, not a person'),
  
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email cannot exceed 255 characters')
    .optional()
    .or(z.literal('')),
  
  phone: z.string()
    .regex(/^[+]?[\d\s-()]{10,}$/, 'Invalid phone number format')
    .max(20, 'Phone number cannot exceed 20 characters')
    .optional()
    .or(z.literal('')),
  
  role: z.string()
    .min(1, 'Role is required')
    .max(50, 'Role cannot exceed 50 characters')
    .regex(/^[a-zA-Z\s-]+$/, 'Role contains invalid characters'),
  
  department: z.string()
    .max(50, 'Department cannot exceed 50 characters')
    .regex(/^[a-zA-Z\s-]+$/, 'Department contains invalid characters')
    .optional()
    .or(z.literal('')),
  
  company: z.string()
    .max(100, 'Company name cannot exceed 100 characters')
    .regex(/^[a-zA-Z0-9\s&.,-]+$/, 'Company name contains invalid characters')
    .optional()
    .or(z.literal('')),
  
  notes: z.string()
    .max(500, 'Notes cannot exceed 500 characters')
    .optional()
    .or(z.literal(''))
});

// Extraction request validation
const extractionRequestSchema = z.object({
  rolePreferences: z.array(z.string().max(50)).optional(),
  options: z.object({
    includeNotes: z.boolean().optional(),
    strictValidation: z.boolean().optional(),
    maxContacts: z.number().min(1).max(1000).optional()
  }).optional(),
  extractionMethod: z.enum(['ai', 'custom', 'auto']).optional()
});

// User input sanitization
const sanitizeString = (input) => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/['"]/g, '') // Remove quotes
    .replace(/[;]/g, '') // Remove semicolons
    .substring(0, 1000); // Limit length
};

// File type validation
const allowedMimeTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/bmp',
  'text/plain'
];

const maxFileSize = 10 * 1024 * 1024; // 10MB

// Validation error types
const ValidationError = {
  field: z.string(),
  message: z.string(),
  code: z.string()
};

const ValidationResult = {
  success: z.boolean(),
  data: z.unknown().optional(),
  errors: z.array(ValidationError).optional()
};

// Custom validation functions
const validateEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  const phoneRegex = /^[+]?[\d\s-()]{10,}$/;
  return phoneRegex.test(phone);
};

const validateName = (name) => {
  const nameRegex = /^[a-zA-Z\s-'.]+$/;
  return nameRegex.test(name) && name.length >= 2 && name.length <= 100;
};

// Rate limiting schemas
const rateLimitSchema = z.object({
  windowMs: z.number().min(1000), // Minimum 1 second
  max: z.number().min(1).max(1000), // Maximum 1000 requests
  message: z.string().optional()
});

// Security headers validation
const securityHeadersSchema = z.object({
  'x-frame-options': z.enum(['DENY', 'SAMEORIGIN']).optional(),
  'x-content-type-options': z.literal('nosniff').optional(),
  'x-xss-protection': z.literal('1; mode=block').optional(),
  'strict-transport-security': z.string().optional(),
  'content-security-policy': z.string().optional()
});

// Custom extraction request validation
const customExtractionUploadSchema = z.object({
  rolePreferences: z.array(z.string().max(50)).optional(),
  options: z.object({
    includeNotes: z.boolean().optional(),
    strictValidation: z.boolean().optional(),
    maxContacts: z.number().min(1).max(1000).optional(),
    defaultRegion: z.string().max(10).optional()
  }).optional()
});

const customExtractionTestSchema = z.object({
  text: z.string().min(10, 'Text must be at least 10 characters').max(100000, 'Text too long'),
  documentType: z.enum(['call_sheet', 'contact_list', 'production_document', 'resume', 'business_card', 'unknown']).optional(),
  productionType: z.enum(['film', 'television', 'commercial', 'corporate', 'theatre', 'unknown']).optional()
});

// API key validation
const apiKeySchema = z.object({
  name: z.string().min(1, 'API key name is required').max(100, 'Name too long'),
  permissions: z.array(z.enum(['extract', 'test', 'admin'])).min(1, 'At least one permission required'),
  expiresAt: z.string().datetime().optional()
});

// Usage tracking validation
const usageTrackingSchema = z.object({
  userId: z.string().uuid(),
  operation: z.enum(['extract', 'test', 'upload']),
  documentSize: z.number().min(0),
  processingTime: z.number().min(0),
  contactsExtracted: z.number().min(0),
  cost: z.number().min(0)
});

module.exports = {
  fileUploadSchema,
  contactSchema,
  extractionRequestSchema,
  sanitizeString,
  allowedMimeTypes,
  maxFileSize,
  ValidationError,
  ValidationResult,
  validateEmail,
  validatePhone,
  validateName,
  rateLimitSchema,
  securityHeadersSchema,
  customExtractionUploadSchema,
  customExtractionTestSchema,
  apiKeySchema,
  usageTrackingSchema
};
