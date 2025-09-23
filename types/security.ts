/**
 * Security Type Definitions
 * 
 * TypeScript interfaces for security-related functionality
 */

export interface EncryptedField {
  encrypted: string;
  iv: string;
  tag: string;
}

export interface Contact {
  id?: string;
  name: string;
  email?: string | EncryptedField;
  phone?: string | EncryptedField;
  role: string;
  department?: string | EncryptedField;
  company?: string | EncryptedField;
  notes?: string | EncryptedField;
  jobId?: string;
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SecureExtractionResult {
  success: boolean;
  contacts: Contact[];
  metadata: {
    extractionMethod: string;
    processingTime: number;
    encryptedFields: string[];
    validationPassed: boolean;
  };
  error?: string;
}

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

export interface FileUploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  suspiciousPatterns: RegExp[];
}

export interface SecurityHeaders {
  'x-frame-options'?: 'DENY' | 'SAMEORIGIN';
  'x-content-type-options'?: 'nosniff';
  'x-xss-protection'?: '1; mode=block';
  'strict-transport-security'?: string;
  'content-security-policy'?: string;
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface SecurityEvent {
  type: 'UPLOAD' | 'EXTRACTION' | 'LOGIN' | 'ERROR' | 'SUSPICIOUS';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  userId?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo: {
    originalName: string;
    filename: string;
    mimetype: string;
    size: number;
    extension: string;
  };
}

export interface InputSanitizationResult {
  original: any;
  sanitized: any;
  changes: Array<{
    field: string;
    original: any;
    sanitized: any;
  }>;
}

export interface SecurityMetrics {
  totalRequests: number;
  blockedRequests: number;
  validationFailures: number;
  encryptionOperations: number;
  decryptionOperations: number;
  suspiciousActivities: number;
  timeRange: {
    start: Date;
    end: Date;
  };
}

export interface SecurityConfig {
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyRotationDays: number;
  };
  validation: {
    enabled: boolean;
    strictMode: boolean;
    maxFileSize: number;
    allowedMimeTypes: string[];
  };
  sanitization: {
    enabled: boolean;
    removeHtml: boolean;
    removeScripts: boolean;
    maxLength: number;
  };
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
  logging: {
    enabled: boolean;
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    retentionDays: number;
  };
}
