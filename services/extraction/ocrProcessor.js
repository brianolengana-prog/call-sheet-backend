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
