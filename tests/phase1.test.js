/**
 * Phase 1 Comprehensive Tests
 * 
 * Tests all Phase 1 implementations:
 * - Authentication (JWT + API Keys)
 * - Input Validation
 * - Structured Logging
 * - Health Checks
 * - Antivirus Scanning
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Mock the server for testing
const app = require('./testServer');

describe('Phase 1 Implementation Tests', () => {
  let testJWT;
  let testAPIKey;
  let testUserId = 'test-user-123';
  
  beforeAll(async () => {
    // Setup test data
    testJWT = 'test-jwt-token';
    testAPIKey = 'sk_test_' + crypto.randomBytes(16).toString('hex');
  });

  afterAll(async () => {
    // Cleanup
    if (global.apiKeys) {
      global.apiKeys.clear();
    }
  });

  describe('Authentication Tests', () => {
    test('JWT Authentication - Valid Token', async () => {
      const response = await request(app)
        .get('/api/custom-extraction/capabilities')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.capabilities).toBeDefined();
    });

    test('JWT Authentication - Invalid Token', async () => {
      const response = await request(app)
        .get('/api/custom-extraction/capabilities')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('authentication');
    });

    test('JWT Authentication - Missing Token', async () => {
      const response = await request(app)
        .get('/api/custom-extraction/capabilities')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('API Key Authentication - Valid Key', async () => {
      // Mock API key in global store
      if (!global.apiKeys) {
        global.apiKeys = new Map();
      }
      
      global.apiKeys.set(testAPIKey, {
        id: 'test-key-123',
        userId: testUserId,
        name: 'Test Key',
        permissions: ['extract', 'test'],
        isActive: true,
        createdAt: new Date(),
        lastUsedAt: null
      });

      const response = await request(app)
        .get('/api/custom-extraction/capabilities')
        .set('X-API-Key', testAPIKey)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('API Key Authentication - Invalid Key', async () => {
      const response = await request(app)
        .get('/api/custom-extraction/capabilities')
        .set('X-API-Key', 'sk_invalid_key')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('API key');
    });

    test('API Key Authentication - Missing Key', async () => {
      const response = await request(app)
        .get('/api/custom-extraction/capabilities')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Input Validation Tests', () => {
    test('Custom Extraction Upload - Valid Input', async () => {
      // Create a test file
      const testFilePath = path.join(__dirname, 'test-file.pdf');
      const testContent = 'Test PDF content';
      fs.writeFileSync(testFilePath, testContent);

      const response = await request(app)
        .post('/api/custom-extraction/upload')
        .set('Authorization', `Bearer ${testJWT}`)
        .attach('file', testFilePath)
        .field('rolePreferences', JSON.stringify(['Director', 'Producer']))
        .field('options', JSON.stringify({
          includeNotes: true,
          strictValidation: false,
          maxContacts: 100
        }))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.contacts).toBeDefined();

      // Cleanup
      fs.unlinkSync(testFilePath);
    });

    test('Custom Extraction Upload - Invalid Options', async () => {
      const testFilePath = path.join(__dirname, 'test-file.pdf');
      const testContent = 'Test PDF content';
      fs.writeFileSync(testFilePath, testContent);

      const response = await request(app)
        .post('/api/custom-extraction/upload')
        .set('Authorization', `Bearer ${testJWT}`)
        .attach('file', testFilePath)
        .field('options', JSON.stringify({
          maxContacts: 9999 // Invalid: exceeds max of 1000
        }))
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid request parameters');

      // Cleanup
      fs.unlinkSync(testFilePath);
    });

    test('Custom Extraction Test - Valid Input', async () => {
      const response = await request(app)
        .post('/api/custom-extraction/test')
        .set('Authorization', `Bearer ${testJWT}`)
        .send({
          text: 'John Doe - Director - john@example.com - (555) 123-4567',
          documentType: 'call_sheet',
          productionType: 'film'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.contacts).toBeDefined();
    });

    test('Custom Extraction Test - Invalid Input', async () => {
      const response = await request(app)
        .post('/api/custom-extraction/test')
        .set('Authorization', `Bearer ${testJWT}`)
        .send({
          text: 'Short', // Too short (min 10 chars)
          documentType: 'invalid_type' // Invalid enum
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toBeDefined();
    });
  });

  describe('API Key Management Tests', () => {
    test('Create API Key - Valid Request', async () => {
      const response = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${testJWT}`)
        .send({
          name: 'Test API Key',
          permissions: ['extract', 'test'],
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.apiKey).toBeDefined();
      expect(response.body.apiKey).toMatch(/^sk_/);
    });

    test('Create API Key - Invalid Request', async () => {
      const response = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${testJWT}`)
        .send({
          name: '', // Invalid: empty name
          permissions: [] // Invalid: no permissions
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toBeDefined();
    });

    test('List API Keys', async () => {
      const response = await request(app)
        .get('/api/api-keys')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.apiKeys).toBeDefined();
      expect(Array.isArray(response.body.apiKeys)).toBe(true);
    });

    test('Revoke API Key', async () => {
      // First create a key
      const createResponse = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${testJWT}`)
        .send({
          name: 'Key to Revoke',
          permissions: ['extract']
        })
        .expect(201);

      const keyId = createResponse.body.keyId;

      // Then revoke it
      const response = await request(app)
        .delete(`/api/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Health Check Tests', () => {
    test('Main Health Check', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body.service).toBeDefined();
      expect(response.body.database).toBeDefined();
    });

    test('Custom Extraction Health Check', async () => {
      const response = await request(app)
        .get('/api/custom-extraction/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('custom-extraction');
      expect(response.body.components).toBeDefined();
    });
  });

  describe('Structured Logging Tests', () => {
    test('Correlation ID Header', async () => {
      const correlationId = 'test-correlation-123';
      
      const response = await request(app)
        .get('/api/custom-extraction/capabilities')
        .set('X-Correlation-ID', correlationId)
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(200);

      expect(response.headers['x-correlation-id']).toBe(correlationId);
    });

    test('Auto-generated Correlation ID', async () => {
      const response = await request(app)
        .get('/api/custom-extraction/capabilities')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(200);

      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(response.headers['x-correlation-id']).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe('Rate Limiting Tests', () => {
    test('Rate Limit Headers', async () => {
      const response = await request(app)
        .get('/api/custom-extraction/capabilities')
        .set('Authorization', `Bearer ${testJWT}`)
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Error Handling Tests', () => {
    test('404 Handler', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      expect(response.body.error).toBe('Endpoint not found');
      expect(response.body.path).toBe('/api/nonexistent-endpoint');
    });

    test('Malformed JSON', async () => {
      const response = await request(app)
        .post('/api/custom-extraction/test')
        .set('Authorization', `Bearer ${testJWT}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
    });
  });

  describe('Security Tests', () => {
    test('CORS Headers', async () => {
      const response = await request(app)
        .get('/api/custom-extraction/capabilities')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test('Security Headers', async () => {
      const response = await request(app)
        .get('/api/custom-extraction/capabilities')
        .expect(401);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('File Upload Tests', () => {
    test('Valid File Upload', async () => {
      const testFilePath = path.join(__dirname, 'test-upload.pdf');
      const testContent = 'Test PDF content for upload';
      fs.writeFileSync(testFilePath, testContent);

      const response = await request(app)
        .post('/api/custom-extraction/upload')
        .set('Authorization', `Bearer ${testJWT}`)
        .attach('file', testFilePath)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.contacts).toBeDefined();

      // Cleanup
      fs.unlinkSync(testFilePath);
    });

    test('Invalid File Type', async () => {
      const testFilePath = path.join(__dirname, 'test-upload.exe');
      const testContent = 'Executable content';
      fs.writeFileSync(testFilePath, testContent);

      const response = await request(app)
        .post('/api/custom-extraction/upload')
        .set('Authorization', `Bearer ${testJWT}`)
        .attach('file', testFilePath)
        .expect(400);

      expect(response.body.success).toBe(false);

      // Cleanup
      fs.unlinkSync(testFilePath);
    });

    test('File Size Limit', async () => {
      // Create a large file (over 50MB limit)
      const testFilePath = path.join(__dirname, 'test-large.pdf');
      const largeContent = 'x'.repeat(51 * 1024 * 1024); // 51MB
      fs.writeFileSync(testFilePath, largeContent);

      const response = await request(app)
        .post('/api/custom-extraction/upload')
        .set('Authorization', `Bearer ${testJWT}`)
        .attach('file', testFilePath)
        .expect(413); // Payload too large

      // Cleanup
      fs.unlinkSync(testFilePath);
    });
  });
});

// Integration test for the complete flow
describe('Phase 1 Integration Tests', () => {
  test('Complete Extraction Flow', async () => {
    // 1. Create API key
    const createKeyResponse = await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer test-jwt-token`)
      .send({
        name: 'Integration Test Key',
        permissions: ['extract', 'test']
      })
      .expect(201);

    const apiKey = createKeyResponse.body.apiKey;

    // 2. Test extraction with API key
    const testFilePath = path.join(__dirname, 'integration-test.pdf');
    const testContent = `
      Call Sheet - Film Production
      
      Director: John Smith - john@example.com - (555) 123-4567
      Producer: Jane Doe - jane@example.com - (555) 987-6543
      Cinematographer: Bob Wilson - bob@example.com - (555) 456-7890
    `;
    fs.writeFileSync(testFilePath, testContent);

    const extractResponse = await request(app)
      .post('/api/custom-extraction/upload')
      .set('X-API-Key', apiKey)
      .attach('file', testFilePath)
      .expect(200);

    expect(extractResponse.body.success).toBe(true);
    expect(extractResponse.body.contacts.length).toBeGreaterThan(0);

    // 3. Test text extraction
    const testResponse = await request(app)
      .post('/api/custom-extraction/test')
      .set('X-API-Key', apiKey)
      .send({
        text: 'Director: John Smith - john@example.com - (555) 123-4567',
        documentType: 'call_sheet',
        productionType: 'film'
      })
      .expect(200);

    expect(testResponse.body.success).toBe(true);
    expect(testResponse.body.contacts.length).toBeGreaterThan(0);

    // 4. Check health
    const healthResponse = await request(app)
      .get('/api/custom-extraction/health')
      .expect(200);

    expect(healthResponse.body.status).toBe('healthy');

    // Cleanup
    fs.unlinkSync(testFilePath);
  });
});
