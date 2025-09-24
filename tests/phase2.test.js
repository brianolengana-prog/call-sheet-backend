/**
 * Phase 2 Tests: AI-Enhanced Extraction
 * 
 * Comprehensive tests for AI-powered document analysis, pattern extraction,
 * and production intelligence features
 */

const request = require('supertest');
const app = require('../server');
const fs = require('fs').promises;
const path = require('path');

// Mock external services
jest.mock('../services/authService');
jest.mock('../services/antivirusService');
jest.mock('../services/prismaService', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    apiKey: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    apiKeyUsage: {
      create: jest.fn(),
    },
  },
  connect: jest.fn(),
  disconnect: jest.fn(),
  healthCheck: jest.fn().mockResolvedValue({ status: 'OK' }),
}));

describe('Phase 2: AI-Enhanced Extraction', () => {
  let testUser;
  let jwtToken;
  let testAPIKey;

  beforeAll(async () => {
    // Setup a mock user for authentication
    testUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'user',
    };
    jwtToken = 'mock-jwt-token';

    // Mock auth service
    const authService = require('../services/authService');
    authService.verifyAccessToken.mockImplementation(async (token) => {
      if (token === jwtToken) {
        return { success: true, user: testUser };
      }
      return { success: false, error: 'Invalid token' };
    });

    // Mock API key service
    const apiKeyService = require('../services/apiKeyService');
    apiKeyService.validateAPIKey.mockImplementation(async (key) => {
      if (key === 'sk_test_api_key') {
        return {
          success: true,
          user: testUser,
          permissions: ['extract', 'test'],
          keyRecord: { id: 'test-key-id' }
        };
      }
      return { success: false, error: 'Invalid API key' };
    });

    // Mock antivirus service
    const antivirusService = require('../services/antivirusService');
    antivirusService.scanFile.mockResolvedValue({
      clean: true,
      threats: [],
      method: 'mock'
    });

    // Mock Prisma calls
    const prisma = require('../services/prismaService').prisma;
    prisma.user.findUnique.mockResolvedValue(testUser);
    prisma.apiKey.create.mockResolvedValue({
      id: 'test-api-key-id',
      userId: testUser.id,
      name: 'Test Key',
      hashedKey: 'hashed-test-api-key',
      permissions: ['extract', 'test'],
      isRevoked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.apiKey.findUnique.mockResolvedValue({
      id: 'test-api-key-id',
      userId: testUser.id,
      name: 'Test Key',
      hashedKey: 'hashed-test-api-key',
      permissions: ['extract', 'test'],
      isRevoked: false,
      expiresAt: null,
      user: testUser,
    });
    prisma.apiKey.findMany.mockResolvedValue([]);
    prisma.apiKey.update.mockResolvedValue({});
    prisma.apiKeyUsage.create.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AI-Enhanced Document Analysis', () => {
    test('should analyze document type with AI', async () => {
      const AIDocumentAnalyzer = require('../services/extraction/aiDocumentAnalyzer');
      const aiDocumentAnalyzer = new AIDocumentAnalyzer();
      
      const mockText = `
        CALL SHEET
        Day 1 - Monday, January 15, 2024
        Location: Studio A
        Call Time: 8:00 AM
        Wrap Time: 6:00 PM
        
        CREW:
        Director: John Smith
        Producer: Jane Doe
        Cinematographer: Bob Johnson
      `;
      
      const mockBuffer = Buffer.from(mockText);
      const result = await aiDocumentAnalyzer.analyzeDocument(mockBuffer, 'text/plain', 'call_sheet.txt');
      
      expect(result.type).toBe('call_sheet');
      expect(result.productionType).toBe('film');
      expect(result.hasContactSections).toBe(true);
      expect(result.estimatedContacts).toBeGreaterThan(0);
      expect(result.aiInsights).toBeDefined();
      expect(result.aiInsights.sentiment).toBeDefined();
      expect(result.aiInsights.complexity).toBeDefined();
      expect(result.aiInsights.keyTopics).toBeDefined();
    });

    test('should analyze production type with AI', async () => {
      const AIDocumentAnalyzer = require('../services/extraction/aiDocumentAnalyzer');
      const aiDocumentAnalyzer = new AIDocumentAnalyzer();
      
      const mockText = `
        TELEVISION PRODUCTION
        Episode 1 - Pilot
        Network: ABC
        Showrunner: Sarah Wilson
        Executive Producer: Mike Brown
      `;
      
      const mockBuffer = Buffer.from(mockText);
      const result = await aiDocumentAnalyzer.analyzeDocument(mockBuffer, 'text/plain', 'tv_script.txt');
      
      expect(result.productionType).toBe('television');
      expect(result.aiInsights.productionContext).toBeDefined();
    });
  });

  describe('AI-Enhanced Pattern Extraction', () => {
    test('should extract contacts with AI pattern recognition', async () => {
      const AIPatternExtractor = require('../services/extraction/aiPatternExtractor');
      const aiPatternExtractor = new AIPatternExtractor();
      
      const mockText = `
        CREW CONTACTS:
        Director: John Smith - john@example.com - (555) 123-4567
        Producer: Jane Doe - jane@example.com - (555) 987-6543
        Cinematographer: Bob Johnson - bob@example.com - (555) 456-7890
      `;
      
      const mockAnalysis = {
        type: 'call_sheet',
        productionType: 'film',
        hasTableStructure: false,
        hasContactSections: true,
        estimatedContacts: 3,
        confidence: 0.8
      };
      
      const contacts = await aiPatternExtractor.extractContacts(mockText, mockAnalysis);
      
      expect(contacts).toHaveLength(3);
      expect(contacts[0]).toMatchObject({
        name: expect.any(String),
        email: expect.any(String),
        phone: expect.any(String),
        role: expect.any(String),
        confidence: expect.any(Number)
      });
    });

    test('should handle complex document structures', async () => {
      const AIPatternExtractor = require('../services/extraction/aiPatternExtractor');
      const aiPatternExtractor = new AIPatternExtractor();
      
      const mockText = `
        PRODUCTION TEAM
        
        Above the Line:
        Director: Sarah Wilson - sarah@studio.com - (555) 111-2222
        Producer: Mike Brown - mike@studio.com - (555) 333-4444
        
        Camera Department:
        Cinematographer: Alex Chen - alex@camera.com - (555) 555-6666
        First AC: Lisa Park - lisa@camera.com - (555) 777-8888
        
        Sound Department:
        Sound Mixer: Tom Davis - tom@sound.com - (555) 999-0000
        Boom Operator: Emma Lee - emma@sound.com - (555) 111-3333
      `;
      
      const mockAnalysis = {
        type: 'contact_list',
        productionType: 'film',
        hasTableStructure: false,
        hasContactSections: true,
        estimatedContacts: 6,
        confidence: 0.9
      };
      
      const contacts = await aiPatternExtractor.extractContacts(mockText, mockAnalysis);
      
      expect(contacts.length).toBeGreaterThanOrEqual(6);
      
      // Check for specific roles
      const director = contacts.find(c => c.role && c.role.toLowerCase().includes('director'));
      const cinematographer = contacts.find(c => c.role && c.role.toLowerCase().includes('cinematographer'));
      
      expect(director).toBeDefined();
      expect(cinematographer).toBeDefined();
    });
  });

  describe('AI Production Intelligence', () => {
    test('should enhance contacts with production intelligence', async () => {
      const AIProductionIntelligence = require('../services/extraction/aiProductionIntelligence');
      const aiProductionIntelligence = new AIProductionIntelligence();
      
      const mockContacts = [
        {
          name: 'John Smith',
          email: 'john@example.com',
          phone: '(555) 123-4567',
          role: 'Director',
          confidence: 0.8
        },
        {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '(555) 987-6543',
          role: 'Producer',
          confidence: 0.9
        }
      ];
      
      const mockAnalysis = {
        type: 'call_sheet',
        productionType: 'film',
        hasTableStructure: false,
        hasContactSections: true,
        estimatedContacts: 2,
        confidence: 0.8
      };
      
      const enhancedContacts = await aiProductionIntelligence.processContacts(mockContacts, mockAnalysis);
      
      expect(enhancedContacts).toHaveLength(2);
      expect(enhancedContacts[0]).toMatchObject({
        name: 'John Smith',
        email: 'john@example.com',
        phone: '(555) 123-4567',
        role: 'Director',
        department: expect.any(String),
        hierarchy: expect.any(String),
        productionContext: expect.any(Object),
        industryMetadata: expect.any(Object)
      });
    });

    test('should identify missing key roles', async () => {
      const AIProductionIntelligence = require('../services/extraction/aiProductionIntelligence');
      const aiProductionIntelligence = new AIProductionIntelligence();
      
      const mockContacts = [
        {
          name: 'John Smith',
          email: 'john@example.com',
          role: 'Director',
          confidence: 0.8
        }
      ];
      
      const mockAnalysis = {
        type: 'call_sheet',
        productionType: 'film',
        hasTableStructure: false,
        hasContactSections: true,
        estimatedContacts: 1,
        confidence: 0.8
      };
      
      const enhancedContacts = await aiProductionIntelligence.processContacts(mockContacts, mockAnalysis);
      
      expect(enhancedContacts).toHaveLength(1);
      expect(enhancedContacts[0].productionContext).toBeDefined();
      expect(enhancedContacts[0].industryMetadata).toBeDefined();
    });
  });

  describe('AI-Enhanced Extraction Service', () => {
    test('should perform complete AI-enhanced extraction', async () => {
      const AIEnhancedExtractionService = require('../services/aiEnhancedExtractionService');
      const aiEnhancedExtractionService = new AIEnhancedExtractionService();
      
      const mockText = `
        CALL SHEET - DAY 1
        
        CREW CONTACTS:
        Director: John Smith - john@studio.com - (555) 123-4567
        Producer: Jane Doe - jane@studio.com - (555) 987-6543
        Cinematographer: Bob Johnson - bob@camera.com - (555) 456-7890
        Sound Mixer: Alice Brown - alice@sound.com - (555) 321-6543
      `;
      
      const mockBuffer = Buffer.from(mockText);
      
      const result = await aiEnhancedExtractionService.extractContacts(
        mockBuffer,
        'text/plain',
        'call_sheet.txt',
        {
          rolePreferences: ['Director', 'Producer'],
          options: {
            includeNotes: true,
            strictValidation: false,
            maxContacts: 100
          }
        }
      );
      
      expect(result.success).toBe(true);
      expect(result.contacts).toHaveLength(4);
      expect(result.metadata.extractionMethod).toBe('ai_enhanced');
      expect(result.metadata.aiInsights).toBeDefined();
      expect(result.metadata.documentAnalysis).toBeDefined();
      
      // Check AI insights
      expect(result.metadata.aiInsights.extractionQuality).toBeDefined();
      expect(result.metadata.aiInsights.documentComplexity).toBeDefined();
      expect(result.metadata.aiInsights.contactDistribution).toBeDefined();
      expect(result.metadata.aiInsights.productionInsights).toBeDefined();
      expect(result.metadata.aiInsights.recommendations).toBeDefined();
    });

    test('should handle extraction errors gracefully', async () => {
      const AIEnhancedExtractionService = require('../services/aiEnhancedExtractionService');
      const aiEnhancedExtractionService = new AIEnhancedExtractionService();
      
      const mockBuffer = Buffer.from(''); // Empty buffer
      
      const result = await aiEnhancedExtractionService.extractContacts(
        mockBuffer,
        'text/plain',
        'empty.txt',
        {}
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.contacts).toHaveLength(0);
    });
  });

  describe('AI-Enhanced API Routes', () => {
    test('should handle AI-enhanced upload with JWT authentication', async () => {
      // Create a mock file
      const mockFilePath = path.join(__dirname, 'mock-call-sheet.txt');
      const mockContent = `
        CALL SHEET - DAY 1
        
        CREW CONTACTS:
        Director: John Smith - john@studio.com - (555) 123-4567
        Producer: Jane Doe - jane@studio.com - (555) 987-6543
        Cinematographer: Bob Johnson - bob@camera.com - (555) 456-7890
      `;
      
      await fs.writeFile(mockFilePath, mockContent);
      
      const response = await request(app)
        .post('/api/custom-extraction/ai-upload')
        .set('Authorization', `Bearer ${jwtToken}`)
        .attach('file', mockFilePath)
        .field('rolePreferences', JSON.stringify(['Director', 'Producer']))
        .field('options', JSON.stringify({
          includeNotes: true,
          strictValidation: false,
          maxContacts: 100
        }));
      
      expect(response.statusCode).toEqual(200);
      expect(response.body.success).toBe(true);
      expect(response.body.contacts).toBeDefined();
      expect(response.body.metadata.extractionMethod).toBe('ai_enhanced');
      expect(response.body.metadata.aiInsights).toBeDefined();
      
      // Clean up
      await fs.unlink(mockFilePath);
    });

    test('should handle AI-enhanced upload with API key authentication', async () => {
      // Create a mock file
      const mockFilePath = path.join(__dirname, 'mock-contact-list.txt');
      const mockContent = `
        PRODUCTION CONTACTS
        
        Director: Sarah Wilson - sarah@studio.com - (555) 111-2222
        Producer: Mike Brown - mike@studio.com - (555) 333-4444
        Cinematographer: Alex Chen - alex@camera.com - (555) 555-6666
      `;
      
      await fs.writeFile(mockFilePath, mockContent);
      
      const response = await request(app)
        .post('/api/custom-extraction/ai-upload')
        .set('X-API-Key', 'sk_test_api_key')
        .attach('file', mockFilePath)
        .field('rolePreferences', JSON.stringify(['Director', 'Producer']));
      
      expect(response.statusCode).toEqual(200);
      expect(response.body.success).toBe(true);
      expect(response.body.contacts).toBeDefined();
      expect(response.body.metadata.extractionMethod).toBe('ai_enhanced');
      
      // Clean up
      await fs.unlink(mockFilePath);
    });

    test('should reject AI-enhanced upload with invalid file', async () => {
      const response = await request(app)
        .post('/api/custom-extraction/ai-upload')
        .set('Authorization', `Bearer ${jwtToken}`)
        .field('rolePreferences', JSON.stringify(['Director']));
      
      expect(response.statusCode).toEqual(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No file uploaded');
    });

    test('should validate AI-enhanced upload parameters', async () => {
      // Create a mock file
      const mockFilePath = path.join(__dirname, 'mock-file.txt');
      await fs.writeFile(mockFilePath, 'test content');
      
      const response = await request(app)
        .post('/api/custom-extraction/ai-upload')
        .set('Authorization', `Bearer ${jwtToken}`)
        .attach('file', mockFilePath)
        .field('options', JSON.stringify({ maxContacts: 'invalid' })); // Invalid option
      
      expect(response.statusCode).toEqual(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid request parameters');
      
      // Clean up
      await fs.unlink(mockFilePath);
    });
  });

  describe('AI-Enhanced Health Checks', () => {
    test('should return AI-enhanced health status', async () => {
      const response = await request(app)
        .get('/api/custom-extraction/health');
      
      expect(response.statusCode).toEqual(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.components).toBeDefined();
      expect(response.body.components.aiDocumentAnalyzer).toBe('operational');
      expect(response.body.components.aiPatternExtractor).toBe('operational');
      expect(response.body.components.aiProductionIntelligence).toBe('operational');
    });
  });

  describe('AI-Enhanced Performance Metrics', () => {
    test('should track AI-enhanced extraction metrics', async () => {
      const AIEnhancedExtractionService = require('../services/aiEnhancedExtractionService');
      const aiEnhancedExtractionService = new AIEnhancedExtractionService();
      
      // Reset metrics
      aiEnhancedExtractionService.resetMetrics();
      
      // Perform some extractions
      const mockBuffer = Buffer.from('Director: John Smith - john@example.com - (555) 123-4567');
      
      await aiEnhancedExtractionService.extractContacts(mockBuffer, 'text/plain', 'test.txt', {});
      await aiEnhancedExtractionService.extractContacts(mockBuffer, 'text/plain', 'test2.txt', {});
      
      const metrics = aiEnhancedExtractionService.getMetrics();
      
      expect(metrics.totalExtractions).toBe(2);
      expect(metrics.successfulExtractions).toBe(2);
      expect(metrics.successRate).toBe(1.0);
      expect(metrics.averageProcessingTime).toBeGreaterThan(0);
      expect(metrics.averageContactsPerDocument).toBeGreaterThan(0);
    });
  });

  describe('AI-Enhanced Error Handling', () => {
    test('should handle AI service failures gracefully', async () => {
      // Mock AI service to throw error
      const AIEnhancedExtractionService = require('../services/aiEnhancedExtractionService');
      const aiEnhancedExtractionService = new AIEnhancedExtractionService();
      const originalExtractContacts = aiEnhancedExtractionService.extractContacts;
      
      aiEnhancedExtractionService.extractContacts = jest.fn().mockRejectedValue(new Error('AI service failure'));
      
      const mockBuffer = Buffer.from('test content');
      
      const result = await aiEnhancedExtractionService.extractContacts(mockBuffer, 'text/plain', 'test.txt', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('AI service failure');
      expect(result.contacts).toHaveLength(0);
      
      // Restore original method
      aiEnhancedExtractionService.extractContacts = originalExtractContacts;
    });
  });
});
