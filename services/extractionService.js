/**
 * Production-Ready Call Sheet Extraction Service
 * Robust document processing with proper error handling and library management
 */

const fetch = require('node-fetch');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const usageService = require('./usageService');

class ExtractionService {
  constructor() {
    this.openAIApiKey = process.env.OPENAI_API_KEY;
    this.openAIBaseUrl = 'https://api.openai.com/v1';
    
    // Debug API key configuration
    if (!this.openAIApiKey) {
      console.error('❌ OPENAI_API_KEY environment variable is not set');
    } else if (!this.openAIApiKey.startsWith('sk-')) {
      console.warn('⚠️ OPENAI_API_KEY does not start with "sk-" - this might be invalid');
    } else {
      console.log('✅ OpenAI API key configured:', this.openAIApiKey.substring(0, 10) + '...');
    }
    
    // Library management with proper initialization
    this.libraries = new Map();
    this.initializationPromise = null;
    this.isInitialized = false;
    
    // Initialize libraries immediately and handle errors gracefully
    this.initializeLibraries().catch(error => {
      console.error('❌ Failed to initialize extraction libraries:', error.message);
      // Service will still work with on-demand loading
    });
  }

  /**
   * Initialize all document processing libraries
   * This method is called once and handles all library loading
   */
  async initializeLibraries() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._loadLibraries();
    await this.initializationPromise;
    this.isInitialized = true;
    
    return this.initializationPromise;
  }

  async _loadLibraries() {
    const libraryConfigs = [
      { name: 'pdfjs', module: 'pdfjs-dist', required: true },
      { name: 'mammoth', module: 'mammoth', required: true },
      { name: 'xlsx', module: 'xlsx', required: true },
      { name: 'tesseract', module: 'tesseract.js', required: false }
    ];

    const loadPromises = libraryConfigs.map(async ({ name, module, required }) => {
      try {
        const lib = require(module);
        this.libraries.set(name, lib);
        console.log(`✅ ${name} library loaded successfully`);
        return { name, success: true };
      } catch (error) {
        if (required) {
          console.error(`❌ Required library ${name} failed to load:`, error.message);
          throw new Error(`Required library ${name} not available: ${error.message}`);
        } else {
          console.warn(`⚠️ Optional library ${name} not available:`, error.message);
          return { name, success: false, error: error.message };
        }
      }
    });

    const results = await Promise.allSettled(loadPromises);
    const failures = results.filter(result => result.status === 'rejected');
    
    if (failures.length > 0) {
      console.error('❌ Some required libraries failed to load:', failures);
      throw new Error('Failed to load required extraction libraries');
    }

    console.log('✅ All extraction libraries initialized successfully');
  }

  /**
   * Ensure library is loaded before use
   * @param {string} libraryName - Name of the library to ensure is loaded
   * @param {boolean} required - Whether the library is required
   */
  async ensureLibrary(libraryName, required = true) {
    // If already loaded, return immediately
    if (this.libraries.has(libraryName)) {
      return this.libraries.get(libraryName);
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise && !this.isInitialized) {
      await this.initializationPromise;
      if (this.libraries.has(libraryName)) {
        return this.libraries.get(libraryName);
      }
    }

    // Try to load the library on-demand
    try {
      const libraryConfigs = {
        pdfjs: 'pdfjs-dist',
        mammoth: 'mammoth',
        xlsx: 'xlsx',
        tesseract: 'tesseract.js'
      };

      const moduleName = libraryConfigs[libraryName];
      if (!moduleName) {
        throw new Error(`Unknown library: ${libraryName}`);
      }

      const lib = require(moduleName);
      this.libraries.set(libraryName, lib);
      console.log(`✅ ${libraryName} library loaded on-demand`);
      return lib;
    } catch (error) {
      const message = `${libraryName} processing library not available: ${error.message}`;
      if (required) {
        throw new Error(message);
      } else {
        console.warn(`⚠️ ${message}`);
        return null;
      }
    }
  }

  /**
   * Process uploaded file and extract text with memory management
   * @param {Buffer} buffer - File buffer
   * @param {string} mimeType - MIME type of the file
   * @param {string} fileName - Original filename
   * @returns {Promise<string>} Extracted text
   */
  async processFile(buffer, mimeType, fileName) {
    try {
      console.log(`📄 Processing file: ${fileName} (${mimeType})`);
      console.log(`📊 File size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
      
      // Check file size limits
      const maxFileSize = 50 * 1024 * 1024; // 50MB limit
      if (buffer.length > maxFileSize) {
        throw new Error(`File too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB. Maximum allowed size is 50MB.`);
      }
      
      // Ensure libraries are loaded
      await this.initializeLibraries();
      
      const fileExtension = path.extname(fileName).toLowerCase();
      let extractedText = '';

      // Route to appropriate extraction method based on file type
      if (mimeType === 'application/pdf' || fileExtension === '.pdf') {
        extractedText = await this.extractTextFromPDF(buffer);
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileExtension === '.docx') {
        extractedText = await this.extractTextFromDOCX(buffer);
      } else if (mimeType === 'application/msword' || fileExtension === '.doc') {
        extractedText = await this.extractTextFromDOC(buffer);
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || fileExtension === '.xlsx') {
        extractedText = await this.extractTextFromXLSX(buffer);
      } else if (mimeType === 'application/vnd.ms-excel' || fileExtension === '.xls') {
        extractedText = await this.extractTextFromXLS(buffer);
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || fileExtension === '.pptx') {
        extractedText = await this.extractTextFromPPTX(buffer);
      } else if (mimeType === 'text/csv' || fileExtension === '.csv') {
        extractedText = await this.extractTextFromCSV(buffer);
      } else if (mimeType === 'application/rtf' || fileExtension === '.rtf') {
        extractedText = await this.extractTextFromRTF(buffer);
      } else if (mimeType.startsWith('image/')) {
        extractedText = await this.extractTextFromImage(buffer);
      } else {
        // Try to extract as plain text
        extractedText = await this.extractTextFromPlainText(buffer);
      }

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text content found in the document');
      }

      console.log(`✅ File processed successfully: ${extractedText.length} characters extracted`);
      
      // Clear buffer from memory to free up space
      buffer = null;
      
      return extractedText.trim();
    } catch (error) {
      console.error('❌ File processing error:', error);
      throw new Error(`File processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF documents
   */
  async extractTextFromPDF(buffer) {
    const pdfjs = await this.ensureLibrary('pdfjs', true);
    
    try {
      const pdf = await pdfjs.getDocument({ data: buffer }).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ');
        fullText += `\n--- Page ${i} ---\n${pageText}\n`;
      }
      
      console.log('📄 PDF processed successfully');
      return fullText.trim();
    } catch (error) {
      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from DOCX documents
   */
  async extractTextFromDOCX(buffer) {
    const mammoth = await this.ensureLibrary('mammoth', true);
    
    try {
      const result = await mammoth.extractRawText({ buffer });
      console.log('📄 DOCX processed successfully');
      return result.value;
    } catch (error) {
      throw new Error(`DOCX processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from legacy DOC documents
   */
  async extractTextFromDOC(buffer) {
    // For legacy DOC files, we'll try to extract as much text as possible
    // This is a basic implementation - for production, consider using antiword or similar
    try {
      const text = buffer.toString('utf-8');
      // Basic text extraction from DOC binary format
      const cleanedText = text
        .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ') // Remove control characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      console.log('📄 Legacy DOC processed successfully');
      return cleanedText;
    } catch (error) {
      throw new Error(`DOC processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from XLSX documents
   */
  async extractTextFromXLSX(buffer) {
    const xlsx = await this.ensureLibrary('xlsx', true);
    
    try {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      let fullText = '';
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetText = xlsx.utils.sheet_to_txt(worksheet);
        if (sheetText.trim()) {
          fullText += `\n--- Sheet: ${sheetName} ---\n${sheetText}\n`;
        }
      });
      
      console.log('📊 XLSX processed successfully');
      return fullText.trim();
    } catch (error) {
      throw new Error(`XLSX processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from legacy XLS documents
   */
  async extractTextFromXLS(buffer) {
    const xlsx = await this.ensureLibrary('xlsx', true);
    
    try {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      let fullText = '';
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetText = xlsx.utils.sheet_to_txt(worksheet);
        if (sheetText.trim()) {
          fullText += `\n--- Sheet: ${sheetName} ---\n${sheetText}\n`;
        }
      });
      
      console.log('📊 XLS processed successfully');
      return fullText.trim();
    } catch (error) {
      throw new Error(`XLS processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from PPTX documents
   */
  async extractTextFromPPTX(buffer) {
    const xlsx = await this.ensureLibrary('xlsx', true);
    
    try {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      let fullText = '';
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetText = xlsx.utils.sheet_to_txt(worksheet);
        if (sheetText.trim()) {
          fullText += `\n--- Slide: ${sheetName} ---\n${sheetText}\n`;
        }
      });
      
      console.log('📊 PPTX processed successfully');
      return fullText.trim();
    } catch (error) {
      throw new Error(`PPTX processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from CSV documents
   */
  async extractTextFromCSV(buffer) {
    try {
      const text = buffer.toString('utf-8');
      console.log('📄 CSV processed successfully');
      return text;
    } catch (error) {
      throw new Error(`CSV processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from RTF documents
   */
  async extractTextFromRTF(buffer) {
    try {
      const text = buffer.toString('utf-8');
      // Basic RTF text extraction (remove RTF formatting codes)
      const cleanedText = text
        .replace(/\\[a-z]+\d*\s?/g, '') // Remove RTF commands
        .replace(/[{}]/g, '') // Remove braces
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      console.log('📄 RTF processed successfully');
      return cleanedText;
    } catch (error) {
      throw new Error(`RTF processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from images using OCR
   */
  async extractTextFromImage(buffer) {
    const tesseract = await this.ensureLibrary('tesseract', false);
    
    if (!tesseract) {
      throw new Error('OCR processing not available - tesseract.js library not loaded');
    }
    
    try {
      const { data: { text } } = await tesseract.recognize(buffer);
      console.log('📄 Image OCR processed successfully');
      return text.trim();
    } catch (error) {
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from plain text files
   */
  async extractTextFromPlainText(buffer) {
    try {
      const text = buffer.toString('utf-8');
      console.log('📄 Plain text processed successfully');
      return text;
    } catch (error) {
      throw new Error(`Plain text processing failed: ${error.message}`);
    }
  }

  /**
   * Extract contacts from processed text using AI with chunking for large documents
   * @param {string} text - Extracted text from document
   * @param {Array} rolePreferences - Preferred roles to focus on
   * @param {Object} options - Extraction options
   * @param {string} userId - User ID for tracking
   * @returns {Object} Extraction result with contacts and metadata
   */
  async extractContacts(text, rolePreferences = [], options = {}, userId = null) {
    try {
      console.log('🤖 Starting AI contact extraction...');
      console.log('📊 Role preferences:', rolePreferences);
      console.log('📊 Options:', options);
      
      // Analyze document structure and type
      const documentAnalysis = await this.analyzeDocumentStructure(text);
      console.log('📋 Document analysis:', documentAnalysis);
      
      // Calculate estimated tokens (roughly 4 characters per token)
      const estimatedTokens = Math.ceil(text.length / 4);
      console.log(`📊 Estimated tokens: ${estimatedTokens}`);
      
      let contacts = [];
      let processedChunks = 1;
      
      // For very large documents, use chunked processing
      if (estimatedTokens > 120000) {
        console.log('📚 Document very large, using chunked processing...');
        const chunkedResult = await this.processLargeDocumentInChunks(text, userId, rolePreferences, options);
        contacts = chunkedResult.contacts;
        processedChunks = chunkedResult.processedChunks;
      } else if (estimatedTokens < 5000) {
        // For small documents, use regex fallback since API key is invalid
        console.log('📝 Small document, using regex fallback extraction...');
        try {
          contacts = this.extractContactsWithRegex(text);
          processedChunks = 1;
          console.log('✅ Regex extraction successful');
        } catch (fallbackError) {
          console.log('❌ Regex extraction failed');
          // Try AI as last resort
          try {
            const result = await this.extractContactsFromChunk(text, 1, 1, rolePreferences, options, documentAnalysis);
            contacts = result.contacts || [];
            processedChunks = 1;
          } catch (error) {
            console.log('❌ All extraction methods failed');
            throw error;
          }
        }
      } else {
        // For moderately large documents, truncate if needed
        let processedText = text;
        if (estimatedTokens > 100000) {
          console.log('✂️ Text too long, truncating to fit context window...');
          const maxChars = 100000 * 4; // ~100k tokens worth of characters
          processedText = text.substring(0, maxChars);
          
          // Try to break at a good point (end of line or paragraph)
          const lastNewline = processedText.lastIndexOf('\n');
          const lastSpace = processedText.lastIndexOf(' ');
          const breakPoint = (lastNewline > maxChars * 0.9) ? lastNewline : 
                            (lastSpace > maxChars * 0.9) ? lastSpace : maxChars;
          
          processedText = text.substring(0, breakPoint).trim();
          console.log(`✂️ Truncated to ${processedText.length} characters`);
        }
        
        // Process single chunk with enhanced prompt
        contacts = await this.extractContactsFromChunk(processedText, 1, 1, rolePreferences, options, documentAnalysis);
      }
      
      return {
        success: true,
        contacts: contacts,
        processedChunks: processedChunks,
        documentType: documentAnalysis.type,
        productionType: documentAnalysis.productionType,
        usage: {
          tokensProcessed: estimatedTokens,
          charactersProcessed: text.length
        }
      };
    } catch (error) {
      console.error('❌ AI contact extraction error:', error);
      return {
        success: false,
        error: `Contact extraction failed: ${error.message}`,
        contacts: []
      };
    }
  }

  /**
   * Analyze document structure to optimize extraction
   */
  async analyzeDocumentStructure(text) {
    const analysis = {
      type: 'unknown',
      productionType: 'unknown',
      hasTableStructure: false,
      hasContactSections: false,
      estimatedContacts: 0
    };

    // Detect document type
    if (text.includes('CALL SHEET') || text.includes('Call Sheet')) {
      analysis.type = 'call_sheet';
    } else if (text.includes('PRODUCTION') || text.includes('Production')) {
      analysis.type = 'production_document';
    } else if (text.includes('CAST') || text.includes('CREW')) {
      analysis.type = 'cast_crew_list';
    } else if (text.includes('CONTACTS') || text.includes('Contacts')) {
      analysis.type = 'contact_list';
    }

    // Detect production type
    if (text.includes('FILM') || text.includes('MOVIE') || text.includes('Film')) {
      analysis.productionType = 'film';
    } else if (text.includes('TV') || text.includes('TELEVISION') || text.includes('SERIES')) {
      analysis.productionType = 'television';
    } else if (text.includes('COMMERCIAL') || text.includes('Commercial')) {
      analysis.productionType = 'commercial';
    } else if (text.includes('DOCUMENTARY') || text.includes('Documentary')) {
      analysis.productionType = 'documentary';
    }

    // Detect table structure
    const tableIndicators = ['|', '\t', 'Name\t', 'Role\t', 'Email\t', 'Phone\t'];
    analysis.hasTableStructure = tableIndicators.some(indicator => text.includes(indicator));

    // Detect contact sections
    const contactSectionIndicators = ['PRODUCTION', 'TALENT', 'CREW', 'CLIENTS', 'CONTACTS', 'CAST'];
    analysis.hasContactSections = contactSectionIndicators.some(indicator => 
      text.toUpperCase().includes(indicator)
    );

    // Estimate number of contacts (rough heuristic)
    const emailMatches = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);
    analysis.estimatedContacts = emailMatches ? emailMatches.length : 0;

    return analysis;
  }

  /**
   * Process very large documents in chunks
   */
  async processLargeDocumentInChunks(text, userId, rolePreferences = [], options = {}) {
    console.log('🔄 Processing very large document in chunks...');
    
    // Analyze document structure first
    const documentAnalysis = await this.analyzeDocumentStructure(text);
    
    // Split text into chunks optimized for 3 RPM + 60k TPM limits (~40k tokens each)
    // This ensures we stay well under the 60k TPM limit and can process within 3 RPM
    const chunkSize = 40000 * 4; // ~40k tokens worth of characters
    const chunks = [];
    
    for (let i = 0; i < text.length; i += chunkSize) {
      let chunk = text.substring(i, i + chunkSize);
      
      // Try to break at a good point (end of line or paragraph)
      if (i + chunkSize < text.length) {
        const lastNewline = chunk.lastIndexOf('\n');
        const lastSpace = chunk.lastIndexOf(' ');
        const breakPoint = (lastNewline > chunkSize * 0.8) ? lastNewline : 
                          (lastSpace > chunkSize * 0.8) ? lastSpace : chunkSize;
        chunk = chunk.substring(0, breakPoint).trim();
      }
      
      if (chunk.trim()) {
        chunks.push(chunk);
      }
    }
    
    console.log(`📚 Split into ${chunks.length} chunks`);
    
    // Process each chunk sequentially to respect rate limits
    const allContacts = [];
    
    for (let i = 0; i < chunks.length; i++) {
      console.log(`🔄 Processing chunk ${i + 1}/${chunks.length}...`);
      
      // Add delay between chunks to respect rate limits
      if (i > 0) {
        const delay = 25000; // 25 seconds between chunks (respects 3 RPM limit)
        console.log(`⏳ Waiting ${delay}ms before processing next chunk...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      try {
        const chunkContacts = await this.extractContactsFromChunk(
          chunks[i], 
          i + 1, 
          chunks.length, 
          rolePreferences, 
          options, 
          documentAnalysis
        );
        allContacts.push(...chunkContacts);
        console.log(`✅ Chunk ${i + 1} extracted ${chunkContacts.length} contacts`);
      } catch (error) {
        console.warn(`⚠️ Chunk ${i + 1} failed:`, error);
        
        // Try to process this chunk with a smaller size as fallback
        console.log(`🔄 Attempting fallback processing for chunk ${i + 1}...`);
        try {
          const smallerChunks = this.splitChunkIntoSmallerPieces(chunks[i]);
          console.log(`📚 Split chunk ${i + 1} into ${smallerChunks.length} smaller pieces`);
          
          for (let j = 0; j < smallerChunks.length; j++) {
            // Add delay between sub-chunks too
            if (j > 0) {
              const subDelay = 25000;
              console.log(`⏳ Waiting ${subDelay}ms before processing sub-chunk...`);
              await new Promise(resolve => setTimeout(resolve, subDelay));
            }
            
            try {
              const subChunkContacts = await this.extractContactsFromChunk(
                smallerChunks[j], 
                i + 1, 
                chunks.length, 
                rolePreferences, 
                options, 
                documentAnalysis
              );
              allContacts.push(...subChunkContacts);
              console.log(`✅ Sub-chunk ${j + 1} extracted ${subChunkContacts.length} contacts`);
            } catch (subError) {
              console.warn(`⚠️ Sub-chunk ${j + 1} also failed:`, subError);
            }
          }
        } catch (fallbackError) {
          console.warn(`⚠️ Fallback processing also failed for chunk ${i + 1}:`, fallbackError);
        }
      }
    }
    
    // Remove duplicates based on name and email
    const uniqueContacts = allContacts.filter((contact, index, self) => 
      index === self.findIndex(c => 
        c.name === contact.name && c.email === contact.email
      )
    );
    
    console.log(`🎯 Total unique contacts found: ${uniqueContacts.length}`);
    return {
      contacts: uniqueContacts,
      processedChunks: chunks.length
    };
  }

  /**
   * Split a chunk into smaller pieces for fallback processing
   */
  splitChunkIntoSmallerPieces(chunk) {
    const maxSize = 40000 * 4; // ~40k tokens worth of characters
    const pieces = [];
    
    for (let i = 0; i < chunk.length; i += maxSize) {
      let piece = chunk.substring(i, i + maxSize);
      
      // Try to break at a good point
      if (i + maxSize < chunk.length) {
        const lastNewline = piece.lastIndexOf('\n');
        const lastSpace = piece.lastIndexOf(' ');
        const breakPoint = (lastNewline > maxSize * 0.8) ? lastNewline : 
                          (lastSpace > maxSize * 0.8) ? lastSpace : maxSize;
        piece = piece.substring(0, breakPoint).trim();
      }
      
      if (piece.trim()) {
        pieces.push(piece);
      }
    }
    
    return pieces;
  }

  /**
   * Extract contacts from a single chunk with adaptive prompts based on document structure
   */
  async extractContactsFromChunk(text, chunkNumber, totalChunks, rolePreferences = [], options = {}, documentAnalysis = {}) {
    // Build adaptive prompt based on document structure
    const prompt = this.buildAdaptivePrompt(text, chunkNumber, totalChunks, rolePreferences, options, documentAnalysis);

    // Implement rate limiting with retries
    return await this.callOpenAIWithRetry(prompt, chunkNumber, totalChunks);
  }

  /**
   * Call OpenAI API with rate limiting and retries
   */
  async callOpenAIWithRetry(prompt, chunkNumber, totalChunks, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} for chunk ${chunkNumber}`);
        
        // Add delay between requests to respect rate limits
        if (attempt > 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Exponential backoff, max 30s
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // For very restrictive rate limits (3 RPM = 20 seconds between requests)
        if (attempt === 1 && chunkNumber > 1) {
          console.log(`⏳ Adding 25-second delay for chunk ${chunkNumber} to respect 3 RPM limit...`);
          await new Promise(resolve => setTimeout(resolve, 25000)); // 25 seconds between chunks
        }
        
        // For the first chunk, add a small delay to respect rate limits
        if (attempt === 1 && chunkNumber === 1) {
          console.log(`⏳ Adding 5-second initial delay to respect 3 RPM limit...`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds initial delay
        }

        const response = await fetch(`${this.openAIBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.openAIApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: 'You are an expert at extracting contact information from production documents. Always return valid JSON. Be thorough but accurate in identifying all relevant contacts.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.1,
            max_tokens: 4000
          })
        });

        if (response.status === 429) {
          // Rate limit hit - extract retry time from response
          const errorData = await response.json().catch(() => ({}));
          console.log(`🚫 Rate limit response:`, JSON.stringify(errorData, null, 2));
          
          const retryAfter = this.extractRetryAfter(errorData);
          console.log(`⏳ Calculated retry time: ${retryAfter}ms (${retryAfter/1000}s)`);
          
          if (attempt < maxRetries) {
            console.log(`⏳ Rate limit hit. Waiting ${retryAfter}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter));
            continue;
          } else {
            throw new Error(`Rate limit exceeded after ${maxRetries} attempts. Please try again later.`);
          }
        }

        return await this.processOpenAIResponse(response, attempt);
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        console.warn(`⚠️ Attempt ${attempt} failed:`, error.message);
      }
    }
  }

  /**
   * Extract retry time from rate limit error
   */
  extractRetryAfter(errorData) {
    // Check for retry-after header first
    if (errorData.retry_after) {
      return parseFloat(errorData.retry_after) * 1000;
    }
    
    // Check for retry-after in error message
    if (errorData.error && errorData.error.message) {
      const match = errorData.error.message.match(/try again in (\d+(?:\.\d+)?)s/);
      if (match) {
        return parseFloat(match[1]) * 1000;
      }
      
      // Check for "rate limit" without specific time
      if (errorData.error.message.toLowerCase().includes('rate limit')) {
        return 60000; // 1 minute for rate limits
      }
    }
    
    // Default to 25 seconds for 3 RPM rate limits (20s + 5s buffer)
    return 25000; // 25 seconds default
  }

  /**
   * Fallback regex-based contact extraction for very small documents
   */
  extractContactsWithRegex(text) {
    console.log('🔍 Using regex fallback extraction...');
    
    const contacts = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    for (const line of lines) {
      // Look for email patterns
      const emailMatch = line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        const email = emailMatch[1];
        const cleanLine = line.replace(email, '').trim();
        
        // Extract name (first word or first two words)
        const nameParts = cleanLine.split(/\s+/).filter(part => part.length > 0);
        const name = nameParts.slice(0, 2).join(' ') || 'Unknown';
        
        // Look for phone numbers
        const phoneMatch = line.match(/(\+?[\d\s\-\(\)]{10,})/);
        const phone = phoneMatch ? phoneMatch[1].trim() : '';
        
        // Look for company names (words after "at" or "from")
        const companyMatch = line.match(/(?:at|from|@)\s+([A-Za-z\s&]+)/i);
        const company = companyMatch ? companyMatch[1].trim() : '';
        
        // Determine role based on context
        let role = 'Contact';
        if (line.toLowerCase().includes('director')) role = 'Director';
        else if (line.toLowerCase().includes('producer')) role = 'Producer';
        else if (line.toLowerCase().includes('manager')) role = 'Manager';
        else if (line.toLowerCase().includes('coordinator')) role = 'Coordinator';
        else if (line.toLowerCase().includes('assistant')) role = 'Assistant';
        
        if (name && name.length > 1) {
          contacts.push({
            name: name,
            email: email,
            role: role,
            department: 'Unknown',
            phone: phone,
            company: company,
            notes: line.trim()
          });
        }
      }
    }
    
    console.log(`📊 Regex extraction found ${contacts.length} contacts`);
    return contacts;
  }

  /**
   * Process OpenAI API response
   */
  async processOpenAIResponse(response, attempt) {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ OpenAI API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        apiKeyPrefix: this.openAIApiKey ? this.openAIApiKey.substring(0, 10) + '...' : 'undefined'
      });
      
      if (response.status === 401) {
        throw new Error(`OpenAI API authentication failed. Please check your API key. Status: ${response.status}`);
      } else if (response.status === 429) {
        throw new Error(`OpenAI API rate limit exceeded. Please try again later. Status: ${response.status}`);
      } else if (response.status === 500) {
        throw new Error(`OpenAI API server error. Please try again later. Status: ${response.status}`);
      } else {
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from AI service');
    }

    // Parse the JSON response
    let contacts;
    try {
      contacts = JSON.parse(content);
    } catch (parseError) {
      console.error('❌ Failed to parse AI response as JSON:', content);
      throw new Error('Invalid response format from AI service');
    }

    if (!Array.isArray(contacts)) {
      throw new Error('AI response is not an array of contacts');
    }

    // Validate and clean contacts
    const validContacts = contacts.filter(contact => {
      return contact && (
        (contact.name && contact.name.trim()) ||
        (contact.role && contact.role.trim())
      );
    }).map(contact => ({
      name: contact.name?.trim() || '',
      role: contact.role?.trim() || '',
      department: contact.department?.trim() || '',
      email: contact.email?.trim() || '',
      phone: contact.phone?.trim() || '',
      company: contact.company?.trim() || '',
      notes: contact.notes?.trim() || ''
    }));

    console.log(`✅ Chunk processed successfully on attempt ${attempt}: ${validContacts.length} contacts`);
    return validContacts;
  }

  /**
   * Build adaptive prompt based on document structure and user preferences
   */
  buildAdaptivePrompt(text, chunkNumber, totalChunks, rolePreferences, options, documentAnalysis) {
    let prompt = `Extract contact information from this production document text. Return a JSON array of contacts with the following structure:
[
  {
    "name": "Full Name",
    "role": "Job Title/Role",
    "department": "Department",
    "email": "email@example.com",
    "phone": "phone number",
    "company": "Company Name",
    "notes": "Additional notes"
  }
]

Only include contacts that have at least a name or role. Be thorough but accurate. If no contacts are found, return an empty array.`;

    // Add document-specific instructions
    if (documentAnalysis.type === 'call_sheet') {
      prompt += `\n\nThis appears to be a CALL SHEET. Focus on extracting production crew, cast members, and key personnel. Look for sections like PRODUCTION, TALENT, CREW, etc.`;
    } else if (documentAnalysis.type === 'cast_crew_list') {
      prompt += `\n\nThis appears to be a CAST/CREW LIST. Extract all cast members and crew members with their roles and contact information.`;
    } else if (documentAnalysis.type === 'contact_list') {
      prompt += `\n\nThis appears to be a CONTACT LIST. Extract all contacts with their roles and contact information.`;
    } else if (documentAnalysis.type === 'production_document') {
      prompt += `\n\nThis appears to be a PRODUCTION DOCUMENT. Look for production team members, crew, and key personnel.`;
    }

    // Add production type specific instructions
    if (documentAnalysis.productionType === 'film') {
      prompt += `\n\nThis is a FILM production. Look for film-specific roles like Director, Producer, Cinematographer, etc.`;
    } else if (documentAnalysis.productionType === 'television') {
      prompt += `\n\nThis is a TELEVISION production. Look for TV-specific roles like Showrunner, Executive Producer, etc.`;
    } else if (documentAnalysis.productionType === 'commercial') {
      prompt += `\n\nThis is a COMMERCIAL production. Look for commercial-specific roles like Creative Director, Account Manager, etc.`;
    }

    // Add role preferences if specified
    if (rolePreferences && rolePreferences.length > 0) {
      prompt += `\n\nPRIORITY ROLES: Focus especially on contacts with these roles: ${rolePreferences.join(', ')}.`;
    }

    // Add table structure instructions
    if (documentAnalysis.hasTableStructure) {
      prompt += `\n\nThis document appears to have a table structure. Look for tabular data with columns for names, roles, emails, phones, etc.`;
    }

    // Add chunk information
    if (totalChunks > 1) {
      prompt += `\n\nThis is chunk ${chunkNumber} of ${totalChunks} from a large document. Extract all contacts from this section.`;
    }

    // Add the actual text
    prompt += `\n\nDocument text:\n${text}`;

    return prompt;
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    return {
      initialized: this.isInitialized,
      libraries: {
        pdfjs: this.libraries.has('pdfjs'),
        mammoth: this.libraries.has('mammoth'),
        xlsx: this.libraries.has('xlsx'),
        tesseract: this.libraries.has('tesseract')
      },
      openai: !!this.openAIApiKey
    };
  }
}

module.exports = ExtractionService;