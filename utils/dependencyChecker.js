/**
 * Dependency Checker Utility
 * 
 * Checks if all required dependencies for OCR and extraction are available
 */

class DependencyChecker {
  constructor() {
    this.results = {
      tesseract: false,
      canvas: false,
      pdfjs: false,
      canvasNative: false,
      allOK: false
    };
  }

  /**
   * Check all dependencies
   * @returns {Object} Check results
   */
  async checkAll() {
    console.log('🔍 Checking OCR and extraction dependencies...\n');

    this.checkTesseract();
    this.checkPDFJS();
    this.checkCanvas();
    await this.checkCanvasNativeDependencies();

    this.results.allOK = 
      this.results.tesseract && 
      this.results.canvas && 
      this.results.pdfjs && 
      this.results.canvasNative;

    this.printSummary();

    return this.results;
  }

  /**
   * Check Tesseract.js availability
   */
  checkTesseract() {
    try {
      const tesseract = require('tesseract.js');
      
      if (tesseract && tesseract.createWorker) {
        console.log('✅ Tesseract.js: Available (v4.x API detected)');
        this.results.tesseract = true;
      } else {
        console.log('⚠️  Tesseract.js: Installed but API mismatch');
        this.results.tesseract = false;
      }
    } catch (error) {
      console.log('❌ Tesseract.js: Not installed');
      console.log('   Install with: npm install tesseract.js');
      this.results.tesseract = false;
    }
  }

  /**
   * Check PDF.js availability
   */
  checkPDFJS() {
    try {
      const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
      
      if (pdfjs && pdfjs.getDocument) {
        console.log('✅ PDF.js: Available');
        this.results.pdfjs = true;
      } else {
        console.log('⚠️  PDF.js: Installed but API issue');
        this.results.pdfjs = false;
      }
    } catch (error) {
      console.log('❌ PDF.js: Not installed');
      console.log('   Install with: npm install pdfjs-dist');
      this.results.pdfjs = false;
    }
  }

  /**
   * Check Canvas module availability
   */
  checkCanvas() {
    try {
      const canvas = require('canvas');
      
      if (canvas && canvas.createCanvas) {
        console.log('✅ Canvas: Module installed');
        this.results.canvas = true;
      } else {
        console.log('⚠️  Canvas: Installed but API issue');
        this.results.canvas = false;
      }
    } catch (error) {
      console.log('❌ Canvas: Not installed');
      console.log('   Install with: npm install canvas');
      this.results.canvas = false;
    }
  }

  /**
   * Check Canvas native dependencies (Cairo, libpng, etc.)
   */
  async checkCanvasNativeDependencies() {
    if (!this.results.canvas) {
      console.log('⚠️  Canvas Native: Cannot check (canvas module not available)');
      this.results.canvasNative = false;
      return;
    }

    try {
      const { createCanvas } = require('canvas');
      
      // Try to create a small canvas to test native dependencies
      const testCanvas = createCanvas(100, 100);
      const context = testCanvas.getContext('2d');
      
      // Try to render something
      context.fillStyle = 'red';
      context.fillRect(0, 0, 50, 50);
      
      // Try to convert to buffer (tests libpng)
      const buffer = testCanvas.toBuffer('image/png');
      
      if (buffer && buffer.length > 0) {
        console.log('✅ Canvas Native: All native dependencies available');
        this.results.canvasNative = true;
      } else {
        console.log('⚠️  Canvas Native: Buffer creation failed');
        this.results.canvasNative = false;
      }
    } catch (error) {
      console.log('❌ Canvas Native: Native dependencies missing');
      console.log(`   Error: ${error.message}`);
      console.log('\n   On Linux, install:');
      console.log('   - Ubuntu/Debian: sudo apt-get install libcairo2-dev libjpeg-dev libpango1.0-dev libgif-dev librsvg2-dev');
      console.log('   - Fedora: sudo yum install cairo-devel libjpeg-turbo-devel pango-devel giflib-devel');
      console.log('   - Arch: sudo pacman -S cairo libjpeg-turbo pango giflib librsvg');
      this.results.canvasNative = false;
    }
  }

  /**
   * Print summary of dependency checks
   */
  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('DEPENDENCY CHECK SUMMARY');
    console.log('='.repeat(50));
    
    if (this.results.allOK) {
      console.log('✅ ALL DEPENDENCIES AVAILABLE - OCR is ready!');
    } else {
      console.log('❌ SOME DEPENDENCIES MISSING - OCR may not work!');
      console.log('\nMissing:');
      if (!this.results.tesseract) console.log('  - Tesseract.js');
      if (!this.results.canvas) console.log('  - Canvas module');
      if (!this.results.pdfjs) console.log('  - PDF.js');
      if (!this.results.canvasNative) console.log('  - Canvas native dependencies');
    }
    
    console.log('='.repeat(50) + '\n');
  }

  /**
   * Get system information
   */
  getSystemInfo() {
    const os = require('os');
    
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      totalMemory: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
      freeMemory: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
      cpuCount: os.cpus().length
    };
  }

  /**
   * Print system information
   */
  printSystemInfo() {
    const info = this.getSystemInfo();
    
    console.log('\n' + '='.repeat(50));
    console.log('SYSTEM INFORMATION');
    console.log('='.repeat(50));
    console.log(`Platform:      ${info.platform} (${info.arch})`);
    console.log(`Node Version:  ${info.nodeVersion}`);
    console.log(`Total Memory:  ${info.totalMemory}`);
    console.log(`Free Memory:   ${info.freeMemory}`);
    console.log(`CPU Cores:     ${info.cpuCount}`);
    console.log('='.repeat(50) + '\n');
  }
}

// CLI usage
if (require.main === module) {
  const checker = new DependencyChecker();
  
  (async () => {
    checker.printSystemInfo();
    const results = await checker.checkAll();
    
    // Exit with error code if dependencies missing
    process.exit(results.allOK ? 0 : 1);
  })();
}

module.exports = DependencyChecker;

