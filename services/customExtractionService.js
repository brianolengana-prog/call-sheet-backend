/**
 * Enterprise-Grade Custom Contact Extraction Service
 * 
 * This service provides AI-free, production-ready contact extraction
 * with advanced pattern matching, document intelligence, and validation.
 * 
 * Architecture:
 * - Document Analysis Layer
 * - Pattern Extraction Engine
 * - Production Intelligence Layer
 * - Validation & Quality Control
 * - OCR Integration
 * - Confidence Scoring
 */

const fs = require('fs');
const path = require('path');

// Import extraction modules
const DocumentAnalyzer = require('./extraction/documentAnalyzer');
const PatternExtractor = require('./extraction/patternExtractor');
const ProductionIntelligence = require('./extraction/productionIntelligence');
const ContactValidator = require('./extraction/contactValidator');
const ConfidenceScorer = require('./extraction/confidenceScorer');
const OCRProcessor = require('./extraction/ocrProcessor');

class CustomExtractionService {
  constructor() {
    this.documentAnalyzer = new DocumentAnalyzer();
    this.patternExtractor = new PatternExtractor();
    this.productionIntelligence = new ProductionIntelligence();
    this.validator = new ContactValidator();
    this.confidenceScorer = new ConfidenceScorer();
    this.ocrProcessor = new OCRProcessor();
    
    // Initialize processing libraries
    this.initializeLibraries();
  }

  /**
   * Initialize required libraries for document processing
   */
  async initializeLibraries() {
    try {
      // PDF processing
      this.pdfjs = require('pdfjs-dist');
      
      // Word document processing
      this.mammoth = require('mammoth');
      
      // Excel processing
      this.xlsx = require('xlsx');
      
      // OCR processing
      this.tesseract = require('tesseract.js');
      
      console.log('✅ Custom extraction libraries initialized');
    } catch (error) {
      console.warn('⚠️ Some custom extraction libraries not available:', error.message);
    }
  }

  /**
   * Main extraction method - orchestrates the entire process
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {string} mimeType - MIME type of the file
   * @param {string} fileName - Original file name
   * @param {Object} options - Extraction options
   * @returns {Object} Extraction result with contacts and metadata
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    const startTime = Date.now();
    console.log('🚀 Starting custom contact extraction...');
    console.log('📁 File:', fileName, 'Type:', mimeType, 'Size:', fileBuffer.length);

    try {
      // Step 1: Document Analysis
      const documentAnalysis = await this.documentAnalyzer.analyzeDocument(fileBuffer, mimeType, fileName);
      console.log('📋 Document analysis:', documentAnalysis);

      // Step 2: Text Extraction
      const extractedText = await this.extractTextFromDocument(fileBuffer, mimeType, fileName);
      console.log('📄 Text extracted, length:', extractedText.length);

      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error('Could not extract meaningful text from document');
      }

      // Step 3: Pattern-Based Contact Extraction
      const rawContacts = await this.patternExtractor.extractContacts(extractedText, documentAnalysis);
      console.log('🔍 Raw contacts found:', rawContacts.length);

      // Step 4: Production Intelligence Processing
      const processedContacts = await this.productionIntelligence.processContacts(rawContacts, documentAnalysis, options);
      console.log('🎬 Production processing complete:', processedContacts.length);

      // Step 5: Validation and Quality Control
      const validatedContacts = await this.validator.validateContacts(processedContacts);
      console.log('✅ Validation complete:', validatedContacts.length);

      // Step 6: Confidence Scoring
      const scoredContacts = await this.confidenceScorer.scoreContacts(validatedContacts, documentAnalysis);
      console.log('📊 Confidence scoring complete');

      // Step 7: Deduplication
      const uniqueContacts = this.deduplicateContacts(scoredContacts);
      console.log('🔄 Deduplication complete:', uniqueContacts.length);

      const processingTime = Date.now() - startTime;
      console.log(`⏱️ Custom extraction completed in ${processingTime}ms`);

      return {
        success: true,
        contacts: uniqueContacts,
        metadata: {
          extractionMethod: 'custom',
          processingTime: processingTime,
          documentType: documentAnalysis.type,
          productionType: documentAnalysis.productionType,
          totalContacts: uniqueContacts.length,
          averageConfidence: this.calculateAverageConfidence(uniqueContacts),
          qualityScore: this.calculateQualityScore(uniqueContacts)
        },
        usage: {
          documentsProcessed: 1,
          contactsExtracted: uniqueContacts.length,
          processingTime: processingTime
        }
      };

    } catch (error) {
      console.error('❌ Custom extraction failed:', error);
      return {
        success: false,
        error: error.message,
        contacts: [],
        metadata: {
          extractionMethod: 'custom',
          error: error.message
        }
      };
    }
  }

  /**
   * Extract text from various document formats
   */
  async extractTextFromDocument(fileBuffer, mimeType, fileName) {
    try {
      switch (mimeType) {
        case 'application/pdf':
          try {
            return await this.extractTextFromPDF(fileBuffer);
          } catch (pdfError) {
            console.warn('⚠️ PDF extraction failed, trying fallback method...');
            // Try to extract as plain text as fallback
            try {
              return fileBuffer.toString('utf8');
            } catch (fallbackError) {
              console.error('❌ PDF fallback extraction also failed:', fallbackError);
              throw pdfError; // Throw original PDF error
            }
          }
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await this.extractTextFromDOCX(fileBuffer);
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
          return await this.extractTextFromXLSX(fileBuffer);
        case 'application/vnd.ms-excel':
          return await this.extractTextFromXLS(fileBuffer);
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
          return await this.extractTextFromPPTX(fileBuffer);
        case 'text/csv':
        case 'application/csv':
          // Treat CSV as UTF-8 text for pattern extraction
          return fileBuffer.toString('utf8');
        case 'image/jpeg':
        case 'image/png':
        case 'image/tiff':
        case 'image/bmp':
          return await this.extractTextFromImage(fileBuffer);
        default:
          // Try to extract as plain text
          return fileBuffer.toString('utf8');
      }
    } catch (error) {
      console.error('❌ Text extraction failed:', error);
      throw new Error(`Text extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF documents
   */
  async extractTextFromPDF(fileBuffer) {
    try {
      // Ensure pdfjs receives a pure Uint8Array (not Node Buffer)
      let data;
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer(fileBuffer)) {
        data = new Uint8Array(fileBuffer);
      } else if (fileBuffer instanceof Uint8Array) {
        // Clone to plain Uint8Array to avoid Buffer subclass issues
        data = new Uint8Array(fileBuffer);
      } else if (typeof fileBuffer === 'string') {
        data = new Uint8Array(Buffer.from(fileBuffer, 'binary'));
      } else if (fileBuffer && fileBuffer.buffer) {
        data = new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset || 0, fileBuffer.byteLength || fileBuffer.length || undefined);
      } else {
        data = new Uint8Array(fileBuffer);
      }

      // Try with different PDF.js options for better compatibility
      const loadingTask = this.pdfjs.getDocument({
        data: data,
        verbosity: 0, // Reduce console output
        disableAutoFetch: true,
        disableStream: true,
        disableRange: true,
        // Add fallback options for problematic PDFs
        cMapUrl: null,
        cMapPacked: false,
        standardFontDataUrl: null
      });
      
      const pdf = await loadingTask.promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        } catch (pageError) {
          console.warn(`⚠️ Failed to extract text from page ${i}:`, pageError.message);
          // Continue with other pages
        }
      }

      if (fullText.trim().length === 0) {
        throw new Error('No text content found in PDF');
      }

      return fullText;
    } catch (error) {
      console.error('❌ PDF extraction failed:', error);
      throw new Error(`PDF text extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from Word documents
   */
  async extractTextFromDOCX(fileBuffer) {
    try {
      const result = await this.mammoth.extractRawText({ buffer: fileBuffer });
      return result.value;
    } catch (error) {
      console.error('❌ DOCX extraction failed:', error);
      throw new Error(`DOCX text extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from Excel documents
   */
  async extractTextFromXLSX(fileBuffer) {
    try {
      const workbook = this.xlsx.read(fileBuffer, { type: 'buffer' });
      let fullText = '';

      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetData = this.xlsx.utils.sheet_to_json(worksheet, { header: 1 });
        
        sheetData.forEach(row => {
          if (Array.isArray(row)) {
            fullText += row.join(' ') + '\n';
          }
        });
      });

      return fullText;
    } catch (error) {
      console.error('❌ XLSX extraction failed:', error);
      throw new Error(`XLSX text extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from legacy Excel documents
   */
  async extractTextFromXLS(fileBuffer) {
    try {
      const workbook = this.xlsx.read(fileBuffer, { type: 'buffer' });
      let fullText = '';

      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetData = this.xlsx.utils.sheet_to_json(worksheet, { header: 1 });
        
        sheetData.forEach(row => {
          if (Array.isArray(row)) {
            fullText += row.join(' ') + '\n';
          }
        });
      });

      return fullText;
    } catch (error) {
      console.error('❌ XLS extraction failed:', error);
      throw new Error(`XLS text extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from PowerPoint documents
   */
  async extractTextFromPPTX(fileBuffer) {
    try {
      // For now, return a placeholder - PowerPoint extraction is complex
      // In production, you'd use a library like 'pptx2json' or 'officegen'
      console.log('⚠️ PowerPoint extraction not fully implemented');
      return 'PowerPoint content extraction not available';
    } catch (error) {
      console.error('❌ PPTX extraction failed:', error);
      throw new Error(`PPTX text extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from images using OCR
   */
  async extractTextFromImage(fileBuffer) {
    try {
      const { data: { text } } = await this.tesseract.recognize(fileBuffer, 'eng', {
        logger: m => console.log('OCR:', m)
      });
      return text;
    } catch (error) {
      console.error('❌ OCR extraction failed:', error);
      throw new Error(`OCR text extraction failed: ${error.message}`);
    }
  }

  /**
   * Remove duplicate contacts based on email and name similarity
   */
  deduplicateContacts(contacts) {
    const uniqueContacts = [];
    const seenEmails = new Set();
    const seenNames = new Set();

    for (const contact of contacts) {
      const email = contact.email?.toLowerCase();
      const name = contact.name?.toLowerCase();

      // Check for exact email match
      if (email && seenEmails.has(email)) {
        continue;
      }

      // Check for similar name match (fuzzy matching) - only for very similar names
      if (name && this.isSimilarName(name, Array.from(seenNames))) {
        // Only skip if it's a very close match (95% similarity) to avoid false positives
        continue;
      }

      // Add to unique contacts
      if (email) seenEmails.add(email);
      if (name) seenNames.add(name);
      uniqueContacts.push(contact);
    }

    return uniqueContacts;
  }

  /**
   * Check if a name is similar to existing names (fuzzy matching)
   */
  isSimilarName(name, existingNames) {
    for (const existingName of existingNames) {
      const similarity = this.calculateStringSimilarity(name, existingName);
      if (similarity > 0.95) { // 95% similarity threshold - only remove very close matches
        return true;
      }
    }
    return false;
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
   * Calculate average confidence score for contacts
   */
  calculateAverageConfidence(contacts) {
    if (contacts.length === 0) return 0;
    
    const totalConfidence = contacts.reduce((sum, contact) => sum + (contact.confidence || 0), 0);
    return Math.round((totalConfidence / contacts.length) * 100) / 100;
  }

  /**
   * Calculate overall quality score for the extraction
   */
  calculateQualityScore(contacts) {
    if (contacts.length === 0) return 0;
    
    const scores = contacts.map(contact => {
      let score = 0;
      if (contact.email) score += 30;
      if (contact.name && contact.name.length > 2) score += 25;
      if (contact.phone) score += 20;
      if (contact.role && contact.role !== 'Contact') score += 15;
      if (contact.company) score += 10;
      return score;
    });
    
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return Math.round(averageScore);
  }
}

module.exports = CustomExtractionService;
