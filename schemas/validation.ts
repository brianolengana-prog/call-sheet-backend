/**
 * Validation Schemas
 * 
 * Zod schemas for input validation across all endpoints
 */

import { z } from 'zod';

// File upload validation
export const fileUploadSchema = z.object({
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
    ], {
      errorMap: () => ({ message: 'Unsupported file type' })
    }),
    size: z.number()
      .min(1, 'File cannot be empty')
      .max(10 * 1024 * 1024, 'File size cannot exceed 10MB'),
    destination: z.string(),
    filename: z.string(),
    path: z.string()
  })
});

// Contact validation
export const contactSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name cannot exceed 100 characters')
    .regex(/^[a-zA-Z\s\-'\.]+$/, 'Name contains invalid characters'),
  
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email cannot exceed 255 characters')
    .optional()
    .or(z.literal('')),
  
  phone: z.string()
    .regex(/^[\+]?[\d\s\-\(\)]{10,}$/, 'Invalid phone number format')
    .max(20, 'Phone number cannot exceed 20 characters')
    .optional()
    .or(z.literal('')),
  
  role: z.string()
    .min(1, 'Role is required')
    .max(50, 'Role cannot exceed 50 characters')
    .regex(/^[a-zA-Z\s\-]+$/, 'Role contains invalid characters'),
  
  department: z.string()
    .max(50, 'Department cannot exceed 50 characters')
    .regex(/^[a-zA-Z\s\-]+$/, 'Department contains invalid characters')
    .optional()
    .or(z.literal('')),
  
  company: z.string()
    .max(100, 'Company name cannot exceed 100 characters')
    .regex(/^[a-zA-Z0-9\s&.,\-]+$/, 'Company name contains invalid characters')
    .optional()
    .or(z.literal('')),
  
  notes: z.string()
    .max(500, 'Notes cannot exceed 500 characters')
    .optional()
    .or(z.literal(''))
});

// Extraction request validation
export const extractionRequestSchema = z.object({
  rolePreferences: z.array(z.string().max(50)).optional(),
  options: z.object({
    includeNotes: z.boolean().optional(),
    strictValidation: z.boolean().optional(),
    maxContacts: z.number().min(1).max(1000).optional()
  }).optional(),
  extractionMethod: z.enum(['ai', 'custom', 'auto']).optional()
});

// User input sanitization
export const sanitizeString = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/['"]/g, '') // Remove quotes
    .replace(/[;]/g, '') // Remove semicolons
    .substring(0, 1000); // Limit length
};

// File type validation
export const allowedMimeTypes = [
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
] as const;

export const maxFileSize = 10 * 1024 * 1024; // 10MB

// Validation error types
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  success: boolean;
  data?: any;
  errors?: ValidationError[];
}

// Custom validation functions
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
};

export const validateName = (name: string): boolean => {
  const nameRegex = /^[a-zA-Z\s\-'\.]+$/;
  return nameRegex.test(name) && name.length >= 1 && name.length <= 100;
};

// Rate limiting schemas
export const rateLimitSchema = z.object({
  windowMs: z.number().min(1000), // Minimum 1 second
  max: z.number().min(1).max(1000), // Maximum 1000 requests
  message: z.string().optional()
});

// Security headers validation
export const securityHeadersSchema = z.object({
  'x-frame-options': z.enum(['DENY', 'SAMEORIGIN']).optional(),
  'x-content-type-options': z.literal('nosniff').optional(),
  'x-xss-protection': z.literal('1; mode=block').optional(),
  'strict-transport-security': z.string().optional(),
  'content-security-policy': z.string().optional()
});
