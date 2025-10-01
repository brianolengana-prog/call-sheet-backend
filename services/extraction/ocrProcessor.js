/**
 * OCR Processor for Image-Based Documents
 * 
 * Handles OCR processing for images and scanned documents
 */

class OCRProcessor {
  constructor() {
    this.tesseract = null;
    this.createWorker = null;
    this.initializeOCR();
  }

  async initializeOCR() {
    try {
      const tesseract = require('tesseract.js');
      this.tesseract = tesseract;
      this.createWorker = tesseract.createWorker;
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
    if (!this.createWorker) {
      throw new Error('OCR processing not available - Tesseract.js not installed');
    }

    console.log('🔍 Starting OCR processing...');
    
    const worker = await this.createWorker('eng', 1, {
      logger: m => {
        if (options.logger) {
          options.logger(m);
        } else if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${(m.progress * 100).toFixed(0)}%`);
        }
      }
    });

    try {
      const { data: { text } } = await worker.recognize(imageBuffer);
      await worker.terminate();
      
      console.log(`📄 OCR extracted ${text.length} characters`);
      return text;
    } catch (error) {
      await worker.terminate();
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
    if (!this.createWorker) {
      throw new Error('OCR not available - Tesseract.js not installed. Install with: npm install tesseract.js');
    }

    console.log('📄 Converting PDF pages to images for OCR...');
    
    try {
      // Import required libraries
      const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
      const { createCanvas } = require('canvas');
      
      // Convert Buffer to Uint8Array for pdfjs
      const data = new Uint8Array(pdfBuffer);
      
      // Load PDF document
      const loadingTask = pdfjs.getDocument({
        data: data,
        verbosity: 0,
        disableAutoFetch: true,
        disableStream: true,
        disableRange: true
      });
      
      const pdf = await loadingTask.promise;
      console.log(`📄 PDF loaded: ${pdf.numPages} pages`);
      
      // Limit pages for memory efficiency (OCR is memory intensive)
      const maxPages = Math.min(pdf.numPages, 10);
      console.log(`📄 Processing ${maxPages} pages with OCR...`);
      
      let fullText = '';
      
      // Process each page
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
          console.log(`📄 Processing page ${pageNum}/${maxPages}...`);
          
          // Get page
          const page = await pdf.getPage(pageNum);
          
          // Get viewport with scale for better OCR quality
          const scale = 2.0; // Higher scale = better quality but slower
          const viewport = page.getViewport({ scale });
          
          // Create canvas
          const canvas = createCanvas(viewport.width, viewport.height);
          const context = canvas.getContext('2d');
          
          // Render PDF page to canvas
          const renderContext = {
            canvasContext: context,
            viewport: viewport
          };
          
          await page.render(renderContext).promise;
          
          // Convert canvas to buffer for Tesseract
          const imageBuffer = canvas.toBuffer('image/png');
          
          console.log(`🔍 Running OCR on page ${pageNum}...`);
          
          // Create worker for this page
          const worker = await this.createWorker('eng', 1, {
            logger: m => {
              if (m.status === 'recognizing text') {
                console.log(`Page ${pageNum} OCR Progress: ${(m.progress * 100).toFixed(0)}%`);
              }
            }
          });
          
          // Run OCR on the rendered page
          const { data: { text } } = await worker.recognize(imageBuffer);
          await worker.terminate();
          
          console.log(`✅ Page ${pageNum} OCR complete: ${text.length} characters`);
          
          fullText += text + '\n\n';
          
          // Cleanup
          page.cleanup();
          
        } catch (pageError) {
          console.error(`❌ OCR failed for page ${pageNum}:`, pageError.message);
          // Continue with other pages
        }
      }
      
      // Cleanup PDF document
      pdf.destroy();
      
      if (fullText.trim().length === 0) {
        throw new Error('OCR processing completed but no text was extracted from the PDF');
      }
      
      console.log(`✅ PDF OCR complete: ${fullText.length} total characters from ${maxPages} pages`);
      return fullText;
      
    } catch (error) {
      console.error('❌ PDF OCR processing failed:', error);
      throw new Error(`PDF OCR failed: ${error.message}`);
    }
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
