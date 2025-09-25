/**
 * Smart Extraction Router
 * 
 * Intelligently routes between custom and AI extraction based on document analysis
 * Handles diverse call sheet structures with optimal performance
 */

const CustomExtractionService = require('./customExtractionService');
const AIEnhancedExtractionService = require('./aiEnhancedExtractionService');
const OptimizedAIExtractionService = require('./optimizedAIExtractionService');

class SmartExtractionRouter {
  constructor() {
    this.customService = new CustomExtractionService();
    this.aiService = new AIEnhancedExtractionService();
    this.optimizedService = new OptimizedAIExtractionService();
    
    // Document structure patterns for routing decisions
    this.documentPatterns = this.initializeDocumentPatterns();
    
    // Performance metrics
    this.metrics = {
      customExtractions: 0,
      aiExtractions: 0,
      hybridExtractions: 0,
      averageAccuracy: 0,
      averageProcessingTime: 0
    };
  }

  /**
   * Initialize document structure patterns for routing decisions
   */
  initializeDocumentPatterns() {
    return {
      // Call sheet patterns that work well with custom extraction
      customFriendly: {
        indicators: [
          'TALENT NAME', 'CONTACT', 'CELL', 'TRANSPORTATION', 'CALL', 'LOCATION',
          'NAME CONTACT', 'VIDEO NAME', 'GLAM NAME', 'SET DESIGN NAME', 'WARDROBE NAME',
          'HEARST NAME', 'AMAZON NAME', 'OMNICOM NAME'
        ],
        confidence: 0.8,
        preferredMethod: 'custom'
      },
      
      // Complex document patterns that benefit from AI
      aiFriendly: {
        indicators: [
          'crew list', 'contact information', 'production team', 'cast and crew',
          'personnel directory', 'staff directory', 'team members'
        ],
        confidence: 0.7,
        preferredMethod: 'ai'
      },
      
      // Spreadsheet/table patterns
      tabular: {
        indicators: [
          'excel', 'spreadsheet', 'csv', 'table', 'grid', 'columns', 'rows'
        ],
        confidence: 0.9,
        preferredMethod: 'custom'
      },
      
      // Unstructured text patterns
      unstructured: {
        indicators: [
          'paragraph', 'narrative', 'description', 'notes', 'comments'
        ],
        confidence: 0.6,
        preferredMethod: 'ai'
      }
    };
  }

  /**
   * Main extraction method with smart routing
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    const startTime = Date.now();
    console.log('🧠 Starting smart extraction routing...');
    
    try {
      // Step 1: Analyze document structure
      const documentAnalysis = await this.analyzeDocumentStructure(fileBuffer, mimeType, fileName);
      console.log('📊 Document analysis:', documentAnalysis);
      
      // Step 2: Determine optimal extraction strategy
      const strategy = this.determineExtractionStrategy(documentAnalysis, options);
      console.log('🎯 Extraction strategy:', strategy);
      
      // Step 3: Execute extraction with chosen strategy
      const result = await this.executeExtraction(fileBuffer, mimeType, fileName, options, strategy);
      
      // Step 4: Post-process and enhance results
      const enhancedResult = await this.enhanceResults(result, documentAnalysis, strategy);
      
      const processingTime = Date.now() - startTime;
      this.updateMetrics(strategy.method, processingTime, enhancedResult.contacts.length);
      
      console.log(`✅ Smart extraction completed in ${processingTime}ms using ${strategy.method}`);
      
      return {
        ...enhancedResult,
        metadata: {
          ...enhancedResult.metadata,
          extractionMethod: strategy.method,
          routingStrategy: strategy.reason,
          processingTime,
          documentAnalysis
        }
      };
      
    } catch (error) {
      console.error('❌ Smart extraction failed:', error);
      throw error;
    }
  }

  /**
   * Analyze document structure to determine optimal extraction method
   */
  async analyzeDocumentStructure(fileBuffer, mimeType, fileName) {
    // Extract text for analysis
    const text = await this.extractTextForAnalysis(fileBuffer, mimeType);
    
    const analysis = {
      type: 'unknown',
      structure: 'unknown',
      complexity: 'medium',
      confidence: 0.5,
      patterns: [],
      estimatedContacts: 0,
      hasTableStructure: false,
      hasContactSections: false,
      productionType: 'unknown'
    };
    
    // Analyze document type
    if (mimeType === 'application/pdf' || fileName.toLowerCase().includes('.pdf')) {
      analysis.type = 'pdf';
    } else if (mimeType.includes('spreadsheet') || fileName.toLowerCase().includes('.xlsx')) {
      analysis.type = 'spreadsheet';
      analysis.structure = 'tabular';
      analysis.hasTableStructure = true;
    } else if (mimeType.includes('word') || fileName.toLowerCase().includes('.docx')) {
      analysis.type = 'document';
    }
    
    // Enhanced call sheet detection
    if (text.toLowerCase().includes('call sheet') || 
        text.toLowerCase().includes('production') ||
        text.toLowerCase().includes('talent') ||
        text.toLowerCase().includes('crew')) {
      analysis.type = 'call_sheet';
      analysis.hasContactSections = true;
    }
    
    // Analyze text patterns
    const textLower = text.toLowerCase();
    
    // Check for call sheet patterns
    const callSheetIndicators = this.documentPatterns.customFriendly.indicators;
    const callSheetMatches = callSheetIndicators.filter(indicator => 
      textLower.includes(indicator.toLowerCase())
    );
    
    if (callSheetMatches.length > 0) {
      analysis.type = 'call_sheet';
      analysis.structure = 'structured';
      analysis.hasContactSections = true;
      analysis.confidence = 0.8;
      analysis.patterns = callSheetMatches;
    }
    
    // Check for tabular patterns
    if (text.includes('\t') || text.includes('|') || text.includes(',')) {
      analysis.structure = 'tabular';
      analysis.hasTableStructure = true;
    }
    
    // Estimate contact count
    const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const phoneMatches = text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g) || [];
    const nameMatches = text.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g) || [];
    
    // Enhanced contact estimation for call sheets
    if (analysis.type === 'call_sheet') {
      // Look for structured lines with names and contact info
      const structuredLines = text.split('\n').filter(line => {
        const hasName = /^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(line.trim());
        const hasContact = /[\d\-\(\)\s]{10,}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(line);
        return hasName && hasContact;
      });
      
      analysis.estimatedContacts = Math.max(
        emailMatches.length, 
        phoneMatches.length, 
        structuredLines.length,
        Math.floor(nameMatches.length / 2)
      );
    } else {
      analysis.estimatedContacts = Math.max(emailMatches.length, phoneMatches.length);
    }
    
    // Determine complexity
    if (analysis.estimatedContacts > 50) {
      analysis.complexity = 'high';
    } else if (analysis.estimatedContacts < 10) {
      analysis.complexity = 'low';
    }
    
    // Determine production type
    if (textLower.includes('film') || textLower.includes('movie')) {
      analysis.productionType = 'film';
    } else if (textLower.includes('commercial') || textLower.includes('advertisement')) {
      analysis.productionType = 'commercial';
    } else if (textLower.includes('television') || textLower.includes('tv')) {
      analysis.productionType = 'television';
    }
    
    return analysis;
  }

  /**
   * Determine optimal extraction strategy based on document analysis
   */
  determineExtractionStrategy(documentAnalysis, options) {
    // Force custom extraction if requested
    if (options.forceCustom) {
      return {
        method: 'custom',
        reason: 'user_requested',
        confidence: 1.0
      };
    }
    
    // Force AI extraction if requested
    if (options.forceAI) {
      return {
        method: 'ai',
        reason: 'user_requested',
        confidence: 1.0
      };
    }
    
    // Use hybrid approach for complex documents
    if (options.useHybrid) {
      return {
        method: 'hybrid',
        reason: 'complex_document',
        confidence: 0.9
      };
    }
    
    // Route based on document analysis
    if (documentAnalysis.type === 'call_sheet' && documentAnalysis.structure === 'structured') {
      return {
        method: 'custom',
        reason: 'structured_call_sheet',
        confidence: 0.8
      };
    }
    
    if (documentAnalysis.structure === 'tabular' || documentAnalysis.type === 'spreadsheet') {
      // Use hybrid extraction for call sheets with many contacts or complex patterns
      if (documentAnalysis.type === 'call_sheet' && documentAnalysis.estimatedContacts > 20) {
        return {
          method: 'hybrid',
          reason: 'complex_call_sheet',
          confidence: 0.9
        };
      }
      
      return {
        method: 'custom',
        reason: 'tabular_data',
        confidence: 0.9
      };
    }
    
    if (documentAnalysis.complexity === 'high' || documentAnalysis.estimatedContacts > 30) {
      return {
        method: 'hybrid',
        reason: 'complex_document',
        confidence: 0.8
      };
    }
    
    if (documentAnalysis.structure === 'unstructured' || documentAnalysis.type === 'unknown') {
      return {
        method: 'ai',
        reason: 'unstructured_content',
        confidence: 0.7
      };
    }
    
    // Default to custom for known patterns
    return {
      method: 'custom',
      reason: 'default_fallback',
      confidence: 0.6
    };
  }

  /**
   * Execute extraction with chosen strategy
   */
  async executeExtraction(fileBuffer, mimeType, fileName, options, strategy) {
    switch (strategy.method) {
      case 'custom':
        return await this.customService.extractContacts(fileBuffer, mimeType, fileName, options);
        
      case 'ai':
        return await this.aiService.extractContacts(fileBuffer, mimeType, fileName, options);
        
      case 'hybrid':
        return await this.executeHybridExtraction(fileBuffer, mimeType, fileName, options);
        
      default:
        throw new Error(`Unknown extraction method: ${strategy.method}`);
    }
  }

  /**
   * Execute hybrid extraction (custom + AI)
   */
  async executeHybridExtraction(fileBuffer, mimeType, fileName, options) {
    console.log('🔄 Executing hybrid extraction...');
    
    try {
      // Run both custom and AI extraction in parallel
      const [customResult, aiResult] = await Promise.allSettled([
        this.customService.extractContacts(fileBuffer, mimeType, fileName, options),
        this.aiService.extractContacts(fileBuffer, mimeType, fileName, options)
      ]);
      
      // Combine results
      const customContacts = customResult.status === 'fulfilled' ? customResult.value.contacts : [];
      const aiContacts = aiResult.status === 'fulfilled' ? aiResult.value.contacts : [];
      
      // Merge and deduplicate contacts
      const mergedContacts = this.mergeContactResults(customContacts, aiContacts);
      
      // Calculate combined confidence
      const customConfidence = customResult.status === 'fulfilled' ? 
        customResult.value.metadata?.averageConfidence || 0 : 0;
      const aiConfidence = aiResult.status === 'fulfilled' ? 
        aiResult.value.metadata?.averageConfidence || 0 : 0;
      const combinedConfidence = (customConfidence + aiConfidence) / 2;
      
      return {
        success: true,
        contacts: mergedContacts,
        metadata: {
          extractionMethod: 'hybrid',
          customContacts: customContacts.length,
          aiContacts: aiContacts.length,
          mergedContacts: mergedContacts.length,
          customConfidence,
          aiConfidence,
          combinedConfidence,
          customSuccess: customResult.status === 'fulfilled',
          aiSuccess: aiResult.status === 'fulfilled'
        }
      };
      
    } catch (error) {
      console.error('❌ Hybrid extraction failed:', error);
      throw error;
    }
  }

  /**
   * Merge contact results from custom and AI extraction
   */
  mergeContactResults(customContacts, aiContacts) {
    const mergedContacts = [...customContacts];
    const seenEmails = new Set(customContacts.map(c => c.email?.toLowerCase()).filter(Boolean));
    
    // Add AI contacts that aren't duplicates
    for (const aiContact of aiContacts) {
      const email = aiContact.email?.toLowerCase();
      if (email && !seenEmails.has(email)) {
        mergedContacts.push({
          ...aiContact,
          source: 'ai_enhanced'
        });
        seenEmails.add(email);
      }
    }
    
    // Remove duplicates using fuzzy matching
    return this.removeFuzzyDuplicates(mergedContacts);
  }

  /**
   * Remove fuzzy duplicates from merged contacts
   */
  removeFuzzyDuplicates(contacts) {
    const uniqueContacts = [];
    const seenContacts = new Set();
    
    for (const contact of contacts) {
      const key = this.generateContactKey(contact);
      
      if (!seenContacts.has(key)) {
        // Check for fuzzy duplicates
        const isDuplicate = uniqueContacts.some(existing => 
          this.calculateContactSimilarity(contact, existing) > 0.8
        );
        
        if (!isDuplicate) {
          uniqueContacts.push(contact);
          seenContacts.add(key);
        }
      }
    }
    
    return uniqueContacts;
  }

  /**
   * Generate contact key for deduplication
   */
  generateContactKey(contact) {
    const email = contact.email?.toLowerCase() || '';
    const name = contact.name?.toLowerCase() || '';
    const phone = contact.phone?.replace(/\D/g, '') || '';
    
    return `${email}|${name}|${phone}`;
  }

  /**
   * Calculate similarity between two contacts
   */
  calculateContactSimilarity(contact1, contact2) {
    let similarity = 0;
    let factors = 0;
    
    // Email similarity
    if (contact1.email && contact2.email) {
      similarity += contact1.email.toLowerCase() === contact2.email.toLowerCase() ? 1 : 0;
      factors++;
    }
    
    // Name similarity
    if (contact1.name && contact2.name) {
      const nameSimilarity = this.calculateStringSimilarity(
        contact1.name.toLowerCase(), 
        contact2.name.toLowerCase()
      );
      similarity += nameSimilarity;
      factors++;
    }
    
    // Phone similarity
    if (contact1.phone && contact2.phone) {
      const phone1 = contact1.phone.replace(/\D/g, '');
      const phone2 = contact2.phone.replace(/\D/g, '');
      similarity += phone1 === phone2 ? 1 : 0;
      factors++;
    }
    
    return factors > 0 ? similarity / factors : 0;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Extract text for document analysis
   */
  async extractTextForAnalysis(fileBuffer, mimeType) {
    try {
      // Simple text extraction for analysis
      if (mimeType === 'application/pdf') {
        const pdfjs = require('pdfjs-dist');
        const data = new Uint8Array(fileBuffer);
        const pdf = await pdfjs.getDocument({ data }).promise;
        let text = '';
        
        for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) { // Only first 3 pages for analysis
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          text += textContent.items.map(item => item.str).join(' ') + '\n';
        }
        
        return text;
      } else if (mimeType.includes('spreadsheet')) {
        const xlsx = require('xlsx');
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        let text = '';
        
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const sheetData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
          sheetData.forEach(row => {
            if (Array.isArray(row)) {
              text += row.join(' ') + '\n';
            }
          });
        });
        
        return text;
      } else {
        return fileBuffer.toString('utf8');
      }
    } catch (error) {
      console.warn('⚠️ Text extraction for analysis failed:', error.message);
      return fileBuffer.toString('utf8');
    }
  }

  /**
   * Enhance results with additional processing
   */
  async enhanceResults(result, documentAnalysis, strategy) {
    if (!result.success) {
      return result;
    }
    
    // Add document analysis insights
    result.metadata = {
      ...result.metadata,
      documentAnalysis,
      routingStrategy: strategy,
      enhancementApplied: true
    };
    
    return result;
  }

  /**
   * Update performance metrics
   */
  updateMetrics(method, processingTime, contactCount) {
    if (method === 'custom') {
      this.metrics.customExtractions++;
    } else if (method === 'ai') {
      this.metrics.aiExtractions++;
    } else if (method === 'hybrid') {
      this.metrics.hybridExtractions++;
    }
    
    // Update average processing time
    const totalExtractions = this.metrics.customExtractions + this.metrics.aiExtractions + this.metrics.hybridExtractions;
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (totalExtractions - 1) + processingTime) / totalExtractions;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      totalExtractions: this.metrics.customExtractions + this.metrics.aiExtractions + this.metrics.hybridExtractions,
      customRatio: this.metrics.customExtractions / (this.metrics.customExtractions + this.metrics.aiExtractions + this.metrics.hybridExtractions),
      aiRatio: this.metrics.aiExtractions / (this.metrics.customExtractions + this.metrics.aiExtractions + this.metrics.hybridExtractions),
      hybridRatio: this.metrics.hybridExtractions / (this.metrics.customExtractions + this.metrics.aiExtractions + this.metrics.hybridExtractions)
    };
  }
}

module.exports = SmartExtractionRouter;
