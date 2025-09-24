/**
 * AI-Powered Document Analyzer
 * 
 * Enhanced document analysis using machine learning and AI techniques
 * for better document type detection, content understanding, and optimization
 */

// Optional AI dependencies
let natural, SentimentAnalyzer;
try {
  natural = require('natural');
  SentimentAnalyzer = natural.SentimentAnalyzer;
} catch (error) {
  console.warn('⚠️ Natural language processing library not available. AI features will be limited.');
  natural = null;
  SentimentAnalyzer = null;
}

class AIDocumentAnalyzer {
  constructor() {
    this.documentTypes = {
      CALL_SHEET: 'call_sheet',
      CONTACT_LIST: 'contact_list',
      PRODUCTION_DOC: 'production_document',
      RESUME: 'resume',
      BUSINESS_CARD: 'business_card',
      SCRIPT: 'script',
      BUDGET: 'budget',
      SCHEDULE: 'schedule',
      UNKNOWN: 'unknown'
    };

    this.productionTypes = {
      FILM: 'film',
      TELEVISION: 'television',
      COMMERCIAL: 'commercial',
      CORPORATE: 'corporate',
      THEATRE: 'theatre',
      DOCUMENTARY: 'documentary',
      MUSIC_VIDEO: 'music_video',
      UNKNOWN: 'unknown'
    };

    // Initialize NLP tools (if available)
    if (natural) {
      this.tokenizer = new natural.WordTokenizer();
      this.stemmer = natural.PorterStemmer;
      this.sentimentAnalyzer = new SentimentAnalyzer('English', this.stemmer, 'afinn');
    } else {
      // Fallback implementations
      this.tokenizer = { tokenize: (text) => text.split(/\s+/) };
      this.stemmer = { stem: (word) => word };
      this.sentimentAnalyzer = { getSentiment: () => 0 };
    }
    
    // Document type classification features
    this.documentFeatures = this.initializeDocumentFeatures();
    this.productionFeatures = this.initializeProductionFeatures();
  }

  /**
   * Initialize document type classification features
   */
  initializeDocumentFeatures() {
    return {
      callSheet: {
        keywords: [
          'call sheet', 'callsheet', 'shooting schedule', 'production schedule',
          'day', 'scene', 'location', 'cast', 'crew', 'call time', 'wrap time',
          'unit', 'first ad', 'second ad', 'script supervisor', 'continuity',
          'weather', 'sunrise', 'sunset', 'meal break', 'company moves'
        ],
        patterns: [
          /day\s+\d+/i,
          /scene\s+\d+/i,
          /call\s+time/i,
          /wrap\s+time/i,
          /\d{1,2}:\d{2}\s*(am|pm)/i
        ],
        weight: 0.8
      },
      contactList: {
        keywords: [
          'contact list', 'contacts', 'phone list', 'email list',
          'directory', 'roster', 'staff list', 'team list', 'crew list',
          'cast list', 'personnel', 'phone numbers', 'email addresses'
        ],
        patterns: [
          /@\w+\.\w+/g,
          /\(\d{3}\)\s*\d{3}-\d{4}/g,
          /\d{3}-\d{3}-\d{4}/g
        ],
        weight: 0.7
      },
      resume: {
        keywords: [
          'resume', 'curriculum vitae', 'cv', 'experience', 'education',
          'skills', 'objective', 'summary', 'work history', 'employment',
          'qualifications', 'achievements', 'references'
        ],
        patterns: [
          /education/i,
          /experience/i,
          /skills/i,
          /objective/i,
          /summary/i
        ],
        weight: 0.9
      },
      businessCard: {
        keywords: [
          'business card', 'card', 'title', 'position', 'company',
          'address', 'phone', 'email', 'website', 'mobile', 'direct'
        ],
        patterns: [
          /title/i,
          /position/i,
          /director/i,
          /producer/i,
          /manager/i
        ],
        weight: 0.6
      },
      script: {
        keywords: [
          'script', 'screenplay', 'scene', 'character', 'dialogue',
          'action', 'int.', 'ext.', 'fade in', 'fade out', 'cut to',
          'close up', 'wide shot', 'medium shot'
        ],
        patterns: [
          /int\./i,
          /ext\./i,
          /fade\s+in/i,
          /fade\s+out/i,
          /cut\s+to/i
        ],
        weight: 0.9
      },
      budget: {
        keywords: [
          'budget', 'cost', 'expense', 'line item', 'above the line',
          'below the line', 'contingency', 'total', 'amount', 'fee',
          'salary', 'wage', 'rate', 'overtime'
        ],
        patterns: [
          /\$\d+/g,
          /budget/i,
          /cost/i,
          /expense/i,
          /line\s+item/i
        ],
        weight: 0.8
      },
      schedule: {
        keywords: [
          'schedule', 'timeline', 'calendar', 'dates', 'shooting days',
          'prep days', 'wrap days', 'travel days', 'rehearsal',
          'production week', 'post production'
        ],
        patterns: [
          /schedule/i,
          /timeline/i,
          /calendar/i,
          /\d{1,2}\/\d{1,2}\/\d{4}/g,
          /week\s+\d+/i
        ],
        weight: 0.7
      }
    };
  }

  /**
   * Initialize production type classification features
   */
  initializeProductionFeatures() {
    return {
      film: {
        keywords: [
          'feature film', 'movie', 'cinema', 'theatrical', 'film festival',
          'director', 'cinematographer', 'film crew', 'movie production',
          'box office', 'theatrical release', 'film distribution'
        ],
        patterns: [
          /feature\s+film/i,
          /movie/i,
          /cinema/i,
          /theatrical/i
        ],
        weight: 0.8
      },
      television: {
        keywords: [
          'television', 'tv series', 'episode', 'season', 'broadcast',
          'network', 'cable', 'streaming', 'tv production', 'pilot',
          'showrunner', 'executive producer', 'series'
        ],
        patterns: [
          /tv\s+series/i,
          /episode/i,
          /season/i,
          /broadcast/i
        ],
        weight: 0.8
      },
      commercial: {
        keywords: [
          'commercial', 'advertisement', 'ad', 'brand', 'marketing',
          'agency', 'client', 'campaign', 'spot', '30 second',
          '15 second', 'brand awareness', 'product placement'
        ],
        patterns: [
          /commercial/i,
          /advertisement/i,
          /brand/i,
          /campaign/i
        ],
        weight: 0.7
      },
      corporate: {
        keywords: [
          'corporate', 'business', 'company', 'office', 'meeting',
          'presentation', 'conference', 'seminar', 'training',
          'internal', 'employee', 'stakeholder'
        ],
        patterns: [
          /corporate/i,
          /business/i,
          /company/i,
          /meeting/i
        ],
        weight: 0.6
      },
      theatre: {
        keywords: [
          'theatre', 'theater', 'stage', 'play', 'musical', 'performance',
          'broadway', 'off-broadway', 'regional', 'community theatre',
          'stage manager', 'stage crew', 'theatrical production'
        ],
        patterns: [
          /theatre/i,
          /theater/i,
          /stage/i,
          /play/i
        ],
        weight: 0.8
      },
      documentary: {
        keywords: [
          'documentary', 'doc', 'non-fiction', 'real story', 'interview',
          'subject', 'narrator', 'voice over', 'archival footage',
          'true story', 'biography', 'investigative'
        ],
        patterns: [
          /documentary/i,
          /non-fiction/i,
          /interview/i,
          /subject/i
        ],
        weight: 0.7
      },
      musicVideo: {
        keywords: [
          'music video', 'mv', 'artist', 'song', 'album', 'single',
          'record label', 'music producer', 'choreography', 'dance',
          'performance', 'concert', 'tour'
        ],
        patterns: [
          /music\s+video/i,
          /artist/i,
          /song/i,
          /album/i
        ],
        weight: 0.8
      }
    };
  }

  /**
   * Enhanced document analysis with AI techniques
   * @param {Buffer} fileBuffer - File content
   * @param {string} mimeType - MIME type
   * @param {string} fileName - File name
   * @returns {Object} Enhanced document analysis result
   */
  async analyzeDocument(fileBuffer, mimeType, fileName) {
    const analysis = {
      type: this.documentTypes.UNKNOWN,
      productionType: this.productionTypes.UNKNOWN,
      hasTableStructure: false,
      hasContactSections: false,
      estimatedContacts: 0,
      confidence: 0,
      aiInsights: {
        sentiment: 'neutral',
        complexity: 'medium',
        language: 'en',
        keyTopics: [],
        documentStructure: 'unstructured',
        contactDensity: 0,
        productionContext: 'unknown'
      },
      metadata: {
        fileName: fileName,
        mimeType: mimeType,
        fileSize: fileBuffer.length,
        hasImages: false,
        pageCount: 0,
        language: 'en',
        processingTime: 0
      }
    };

    const startTime = Date.now();

    try {
      // Extract text for analysis
      const text = await this.extractTextForAnalysis(fileBuffer, mimeType);
      
      // AI-powered document type classification
      analysis.type = await this.classifyDocumentType(text, fileName);
      
      // AI-powered production type classification
      analysis.productionType = await this.classifyProductionType(text);
      
      // Enhanced structure analysis
      analysis.hasTableStructure = this.detectAdvancedTableStructure(text);
      analysis.hasContactSections = this.detectContactSections(text);
      analysis.estimatedContacts = this.estimateContactCount(text);
      
      // AI insights
      analysis.aiInsights = await this.generateAIInsights(text, analysis);
      
      // Calculate confidence with AI weighting
      analysis.confidence = this.calculateAIConfidence(analysis);
      
      // Enhanced metadata
      analysis.metadata.hasImages = this.detectImages(fileBuffer, mimeType);
      analysis.metadata.pageCount = this.estimatePageCount(fileBuffer, mimeType);
      analysis.metadata.language = this.detectLanguage(text);
      analysis.metadata.processingTime = Date.now() - startTime;

    } catch (error) {
      console.error('❌ AI document analysis failed:', error);
      analysis.confidence = 0.1;
    }

    return analysis;
  }

  /**
   * AI-powered document type classification
   */
  async classifyDocumentType(text, fileName) {
    const scores = {};
    const lowerText = text.toLowerCase();
    const lowerFileName = fileName.toLowerCase();

    // Score each document type
    for (const [type, features] of Object.entries(this.documentFeatures)) {
      let score = 0;
      
      // Keyword matching with TF-IDF weighting
      const keywordMatches = features.keywords.filter(keyword => 
        lowerText.includes(keyword.toLowerCase()) || lowerFileName.includes(keyword.toLowerCase())
      ).length;
      
      score += (keywordMatches / features.keywords.length) * features.weight * 0.6;
      
      // Pattern matching
      const patternMatches = features.patterns.filter(pattern => pattern.test(text)).length;
      score += (patternMatches / features.patterns.length) * features.weight * 0.4;
      
      scores[type] = score;
    }

    // Find the highest scoring type
    const bestMatch = Object.entries(scores).reduce((a, b) => scores[a[0]] > scores[b[0]] ? a : b);
    
    if (bestMatch[1] > 0.3) { // Threshold for classification
      // Map feature names to document type constants
      const typeMapping = {
        'callSheet': 'CALL_SHEET',
        'contactList': 'CONTACT_LIST',
        'resume': 'RESUME',
        'businessCard': 'BUSINESS_CARD',
        'script': 'SCRIPT',
        'budget': 'BUDGET',
        'schedule': 'SCHEDULE'
      };
      return this.documentTypes[typeMapping[bestMatch[0]]] || this.documentTypes.UNKNOWN;
    }

    return this.documentTypes.UNKNOWN;
  }

  /**
   * AI-powered production type classification
   */
  async classifyProductionType(text) {
    const scores = {};
    const lowerText = text.toLowerCase();

    // Score each production type
    for (const [type, features] of Object.entries(this.productionFeatures)) {
      let score = 0;
      
      // Keyword matching
      const keywordMatches = features.keywords.filter(keyword => 
        lowerText.includes(keyword.toLowerCase())
      ).length;
      
      score += (keywordMatches / features.keywords.length) * features.weight * 0.6;
      
      // Pattern matching
      const patternMatches = features.patterns.filter(pattern => pattern.test(text)).length;
      score += (patternMatches / features.patterns.length) * features.weight * 0.4;
      
      scores[type] = score;
    }

    // Find the highest scoring type
    const bestMatch = Object.entries(scores).reduce((a, b) => scores[a[0]] > scores[b[0]] ? a : b);
    
    if (bestMatch[1] > 0.3) {
      return this.productionTypes[bestMatch[0].toUpperCase()];
    }

    return this.productionTypes.UNKNOWN;
  }

  /**
   * Generate AI insights about the document
   */
  async generateAIInsights(text, analysis) {
    const insights = {
      sentiment: 'neutral',
      complexity: 'medium',
      language: 'en',
      keyTopics: [],
      documentStructure: 'unstructured',
      contactDensity: 0,
      productionContext: 'unknown'
    };

    try {
      // Sentiment analysis
      const sentiment = this.sentimentAnalyzer.getSentiment(text.split(' '));
      if (sentiment > 0.1) insights.sentiment = 'positive';
      else if (sentiment < -0.1) insights.sentiment = 'negative';
      else insights.sentiment = 'neutral';

      // Complexity analysis
      const words = this.tokenizer.tokenize(text);
      const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
      const uniqueWords = new Set(words).size;
      const complexity = (avgWordLength * uniqueWords) / words.length;
      
      if (complexity > 5) insights.complexity = 'high';
      else if (complexity > 3) insights.complexity = 'medium';
      else insights.complexity = 'low';

      // Key topics extraction
      insights.keyTopics = this.extractKeyTopics(text);

      // Document structure analysis
      insights.documentStructure = this.analyzeDocumentStructure(text);

      // Contact density
      const emailCount = (text.match(/@\w+\.\w+/g) || []).length;
      const phoneCount = (text.match(/(\+?[\d\s\-\(\)]{10,})/g) || []).length;
      insights.contactDensity = (emailCount + phoneCount) / Math.max(text.length / 1000, 1);

      // Production context
      insights.productionContext = this.analyzeProductionContext(text, analysis);

    } catch (error) {
      console.error('❌ AI insights generation failed:', error);
    }

    return insights;
  }

  /**
   * Extract key topics from text using TF-IDF
   */
  extractKeyTopics(text) {
    const words = this.tokenizer.tokenize(text.toLowerCase());
    const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should']);
    
    const filteredWords = words.filter(word => 
      word.length > 3 && !stopWords.has(word) && /^[a-zA-Z]+$/.test(word)
    );

    const wordFreq = {};
    filteredWords.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    // Sort by frequency and return top 10
    return Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, freq]) => ({ word, frequency: freq }));
  }

  /**
   * Analyze document structure
   */
  analyzeDocumentStructure(text) {
    const lines = text.split('\n');
    const hasHeaders = lines.some(line => /^[A-Z][A-Z\s]+$/.test(line.trim()));
    const hasNumbers = lines.some(line => /^\d+\./.test(line.trim()));
    const hasBullets = lines.some(line => /^[\-\*\+]/.test(line.trim()));
    const hasTables = this.detectAdvancedTableStructure(text);

    if (hasTables) return 'tabular';
    if (hasHeaders && hasNumbers) return 'structured';
    if (hasHeaders) return 'hierarchical';
    if (hasNumbers || hasBullets) return 'list';
    
    return 'unstructured';
  }

  /**
   * Analyze production context
   */
  analyzeProductionContext(text, analysis) {
    const lowerText = text.toLowerCase();
    
    if (analysis.type === this.documentTypes.CALL_SHEET) {
      if (lowerText.includes('film') || lowerText.includes('movie')) return 'film_production';
      if (lowerText.includes('tv') || lowerText.includes('television')) return 'tv_production';
      if (lowerText.includes('commercial')) return 'commercial_production';
    }
    
    if (analysis.type === this.documentTypes.CONTACT_LIST) {
      if (lowerText.includes('crew') || lowerText.includes('cast')) return 'production_contacts';
      if (lowerText.includes('client') || lowerText.includes('agency')) return 'business_contacts';
    }
    
    return 'unknown';
  }

  /**
   * Enhanced table structure detection
   */
  detectAdvancedTableStructure(text) {
    const lines = text.split('\n');
    let tableScore = 0;
    
    for (const line of lines) {
      // Tab-separated values
      if (line.includes('\t') && line.split('\t').length > 2) {
        tableScore += 2;
      }
      
      // Pipe-separated values
      if (line.includes('|') && line.split('|').length > 2) {
        tableScore += 2;
      }
      
      // Multiple spaces (potential table)
      if (line.match(/\s{3,}/) && line.split(/\s{3,}/).length > 2) {
        tableScore += 1;
      }
      
      // Comma-separated values
      if (line.includes(',') && line.split(',').length > 3) {
        tableScore += 1;
      }
      
      // Consistent column alignment
      if (line.match(/^\s*\w+\s+\w+\s+\w+/)) {
        tableScore += 1;
      }
    }
    
    return tableScore > 5; // Higher threshold for better accuracy
  }

  /**
   * Enhanced contact section detection
   */
  detectContactSections(text) {
    const lowerText = text.toLowerCase();
    
    const contactSectionHeaders = [
      'contacts', 'contact list', 'crew', 'cast', 'production team',
      'staff', 'personnel', 'team', 'directory', 'roster',
      'producers', 'directors', 'writers', 'editors', 'camera',
      'sound', 'lighting', 'grip', 'electric', 'art department',
      'wardrobe', 'makeup', 'hair', 'transportation', 'catering',
      'department heads', 'key crew', 'above the line', 'below the line'
    ];

    return contactSectionHeaders.some(header => lowerText.includes(header));
  }

  /**
   * Enhanced contact count estimation
   */
  estimateContactCount(text) {
    // Count email addresses
    const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    const emailCount = emailMatches ? emailMatches.length : 0;

    // Count phone numbers (various formats)
    const phoneMatches = text.match(/(\+?[\d\s\-\(\)]{10,})/g);
    const phoneCount = phoneMatches ? phoneMatches.length : 0;

    // Count potential names (improved pattern)
    const nameMatches = text.match(/\b[A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g);
    const nameCount = nameMatches ? nameMatches.length : 0;

    // Use the maximum as estimate, but apply some intelligence
    const maxCount = Math.max(emailCount, phoneCount, Math.floor(nameCount / 2));
    
    // Apply confidence weighting based on document type
    if (this.documentTypes.CONTACT_LIST) {
      return Math.min(maxCount * 1.2, 1000); // Boost for contact lists
    }
    
    return Math.min(maxCount, 500); // Cap at reasonable number
  }

  /**
   * Calculate AI-enhanced confidence score
   */
  calculateAIConfidence(analysis) {
    let confidence = 0;

    // Document type confidence
    if (analysis.type !== this.documentTypes.UNKNOWN) {
      confidence += 0.3;
    }

    // Production type confidence
    if (analysis.productionType !== this.productionTypes.UNKNOWN) {
      confidence += 0.2;
    }

    // Structure confidence
    if (analysis.hasTableStructure) {
      confidence += 0.15;
    }

    // Contact sections confidence
    if (analysis.hasContactSections) {
      confidence += 0.15;
    }

    // AI insights confidence
    if (analysis.aiInsights.contactDensity > 0.1) {
      confidence += 0.1;
    }

    if (analysis.aiInsights.keyTopics.length > 0) {
      confidence += 0.05;
    }

    // Estimated contacts confidence
    if (analysis.estimatedContacts > 0) {
      confidence += 0.05;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Extract text for analysis (lightweight extraction)
   */
  async extractTextForAnalysis(fileBuffer, mimeType) {
    const maxSampleSize = 15000; // Increased sample size for better AI analysis
    
    if (fileBuffer.length <= maxSampleSize) {
      return fileBuffer.toString('utf8');
    }
    
    // Take a sample from the beginning, middle, and end
    const sampleSize = maxSampleSize / 3;
    const sample1 = fileBuffer.slice(0, sampleSize).toString('utf8');
    const sample2 = fileBuffer.slice(fileBuffer.length / 2, fileBuffer.length / 2 + sampleSize).toString('utf8');
    const sample3 = fileBuffer.slice(fileBuffer.length - sampleSize).toString('utf8');
    
    return sample1 + '\n' + sample2 + '\n' + sample3;
  }

  /**
   * Detect images in document
   */
  detectImages(fileBuffer, mimeType) {
    return mimeType.startsWith('image/');
  }

  /**
   * Estimate page count
   */
  estimatePageCount(fileBuffer, mimeType) {
    if (mimeType === 'application/pdf') {
      return Math.max(1, Math.floor(fileBuffer.length / 4000));
    }
    
    return 1;
  }

  /**
   * Detect language (enhanced)
   */
  detectLanguage(text) {
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const spanishWords = ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le'];
    const frenchWords = ['le', 'la', 'de', 'et', 'à', 'en', 'un', 'une', 'des', 'du', 'dans', 'sur', 'avec'];
    
    const lowerText = text.toLowerCase();
    const englishCount = englishWords.filter(word => lowerText.includes(word)).length;
    const spanishCount = spanishWords.filter(word => lowerText.includes(word)).length;
    const frenchCount = frenchWords.filter(word => lowerText.includes(word)).length;
    
    if (spanishCount > englishCount && spanishCount > frenchCount) {
      return 'es';
    }
    
    if (frenchCount > englishCount && frenchCount > spanishCount) {
      return 'fr';
    }
    
    return 'en'; // Default to English
  }
}

module.exports = AIDocumentAnalyzer;
