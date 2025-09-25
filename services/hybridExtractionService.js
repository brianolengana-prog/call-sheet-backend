const CustomExtractionService = require('./customExtractionService');
const AIPreprocessingService = require('./aiPreprocessingService');
const PatternExtractor = require('./extraction/patternExtractor');
const ContactValidator = require('./extraction/contactValidator');

class HybridExtractionService {
  constructor() {
    // Use singleton instances to prevent memory leaks
    this.customExtractionService = require('./customExtractionService');
    this.aiPreprocessingService = require('./aiPreprocessingService');
    this.patternExtractor = require('./extraction/patternExtractor');
    this.contactValidator = require('./extraction/contactValidator');
  }

  async extractContacts(fileBuffer, mimeType, fileName) {
    console.log('🔄 Starting hybrid AI + Custom extraction...');
    
    try {
      // Step 1: Extract text using custom service
      const extractedText = await this.customExtractionService.extractTextFromDocument(fileBuffer, mimeType, fileName);
      console.log('📄 Text extracted, length:', extractedText.length);
      
      // Step 2: AI preprocessing to understand structure and normalize text
      const documentAnalysis = await this.customExtractionService.documentAnalyzer.analyzeDocument(fileBuffer, mimeType, fileName);
      const aiPreprocessing = await this.aiPreprocessingService.preprocessDocument(extractedText, documentAnalysis);
      
      console.log('🤖 AI preprocessing results:', {
        sections: aiPreprocessing.sections?.length || 0,
        totalContacts: aiPreprocessing.sections?.reduce((sum, section) => sum + (section.contacts?.length || 0), 0) || 0
      });
      
      // Step 3: Use AI preprocessed text for custom pattern extraction
      const normalizedText = aiPreprocessing.normalized_text || extractedText;
      console.log('📄 Using normalized text for pattern extraction, length:', normalizedText.length);
      
      // Step 4: Custom pattern extraction on AI-preprocessed text
      const patternContacts = await this.patternExtractor.extractContacts(normalizedText, documentAnalysis);
      console.log('🔍 Pattern extraction found:', patternContacts.length, 'contacts');
      
      // Step 5: Combine AI-extracted contacts with pattern-extracted contacts
      let allContacts = [...patternContacts];
      
      // Add AI-extracted contacts if they exist
      if (aiPreprocessing.sections) {
        for (const section of aiPreprocessing.sections) {
          if (section.contacts) {
            for (const aiContact of section.contacts) {
              // Convert AI contact to our format
              const contact = {
                name: aiContact.name || '',
                email: aiContact.email || '',
                phone: aiContact.phone || '',
                role: aiContact.role || '',
                company: aiContact.company || '',
                confidence: 0.8 // High confidence for AI-extracted contacts
              };
              
              if (contact.name && (contact.email || contact.phone)) {
                allContacts.push(contact);
              }
            }
          }
        }
      }
      
      console.log('🔄 Combined contacts:', allContacts.length);
      
      // Step 6: Validate all contacts
      const validatedContacts = [];
      for (const contact of allContacts) {
        const validation = await this.contactValidator.validateContact(contact);
        if (validation.isValid) {
          validatedContacts.push({
            ...contact,
            confidence: contact.confidence || validation.confidence
          });
        }
      }
      
      console.log('✅ Validated contacts:', validatedContacts.length);
      
      // Step 7: AI enhancement of final results
      const enhancedContacts = await this.aiPreprocessingService.enhanceExtractionResults(validatedContacts, documentAnalysis);
      
      // Step 8: Deduplication
      const deduplicatedContacts = this.deduplicateContacts(enhancedContacts);
      console.log('🔄 Deduplication complete:', deduplicatedContacts.length);
      
      return {
        contacts: deduplicatedContacts,
        metadata: {
          extractionMethod: 'hybrid',
          aiPreprocessing: {
            sections: aiPreprocessing.sections?.length || 0,
            totalAIContacts: aiPreprocessing.sections?.reduce((sum, section) => sum + (section.contacts?.length || 0), 0) || 0
          },
          patternExtraction: {
            contactsFound: patternContacts.length
          },
          finalResults: {
            totalContacts: deduplicatedContacts.length,
            aiEnhanced: true
          }
        }
      };
      
    } catch (error) {
      console.error('❌ Hybrid extraction failed:', error);
      throw error;
    }
  }
  
  deduplicateContacts(contacts) {
    const seen = new Set();
    const deduplicated = [];
    
    for (const contact of contacts) {
      const key = `${contact.email || ''}-${contact.name || ''}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(contact);
      }
    }
    
    return deduplicated;
  }
}

module.exports = HybridExtractionService;
