/**
 * Text Cleaner
 * 
 * Cleans and validates extracted text, removing PDF artifacts and garbage
 */

class TextCleaner {
  constructor() {
    this.pdfArtifacts = this.buildPDFArtifactPatterns();
    this.garbagePatterns = this.buildGarbagePatterns();
  }

  /**
   * Build patterns to detect PDF structure elements
   */
  buildPDFArtifactPatterns() {
    return [
      // PDF object markers
      /^\d+\s+\d+\s+obj$/gm,
      /^endobj$/gm,
      /^stream$/gm,
      /^endstream$/gm,
      
      // PDF structure
      /^xref$/gm,
      /^trailer$/gm,
      /^startxref$/gm,
      /^%%EOF$/gm,
      
      // PDF metadata
      /^\/Type\s+\/\w+/gm,
      /^\/Subtype\s+\/\w+/gm,
      /^\/Filter\s+\/\w+/gm,
      /^\/Length\s+\d+/gm,
      /^\/Root\s+/gm,
      /^\/Info\s+/gm,
      /^\/ID\s+\[/gm,
      /^\/Size\s+\d+/gm,
      /^\/Catalog$/gm,
      /^\/Pages$/gm,
      /^\/Kids\s+\[/gm,
      /^\/Count\s+\d+/gm,
      /^\/MediaBox\s+\[/gm,
      /^\/Resources\s+<</gm,
      /^\/Font\s+<</gm,
      /^\/ProcSet\s+\[/gm,
      
      // Image metadata
      /^JFIF$/gm,
      /^ICC_PROFILE$/gm,
      /^Exif$/gm,
      
      // PDF operators
      /^[qQ]$/gm,
      /^\d+\.?\d*\s+\d+\.?\d*\s+\d+\.?\d*\s+cm$/gm,
      /^\d+\.?\d*\s+\d+\.?\d*\s+\d+\.?\d*\s+scn$/gm,
      /^\d+\.?\d*\s+\d+\.?\d*\s+\d+\.?\d*\s+SCN$/gm,
      /^\d+\.?\d*\s+\d+\.?\d*\s+\d+\.?\d*\s+rg$/gm,
      /^\d+\.?\d*\s+\d+\.?\d*\s+\d+\.?\d*\s+RG$/gm,
      
      // Encoding markers
      /^<</gm,
      /^>>$/gm,
      /^\[$/gm,
      /^\]$/gm
    ];
  }

  /**
   * Build patterns to detect garbage/binary data
   */
  buildGarbagePatterns() {
    return [
      // Binary data (lots of non-printable characters)
      /[\x00-\x08\x0B\x0C\x0E-\x1F]{5,}/g,
      
      // Long sequences of special chars
      /[^\w\s@.,()\-/]{20,}/g,
      
      // Hex strings
      /^[0-9A-Fa-f]{32,}$/gm,
      
      // Base64-like long strings without spaces
      /^[A-Za-z0-9+/]{100,}={0,2}$/gm
    ];
  }

  /**
   * Check if text is garbage (failed PDF extraction)
   */
  isGarbageText(text) {
    if (!text || text.trim().length < 10) return true;
    
    // Check for PDF markers
    const pdfMarkerCount = [
      'endobj', 'stream', 'endstream', 'xref', 'trailer', 
      'startxref', '%%EOF'
    ].filter(marker => text.includes(marker)).length;
    
    if (pdfMarkerCount >= 3) {
      console.log('⚠️ Text contains PDF structure markers - likely failed extraction');
      return true;
    }
    
    // Check for high ratio of non-printable characters
    const nonPrintable = (text.match(/[\x00-\x1F\x7F-\x9F]/g) || []).length;
    const printable = text.length - nonPrintable;
    const nonPrintableRatio = nonPrintable / text.length;
    
    if (nonPrintableRatio > 0.3) {
      console.log(`⚠️ Text is ${(nonPrintableRatio * 100).toFixed(1)}% non-printable - likely binary`);
      return true;
    }
    
    // Check for binary data patterns
    const hasBinaryPatterns = this.garbagePatterns.some(pattern => 
      pattern.test(text.substring(0, 1000)) // Check first 1000 chars
    );
    
    if (hasBinaryPatterns) {
      console.log('⚠️ Text contains binary data patterns');
      return true;
    }
    
    return false;
  }

  /**
   * Clean text by removing PDF artifacts
   */
  cleanText(text) {
    if (!text) return '';
    
    let cleaned = text;
    
    // Remove PDF structure lines
    this.pdfArtifacts.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    // Remove garbage patterns
    this.garbagePatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    // Remove lines that are just numbers
    cleaned = cleaned.replace(/^\d+$/gm, '');
    
    // Remove lines with only special characters
    cleaned = cleaned.replace(/^[^\w\s@]+$/gm, '');
    
    // Remove excessive whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    
    // Remove leading/trailing whitespace from each line
    cleaned = cleaned.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
    
    return cleaned;
  }

  /**
   * Validate that text is extractable (not garbage)
   */
  validateText(text) {
    if (this.isGarbageText(text)) {
      return {
        valid: false,
        reason: 'Text appears to be binary or corrupted PDF structure',
        suggestions: [
          'The PDF may be scanned/image-based - OCR is required',
          'The PDF may be encrypted or corrupted',
          'Try re-saving the PDF or converting to a different format'
        ]
      };
    }
    
    // Check for minimum readable content
    const words = text.split(/\s+/).filter(w => w.length > 2);
    const readableWords = words.filter(w => /^[A-Za-z0-9@.,-]+$/.test(w));
    const readableRatio = readableWords.length / words.length;
    
    if (readableRatio < 0.3) {
      return {
        valid: false,
        reason: `Only ${(readableRatio * 100).toFixed(1)}% of text is readable`,
        suggestions: [
          'The document may need OCR processing',
          'Try converting to a text-based format'
        ]
      };
    }
    
    return {
      valid: true,
      readableRatio,
      wordCount: words.length
    };
  }

  /**
   * Clean and validate text before extraction
   */
  prepare(text) {
    // First validate
    const validation = this.validateText(text);
    
    if (!validation.valid) {
      throw new Error(`Invalid text: ${validation.reason}. ${validation.suggestions.join(' ')}`);
    }
    
    // Then clean
    const cleaned = this.cleanText(text);
    
    console.log(`✅ Text cleaned: ${text.length} → ${cleaned.length} chars`);
    console.log(`📊 Readable ratio: ${(validation.readableRatio * 100).toFixed(1)}%`);
    console.log(`📝 Word count: ${validation.wordCount}`);
    
    return cleaned;
  }
}

module.exports = TextCleaner;

