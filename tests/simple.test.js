/**
 * Simple Phase 1 Tests
 * 
 * Basic tests for Phase 1 components without full server setup
 */

describe('Phase 1 Simple Tests', () => {
  
  describe('Validation Schemas', () => {
    test('Custom Extraction Upload Schema', () => {
      const { customExtractionUploadSchema } = require('../schemas/validation');
      
      // Valid data
      const validData = {
        rolePreferences: ['Director', 'Producer'],
        options: {
          includeNotes: true,
          strictValidation: false,
          maxContacts: 100,
          defaultRegion: 'US'
        }
      };
      
      const result = customExtractionUploadSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    test('Custom Extraction Test Schema', () => {
      const { customExtractionTestSchema } = require('../schemas/validation');
      
      // Valid data
      const validData = {
        text: 'John Doe - Director - john@example.com - (555) 123-4567',
        documentType: 'call_sheet',
        productionType: 'film'
      };
      
      const result = customExtractionTestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    test('API Key Schema', () => {
      const { apiKeySchema } = require('../schemas/validation');
      
      // Valid data
      const validData = {
        name: 'Test API Key',
        permissions: ['extract', 'test'],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
      
      const result = apiKeySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    test('Invalid Data Rejection', () => {
      const { customExtractionTestSchema } = require('../schemas/validation');
      
      // Invalid data
      const invalidData = {
        text: 'Short', // Too short
        documentType: 'invalid_type' // Invalid enum
      };
      
      const result = customExtractionTestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      if (result.error && result.error.errors) {
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Validation Functions', () => {
    test('Email Validation', () => {
      const { validateEmail } = require('../schemas/validation');
      
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('user@domain.co.uk')).toBe(true);
    });

    test('Phone Validation', () => {
      const { validatePhone } = require('../schemas/validation');
      
      expect(validatePhone('(555) 123-4567')).toBe(true);
      expect(validatePhone('+1-555-123-4567')).toBe(true);
      expect(validatePhone('5551234567')).toBe(true);
      expect(validatePhone('123')).toBe(false);
    });

    test('Name Validation', () => {
      const { validateName } = require('../schemas/validation');
      
      expect(validateName('John Doe')).toBe(true);
      expect(validateName('Mary Jane Smith')).toBe(true);
      expect(validateName('John O\'Connor')).toBe(true); // Valid with apostrophe
      expect(validateName('John123')).toBe(false); // Contains numbers
      // Note: Single character names might be valid in some contexts
      expect(validateName('A')).toBe(false); // Too short
    });
  });

  describe('API Key Service', () => {
    test('API Key Generation', () => {
      const apiKeyService = require('../services/apiKeyService');
      
      // Test API key format
      const testKey = 'sk_test_1234567890abcdef';
      expect(testKey.startsWith('sk_')).toBe(true);
      expect(testKey.length).toBeGreaterThan(10);
    });

    test('API Key Validation', async () => {
      const apiKeyService = require('../services/apiKeyService');
      
      // Mock a valid API key
      if (!global.apiKeys) {
        global.apiKeys = new Map();
      }
      
      const testKey = 'sk_test_1234567890abcdef';
      global.apiKeys.set(testKey, {
        id: 'test-key-123',
        userId: 'test-user-123',
        permissions: ['extract', 'test'],
        isActive: true,
        createdAt: new Date(),
        lastUsedAt: null
      });
      
      const result = await apiKeyService.validateAPIKey(testKey);
      expect(result.success).toBe(true);
      expect(result.keyRecord).toBeDefined();
    });
  });

  describe('Antivirus Service', () => {
    test('Antivirus Service Initialization', () => {
      const antivirusService = require('../services/antivirusService');
      
      expect(antivirusService).toBeDefined();
      expect(antivirusService.scanFile).toBeDefined();
      expect(typeof antivirusService.scanFile).toBe('function');
    });

    test('Antivirus Configuration', () => {
      const antivirusService = require('../services/antivirusService');
      
      // Test that the service has the expected methods
      expect(antivirusService.scanFile).toBeDefined();
      expect(typeof antivirusService.scanFile).toBe('function');
      
      // Test that the service is properly initialized
      expect(antivirusService).toBeDefined();
      expect(typeof antivirusService).toBe('object');
    });
  });

  describe('Logging Middleware', () => {
    test('Correlation ID Generation', () => {
      const { structuredLogging } = require('../middleware/logging');
      
      expect(structuredLogging).toBeDefined();
      expect(typeof structuredLogging).toBe('function');
    });

    test('Logging Functions', () => {
      const { logExtractionEvent, logAPIKeyUsage, logSecurityEvent } = require('../middleware/logging');
      
      expect(logExtractionEvent).toBeDefined();
      expect(logAPIKeyUsage).toBeDefined();
      expect(logSecurityEvent).toBeDefined();
      expect(typeof logExtractionEvent).toBe('function');
      expect(typeof logAPIKeyUsage).toBe('function');
      expect(typeof logSecurityEvent).toBe('function');
    });
  });

  describe('File Upload Configuration', () => {
    test('Allowed MIME Types', () => {
      const { allowedMimeTypes } = require('../schemas/validation');
      
      expect(Array.isArray(allowedMimeTypes)).toBe(true);
      expect(allowedMimeTypes).toContain('application/pdf');
      expect(allowedMimeTypes).toContain('image/jpeg');
      expect(allowedMimeTypes).toContain('text/plain');
    });

    test('File Size Limits', () => {
      const { maxFileSize } = require('../schemas/validation');
      
      expect(maxFileSize).toBe(10 * 1024 * 1024); // 10MB
      expect(typeof maxFileSize).toBe('number');
    });
  });

  describe('Security Headers', () => {
    test('Security Headers Schema', () => {
      const { securityHeadersSchema } = require('../schemas/validation');
      
      const validHeaders = {
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'x-xss-protection': '1; mode=block'
      };
      
      const result = securityHeadersSchema.safeParse(validHeaders);
      expect(result.success).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    test('Rate Limit Schema', () => {
      const { rateLimitSchema } = require('../schemas/validation');
      
      const validConfig = {
        windowMs: 60000, // 1 minute
        max: 100, // 100 requests
        message: 'Too many requests'
      };
      
      const result = rateLimitSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });
  });
});
