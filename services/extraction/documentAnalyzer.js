/**
 * Document Analysis Layer
 * 
 * Analyzes document structure, type, and content to optimize extraction
 */

class DocumentAnalyzer {
  constructor() {
    this.documentTypes = {
      CALL_SHEET: 'call_sheet',
      CONTACT_LIST: 'contact_list',
      PRODUCTION_DOC: 'production_document',
      RESUME: 'resume',
      BUSINESS_CARD: 'business_card',
      UNKNOWN: 'unknown'
    };

    this.productionTypes = {
      FILM: 'film',
      TELEVISION: 'television',
      COMMERCIAL: 'commercial',
      CORPORATE: 'corporate',
      THEATRE: 'theatre',
      UNKNOWN: 'unknown'
    };
  }

  /**
   * Analyze document structure and type
   * @param {Buffer} fileBuffer - File content
   * @param {string} mimeType - MIME type
   * @param {string} fileName - File name
   * @returns {Object} Document analysis result
   */
  async analyzeDocument(fileBuffer, mimeType, fileName) {
    const analysis = {
      type: this.documentTypes.UNKNOWN,
      productionType: this.productionTypes.UNKNOWN,
      hasTableStructure: false,
      hasContactSections: false,
      estimatedContacts: 0,
      confidence: 0,
      metadata: {
        fileName: fileName,
        mimeType: mimeType,
        fileSize: fileBuffer.length,
        hasImages: false,
        pageCount: 0,
        language: 'en'
      }
    };

    try {
      // Extract text for analysis
      const text = await this.extractTextForAnalysis(fileBuffer, mimeType);
      
      // Analyze document type
      analysis.type = this.analyzeDocumentType(text, fileName);
      
      // Analyze production type
      analysis.productionType = this.analyzeProductionType(text);
      
      // Check for table structure
      analysis.hasTableStructure = this.detectTableStructure(text);
      
      // Check for contact sections
      analysis.hasContactSections = this.detectContactSections(text);
      
      // Estimate number of contacts
      analysis.estimatedContacts = this.estimateContactCount(text);
      
      // Calculate confidence
      analysis.confidence = this.calculateAnalysisConfidence(analysis);
      
      // Additional metadata
      analysis.metadata.hasImages = this.detectImages(fileBuffer, mimeType);
      analysis.metadata.pageCount = this.estimatePageCount(fileBuffer, mimeType);
      analysis.metadata.language = this.detectLanguage(text);

    } catch (error) {
      console.error('❌ Document analysis failed:', error);
      analysis.confidence = 0.1; // Low confidence due to analysis failure
    }

    return analysis;
  }

  /**
   * Extract text for analysis (lightweight extraction)
   */
  async extractTextForAnalysis(fileBuffer, mimeType) {
    // For analysis, we only need a sample of the text
    const maxSampleSize = 10000; // 10KB sample
    
    if (fileBuffer.length <= maxSampleSize) {
      return fileBuffer.toString('utf8');
    }
    
    // Take a sample from the beginning and middle
    const sample1 = fileBuffer.slice(0, maxSampleSize / 2).toString('utf8');
    const sample2 = fileBuffer.slice(fileBuffer.length / 2, fileBuffer.length / 2 + maxSampleSize / 2).toString('utf8');
    
    return sample1 + '\n' + sample2;
  }

  /**
   * Analyze document type based on content and filename
   */
  analyzeDocumentType(text, fileName) {
    const lowerText = text.toLowerCase();
    const lowerFileName = fileName.toLowerCase();

    // Call sheet indicators
    const callSheetKeywords = [
      'call sheet', 'callsheet', 'shooting schedule', 'production schedule',
      'day', 'scene', 'location', 'cast', 'crew', 'call time', 'wrap time',
      'unit', 'first ad', 'second ad', 'script supervisor'
    ];

    // Contact list indicators
    const contactListKeywords = [
      'contact list', 'contacts', 'phone list', 'email list',
      'directory', 'roster', 'staff list', 'team list'
    ];

    // Resume indicators
    const resumeKeywords = [
      'resume', 'curriculum vitae', 'cv', 'experience', 'education',
      'skills', 'objective', 'summary', 'work history'
    ];

    // Business card indicators
    const businessCardKeywords = [
      'business card', 'card', 'title', 'position', 'company',
      'address', 'phone', 'email', 'website'
    ];

    // Check for call sheet
    if (callSheetKeywords.some(keyword => lowerText.includes(keyword) || lowerFileName.includes(keyword))) {
      return this.documentTypes.CALL_SHEET;
    }

    // Check for contact list
    if (contactListKeywords.some(keyword => lowerText.includes(keyword) || lowerFileName.includes(keyword))) {
      return this.documentTypes.CONTACT_LIST;
    }

    // Check for resume
    if (resumeKeywords.some(keyword => lowerText.includes(keyword) || lowerFileName.includes(keyword))) {
      return this.documentTypes.RESUME;
    }

    // Check for business card
    if (businessCardKeywords.some(keyword => lowerText.includes(keyword) || lowerFileName.includes(keyword))) {
      return this.documentTypes.BUSINESS_CARD;
    }

    // Check for production document
    const productionKeywords = [
      'production', 'film', 'movie', 'tv', 'television', 'commercial',
      'director', 'producer', 'cinematographer', 'editor', 'sound',
      'lighting', 'grip', 'electric', 'camera', 'audio'
    ];

    if (productionKeywords.some(keyword => lowerText.includes(keyword))) {
      return this.documentTypes.PRODUCTION_DOC;
    }

    return this.documentTypes.UNKNOWN;
  }

  /**
   * Analyze production type
   */
  analyzeProductionType(text) {
    const lowerText = text.toLowerCase();

    // Film indicators
    const filmKeywords = [
      'feature film', 'movie', 'cinema', 'theatrical', 'film festival',
      'director', 'cinematographer', 'film crew', 'movie production'
    ];

    // Television indicators
    const tvKeywords = [
      'television', 'tv series', 'episode', 'season', 'broadcast',
      'network', 'cable', 'streaming', 'tv production'
    ];

    // Commercial indicators
    const commercialKeywords = [
      'commercial', 'advertisement', 'ad', 'brand', 'marketing',
      'agency', 'client', 'campaign', 'spot'
    ];

    // Corporate indicators
    const corporateKeywords = [
      'corporate', 'business', 'company', 'office', 'meeting',
      'presentation', 'conference', 'seminar', 'training'
    ];

    // Theatre indicators
    const theatreKeywords = [
      'theatre', 'theater', 'stage', 'play', 'musical', 'performance',
      'broadway', 'off-broadway', 'regional', 'community theatre'
    ];

    if (filmKeywords.some(keyword => lowerText.includes(keyword))) {
      return this.productionTypes.FILM;
    }

    if (tvKeywords.some(keyword => lowerText.includes(keyword))) {
      return this.productionTypes.TELEVISION;
    }

    if (commercialKeywords.some(keyword => lowerText.includes(keyword))) {
      return this.productionTypes.COMMERCIAL;
    }

    if (corporateKeywords.some(keyword => lowerText.includes(keyword))) {
      return this.productionTypes.CORPORATE;
    }

    if (theatreKeywords.some(keyword => lowerText.includes(keyword))) {
      return this.productionTypes.THEATRE;
    }

    return this.productionTypes.UNKNOWN;
  }

  /**
   * Detect table structure in text
   */
  detectTableStructure(text) {
    const lines = text.split('\n');
    let tableIndicators = 0;

    for (const line of lines) {
      // Check for tab-separated values
      if (line.includes('\t') && line.split('\t').length > 2) {
        tableIndicators++;
      }
      
      // Check for pipe-separated values
      if (line.includes('|') && line.split('|').length > 2) {
        tableIndicators++;
      }
      
      // Check for multiple spaces (potential table)
      if (line.match(/\s{3,}/) && line.split(/\s{3,}/).length > 2) {
        tableIndicators++;
      }
      
      // Check for comma-separated values
      if (line.includes(',') && line.split(',').length > 3) {
        tableIndicators++;
      }
    }

    return tableIndicators > 3; // Threshold for table detection
  }

  /**
   * Detect contact sections in text
   */
  detectContactSections(text) {
    const lowerText = text.toLowerCase();
    
    const contactSectionHeaders = [
      'contacts', 'contact list', 'crew', 'cast', 'production team',
      'staff', 'personnel', 'team', 'directory', 'roster',
      'producers', 'directors', 'writers', 'editors', 'camera',
      'sound', 'lighting', 'grip', 'electric', 'art department',
      'wardrobe', 'makeup', 'hair', 'transportation', 'catering'
    ];

    return contactSectionHeaders.some(header => lowerText.includes(header));
  }

  /**
   * Estimate number of contacts in document
   */
  estimateContactCount(text) {
    // Count email addresses
    const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    const emailCount = emailMatches ? emailMatches.length : 0;

    // Count phone numbers
    const phoneMatches = text.match(/(\+?[\d\s\-\(\)]{10,})/g);
    const phoneCount = phoneMatches ? phoneMatches.length : 0;

    // Count potential names (words that start with capital letters)
    const nameMatches = text.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g);
    const nameCount = nameMatches ? nameMatches.length : 0;

    // Take the maximum as a rough estimate
    return Math.max(emailCount, phoneCount, Math.floor(nameCount / 2));
  }

  /**
   * Calculate analysis confidence
   */
  calculateAnalysisConfidence(analysis) {
    let confidence = 0;

    // Document type confidence
    if (analysis.type !== this.documentTypes.UNKNOWN) {
      confidence += 0.3;
    }

    // Production type confidence
    if (analysis.productionType !== this.productionTypes.UNKNOWN) {
      confidence += 0.2;
    }

    // Table structure confidence
    if (analysis.hasTableStructure) {
      confidence += 0.2;
    }

    // Contact sections confidence
    if (analysis.hasContactSections) {
      confidence += 0.2;
    }

    // Estimated contacts confidence
    if (analysis.estimatedContacts > 0) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Detect images in document
   */
  detectImages(fileBuffer, mimeType) {
    // For now, just check MIME type
    return mimeType.startsWith('image/');
  }

  /**
   * Estimate page count
   */
  estimatePageCount(fileBuffer, mimeType) {
    if (mimeType === 'application/pdf') {
      // Rough estimate: 1 page per 4KB
      return Math.max(1, Math.floor(fileBuffer.length / 4000));
    }
    
    // Default estimate
    return 1;
  }

  /**
   * Detect language (simplified)
   */
  detectLanguage(text) {
    // Simple language detection based on common words
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const spanishWords = ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le'];
    
    const lowerText = text.toLowerCase();
    const englishCount = englishWords.filter(word => lowerText.includes(word)).length;
    const spanishCount = spanishWords.filter(word => lowerText.includes(word)).length;
    
    if (spanishCount > englishCount) {
      return 'es';
    }
    
    return 'en'; // Default to English
  }
}

module.exports = DocumentAnalyzer;
