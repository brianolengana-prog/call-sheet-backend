/**
 * Optimized Extraction Service
 * 
 * The most efficient approach combining:
 * 1. Streaming document processing
 * 2. Intelligent content routing
 * 3. Micro-optimizations for memory and speed
 * 4. Smart AI usage only where needed
 */

const fs = require('fs');
const path = require('path');

class OptimizedExtractionService {
  constructor() {
    this.initializeLibraries();
    this.setupMemoryMonitoring();
    this.contactCache = new Map(); // Cache for deduplication
  }

  async initializeLibraries() {
    try {
      this.pdfjs = require('pdfjs-dist');
      this.mammoth = require('mammoth');
      this.xlsx = require('xlsx');
      console.log('✅ Optimized extraction libraries initialized');
    } catch (error) {
      console.warn('⚠️ Some libraries not available:', error.message);
    }
  }

  setupMemoryMonitoring() {
    this.memoryThreshold = 0.85; // 85% memory threshold
    this.isHighMemory = false;
    
    setInterval(() => {
      const usage = process.memoryUsage();
      const memoryPercent = usage.heapUsed / usage.heapTotal;
      this.isHighMemory = memoryPercent > this.memoryThreshold;
      
      if (this.isHighMemory) {
        console.warn(`⚠️ High memory usage: ${(memoryPercent * 100).toFixed(2)}%`);
        if (global.gc) global.gc();
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Main extraction method with intelligent routing
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    const startTime = Date.now();
    console.log('🚀 Starting optimized extraction...');

    try {
      // Step 1: Quick document analysis (lightweight)
      const docType = await this.quickAnalyzeDocument(fileBuffer, mimeType, fileName);
      console.log('📋 Document type:', docType);

      // Step 2: Route to optimal extraction strategy
      const strategy = this.selectExtractionStrategy(docType, fileBuffer.length);
      console.log('🎯 Selected strategy:', strategy);

      // Step 3: Execute optimized extraction
      const result = await this.executeStrategy(strategy, fileBuffer, mimeType, fileName, options);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Optimized extraction completed in ${processingTime}ms`);

      return {
        success: true,
        contacts: result.contacts,
        metadata: {
          extractionMethod: strategy,
          processingTime,
          documentType: docType,
          memoryOptimized: this.isHighMemory
        }
      };

    } catch (error) {
      console.error('❌ Optimized extraction failed:', error);
      throw error;
    }
  }

  /**
   * Quick document analysis without heavy processing
   */
  async quickAnalyzeDocument(fileBuffer, mimeType, fileName) {
    const analysis = {
      type: 'unknown',
      isCallSheet: false,
      estimatedContacts: 0,
      complexity: 'low',
      hasStructuredData: false
    };

    // Quick file type detection
    if (mimeType === 'application/pdf') {
      analysis.type = 'pdf';
      // Quick PDF header analysis
      const header = fileBuffer.toString('ascii', 0, Math.min(1000, fileBuffer.length));
      analysis.isCallSheet = this.detectCallSheetHeaders(header);
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      analysis.type = 'document';
    } else if (mimeType.includes('sheet') || mimeType.includes('excel')) {
      analysis.type = 'spreadsheet';
      analysis.hasStructuredData = true;
    }

    // Quick content sampling for estimation
    if (analysis.type === 'pdf') {
      const sample = await this.samplePDFContent(fileBuffer);
      analysis.estimatedContacts = this.estimateContactsFromSample(sample);
      analysis.complexity = analysis.estimatedContacts > 20 ? 'high' : 'medium';
    }

    return analysis;
  }

  /**
   * Detect call sheet headers in PDF
   */
  detectCallSheetHeaders(header) {
    const callSheetKeywords = [
      'call sheet', 'call-sheet', 'callsheet',
      'production', 'shoot', 'location',
      'crew', 'talent', 'contact'
    ];
    
    const headerLower = header.toLowerCase();
    return callSheetKeywords.some(keyword => headerLower.includes(keyword));
  }

  /**
   * Sample PDF content for quick analysis
   */
  async samplePDFContent(fileBuffer) {
    try {
      const data = new Uint8Array(fileBuffer);
      const pdf = await this.pdfjs.getDocument({
        data,
        verbosity: 0,
        disableAutoFetch: true,
        disableStream: true
      }).promise;

      // Sample first 3 pages only
      const maxPages = Math.min(3, pdf.numPages);
      let sampleText = '';

      for (let i = 1; i <= maxPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          sampleText += pageText + '\n';
          
          // Memory cleanup
          page.cleanup();
        } catch (pageError) {
          console.warn(`⚠️ Could not sample page ${i}:`, pageError.message);
        }
      }

      pdf.destroy();
      return sampleText;
    } catch (error) {
      console.warn('⚠️ PDF sampling failed:', error.message);
      return '';
    }
  }

  /**
   * Estimate contacts from text sample
   */
  estimateContactsFromSample(sample) {
    if (!sample) return 0;

    // Count email patterns
    const emailMatches = sample.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);
    const emailCount = emailMatches ? emailMatches.length : 0;

    // Count phone patterns
    const phoneMatches = sample.match(/(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g);
    const phoneCount = phoneMatches ? phoneMatches.length : 0;

    // Count structured lines (name + contact info)
    const lines = sample.split('\n');
    const structuredLines = lines.filter(line => {
      const hasEmail = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(line);
      const hasPhone = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/.test(line);
      const hasName = /^[A-Z][a-z]+ [A-Z][a-z]+/.test(line.trim());
      return (hasEmail || hasPhone) && hasName;
    }).length;

    return Math.max(emailCount, phoneCount, structuredLines);
  }

  /**
   * Select optimal extraction strategy
   */
  selectExtractionStrategy(docType, fileSize) {
    // Memory-based routing
    if (this.isHighMemory) {
      return 'streaming_custom';
    }

    // Size-based routing
    if (fileSize > 5 * 1024 * 1024) { // > 5MB
      return 'streaming_custom';
    }

    // Document type routing
    if (docType.type === 'spreadsheet') {
      return 'structured_extraction';
    }

    if (docType.isCallSheet && docType.estimatedContacts > 15) {
      return 'hybrid_optimized';
    }

    if (docType.complexity === 'high') {
      return 'ai_enhanced';
    }

    return 'custom_optimized';
  }

  /**
   * Execute selected strategy
   */
  async executeStrategy(strategy, fileBuffer, mimeType, fileName, options) {
    switch (strategy) {
      case 'streaming_custom':
        return await this.streamingCustomExtraction(fileBuffer, mimeType, fileName, options);
      
      case 'structured_extraction':
        return await this.structuredExtraction(fileBuffer, mimeType, fileName, options);
      
      case 'hybrid_optimized':
        return await this.hybridOptimizedExtraction(fileBuffer, mimeType, fileName, options);
      
      case 'ai_enhanced':
        return await this.aiEnhancedExtraction(fileBuffer, mimeType, fileName, options);
      
      default:
        return await this.customOptimizedExtraction(fileBuffer, mimeType, fileName, options);
    }
  }

  /**
   * Streaming custom extraction for large files
   */
  async streamingCustomExtraction(fileBuffer, mimeType, fileName, options) {
    console.log('🌊 Using streaming custom extraction...');
    
    const contacts = [];
    const maxPages = this.isHighMemory ? 5 : 10;
    
    if (mimeType === 'application/pdf') {
      const data = new Uint8Array(fileBuffer);
      const pdf = await this.pdfjs.getDocument({
        data,
        verbosity: 0,
        disableAutoFetch: true,
        disableStream: true
      }).promise;

      const actualPages = Math.min(pdf.numPages, maxPages);
      
      for (let i = 1; i <= actualPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          
          // Process page immediately
          const pageContacts = await this.extractContactsFromText(pageText, 'call_sheet');
          contacts.push(...pageContacts);
          
          // Memory cleanup
          page.cleanup();
          
          // Force GC if high memory
          if (this.isHighMemory && i % 3 === 0 && global.gc) {
            global.gc();
          }
        } catch (pageError) {
          console.warn(`⚠️ Page ${i} processing failed:`, pageError.message);
        }
      }
      
      pdf.destroy();
    } else {
      // For non-PDF, use regular extraction
      const text = await this.extractTextFromDocument(fileBuffer, mimeType, fileName);
      const allContacts = await this.extractContactsFromText(text, 'call_sheet');
      contacts.push(...allContacts);
    }

    return { contacts: this.deduplicateContacts(contacts) };
  }

  /**
   * Structured extraction for spreadsheets
   */
  async structuredExtraction(fileBuffer, mimeType, fileName, options) {
    console.log('📊 Using structured extraction...');
    
    try {
      const workbook = this.xlsx.read(fileBuffer, { type: 'buffer' });
      const contacts = [];
      
      // Process each sheet
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = this.xlsx.utils.sheet_to_json(sheet);
        
        for (const row of jsonData) {
          const contact = this.parseStructuredRow(row);
          if (contact && this.isValidContact(contact)) {
            contacts.push(contact);
          }
        }
      }
      
      return { contacts: this.deduplicateContacts(contacts) };
    } catch (error) {
      console.error('❌ Structured extraction failed:', error);
      throw error;
    }
  }

  /**
   * Hybrid optimized extraction
   */
  async hybridOptimizedExtraction(fileBuffer, mimeType, fileName, options) {
    console.log('🔄 Using hybrid optimized extraction...');
    
    // Step 1: Custom extraction first (fast)
    const customResult = await this.customOptimizedExtraction(fileBuffer, mimeType, fileName, options);
    console.log('🔍 Custom extraction found:', customResult.contacts.length, 'contacts');
    
    // Step 2: AI enhancement only for low-confidence contacts
    const lowConfidenceContacts = customResult.contacts.filter(c => c.confidence < 0.7);
    
    if (lowConfidenceContacts.length > 0 && !this.isHighMemory) {
      try {
        const aiEnhanced = await this.enhanceContactsWithAI(lowConfidenceContacts, fileBuffer);
        console.log('🤖 AI enhanced:', aiEnhanced.length, 'contacts');
        
        // Merge results
        const allContacts = [...customResult.contacts.filter(c => c.confidence >= 0.7), ...aiEnhanced];
        return { contacts: this.deduplicateContacts(allContacts) };
      } catch (aiError) {
        console.warn('⚠️ AI enhancement failed, using custom results:', aiError.message);
      }
    }
    
    return customResult;
  }

  /**
   * AI-enhanced extraction
   */
  async aiEnhancedExtraction(fileBuffer, mimeType, fileName, options) {
    console.log('🤖 Using AI-enhanced extraction...');
    
    // This would integrate with your existing AI services
    // but with chunking and memory optimization
    const text = await this.extractTextFromDocument(fileBuffer, mimeType, fileName);
    const chunks = this.chunkTextForAI(text, 2500);
    
    const contacts = [];
    for (const chunk of chunks) {
      try {
        const chunkContacts = await this.processChunkWithAI(chunk);
        contacts.push(...chunkContacts);
      } catch (chunkError) {
        console.warn('⚠️ Chunk processing failed:', chunkError.message);
      }
    }
    
    return { contacts: this.deduplicateContacts(contacts) };
  }

  /**
   * Custom optimized extraction
   */
  async customOptimizedExtraction(fileBuffer, mimeType, fileName, options) {
    console.log('⚡ Using custom optimized extraction...');
    
    const text = await this.extractTextFromDocument(fileBuffer, mimeType, fileName);
    const contacts = await this.extractContactsFromText(text, 'call_sheet');
    
    return { contacts: this.deduplicateContacts(contacts) };
  }

  /**
   * Extract contacts from text with optimized patterns
   */
  async extractContactsFromText(text, docType) {
    const contacts = [];
    const lines = text.split('\n');
    
    // Optimized patterns
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const phonePattern = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || this.isHeaderLine(line)) continue;
      
      // Extract emails
      const emailMatches = [...line.matchAll(emailPattern)];
      for (const emailMatch of emailMatches) {
        const contact = this.buildContactFromLine(line, i, lines);
        if (contact && this.isValidContact(contact)) {
          contacts.push(contact);
        }
      }
      
      // Extract phones if no email
      if (emailMatches.length === 0) {
        const phoneMatches = [...line.matchAll(phonePattern)];
        for (const phoneMatch of phoneMatches) {
          const contact = this.buildContactFromPhoneLine(line, i, lines);
          if (contact && this.isValidContact(contact)) {
            contacts.push(contact);
          }
        }
      }
    }
    
    return contacts;
  }

  /**
   * Build contact from line
   */
  buildContactFromLine(line, lineIndex, allLines) {
    const emailMatch = line.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    const phoneMatch = line.match(/(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/);
    
    const name = this.extractNameFromLine(line);
    const email = emailMatch ? emailMatch[0] : '';
    const phone = phoneMatch ? phoneMatch[0] : '';
    const role = this.inferRoleFromContext(line, allLines);
    const company = this.inferCompanyFromContext(line, allLines);
    
    return {
      id: this.generateContactId(),
      name: name || 'Unknown',
      email,
      phone,
      role,
      company,
      confidence: this.calculateConfidence(name, email, phone),
      source: 'custom_extraction'
    };
  }

  /**
   * Build contact from phone line
   */
  buildContactFromPhoneLine(line, lineIndex, allLines) {
    const phoneMatch = line.match(/(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/);
    
    const name = this.extractNameFromLine(line);
    const phone = phoneMatch ? phoneMatch[0] : '';
    const role = this.inferRoleFromContext(line, allLines);
    const company = this.inferCompanyFromContext(line, allLines);
    
    return {
      id: this.generateContactId(),
      name: name || 'Unknown',
      email: '',
      phone,
      role,
      company,
      confidence: this.calculateConfidence(name, '', phone),
      source: 'custom_extraction'
    };
  }

  /**
   * Extract name from line
   */
  extractNameFromLine(line) {
    // Look for capitalized words before email/phone
    const beforeContact = line.split(/[@\d]/)[0].trim();
    const words = beforeContact.split(/\s+/);
    
    const nameParts = [];
    for (const word of words) {
      if (word.length > 1 && word[0] === word[0].toUpperCase() && 
          word.substring(1) === word.substring(1).toLowerCase()) {
        nameParts.push(word);
      } else if (nameParts.length > 0) {
        break;
      }
    }
    
    return nameParts.length > 0 ? nameParts.join(' ') : '';
  }

  /**
   * Infer role from context
   */
  inferRoleFromContext(line, allLines) {
    const roles = ['director', 'producer', 'editor', 'gaffer', 'grip', 'stylist', 'hmu', 'talent', 'coordinator', 'assistant'];
    const lineLower = line.toLowerCase();
    
    for (const role of roles) {
      if (lineLower.includes(role)) {
        return role;
      }
    }
    
    return '';
  }

  /**
   * Infer company from context
   */
  inferCompanyFromContext(line, allLines) {
    // Simple heuristic for company names
    const words = line.split(/\s+/);
    const companyWords = [];
    
    for (const word of words) {
      if (word.length > 2 && word[0] === word[0].toUpperCase() && 
          !this.isCommonName(word) && !this.isCommonRole(word)) {
        companyWords.push(word);
      }
    }
    
    return companyWords.length > 0 ? companyWords.join(' ') : '';
  }

  /**
   * Check if word is common name
   */
  isCommonName(word) {
    const commonNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emily', 'Chris', 'Alex'];
    return commonNames.includes(word);
  }

  /**
   * Check if word is common role
   */
  isCommonRole(word) {
    const commonRoles = ['Director', 'Producer', 'Editor', 'Gaffer', 'Grip', 'Stylist'];
    return commonRoles.includes(word);
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(name, email, phone) {
    let score = 0;
    if (name && name !== 'Unknown') score += 0.4;
    if (email) score += 0.4;
    if (phone) score += 0.2;
    return Math.min(score, 1.0);
  }

  /**
   * Check if line is header
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
   * Generate unique contact ID
   */
  generateContactId() {
    return 'contact_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Deduplicate contacts
   */
  deduplicateContacts(contacts) {
    const seen = new Set();
    const unique = [];
    
    for (const contact of contacts) {
      const key = `${contact.email?.toLowerCase() || ''}-${contact.phone || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(contact);
      }
    }
    
    return unique;
  }

  /**
   * Parse structured row from spreadsheet
   */
  parseStructuredRow(row) {
    const name = row.Name || row.name || row.NAME || '';
    const email = row.Email || row.email || row.EMAIL || '';
    const phone = row.Phone || row.phone || row.PHONE || '';
    const role = row.Role || row.role || row.ROLE || '';
    const company = row.Company || row.company || row.COMPANY || '';
    
    if (name || email || phone) {
      return {
        id: this.generateContactId(),
        name: name || 'Unknown',
        email,
        phone,
        role,
        company,
        confidence: this.calculateConfidence(name, email, phone),
        source: 'structured_extraction'
      };
    }
    
    return null;
  }

  /**
   * Extract text from document (delegated to existing service)
   */
  async extractTextFromDocument(fileBuffer, mimeType, fileName) {
    const CustomExtractionService = require('./customExtractionService');
    const service = new CustomExtractionService();
    return await service.extractTextFromDocument(fileBuffer, mimeType, fileName);
  }

  /**
   * Chunk text for AI processing
   */
  chunkTextForAI(text, maxChunkSize) {
    const chunks = [];
    const lines = text.split('\n');
    let currentChunk = '';
    
    for (const line of lines) {
      if (currentChunk.length + line.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  /**
   * Process chunk with AI (placeholder)
   */
  async processChunkWithAI(chunk) {
    // This would integrate with your AI services
    // For now, return empty array
    return [];
  }

  /**
   * Enhance contacts with AI (placeholder)
   */
  async enhanceContactsWithAI(contacts, fileBuffer) {
    // This would integrate with your AI services
    // For now, return original contacts
    return contacts;
  }
}

module.exports = new OptimizedExtractionService();


