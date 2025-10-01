/**
 * OCR Processor for Image-Based Documents
 * 
 * Handles OCR processing for images and scanned documents
 */

class OCRProcessor {
  constructor() {
    this.tesseract = null;
    this.createWorker = null;
    this.activeJobs = 0;
    this.maxConcurrentJobs = 2; // Limit concurrent OCR jobs to prevent OOM
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
   * Check if OCR job can be started (concurrency control)
   * @throws {Error} If too many jobs are running
   */
  checkConcurrency() {
    if (this.activeJobs >= this.maxConcurrentJobs) {
      throw new Error(`OCR service is busy processing ${this.activeJobs} requests. Please try again in a moment.`);
    }
  }

  /**
   * Increment active job counter
   */
  startJob() {
    this.activeJobs++;
    console.log(`📊 OCR jobs active: ${this.activeJobs}/${this.maxConcurrentJobs}`);
  }

  /**
   * Decrement active job counter
   */
  endJob() {
    this.activeJobs = Math.max(0, this.activeJobs - 1);
    console.log(`📊 OCR jobs active: ${this.activeJobs}/${this.maxConcurrentJobs}`);
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
    
    // v4.x API: createWorker accepts only options object
    const worker = await this.createWorker({
      logger: m => {
        if (options.logger) {
          options.logger(m);
        } else if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${(m.progress * 100).toFixed(0)}%`);
        }
      }
    });

    try {
      // Load language - required in v4.x before recognition
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      
      const { data: { text } } = await worker.recognize(imageBuffer);
      
      console.log(`📄 OCR extracted ${text.length} characters`);
      return text;
    } catch (error) {
      console.error('❌ OCR processing failed:', error);
      throw new Error(`OCR processing failed: ${error.message}`);
    } finally {
      // Always terminate worker in finally block
      try {
        await worker.terminate();
      } catch (terminateError) {
        console.warn('⚠️ Worker termination warning:', terminateError.message);
      }
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

    // Check concurrency limits
    this.checkConcurrency();
    this.startJob();

    try {
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
    } finally {
      this.endJob();
    }
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

    // Check memory before starting OCR
    this.checkMemoryAvailability();

    console.log('📄 Converting PDF pages to images for OCR...');
    
    let pdf = null;
    
    try {
      // Import required libraries with availability check
      let pdfjs, createCanvas;
      try {
        pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
        const canvas = require('canvas');
        createCanvas = canvas.createCanvas;
      } catch (importError) {
        throw new Error('Required dependencies not available. Canvas or PDF.js not installed.');
      }
      
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
      
      pdf = await loadingTask.promise;
      console.log(`📄 PDF loaded: ${pdf.numPages} pages`);
      
      // Verify actual page accessibility (handle corrupted PDFs)
      let actualPages = pdf.numPages;
      try {
        await pdf.getPage(1);
      } catch (pageError) {
        throw new Error('PDF loaded but pages are not accessible. File may be corrupted or encrypted.');
      }
      
      // Limit pages for memory efficiency (OCR is memory intensive)
      const maxPages = Math.min(actualPages, 10);
      console.log(`📄 Processing ${maxPages} pages with OCR...`);
      
      let fullText = '';
      
      // Process each page
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        let page = null;
        let worker = null;
        let canvas = null;
        
        try {
          console.log(`📄 Processing page ${pageNum}/${maxPages}...`);
          
          // Check memory before each page
          if (pageNum > 1) {
            const memUsage = process.memoryUsage();
            const memPercent = memUsage.heapUsed / memUsage.heapTotal;
            if (memPercent > 0.85) {
              console.warn(`⚠️ Memory usage high (${(memPercent * 100).toFixed(1)}%), stopping at page ${pageNum}`);
              break;
            }
          }
          
          // Get page with timeout
          page = await Promise.race([
            pdf.getPage(pageNum),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Page access timeout')), 30000)
            )
          ]);
          
          // Adjust scale based on page size to prevent huge canvases
          const baseViewport = page.getViewport({ scale: 1.0 });
          const maxDimension = 3000; // Limit to prevent huge images
          let scale = 2.0;
          
          if (baseViewport.width > maxDimension || baseViewport.height > maxDimension) {
            scale = Math.min(
              maxDimension / baseViewport.width,
              maxDimension / baseViewport.height
            );
            console.log(`⚠️ Large page detected, reducing scale to ${scale.toFixed(2)}`);
          }
          
          const viewport = page.getViewport({ scale });
          
          // Create canvas
          canvas = createCanvas(viewport.width, viewport.height);
          const context = canvas.getContext('2d');
          
          // Render PDF page to canvas with timeout
          const renderContext = {
            canvasContext: context,
            viewport: viewport
          };
          
          await Promise.race([
            page.render(renderContext).promise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Page rendering timeout')), 60000)
            )
          ]);
          
          // Convert canvas to buffer for Tesseract
          const imageBuffer = canvas.toBuffer('image/png');
          console.log(`📄 Page ${pageNum} rendered: ${Math.round(imageBuffer.length / 1024)}KB`);
          
          // Clear canvas reference to allow GC
          canvas = null;
          
          console.log(`🔍 Running OCR on page ${pageNum}...`);
          
          // Create worker for this page (v4.x API)
          worker = await this.createWorker({
            logger: m => {
              if (m.status === 'recognizing text') {
                console.log(`Page ${pageNum} OCR Progress: ${(m.progress * 100).toFixed(0)}%`);
              }
            }
          });
          
          // Load and initialize language
          await worker.loadLanguage('eng');
          await worker.initialize('eng');
          
          // Run OCR on the rendered page
          const { data: { text, confidence } } = await worker.recognize(imageBuffer);
          
          console.log(`✅ Page ${pageNum} OCR complete: ${text.length} characters, confidence: ${confidence.toFixed(1)}%`);
          
          // Validate OCR quality
          if (this.isValidOCROutput(text)) {
            fullText += text + '\n\n';
          } else {
            console.warn(`⚠️ Page ${pageNum} OCR output quality low, skipping`);
          }
          
        } catch (pageError) {
          console.error(`❌ OCR failed for page ${pageNum}:`, pageError.message);
          // Continue with other pages
        } finally {
          // Cleanup resources
          if (worker) {
            try {
              await worker.terminate();
            } catch (e) {
              console.warn(`⚠️ Worker cleanup warning:`, e.message);
            }
          }
          if (page) {
            try {
              page.cleanup();
            } catch (e) {
              console.warn(`⚠️ Page cleanup warning:`, e.message);
            }
          }
          // Force null to help GC
          worker = null;
          page = null;
          canvas = null;
          
          // Suggest GC every 3 pages
          if (pageNum % 3 === 0 && global.gc) {
            global.gc();
          }
        }
      }
      
      if (fullText.trim().length === 0) {
        throw new Error('OCR processing completed but no readable text was extracted from the PDF. The document may be blank or contain only graphics.');
      }
      
      console.log(`✅ PDF OCR complete: ${fullText.length} total characters from ${maxPages} pages`);
      return fullText;
      
    } catch (error) {
      console.error('❌ PDF OCR processing failed:', error);
      
      // Provide user-friendly error messages
      if (error.message.includes('Canvas') || error.message.includes('dependencies')) {
        throw new Error('PDF OCR service temporarily unavailable. Please try converting your PDF to text format or contact support.');
      } else if (error.message.includes('timeout')) {
        throw new Error('PDF processing timeout. Your file may be too complex. Please try a simpler format or contact support.');
      } else if (error.message.includes('memory') || error.message.includes('Memory')) {
        throw new Error('PDF too large for OCR processing. Please try uploading fewer pages or contact support for large file processing.');
      }
      
      throw new Error(`PDF OCR failed: ${error.message}`);
    } finally {
      // Final cleanup
      if (pdf) {
        try {
          pdf.destroy();
        } catch (e) {
          console.warn('⚠️ PDF cleanup warning:', e.message);
        }
      }
    }
  }

  /**
   * Check if sufficient memory is available for OCR processing
   * @throws {Error} If memory is too low
   */
  checkMemoryAvailability() {
    const memUsage = process.memoryUsage();
    const memPercent = memUsage.heapUsed / memUsage.heapTotal;
    const availableMB = (memUsage.heapTotal - memUsage.heapUsed) / 1024 / 1024;
    
    console.log(`📊 Memory check: ${(memPercent * 100).toFixed(1)}% used, ${availableMB.toFixed(0)}MB available`);
    
    // Need at least 100MB free for OCR processing
    if (availableMB < 100) {
      throw new Error('Insufficient memory available for OCR processing. Please try again later.');
    }
    
    // Warn if memory is getting tight
    if (memPercent > 0.75) {
      console.warn(`⚠️ Memory usage high: ${(memPercent * 100).toFixed(1)}%`);
    }
  }

  /**
   * Validate OCR output quality
   * @param {string} text - OCR extracted text
   * @returns {boolean} True if text quality is acceptable
   */
  isValidOCROutput(text) {
    if (!text || text.trim().length < 10) {
      return false;
    }
    
    // Check for garbage output (too many special characters)
    const alphanumericCount = (text.match(/[a-zA-Z0-9]/g) || []).length;
    const totalChars = text.length;
    const alphanumericRatio = alphanumericCount / totalChars;
    
    // Should have at least 40% alphanumeric characters
    if (alphanumericRatio < 0.4) {
      console.warn(`⚠️ Low alphanumeric ratio: ${(alphanumericRatio * 100).toFixed(1)}%`);
      return false;
    }
    
    // Check for recognizable words (at least some 3+ letter words)
    const words = text.match(/\b[a-zA-Z]{3,}\b/g);
    if (!words || words.length < 5) {
      console.warn(`⚠️ Too few recognizable words: ${words ? words.length : 0}`);
      return false;
    }
    
    return true;
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
