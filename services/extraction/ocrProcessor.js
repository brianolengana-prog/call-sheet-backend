/**
 * OCR Processor for Image-Based Documents
 * 
 * Handles OCR processing for images and scanned documents
 */

class OCRProcessor {
  constructor() {
    this.tesseract = null;
    this.initializeOCR();
  }

  async initializeOCR() {
    try {
      this.tesseract = require('tesseract.js');
      console.log('✅ OCR processor initialized');
    } catch (error) {
      console.warn('⚠️ Tesseract.js not available for OCR processing');
    }
  }

  /**
   * Process image for OCR text extraction
   * @param {Buffer} imageBuffer - Image file buffer
   * @param {Object} options - OCR options
   * @returns {string} Extracted text
   */
  async processImage(imageBuffer, options = {}) {
    if (!this.tesseract) {
      throw new Error('OCR processing not available - Tesseract.js not installed');
    }

    console.log('🔍 Starting OCR processing...');
    
    const ocrOptions = {
      logger: m => console.log('OCR:', m),
      ...options
    };

    try {
      const { data: { text } } = await this.tesseract.recognize(imageBuffer, 'eng', ocrOptions);
      
      console.log(`📄 OCR extracted ${text.length} characters`);
      return text;
    } catch (error) {
      console.error('❌ OCR processing failed:', error);
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  /**
   * Process multiple images in batch
   * @param {Array} imageBuffers - Array of image buffers
   * @param {Object} options - OCR options
   * @returns {Array} Array of extracted texts
   */
  async processBatch(imageBuffers, options = {}) {
    console.log(`🔍 Starting batch OCR processing for ${imageBuffers.length} images...`);
    
    const results = [];
    
    for (let i = 0; i < imageBuffers.length; i++) {
      try {
        console.log(`📄 Processing image ${i + 1}/${imageBuffers.length}...`);
        const text = await this.processImage(imageBuffers[i], options);
        results.push({
          index: i,
          success: true,
          text: text,
          length: text.length
        });
      } catch (error) {
        console.error(`❌ OCR failed for image ${i + 1}:`, error);
        results.push({
          index: i,
          success: false,
          error: error.message,
          text: '',
          length: 0
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`📊 Batch OCR complete: ${successCount}/${imageBuffers.length} successful`);
    
    return results;
  }

  /**
   * Process any document type (PDF, images)
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} mimeType - MIME type of file
   * @returns {string} Extracted text
   */
  async processDocument(fileBuffer, mimeType) {
    if (!this.tesseract) {
      throw new Error('OCR not available - Tesseract.js not installed. Install with: npm install tesseract.js');
    }

    console.log('🔍 OCR processing document:', mimeType);

    // For PDFs, we need to convert to images first
    if (mimeType === 'application/pdf') {
      return await this.processPDF(fileBuffer);
    }

    // For images, process directly
    if (mimeType.startsWith('image/')) {
      return await this.processImage(fileBuffer);
    }

    throw new Error(`OCR not supported for type: ${mimeType}`);
  }

  /**
   * Process PDF by converting pages to images and running OCR
   * @param {Buffer} pdfBuffer - PDF file buffer
   * @returns {string} Extracted text from all pages
   */
  async processPDF(pdfBuffer) {
    console.log('📄 Converting PDF pages to images for OCR...');
    
    // For now, throw helpful error
    // Full implementation requires pdf-to-img conversion
    throw new Error('PDF OCR requires additional setup. Please: 1) Install pdf-poppler or pdf-to-img, 2) Convert PDF to images, 3) Enable OCR. OR convert your PDF to text-based format.');
  }

  /**
   * Check if OCR is available
   * @returns {boolean} True if OCR is available
   */
  isAvailable() {
    return this.tesseract !== null;
  }

  /**
   * Get OCR capabilities
   * @returns {Object} OCR capabilities
   */
  getCapabilities() {
    return {
      available: this.isAvailable(),
      supportedFormats: ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp'],
      supportedLanguages: ['eng', 'spa', 'fra', 'deu'],
      maxImageSize: '50MB',
      processingTime: '5-30 seconds per image'
    };
  }
}

module.exports = OCRProcessor;
