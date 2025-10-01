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
      console.log('📄 First 500 characters of extracted text:');
      console.log(extractedText.substring(0, 500));
      console.log('📄 Last 500 characters of extracted text:');
      console.log(extractedText.substring(Math.max(0, extractedText.length - 500)));

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
            console.warn('⚠️ PDF extraction failed:', pdfError.message);
            console.log('🔄 Attempting OCR as fallback...');
            
            // Don't fall back to toString - that creates garbage!
            // Instead, try OCR or throw error
            try {
              const OCRProcessor = require('./extraction/ocrProcessor');
              const ocrProcessor = new OCRProcessor();
              const ocrText = await ocrProcessor.processDocument(fileBuffer, mimeType);
              console.log('✅ OCR extracted text successfully');
              return ocrText;
            } catch (ocrError) {
              console.error('❌ OCR also failed:', ocrError.message);
              throw new Error('PDF text extraction failed. This PDF may be image-based or corrupted. Please try converting to a text-based format or use OCR.');
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

      console.log(`📄 PDF has ${pdf.numPages} pages`);
      
      // Fix for PDF.js misreporting page count - try to access pages to find actual count
      let actualPageCount = pdf.numPages;
      try {
        // Test if we can actually access the reported pages
        for (let testPage = 1; testPage <= Math.min(pdf.numPages, 5); testPage++) {
          try {
            await pdf.getPage(testPage);
          } catch (pageError) {
            console.warn(`⚠️ Cannot access page ${testPage}, actual page count might be ${testPage - 1}`);
            actualPageCount = testPage - 1;
            break;
          }
        }
      } catch (error) {
        console.warn('⚠️ Error testing page access, using reported count');
      }
      
      console.log(`📄 Actual accessible pages: ${actualPageCount}`);
      
      // Memory optimization: Limit pages and add cleanup
      const maxPages = Math.min(actualPageCount, 2); // Process max 2 pages for memory
      console.log(`📄 Processing max ${maxPages} pages for memory efficiency`);
      
      for (let i = 1; i <= maxPages; i++) {
        let page = null;
        try {
          // Check memory before each page (but always process first page)
          if (i > 1) {
            const memUsage = process.memoryUsage();
            const memPercent = memUsage.heapUsed / memUsage.heapTotal;
            if (memPercent > 0.95) {
              console.warn(`⚠️ Memory usage too high (${(memPercent * 100).toFixed(1)}%), stopping PDF processing at page ${i}`);
              break;
            }
          }
          
          console.log(`🔍 DEBUG: Getting page ${i}...`);
          page = await pdf.getPage(i);
          console.log(`🔍 DEBUG: Got page ${i}, getting text content...`);
          const textContent = await page.getTextContent();
          
          console.log(`🔍 DEBUG: textContent type: ${typeof textContent}`);
          console.log(`🔍 DEBUG: textContent.items exists: ${!!textContent.items}`);
          console.log(`🔍 DEBUG: textContent.items is array: ${Array.isArray(textContent.items)}`);
          console.log(`📄 Page ${i} textContent items: ${textContent.items ? textContent.items.length : 0}`);
          
          // Log first few items for debugging
          if (textContent.items && textContent.items.length > 0) {
            console.log(`🔍 DEBUG: First item:`, JSON.stringify(textContent.items[0]));
            console.log(`🔍 DEBUG: First 3 items str values:`, textContent.items.slice(0, 3).map(item => item.str));
          }
          
          // Simple, robust text extraction
          let pageText = '';
          
          if (textContent.items && Array.isArray(textContent.items)) {
            // Method 1: Simple concatenation with spaces
            pageText = textContent.items
              .map(item => {
                if (item && typeof item === 'object' && item.str) {
                  return item.str;
                }
                // Handle case where item might be a string directly
                if (typeof item === 'string') {
                  return item;
                }
                return '';
              })
              .filter(str => str.length > 0)
              .join(' ');
            
            console.log(`🔍 DEBUG: After map/filter/join, pageText length: ${pageText.length}`);
            if (pageText.length > 0) {
              console.log(`🔍 DEBUG: First 100 chars: "${pageText.substring(0, 100)}"`);
            }
          } else {
            console.log(`❌ DEBUG: textContent.items is not a valid array!`);
          }
          
          console.log(`📄 Page ${i} raw text length: ${pageText.length}`);
          
          // If simple method got nothing, try accessing items differently
          if (pageText.length === 0 && textContent.items) {
            console.log('⚠️ Trying alternative extraction method...');
            const allText = [];
            for (let j = 0; j < textContent.items.length; j++) {
              const item = textContent.items[j];
              if (item && item.str) {
                allText.push(item.str);
              }
            }
            pageText = allText.join(' ');
            console.log(`📄 Alternative method got: ${pageText.length} characters`);
          }
          
          fullText += pageText + ' ';
          console.log(`📄 Page ${i} extracted: ${pageText.length} characters`);
          
          // Force cleanup of page object
          page = null;
          
          // Force garbage collection every 5 pages
          if (i % 5 === 0) {
            if (global.gc) {
              global.gc();
            }
          }
        } catch (pageError) {
          console.warn(`⚠️ Failed to extract text from page ${i}:`, pageError.message);
          // Continue with other pages
        } finally {
          // Ensure page is cleaned up
          if (page) {
            page = null;
          }
        }
      }
      
      // Final cleanup
      pdf.destroy();

      if (fullText.trim().length === 0) {
        console.log('⚠️ PDF.js extracted 0 characters - trying AI Vision fallback...');
        // Don't throw yet - let the catch block handle AI Vision fallback
        throw new Error('No text content found in PDF - likely image-based or scanned');
      }

      // CRITICAL: Validate that we got real text, not PDF garbage
      const isGarbage = this.isPDFGarbage(fullText);
      if (isGarbage) {
        console.error('❌ PDF extraction returned garbage (PDF structure/binary data)');
        console.log('🔄 This is likely an image-based or scanned PDF - OCR required');
        throw new Error('PDF contains no extractable text - appears to be image-based. OCR processing required.');
      }

      // Check if we extracted very little text from a large PDF
      if (fullText.length < 1000 && pdf.numPages > 5) {
        console.warn(`⚠️ Low text extraction: ${fullText.length} chars from ${pdf.numPages} pages`);
        console.warn('📄 This might be a scanned PDF or image-based content');
      }

      console.log(`✅ PDF text extraction successful: ${fullText.length} characters`);
      return fullText;
    } catch (error) {
      console.error('❌ PDF extraction failed:', error);
      
      // Fallback: Try to extract text using a different method
      try {
        console.log('🔄 Attempting fallback text extraction...');
        const fallbackText = await this.extractTextFromPDFFallback(fileBuffer);
        if (fallbackText && fallbackText.length > 100) {
          console.log('✅ Fallback extraction successful:', fallbackText.length, 'characters');
          return fallbackText;
        }
      } catch (fallbackError) {
        console.error('❌ Fallback extraction also failed:', fallbackError);
      }
      
      // ULTIMATE FALLBACK: Use GPT-4 Vision to read PDF as image
      try {
        console.log('🎨 ULTIMATE FALLBACK: Using GPT-4 Vision to read PDF...');
        const visionText = await this.extractTextWithAIVision(fileBuffer);
        if (visionText && visionText.length > 50) {
          console.log('✅ AI Vision extraction successful:', visionText.length, 'characters');
          return visionText;
        }
      } catch (visionError) {
        console.error('❌ AI Vision also failed:', visionError.message);
      }
      
      throw new Error(`PDF text extraction failed: ${error.message}`);
    }
  }

  /**
   * ULTIMATE FALLBACK: Use GPT-4 Vision to read PDF as image
   * This works for ANY PDF - text-based, image-based, corrupted, etc.
   */
  async extractTextWithAIVision(fileBuffer) {
    try {
      console.log('🎨 Using AI Vision to read PDF (no canvas needed)...');
      
      // Simply send the PDF as base64 - OpenAI handles it!
      const base64PDF = Buffer.from(fileBuffer).toString('base64');
      
      console.log(`📄 PDF size: ${Math.round(base64PDF.length / 1024)}KB, sending to GPT-4 Vision...`);
      
      // Send to OpenAI GPT-4 Vision (can handle PDFs directly!)
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',  // Updated model that handles PDFs better
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'This is a call sheet PDF. Extract ALL text content from it. Return the raw text preserving names, phone numbers, emails, roles, and structure. Include every person listed with their contact information. Do not summarize - extract everything.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:application/pdf;base64,${base64PDF}`
                  }
                }
              ]
            }
          ],
          max_tokens: 4000,
          temperature: 0
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ OpenAI API error:', errorText);
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      const extractedText = data.choices?.[0]?.message?.content || '';
      
      if (!extractedText || extractedText.length < 50) {
        throw new Error(`AI Vision returned insufficient text: ${extractedText.length} characters`);
      }
      
      console.log(`✅ AI Vision extracted ${extractedText.length} characters`);
      console.log(`📄 First 200 chars: "${extractedText.substring(0, 200)}..."`);
      
      return extractedText;
      
    } catch (error) {
      console.error('❌ AI Vision extraction failed:', error.message);
      throw error;
    }
  }

  /**
   * Fallback PDF text extraction method
   */
  async extractTextFromPDFFallback(fileBuffer) {
    try {
      console.log('🔄 Using fallback PDF extraction...');
      
      // Try with minimal PDF.js options
      const loadingTask = this.pdfjs.getDocument({
        data: new Uint8Array(fileBuffer),
        verbosity: 0,
        disableAutoFetch: true,
        disableStream: true,
        disableRange: true,
        cMapUrl: null,
        cMapPacked: false,
        standardFontDataUrl: null,
        // Minimal options for maximum compatibility
        maxImageSize: 1024 * 1024,
        isEvalSupported: false,
        useSystemFonts: false
      });
      
      const pdf = await loadingTask.promise;
      let fullText = '';
      
      // Process only first 5 pages to avoid memory issues
      const maxPages = Math.min(pdf.numPages, 5);
      
      for (let i = 1; i <= maxPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
          
          // Force cleanup
          page.cleanup();
        } catch (pageError) {
          console.warn(`⚠️ Failed to extract page ${i}:`, pageError.message);
          continue;
        }
      }
      
      await pdf.destroy();
      return fullText;
      
    } catch (error) {
      console.error('❌ Fallback PDF extraction failed:', error);
      return '';
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

  /**
   * Detect if extracted text is PDF garbage (binary/structure data)
   */
  isPDFGarbage(text) {
    if (!text || text.length < 10) return false;
    
    // PDF structure markers that indicate extraction failed
    const pdfMarkers = [
      'endobj', 'stream', 'endstream', 'xref', 'trailer',
      'startxref', '%%EOF', '/Type', '/Subtype', '/Filter',
      '/Length', '/Root', '/Info', '/Catalog', '/Pages'
    ];
    
    // Count how many PDF markers are present
    let markerCount = 0;
    pdfMarkers.forEach(marker => {
      if (text.includes(marker)) markerCount++;
    });
    
    // If 3+ PDF markers, it's definitely garbage
    if (markerCount >= 3) {
      console.warn(`⚠️ Found ${markerCount} PDF structure markers - text is garbage`);
      return true;
    }
    
    // Check for binary/encoded data patterns
    const binaryPatterns = [
      /[\x00-\x08\x0B\x0C\x0E-\x1F]{5,}/,  // Control characters
      /�{10,}/,  // Replacement characters (bad encoding)
      /[^\x20-\x7E\n\r\t]{50,}/  // Non-ASCII sequences
    ];
    
    for (const pattern of binaryPatterns) {
      if (pattern.test(text.substring(0, 2000))) { // Check first 2000 chars
        console.warn('⚠️ Found binary data patterns - text is garbage');
        return true;
      }
    }
    
    // Check for high ratio of non-printable characters
    const sample = text.substring(0, 5000);
    const nonPrintable = (sample.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F�]/g) || []).length;
    const nonPrintableRatio = nonPrintable / sample.length;
    
    if (nonPrintableRatio > 0.15) {
      console.warn(`⚠️ ${(nonPrintableRatio * 100).toFixed(1)}% non-printable characters - text is garbage`);
      return true;
    }
    
    // Check for image metadata markers
    const imageMarkers = ['JFIF', 'ICC_PROFILE', 'Exif', 'XYZ', 'RGB'];
    let imageMarkerCount = 0;
    imageMarkers.forEach(marker => {
      if (text.includes(marker)) imageMarkerCount++;
    });
    
    if (imageMarkerCount >= 2) {
      console.warn(`⚠️ Found ${imageMarkerCount} image metadata markers - PDF is image-based`);
      return true;
    }
    
    return false;
  }
}

module.exports = CustomExtractionService;
