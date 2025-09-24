/**
 * Jest Test Setup
 * 
 * Global test configuration and mocks
 */

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.CLAMAV_ENABLED = 'false'; // Disable ClamAV for tests
process.env.VIRUSTOTAL_ENABLED = 'false'; // Disable VirusTotal for tests

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
};

// Mock file system operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  existsSync: jest.fn(() => true)
}));

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn((command, callback) => {
    // Mock successful ClamAV scan
    if (command.includes('clamscan')) {
      callback(null, 'OK', '');
    } else {
      callback(new Error('Command not found'), '', 'Command not found');
    }
  })
}));

// Mock fetch for VirusTotal API
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      response_code: 1,
      positives: 0,
      total: 50,
      scans: {}
    })
  })
);

// Setup global test data
beforeAll(() => {
  // Initialize global API keys store
  global.apiKeys = new Map();
});

afterAll(() => {
  // Cleanup
  if (global.apiKeys) {
    global.apiKeys.clear();
  }
});

// Mock authentication middleware
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'test-user-123', email: 'test@example.com' };
    next();
  },
  optionalAuth: (req, res, next) => {
    req.user = { id: 'test-user-123', email: 'test@example.com' };
    next();
  }
}));

// Mock auth service to avoid bcrypt dependency
jest.mock('../services/authService', () => ({
  verifyAccessToken: jest.fn(() => Promise.resolve({
    success: true,
    user: { id: 'test-user-123', email: 'test@example.com' }
  }))
}));

// Mock security service to avoid bcrypt dependency
jest.mock('../services/securityService', () => ({
  hashPassword: jest.fn(() => 'hashed-password'),
  comparePassword: jest.fn(() => true)
}));

// Mock API key service
jest.mock('../services/apiKeyService', () => ({
  validateAPIKey: jest.fn((key) => {
    if (key && key.startsWith('sk_')) {
      return Promise.resolve({
        success: true,
        keyRecord: {
          id: 'test-key-123',
          userId: 'test-user-123',
          permissions: ['extract', 'test'],
          isActive: true
        }
      });
    }
    return Promise.resolve({ success: false, error: 'Invalid API key' });
  }),
  createAPIKey: jest.fn(() => Promise.resolve({
    success: true,
    apiKey: 'sk_test_' + Math.random().toString(36).substr(2, 9),
    keyId: 'test-key-123'
  })),
  getUserAPIKeys: jest.fn(() => Promise.resolve([])),
  revokeAPIKey: jest.fn(() => Promise.resolve({ success: true }))
}));

// Mock antivirus service
jest.mock('../services/antivirusService', () => ({
  scanFile: jest.fn(() => Promise.resolve({
    clean: true,
    threats: [],
    method: 'clamav',
    scanTime: Date.now()
  }))
}));

// Mock custom extraction service
jest.mock('../services/customExtractionService', () => {
  return jest.fn().mockImplementation(() => ({
    extractContacts: jest.fn(() => Promise.resolve({
      success: true,
      contacts: [
        {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '(555) 123-4567',
          role: 'Director',
          company: 'Test Productions',
          confidence: 0.9
        }
      ],
      metadata: {
        processingTime: 1000,
        documentType: 'call_sheet',
        productionType: 'film',
        totalContacts: 1,
        averageConfidence: 0.9,
        qualityScore: 85
      },
      usage: {
        documentsProcessed: 1,
        contactsExtracted: 1,
        processingTime: 1000
      }
    })),
    documentAnalyzer: {},
    patternExtractor: {},
    validator: {},
    productionIntelligence: {},
    confidenceScorer: {},
    ocrProcessor: {}
  }));
});
