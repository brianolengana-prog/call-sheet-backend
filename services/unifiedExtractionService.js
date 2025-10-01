/**
 * Unified Extraction Service
 * 
 * Single, robust extraction service that leverages OpenAI throughout the pipeline
 * while maintaining proven custom extraction patterns as fallbacks.
 */

const fs = require('fs');
const path = require('path');

// Import core modules
const DocumentAnalyzer = require('./extraction/documentAnalyzer');
const ContactValidator = require('./extraction/contactValidator');
const ConfidenceScorer = require('./extraction/confidenceScorer');
const OCRProcessor = require('./extraction/ocrProcessor');
const PatternExtractor = require('./extraction/patternExtractor');

// Import production intelligence with fallback
let ProductionIntelligence;
try {
  ProductionIntelligence = require('./extraction/productionIntelligence');
} catch (error) {
  console.warn('⚠️ ProductionIntelligence not available, using fallback');
  ProductionIntelligence = class {
    async processContacts(contacts) { return contacts; }
  };
}

// Import deduplicator with fallback
let Deduplicator;
try {
  Deduplicator = require('./extraction/deduplicator');
} catch (error) {
  console.warn('⚠️ Deduplicator not available, using fallback');
  Deduplicator = class {
    removeDuplicates(contacts) { return contacts; }
  };
}

class UnifiedExtractionService {
  constructor() {
    // Initialize core modules
    this.documentAnalyzer = new DocumentAnalyzer();
    this.validator = new ContactValidator();
    this.confidenceScorer = new ConfidenceScorer();
    this.ocrProcessor = new OCRProcessor();
    this.patternExtractor = new PatternExtractor();
    this.productionIntelligence = new ProductionIntelligence();
    this.deduplicator = new Deduplicator();
    
    // Initialize adaptive extractor
    const AdaptiveExtractor = require('./extraction/adaptiveExtractor');
    this.adaptiveExtractor = new AdaptiveExtractor();
    
    // Load extraction configuration
    try {
      this.extractionConfig = require('../config/extraction.config');
    } catch (error) {
      console.warn('⚠️ Extraction config not found, using defaults');
      this.extractionConfig = {
        useAdaptiveExtractor: true,
        useMultiPass: false,
        confidenceThreshold: 0.3,
        fallbackToAI: true
      };
    }
    
    // Initialize OpenAI with error handling
    this.initializeOpenAI();
    
    // Performance tracking
    this.stats = {
      totalExtractions: 0,
      successfulExtractions: 0,
      aiEnhancedExtractions: 0,
      fallbackExtractions: 0,
      adaptiveExtractions: 0
    };
  }

  initializeOpenAI() {
    try {
      const { OpenAI } = require('openai');
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      this.aiAvailable = true;
      console.log('✅ Unified Extraction Service: OpenAI initialized');
    } catch (error) {
      console.warn('⚠️ Unified Extraction Service: OpenAI not available, using fallback mode');
      this.openai = null;
      this.aiAvailable = false;
    }
  }

  /**
   * AI-First Extraction with Custom Fallbacks for AI Limitations
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    const startTime = Date.now();
    console.log('🚀 Starting AI-first extraction...');
    console.log('📁 File:', fileName, 'Type:', mimeType, 'Size:', fileBuffer.length);

    try {
      this.stats.totalExtractions++;

      // Step 1: AI Document Analysis (with custom fallback)
      const documentAnalysis = await this.analyzeDocumentWithAI(fileBuffer, mimeType, fileName);
      console.log('🧠 AI document analysis:', documentAnalysis);

      // Step 2: AI Text Preprocessing (with custom fallback)
      const preprocessedText = await this.preprocessTextWithAI(fileBuffer, mimeType, fileName, documentAnalysis);
      console.log('📄 AI preprocessed text, length:', preprocessedText.length);

      if (!preprocessedText || preprocessedText.trim().length < 10) {
        throw new Error('Could not extract meaningful text from document');
      }

      // Step 3: AI Pattern Recognition (with custom fallback)
      const aiContacts = await this.extractContactsWithAIPatterns(preprocessedText, documentAnalysis, options);
      console.log('🤖 AI pattern extraction found:', aiContacts.length, 'contacts');

      // Step 4: AI Production Intelligence (with custom fallback)
      const productionEnhancedContacts = await this.enhanceWithProductionAI(aiContacts, preprocessedText, documentAnalysis);
      console.log('🎬 AI production enhancement:', productionEnhancedContacts.length, 'contacts');

      // Step 5: AI Quality Assurance (with custom fallback)
      const aiValidatedContacts = await this.validateContactsWithAI(productionEnhancedContacts, preprocessedText, documentAnalysis);
      console.log('✅ AI validation complete:', aiValidatedContacts.length, 'contacts');

      // Step 6: Custom Fallback for AI Limitations
      const finalContacts = await this.handleAILimitations(aiValidatedContacts, preprocessedText, documentAnalysis);
      console.log('🔄 Final contacts after handling AI limitations:', finalContacts.length, 'contacts');

      this.stats.successfulExtractions++;
      if (this.aiAvailable) this.stats.aiEnhancedExtractions++;

      const processingTime = Date.now() - startTime;
      console.log(`✅ AI-first extraction completed in ${processingTime}ms`);

      return {
        success: true,
        contacts: finalContacts,
        metadata: {
          extractionMethod: 'ai-first',
          processingTime,
          documentAnalysis,
          aiEnhanced: this.aiAvailable,
          contactsFound: finalContacts.length,
          confidence: this.calculateOverallConfidence(finalContacts),
          aiLimitationsHandled: true
        }
      };

    } catch (error) {
      console.error('❌ AI-first extraction failed:', error);
      this.stats.fallbackExtractions++;
      
      // Fallback to custom extraction
      return await this.fallbackExtraction(fileBuffer, mimeType, fileName, options);
    }
  }

  /**
   * AI Document Analysis (with custom fallback)
   */
  async analyzeDocumentWithAI(fileBuffer, mimeType, fileName) {
    // Custom fallback
    const customAnalysis = await this.documentAnalyzer.analyzeDocument(fileBuffer, mimeType, fileName);
    
    if (!this.aiAvailable) {
      return customAnalysis;
    }

    try {
      const extractedText = await this.extractTextFromDocument(fileBuffer, mimeType, fileName);
      
      const prompt = `You are a document analysis expert. Analyze this call sheet document:

${extractedText}

Provide detailed analysis in JSON format:
{
  "type": "call_sheet|contact_list|other",
  "structure": "tabular|unstructured|mixed",
  "complexity": "low|medium|high",
  "estimatedContacts": number,
  "sections": ["CREW", "TALENT", "CLIENTS", etc.],
  "productionType": "film|commercial|tv|other",
  "confidence": 0.0-1.0,
  "aiInsights": {
    "contactDensity": number,
    "documentStructure": "description",
    "keyPatterns": ["pattern1", "pattern2"],
    "extractionChallenges": ["challenge1", "challenge2"]
  }
}`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.1
      });

      const aiAnalysis = JSON.parse(response.choices[0].message.content);
      console.log('🧠 AI document analysis complete');
      
      // Merge AI insights with custom analysis
      return { ...customAnalysis, ...aiAnalysis };
    } catch (error) {
      console.warn('⚠️ AI document analysis failed, using custom analysis:', error.message);
      return customAnalysis;
    }
  }

  /**
   * AI Text Preprocessing (with custom fallback)
   */
  async preprocessTextWithAI(fileBuffer, mimeType, fileName, documentAnalysis) {
    // Custom text extraction
    const baseText = await this.extractTextFromDocument(fileBuffer, mimeType, fileName);
    
    if (!this.aiAvailable) {
      return baseText;
    }

    try {
      const prompt = `Clean and structure this call sheet text for contact extraction:

${baseText}

Return only the cleaned text:`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4000,
        temperature: 0.1
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.warn('⚠️ AI text preprocessing failed, using original text:', error.message);
      return baseText;
    }
  }

  /**
   * AI Pattern Recognition (with custom fallback)
   */
  async extractContactsWithAIPatterns(text, documentAnalysis, options) {
    // Custom pattern extraction as fallback
    const customContacts = await this.extractContactsWithPatterns(text, documentAnalysis);
    console.log('🔍 Custom pattern extraction found:', customContacts.length, 'contacts');

    if (!this.aiAvailable) {
      return customContacts;
    }

    try {
      // Smart text chunking to avoid token limits
      const textChunks = this.chunkTextForAI(text, 3000);
      let allAIContacts = [];
      
      for (let i = 0; i < textChunks.length; i++) {
        const chunk = textChunks[i];
        console.log(`🤖 Processing AI chunk ${i + 1}/${textChunks.length} (${chunk.length} chars)`);
        
        const prompt = `Extract contacts from this call sheet chunk:

${chunk}

Return JSON array of contacts with: name, email, phone, role, company, confidence`;

        const response = await this.openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "You are an expert at extracting contacts from call sheets. Always return valid JSON array of contacts with these fields: name, email, phone, role, company, confidence."
            },
            { role: "user", content: prompt }
          ],
          max_tokens: 6000,  // Increased to handle larger call sheets
          temperature: 0.1
        });

        const chunkContacts = JSON.parse(response.choices[0].message.content);
        allAIContacts = allAIContacts.concat(chunkContacts);
      }

      console.log('🤖 AI pattern extraction found:', allAIContacts.length, 'contacts');
      
      // Merge AI and custom results, removing duplicates
      const mergedContacts = this.mergeContacts(customContacts, allAIContacts);
      console.log('🔄 Merged contacts:', mergedContacts.length, 'contacts');
      
      return mergedContacts;
    } catch (error) {
      console.warn('⚠️ AI pattern extraction failed, using custom results:', error.message);
      return customContacts;
    }
  }

  /**
   * AI Production Intelligence (with custom fallback)
   */
  async enhanceWithProductionAI(contacts, text, documentAnalysis) {
    // Custom production intelligence as fallback
    const customEnhanced = await this.productionIntelligence.processContacts(contacts, documentAnalysis, {});
    console.log('🎬 Custom production enhancement:', customEnhanced.length, 'contacts');

    if (!this.aiAvailable) {
      return customEnhanced;
    }

    try {
      const prompt = `You are a production intelligence expert. Enhance these extracted contacts with production context:

Contacts:
${JSON.stringify(contacts, null, 2)}

Document Context:
${text}

Document Analysis:
${JSON.stringify(documentAnalysis, null, 2)}

Enhance each contact by:
1. Improving role assignments based on production context
2. Inferring missing company information
3. Adding production-specific insights
4. Standardizing contact formats
5. Adding confidence scores

Return enhanced contacts in the same JSON format:`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert at enhancing production contacts. Always return valid JSON array of contacts."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 3000,
        temperature: 0.1
      });

      const aiEnhanced = JSON.parse(response.choices[0].message.content);
      console.log('🎬 AI production enhancement complete:', aiEnhanced.length, 'contacts');
      
      return aiEnhanced;
    } catch (error) {
      console.warn('⚠️ AI production enhancement failed, using custom results:', error.message);
      return customEnhanced;
    }
  }

  /**
   * Enhanced Pattern-based extraction (PRIMARY METHOD)
   * Now using Adaptive Extractor for robust, format-agnostic extraction
   */
  async extractContactsWithPatterns(text, documentAnalysis) {
    // Check if adaptive extractor is enabled
    if (this.extractionConfig.useAdaptiveExtractor) {
      console.log('🎯 Using Adaptive Extractor...');
      this.stats.adaptiveExtractions++;
      
      try {
        const result = await this.adaptiveExtractor.extract(text, documentAnalysis, {
          useMultiPass: this.extractionConfig.useMultiPass,
          confidenceThreshold: this.extractionConfig.confidenceThreshold
        });
        
        console.log('✅ Adaptive extraction:', result.contacts.length, 'contacts');
        console.log('📊 Structure:', result.metadata.structure.type);
        console.log('📈 Avg confidence:', result.metadata.avgConfidence);
        
        return result.contacts;
        
      } catch (error) {
        console.error('❌ Adaptive extraction failed:', error.message);
        console.log('🔄 Falling back to legacy pattern extraction...');
        // Fall through to legacy extraction
      }
    }
    
    // Legacy pattern extraction (fallback)
    return await this.legacyPatternExtraction(text, documentAnalysis);
  }

  /**
   * Legacy Pattern Extraction (kept as fallback)
   */
  async legacyPatternExtraction(text, documentAnalysis) {
    const contacts = [];
    const lines = text.split('\n');
    
    // Enhanced pattern matching for call sheets
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const phonePattern = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
    
    console.log('🔍 Processing', lines.length, 'lines for legacy pattern extraction');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip empty lines and headers
      if (!line.trim() || this.isHeaderLine(line)) continue;
      
      // Extract emails (primary method)
      const emailMatches = [...line.matchAll(emailPattern)];
      for (const emailMatch of emailMatches) {
        const contact = this.buildContactFromLine(line, i, lines, documentAnalysis);
        if (contact && this.isValidContact(contact)) {
          contacts.push(contact);
        }
      }
      
      // Also look for phone numbers without emails (secondary)
      if (emailMatches.length === 0) {
        const phoneMatches = [...line.matchAll(phonePattern)];
        for (const phoneMatch of phoneMatches) {
          const contact = this.buildContactFromPhoneLine(line, i, lines, documentAnalysis);
          if (contact && this.isValidContact(contact)) {
            contacts.push(contact);
          }
        }
      }
    }
    
    console.log('🔍 Legacy pattern extraction found:', contacts.length, 'contacts');
    return contacts;
  }

  /**
   * Check if line is a header (skip these)
   */
  isHeaderLine(line) {
    const headers = ['name', 'contact', 'email', 'phone', 'role', 'company', 'crew', 'talent'];
    const lineLower = line.toLowerCase();
    return headers.some(header => lineLower.includes(header));
  }

  /**
   * Check if contact is valid
   */
  isValidContact(contact) {
    return contact && 
           contact.name && 
           contact.name.trim().length > 0 && 
           (contact.email || contact.phone);
  }

  /**
   * AI Quality Assurance (with custom fallback)
   */
  async validateContactsWithAI(contacts, text, documentAnalysis) {
    // Custom validation as fallback
    const customValidated = await this.validator.validateContacts(contacts);
    console.log('✅ Custom validation complete:', customValidated.length, 'contacts');

    if (!this.aiAvailable) {
      return customValidated;
    }

    try {
      const prompt = `You are a contact validation expert. Validate and score these extracted contacts:

Contacts:
${JSON.stringify(contacts, null, 2)}

Document Context:
${text}

Document Analysis:
${JSON.stringify(documentAnalysis, null, 2)}

For each contact, validate:
1. Name accuracy and completeness
2. Email format and validity
3. Phone number format and validity
4. Role accuracy based on context
5. Company inference accuracy
6. Overall confidence score (0.0-1.0)

Return validated contacts with improved confidence scores and any corrections needed:`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert at validating contact information. Always return valid JSON array of contacts."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 3000,
        temperature: 0.1
      });

      const aiValidated = JSON.parse(response.choices[0].message.content);
      console.log('✅ AI validation complete:', aiValidated.length, 'contacts');
      
      return aiValidated;
    } catch (error) {
      console.warn('⚠️ AI validation failed, using custom results:', error.message);
      return customValidated;
    }
  }

  /**
   * Handle AI Limitations with Custom Implementation
   */
  async handleAILimitations(aiContacts, text, documentAnalysis) {
    console.log('🔄 Handling AI limitations with custom implementation...');
    
    // AI Limitations we need to address:
    // 1. Token limits - AI might miss contacts in large documents
    // 2. Context limits - AI might not see full document structure
    // 3. Pattern recognition - AI might miss complex patterns
    // 4. Validation accuracy - AI might be too lenient or strict
    
    try {
      // Custom pattern extraction to catch missed contacts
      const customContacts = await this.extractContactsWithPatterns(text, documentAnalysis);
      console.log('🔍 Custom fallback found:', customContacts.length, 'contacts');
      
      // Custom validation for stricter quality control
      const customValidated = await this.validator.validateContacts(customContacts);
      console.log('✅ Custom validation found:', customValidated.length, 'contacts');
      
      // Merge AI and custom results, prioritizing quality
      const mergedContacts = this.mergeContactsWithQuality(aiContacts, customValidated);
      console.log('🔄 Quality-merged contacts:', mergedContacts.length, 'contacts');
      
      // Custom deduplication with stricter rules
      const finalContacts = await this.deduplicator.removeDuplicates(mergedContacts);
      console.log('🔄 Final deduplicated contacts:', finalContacts.length, 'contacts');
      
      return finalContacts;
    } catch (error) {
      console.warn('⚠️ Custom fallback failed, using AI results:', error.message);
      return aiContacts;
    }
  }

  /**
   * AI Contact Enhancement (legacy method)
   */
  async enhanceContactsWithAI(contacts, documentAnalysis) {
    if (!this.aiAvailable || contacts.length === 0) {
      return contacts;
    }

    try {
      const prompt = `You are a contact enhancement expert. Improve these extracted contacts:

${JSON.stringify(contacts, null, 2)}

Please:
1. Improve role assignments based on context
2. Infer missing company information
3. Clean and standardize data
4. Add confidence scores

Return the enhanced contacts in the same JSON format.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert at enhancing contact information. Always return valid JSON."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 3000,
        temperature: 0.1
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.warn('⚠️ AI enhancement failed, using original contacts:', error.message);
      return contacts;
    }
  }

  /**
   * Merge and deduplicate contacts from different sources
   */
  mergeAndDeduplicateContacts(aiContacts, patternContacts) {
    const merged = [...aiContacts];
    const seenEmails = new Set(aiContacts.map(c => c.email?.toLowerCase()).filter(Boolean));
    const seenPhones = new Set(aiContacts.map(c => c.phone).filter(Boolean));

    for (const contact of patternContacts) {
      const email = contact.email?.toLowerCase();
      const phone = contact.phone;

      if ((email && seenEmails.has(email)) || (phone && seenPhones.has(phone))) {
        continue; // Duplicate
      }

      merged.push(contact);
      if (email) seenEmails.add(email);
      if (phone) seenPhones.add(phone);
    }

    return merged;
  }

  /**
   * Build contact from line context (email-based)
   */
  buildContactFromLine(line, lineIndex, allLines, documentAnalysis) {
    const emailMatch = line.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (!emailMatch) return null;

    const email = emailMatch[0];
    const name = this.extractNameFromLine(line);
    const phone = this.extractPhoneFromLine(line);
    const role = this.inferRoleFromContext(line, allLines, documentAnalysis);
    const company = this.inferCompanyFromContext(line, allLines, documentAnalysis);

    return {
      name: name || 'Unknown',
      email,
      phone: phone || '',
      role: role || 'Unknown',
      company: company || ''
    };
  }

  /**
   * Build contact from phone-only line
   */
  buildContactFromPhoneLine(line, lineIndex, allLines, documentAnalysis) {
    const phoneMatch = line.match(/(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/);
    if (!phoneMatch) return null;

    const phone = phoneMatch[0];
    const name = this.extractNameFromLine(line);
    const role = this.inferRoleFromContext(line, allLines, documentAnalysis);
    const company = this.inferCompanyFromContext(line, allLines, documentAnalysis);

    return {
      name: name || 'Unknown',
      email: '',
      phone: phone,
      role: role || 'Unknown',
      company: company || ''
    };
  }

  extractNameFromLine(line) {
    // Handle different call sheet formats:
    // 1. "Role: Name / Phone" (e.g., "Photographer: Coni Tarallo / 929.250.6798")
    // 2. "Name <email>" or "Name email@domain.com"
    // 3. "Name / Phone"
    
    // Pattern 1: Role: Name / Phone
    const rolePattern = /^([^:]+):\s*([^\/]+)\s*\//;
    const roleMatch = line.match(rolePattern);
    if (roleMatch) {
      return roleMatch[2].trim();
    }
    
    // Pattern 2: Look for name before email
    if (line.includes('@')) {
      const beforeEmail = line.split('@')[0];
      const words = beforeEmail.trim().split(/\s+/);
      const nameWords = words.filter(word => 
        word.length > 1 && 
        /^[A-Z]/.test(word) && 
        !/^[A-Z]{2,}$/.test(word) // Not all caps
      );
      return nameWords.slice(0, 2).join(' ');
    }
    
    // Pattern 3: Look for name before phone number or slash
    const beforePhoneOrSlash = line.split(/[\/\(0-9]/)[0];
    const words = beforePhoneOrSlash.trim().split(/\s+/);
    const nameWords = words.filter(word => 
      word.length > 1 && 
      /^[A-Z]/.test(word) && 
      !/^[A-Z]{2,}$/.test(word) && // Not all caps
      !word.includes(':') // Not a role prefix
    );
    
    // Return first 2-3 words as name
    return nameWords.slice(0, 3).join(' ');
  }

  extractPhoneFromLine(line) {
    const phoneMatch = line.match(/(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/);
    return phoneMatch ? phoneMatch[0] : '';
  }

  inferRoleFromContext(line, allLines, documentAnalysis) {
    const lineLower = line.toLowerCase();
    
    // Pattern 1: Extract role from "Role:" prefix (e.g., "Photographer: Name / Phone")
    const rolePattern = /^([^:]+):/;
    const roleMatch = line.match(rolePattern);
    if (roleMatch) {
      const role = roleMatch[1].trim();
      // Clean up common role formats
      return role
        .replace(/^(1st|2nd|3rd)\s+/i, '') // Remove ordinal prefixes for consistency
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // Pattern 2: Common role keywords
    if (lineLower.includes('photographer')) return 'Photographer';
    if (lineLower.includes('director')) return 'Director';
    if (lineLower.includes('producer')) return 'Producer';
    if (lineLower.includes('assistant')) return 'Production Assistant';
    if (lineLower.includes('digitech')) return 'Digital Technician';
    if (lineLower.includes('videographer')) return 'Videographer';
    if (lineLower.includes('model')) return 'Model';
    if (lineLower.includes('casting')) return 'Casting Director';
    if (lineLower.includes('camera')) return 'Camera';
    if (lineLower.includes('sound')) return 'Sound';
    if (lineLower.includes('grip')) return 'Grip';
    if (lineLower.includes('electric')) return 'Electric';
    if (lineLower.includes('mua') || lineLower.includes('makeup')) return 'Makeup Artist';
    if (lineLower.includes('hua') || lineLower.includes('hair')) return 'Hair Artist';
    if (lineLower.includes('hmua')) return 'Hair & Makeup Artist';
    if (lineLower.includes('stylist')) return 'Stylist';
    if (lineLower.includes('wardrobe')) return 'Wardrobe';
    if (lineLower.includes('driver')) return 'Driver';
    
    return 'Crew';
  }

  inferCompanyFromContext(line, allLines, documentAnalysis) {
    // Pattern 1: Model agency format: "Model: NAME / Agency Agent / Phone"
    // Example: "Model: BIANCA FELICIANO / Ford Brett Pougnet / 917.783.8966"
    if (line.toLowerCase().includes('model')) {
      const parts = line.split('/');
      if (parts.length >= 3) {
        // The middle part is usually "Agency AgentName"
        const agencyPart = parts[1].trim();
        // Extract agency name (first word or two before agent name)
        const agencyMatch = agencyPart.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+[-\s]?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/);
        if (agencyMatch) {
          return `${agencyMatch[1]} (Agent: ${agencyMatch[2]})`;
        }
        return agencyPart;
      }
    }
    
    // Pattern 2: Email domain as company
    const emailMatch = line.match(/@([a-zA-Z0-9.-]+)\./);
    if (emailMatch) {
      return emailMatch[1];
    }
    
    // Pattern 3: All caps company name (e.g., "ACME STUDIOS")
    const allCapsMatch = line.match(/\b([A-Z]{2,}(?:\s+[A-Z]{2,})*)\b/);
    if (allCapsMatch && allCapsMatch[1].length > 2) {
      return allCapsMatch[1];
    }
    
    // Pattern 4: Capitalized company name
    const capitalizedMatch = line.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/);
    if (capitalizedMatch) {
      return capitalizedMatch[1];
    }
    
    return '';
  }

  /**
   * Fallback extraction when AI fails
   */
  async fallbackExtraction(fileBuffer, mimeType, fileName, options) {
    console.log('🔄 Using fallback extraction...');
    
    try {
      const documentAnalysis = await this.documentAnalyzer.analyzeDocument(fileBuffer, mimeType, fileName);
      const extractedText = await this.extractTextFromDocument(fileBuffer, mimeType, fileName);
      const contacts = await this.extractContactsWithPatterns(extractedText, documentAnalysis);
      const validatedContacts = await this.validator.validateContacts(contacts);
      
      return {
        success: true,
        contacts: validatedContacts,
        metadata: {
          extractionMethod: 'fallback',
          contactsFound: validatedContacts.length,
          aiEnhanced: false
        }
      };
    } catch (error) {
      console.error('❌ Fallback extraction failed:', error);
      throw error;
    }
  }

  /**
   * Calculate overall confidence score
   */
  calculateOverallConfidence(contacts) {
    if (contacts.length === 0) return 0;
    
    const totalConfidence = contacts.reduce((sum, contact) => 
      sum + (contact.confidence || 0.5), 0
    );
    
    return totalConfidence / contacts.length;
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      aiAvailable: this.aiAvailable,
      adaptiveExtractorEnabled: this.extractionConfig.useAdaptiveExtractor,
      multiPassEnabled: this.extractionConfig.useMultiPass,
      successRate: this.stats.totalExtractions > 0 
        ? (this.stats.successfulExtractions / this.stats.totalExtractions) * 100 
        : 0,
      adaptiveUsageRate: this.stats.totalExtractions > 0
        ? (this.stats.adaptiveExtractions / this.stats.totalExtractions) * 100
        : 0,
      adaptiveExtractorStats: this.adaptiveExtractor ? {
        totalExtractions: this.adaptiveExtractor.metrics?.totalExtractions || 0
      } : null
    };
  }

  // Delegate to the hardened CustomExtractionService
  async extractTextFromDocument(fileBuffer, mimeType, fileName) {
    const CustomExtractionService = require('./customExtractionService');
    const service = new CustomExtractionService();
    return await service.extractTextFromDocument(fileBuffer, mimeType, fileName);
  }

  /**
   * Merge contacts from AI and custom extraction
   */
  mergeContacts(customContacts, aiContacts) {
    const merged = [...customContacts];
    const seen = new Set(customContacts.map(c => this.getContactKey(c)).filter(Boolean));

    for (const aiContact of aiContacts) {
      const key = this.getContactKey(aiContact);
      if (key && !seen.has(key)) {
        merged.push(aiContact);
        seen.add(key);
      }
    }

    return merged;
  }

  /**
   * Merge contacts with quality prioritization
   */
  mergeContactsWithQuality(aiContacts, customContacts) {
    const merged = [...aiContacts];
    const seen = new Set(aiContacts.map(c => this.getContactKey(c)).filter(Boolean));

    for (const customContact of customContacts) {
      const key = this.getContactKey(customContact);
      if (key && !seen.has(key)) {
        // Prioritize custom contacts with higher confidence
        if (customContact.confidence > 0.8) {
          merged.push(customContact);
          seen.add(key);
        }
      }
    }

    return merged;
  }

  /**
   * Get unique key for contact deduplication
   */
  getContactKey(contact) {
    const email = contact.email?.toLowerCase() || '';
    const phone = contact.phone || '';
    const name = contact.name?.toLowerCase() || '';
    
    // Use email as primary key, phone as secondary, name as tertiary
    if (email) return `email:${email}`;
    if (phone) return `phone:${phone}`;
    if (name) return `name:${name}`;
    return null;
  }

  /**
   * Smart text chunking for AI processing
   */
  chunkTextForAI(text, maxChunkSize) {
    const chunks = [];
    const lines = text.split('\n');
    let currentChunk = '';
    
    for (const line of lines) {
      // If adding this line would exceed the limit, save current chunk
      if (currentChunk.length + line.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    
    // Add the last chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    console.log(`📄 Text chunked into ${chunks.length} pieces for AI processing`);
    return chunks;
  }
}

module.exports = UnifiedExtractionService;
