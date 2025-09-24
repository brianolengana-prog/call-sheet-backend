/**
 * Phase 2 Simple Tests: AI-Enhanced Extraction
 * 
 * Basic tests for AI-powered features without server dependencies
 */

describe('Phase 2: AI-Enhanced Extraction (Simple)', () => {
  
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
      
      // Mock the extractContacts method to throw an error
      const originalExtractContacts = aiEnhancedExtractionService.extractContacts;
      aiEnhancedExtractionService.extractContacts = jest.fn().mockImplementation(async () => {
        throw new Error('AI service failure');
      });
      
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
