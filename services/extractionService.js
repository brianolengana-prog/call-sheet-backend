/**
 * Enhanced Call Sheet Extraction Service
 * Handles AI-powered contact extraction from call sheets with advanced document processing
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
    
    // Document processing libraries (will be loaded dynamically)
    this.libraries = {
      pdfjs: null,
      mammoth: null,
      xlsx: null,
      tesseract: null
    };
  }

  /**
   * Initialize document processing libraries
   */
  async initializeLibraries() {
    try {
      // Load PDF processing
      this.libraries.pdfjs = require('pdfjs-dist');
      
      // Load Word document processing
      this.libraries.mammoth = require('mammoth');
      
      // Load Excel processing
      this.libraries.xlsx = require('xlsx');
      
      // Load OCR processing
      this.libraries.tesseract = require('tesseract.js');
      
      console.log('✅ Document processing libraries loaded');
    } catch (error) {
      console.warn('⚠️ Some document processing libraries not available:', error.message);
    }
  }

  /**
   * Process uploaded file and extract text
   */
  async processFile(filePath, mimeType) {
    try {
      const fileExtension = path.extname(filePath).toLowerCase();
      const buffer = await fs.readFile(filePath);
      
      console.log(`📄 Processing file: ${filePath} (${mimeType})`);
      
      // PDF processing
      if (mimeType === 'application/pdf' || fileExtension === '.pdf') {
        return await this.extractTextFromPDF(buffer);
      }
      
      // Word documents
      if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileExtension === '.docx') {
        return await this.extractTextFromDOCX(buffer);
      }
      
      // Legacy Word documents
      if (mimeType === 'application/msword' || fileExtension === '.doc') {
        return await this.extractTextFromDOC(buffer);
      }
      
      // Excel files
      if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || fileExtension === '.xlsx') {
        return await this.extractTextFromXLSX(buffer);
      }
      
      // Legacy Excel files
      if (mimeType === 'application/vnd.ms-excel' || fileExtension === '.xls') {
        return await this.extractTextFromXLS(buffer);
      }
      
      // PowerPoint files
      if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || fileExtension === '.pptx') {
        return await this.extractTextFromPPTX(buffer);
      }
      
      // CSV files
      if (mimeType === 'text/csv' || fileExtension === '.csv') {
        return await this.extractTextFromCSV(buffer);
      }
      
      // RTF files
      if (mimeType === 'application/rtf' || fileExtension === '.rtf') {
        return await this.extractTextFromRTF(buffer);
      }
      
      // Image files (OCR)
      if (mimeType.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(fileExtension)) {
        return await this.extractTextFromImage(buffer);
      }
      
      // Plain text files
      if (mimeType === 'text/plain' || fileExtension === '.txt') {
        return buffer.toString('utf-8');
      }
      
      throw new Error(`Unsupported file type: ${mimeType}`);
      
    } catch (error) {
      console.error('❌ File processing error:', error);
      throw new Error(`File processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF
   */
  async extractTextFromPDF(buffer) {
    if (!this.libraries.pdfjs) {
      throw new Error('PDF processing library not available');
    }
    
    try {
      const pdf = await this.libraries.pdfjs.getDocument({ data: buffer }).promise;
      let fullText = '';
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .filter(item => 'str' in item)
          .map(item => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      
      console.log('📄 PDF processed successfully');
      return fullText.trim();
    } catch (error) {
      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from DOCX
   */
  async extractTextFromDOCX(buffer) {
    if (!this.libraries.mammoth) {
      throw new Error('DOCX processing library not available');
    }
    
    try {
      const result = await this.libraries.mammoth.extractRawText({ buffer });
      console.log('📄 DOCX processed successfully');
      return result.value;
    } catch (error) {
      throw new Error(`DOCX processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from legacy DOC
   */
  async extractTextFromDOC(buffer) {
    // Basic text extraction for .doc files
    const uint8Array = new Uint8Array(buffer);
    let text = '';
    
    for (let i = 0; i < uint8Array.length; i++) {
      if (uint8Array[i] >= 32 && uint8Array[i] <= 126) {
        text += String.fromCharCode(uint8Array[i]);
      } else if (uint8Array[i] === 10 || uint8Array[i] === 13) {
        text += '\n';
      }
    }
    
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    console.log('📄 Legacy DOC processed successfully');
    return cleanedText;
  }

  /**
   * Extract text from XLSX
   */
  async extractTextFromXLSX(buffer) {
    if (!this.libraries.xlsx) {
      throw new Error('XLSX processing library not available');
    }
    
    try {
      const workbook = this.libraries.xlsx.read(buffer, { type: 'buffer' });
      let fullText = '';
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetText = this.libraries.xlsx.utils.sheet_to_txt(worksheet);
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
   * Extract text from legacy XLS
   */
  async extractTextFromXLS(buffer) {
    if (!this.libraries.xlsx) {
      throw new Error('XLS processing library not available');
    }
    
    try {
      const workbook = this.libraries.xlsx.read(buffer, { type: 'buffer' });
      let fullText = '';
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetText = this.libraries.xlsx.utils.sheet_to_txt(worksheet);
        if (sheetText.trim()) {
          fullText += `\n--- Sheet: ${sheetName} ---\n${sheetText}\n`;
        }
      });
      
      console.log('📊 Legacy XLS processed successfully');
      return fullText.trim();
    } catch (error) {
      throw new Error(`XLS processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from PPTX
   */
  async extractTextFromPPTX(buffer) {
    if (!this.libraries.xlsx) {
      throw new Error('PPTX processing library not available');
    }
    
    try {
      const workbook = this.libraries.xlsx.read(buffer, { type: 'buffer' });
      let fullText = '';
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetText = this.libraries.xlsx.utils.sheet_to_txt(worksheet);
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
   * Extract text from CSV
   */
  async extractTextFromCSV(buffer) {
    const text = buffer.toString('utf-8');
    console.log('📄 CSV processed successfully');
    return text;
  }

  /**
   * Extract text from RTF
   */
  async extractTextFromRTF(buffer) {
    const text = buffer.toString('utf-8');
    // Basic RTF text extraction (remove RTF formatting codes)
    const cleanedText = text
      .replace(/\\[a-z]+\d*\s?/g, '') // Remove RTF commands
      .replace(/[{}]/g, '') // Remove braces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    console.log('📄 RTF processed successfully');
    return cleanedText;
  }

  /**
   * Extract text from image using OCR
   */
  async extractTextFromImage(buffer) {
    if (!this.libraries.tesseract) {
      throw new Error('OCR processing library not available');
    }
    
    try {
      const { createWorker } = this.libraries.tesseract;
      const worker = await createWorker('eng', 1);
      const { data: { text } } = await worker.recognize(buffer);
      await worker.terminate();
      
      console.log('📄 Image OCR processed successfully');
      return text;
    } catch (error) {
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  /**
   * Classify document type for adaptive processing
   */
  classifyDocumentType(text) {
    const hasTable = /Name\s+Phone\s+Email|Name\s+Role\s+Contact/i.test(text);
    const hasSections = /(PRODUCTION|TALENT|CREW|CLIENTS)/i.test(text);
    const hasNarrative = text.split('\n').length > 20 && !hasTable;
    
    if (hasTable) return 'STRUCTURED_TABLE';
    if (hasSections) return 'SECTIONED';
    if (hasNarrative) return 'NARRATIVE';
    return 'GENERIC';
  }

  /**
   * Detect production type for context-aware extraction
   */
  detectProductionType(text) {
    const textLower = text.toLowerCase();
    if (textLower.includes('photo') || textLower.includes('photographer')) return 'PHOTOGRAPHY';
    if (textLower.includes('video') || textLower.includes('director')) return 'VIDEO';
    if (textLower.includes('fashion') || textLower.includes('model')) return 'FASHION';
    if (textLower.includes('commercial') || textLower.includes('advertising')) return 'COMMERCIAL';
    return 'GENERAL';
  }

  /**
   * Build adaptive prompt based on document and production type
   */
  buildAdaptivePrompt(text, documentType, productionType, rolePreferences, options) {
    const baseInstructions = rolePreferences && rolePreferences.length > 0
      ? `Focus on these specific roles: ${rolePreferences.join(', ')}.`
      : `Extract ALL people mentioned in the call sheet, including but not limited to: Producer, Creative Director, Photographer, Makeup Artist, Stylist, Client Contact, Art Director, Director, Assistant, Talent, etc.`;

    const documentTypeInstructions = {
      'STRUCTURED_TABLE': 'This appears to be a structured table format. Pay special attention to rows and columns.',
      'SECTIONED': 'This document has clear sections. Look for people in each relevant section.',
      'NARRATIVE': 'This is a narrative format. Look for people mentioned throughout the text.',
      'GENERIC': 'Extract all people mentioned regardless of format.'
    };

    const productionTypeInstructions = {
      'PHOTOGRAPHY': 'Focus on photography-related roles: Photographer, Art Director, Stylist, Makeup Artist, Model, etc.',
      'VIDEO': 'Focus on video production roles: Director, Producer, Cinematographer, Editor, etc.',
      'FASHION': 'Focus on fashion industry roles: Stylist, Model, Fashion Director, etc.',
      'COMMERCIAL': 'Focus on commercial production roles: Client, Agency, Creative Director, etc.',
      'GENERAL': 'Extract all relevant production roles.'
    };

    const optionInstructions = (() => {
      const parts = [];
      if (options.includePhoneNumbers) parts.push('Include phone numbers when available');
      if (options.includeEmails) parts.push('Include email addresses when available');
      if (options.includeAddresses) parts.push('Include addresses when available');
      if (options.includeSocialMedia) parts.push('Include social media handles when available');
      return parts.length > 0 ? `Additional requirements: ${parts.join(', ')}.` : '';
    })();

    return `Extract contact information from this production call sheet:

${baseInstructions}
${documentTypeInstructions[documentType] || ''}
${productionTypeInstructions[productionType] || ''}
${optionInstructions}

Return the results as a JSON array of contact objects. Each contact should have this structure:
{
  "name": "Full Name",
  "role": "Job Title/Role",
  "phone": "Phone Number (if available)",
  "email": "Email Address (if available)",
  "company": "Company/Production (if mentioned)",
  "notes": "Any additional notes or context"
}

Call Sheet Content:
${text}

Extract all relevant contacts and return as a valid JSON array.`;
  }

  /**
   * Extract contacts from call sheet text using OpenAI
   */
  async extractContacts(text, rolePreferences = [], options = {}, userId = null) {
    try {
      if (!this.openAIApiKey) {
        throw new Error('OpenAI API key not configured');
      }

      if (!text || text.trim().length < 10) {
        throw new Error('Insufficient text content to process');
      }

      console.log('🔍 Starting enhanced contact extraction...');
      console.log('📄 Text length:', text.length);
      console.log('🎭 Role preferences:', rolePreferences);

      // Check usage limits if userId is provided
      if (userId) {
        const canProcess = await usageService.canPerformAction(userId, 'ai_processing', 1);
        if (!canProcess.canPerform) {
          throw new Error(`Usage limit exceeded: ${canProcess.reason}`);
        }
      }

      // Classify document and production type
      const documentType = this.classifyDocumentType(text);
      const productionType = this.detectProductionType(text);
      
      console.log('📋 Document type:', documentType);
      console.log('🎬 Production type:', productionType);

      // Build adaptive extraction prompt
      const prompt = this.buildAdaptivePrompt(text, documentType, productionType, rolePreferences, options);

      // Call OpenAI API
      const response = await fetch(`${this.openAIBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert AI assistant specialized in extracting contact information from production call sheets. Always return ONLY valid JSON in the specified format. Do not wrap the JSON in markdown code blocks or any other formatting. Return pure JSON that can be parsed directly.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 4000
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ OpenAI API error:', response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content;

      if (!aiResponse) {
        throw new Error('No response from AI service');
      }

      console.log('🤖 AI Response received (first 500 chars):', aiResponse.substring(0, 500));

      // Parse the JSON response
      const contacts = this.parseAIResponse(aiResponse);
      
      console.log('✅ Extraction completed:', contacts.length, 'contacts found');
      
      // Track usage if userId is provided
      if (userId) {
        try {
          const estimatedTokens = data.usage?.total_tokens || Math.ceil(text.length / 4);
          const estimatedMinutes = Math.ceil(estimatedTokens / 1000); // Rough estimate: 1000 tokens = 1 minute
          
          await usageService.incrementUsage(userId, 'ai_processing', estimatedMinutes);
          await usageService.incrementUsage(userId, 'api_call', 1);
          
          console.log('✅ Usage tracked for user:', userId);
        } catch (usageError) {
          console.warn('⚠️ Failed to track usage:', usageError.message);
          // Don't fail the extraction if usage tracking fails
        }
      }
      
      return {
        success: true,
        contacts,
        usage: data.usage
      };

    } catch (error) {
      console.error('❌ Extraction error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build extraction prompt based on text and preferences
   */
  buildExtractionPrompt(text, rolePreferences, options) {
    const roleFilter = rolePreferences && rolePreferences.length > 0
      ? `Only include people with these specific roles: ${rolePreferences.join(', ')}.`
      : `Extract ALL people mentioned in the call sheet, including but not limited to: Producer, Creative Director, Photographer, Makeup Artist, Stylist, Client Contact, Art Director, Director, Assistant, Talent, Catering, Security, Location Manager, etc.`;

    const optionInstructions = (() => {
      const parts = [];
      if (options.includePhoneNumbers) parts.push('Include phone numbers when available');
      if (options.includeEmails) parts.push('Include email addresses when available');
      if (options.includeAddresses) parts.push('Include addresses when available');
      if (options.includeSocialMedia) parts.push('Include social media handles when available');
      return parts.length > 0 ? `Additional requirements: ${parts.join(', ')}.` : '';
    })();

    return `Extract contact information from this production call sheet:

${roleFilter}
${optionInstructions}

Return the results as a JSON array of contact objects. Each contact should have this structure:
{
  "name": "Full Name",
  "role": "Job Title/Role",
  "phone": "Phone Number (if available)",
  "email": "Email Address (if available)",
  "company": "Company/Production (if mentioned)",
  "notes": "Any additional notes or context"
}

Call Sheet Content:
${text}

Extract all relevant contacts and return as a valid JSON array.`;
  }

  /**
   * Parse AI response and extract JSON
   */
  parseAIResponse(response) {
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedResponse = response.trim();
      
      // Remove markdown code blocks
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Parse JSON
      const contacts = JSON.parse(cleanedResponse);
      
      // Validate that it's an array
      if (!Array.isArray(contacts)) {
        throw new Error('AI response is not an array');
      }

      // Validate contact structure
      return contacts.map(contact => ({
        name: contact.name || 'Unknown',
        role: contact.role || 'Unknown',
        phone: contact.phone || '',
        email: contact.email || '',
        company: contact.company || '',
        notes: contact.notes || ''
      }));

    } catch (error) {
      console.error('❌ Failed to parse AI response:', error);
      console.error('❌ Raw response:', response);
      throw new Error('Failed to parse AI response');
    }
  }

  /**
   * Process large documents in chunks
   */
  async processLargeDocument(text, rolePreferences = [], options = {}) {
    const chunkSize = 8000; // Characters per chunk
    const overlap = 500; // Overlap between chunks
    
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      chunks.push(text.slice(i, i + chunkSize));
    }

    console.log(`📚 Processing large document in ${chunks.length} chunks`);

    const allContacts = [];
    
    for (let i = 0; i < chunks.length; i++) {
      console.log(`🔄 Processing chunk ${i + 1}/${chunks.length}`);
      
      const result = await this.extractContacts(chunks[i], rolePreferences, options);
      
      if (result.success) {
        allContacts.push(...result.contacts);
      } else {
        console.warn(`⚠️ Chunk ${i + 1} failed:`, result.error);
      }
    }

    // Remove duplicates based on name and role
    const uniqueContacts = this.removeDuplicateContacts(allContacts);
    
    return {
      success: true,
      contacts: uniqueContacts,
      processedChunks: chunks.length
    };
  }

  /**
   * Remove duplicate contacts
   */
  removeDuplicateContacts(contacts) {
    const seen = new Set();
    return contacts.filter(contact => {
      const key = `${contact.name.toLowerCase()}-${contact.role.toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

module.exports = new ExtractionService();
