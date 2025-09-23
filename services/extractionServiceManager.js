/**
 * Extraction Service Manager
 * 
 * Manages switching between AI and custom extraction services
 * Provides fallback mechanisms and intelligent service selection
 */

const ExtractionService = require('./extractionService');
const CustomExtractionService = require('./customExtractionService');

class ExtractionServiceManager {
  constructor() {
    this.aiService = new ExtractionService();
    this.customService = new CustomExtractionService();
    this.serviceConfig = {
      preferredService: 'auto', // 'ai', 'custom', 'auto'
      fallbackEnabled: true,
      customServiceThreshold: 5000, // Use custom for documents < 5KB
      aiServiceThreshold: 100000, // Use AI for documents > 100KB
      hybridMode: true // Use both services and combine results
    };
  }

  /**
   * Extract contacts using the best available service
   * @param {Buffer} fileBuffer - File content
   * @param {string} mimeType - MIME type
   * @param {string} fileName - File name
   * @param {Object} options - Extraction options
   * @returns {Object} Extraction result
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    const startTime = Date.now();
    console.log('🎯 Starting intelligent extraction...');
    console.log('📁 File:', fileName, 'Type:', mimeType, 'Size:', fileBuffer.length);

    try {
      // Determine the best service to use
      const serviceStrategy = this.determineServiceStrategy(fileBuffer, mimeType, fileName, options);
      console.log('🎯 Service strategy:', serviceStrategy);

      let result;

      switch (serviceStrategy) {
        case 'custom':
          result = await this.extractWithCustomService(fileBuffer, mimeType, fileName, options);
          break;
        case 'ai':
          result = await this.extractWithAIService(fileBuffer, mimeType, fileName, options);
          break;
        case 'hybrid':
          result = await this.extractWithHybridService(fileBuffer, mimeType, fileName, options);
          break;
        default:
          throw new Error('Unknown service strategy');
      }

      const processingTime = Date.now() - startTime;
      result.metadata.processingTime = processingTime;
      result.metadata.serviceStrategy = serviceStrategy;

      console.log(`⏱️ Extraction completed in ${processingTime}ms using ${serviceStrategy} strategy`);
      return result;

    } catch (error) {
      console.error('❌ Extraction failed:', error);
      
      // Try fallback if enabled
      if (this.serviceConfig.fallbackEnabled) {
        console.log('🔄 Attempting fallback extraction...');
        try {
          const fallbackResult = await this.extractWithFallback(fileBuffer, mimeType, fileName, options);
          const processingTime = Date.now() - startTime;
          fallbackResult.metadata.processingTime = processingTime;
          fallbackResult.metadata.serviceStrategy = 'fallback';
          return fallbackResult;
        } catch (fallbackError) {
          console.error('❌ Fallback extraction also failed:', fallbackError);
        }
      }

      return {
        success: false,
        error: error.message,
        contacts: [],
        metadata: {
          extractionMethod: 'failed',
          serviceStrategy: 'failed',
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Determine the best service strategy based on document characteristics
   */
  determineServiceStrategy(fileBuffer, mimeType, fileName, options) {
    const fileSize = fileBuffer.length;
    const fileSizeKB = fileSize / 1024;

    // Check if AI service is available
    const aiServiceAvailable = this.isAIServiceAvailable();
    const customServiceAvailable = this.isCustomServiceAvailable();

    // Force custom service if AI is not available
    if (!aiServiceAvailable && customServiceAvailable) {
      return 'custom';
    }

    // Force AI service if custom is not available
    if (aiServiceAvailable && !customServiceAvailable) {
      return 'ai';
    }

    // If neither service is available, try custom as fallback
    if (!aiServiceAvailable && !customServiceAvailable) {
      return 'custom';
    }

    // Use configured preferred service
    if (this.serviceConfig.preferredService === 'custom') {
      return 'custom';
    }
    if (this.serviceConfig.preferredService === 'ai') {
      return 'ai';
    }

    // Auto mode - choose based on document characteristics
    if (fileSizeKB < this.serviceConfig.customServiceThreshold) {
      return 'custom'; // Small documents - use custom
    }
    
    if (fileSizeKB > this.serviceConfig.aiServiceThreshold) {
      return 'ai'; // Large documents - use AI
    }

    // Medium documents - use hybrid if enabled
    if (this.serviceConfig.hybridMode) {
      return 'hybrid';
    }

    // Default to custom for medium documents
    return 'custom';
  }

  /**
   * Extract using custom service only
   */
  async extractWithCustomService(fileBuffer, mimeType, fileName, options) {
    console.log('🔧 Using custom extraction service...');
    return await this.customService.extractContacts(fileBuffer, mimeType, fileName, options);
  }

  /**
   * Extract using AI service only
   */
  async extractWithAIService(fileBuffer, mimeType, fileName, options) {
    console.log('🤖 Using AI extraction service...');
    return await this.aiService.extractContacts(fileBuffer, mimeType, fileName, options);
  }

  /**
   * Extract using hybrid approach (both services)
   */
  async extractWithHybridService(fileBuffer, mimeType, fileName, options) {
    console.log('🔄 Using hybrid extraction approach...');
    
    const [customResult, aiResult] = await Promise.allSettled([
      this.customService.extractContacts(fileBuffer, mimeType, fileName, options),
      this.aiService.extractContacts(fileBuffer, mimeType, fileName, options)
    ]);

    const customContacts = customResult.status === 'fulfilled' ? customResult.value.contacts : [];
    const aiContacts = aiResult.status === 'fulfilled' ? aiResult.value.contacts : [];

    console.log(`🔧 Custom service: ${customContacts.length} contacts`);
    console.log(`🤖 AI service: ${aiContacts.length} contacts`);

    // Combine and deduplicate results
    const combinedContacts = this.combineAndDeduplicateContacts(customContacts, aiContacts);
    
    console.log(`🔄 Hybrid result: ${combinedContacts.length} unique contacts`);

    return {
      success: true,
      contacts: combinedContacts,
      metadata: {
        extractionMethod: 'hybrid',
        customContacts: customContacts.length,
        aiContacts: aiContacts.length,
        combinedContacts: combinedContacts.length,
        customSuccess: customResult.status === 'fulfilled',
        aiSuccess: aiResult.status === 'fulfilled'
      }
    };
  }

  /**
   * Fallback extraction when primary method fails
   */
  async extractWithFallback(fileBuffer, mimeType, fileName, options) {
    console.log('🆘 Using fallback extraction...');
    
    // Try custom service as fallback
    if (this.isCustomServiceAvailable()) {
      return await this.customService.extractContacts(fileBuffer, mimeType, fileName, options);
    }
    
    // If custom is not available, try AI
    if (this.isAIServiceAvailable()) {
      return await this.aiService.extractContacts(fileBuffer, mimeType, fileName, options);
    }
    
    throw new Error('No extraction services available');
  }

  /**
   * Check if AI service is available
   */
  isAIServiceAvailable() {
    try {
      // Check if OpenAI API key is configured
      return !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'undefined';
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if custom service is available
   */
  isCustomServiceAvailable() {
    try {
      // Custom service is always available
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Combine and deduplicate contacts from multiple services
   */
  combineAndDeduplicateContacts(customContacts, aiContacts) {
    const allContacts = [...customContacts, ...aiContacts];
    const uniqueContacts = [];
    const seenEmails = new Set();
    const seenNames = new Set();

    for (const contact of allContacts) {
      const email = contact.email?.toLowerCase();
      const name = contact.name?.toLowerCase();

      // Skip if we've already seen this email
      if (email && seenEmails.has(email)) {
        continue;
      }

      // Skip if we've already seen this name (fuzzy matching)
      if (name && this.isSimilarName(name, Array.from(seenNames))) {
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
   * Check if a name is similar to existing names
   */
  isSimilarName(name, existingNames) {
    for (const existingName of existingNames) {
      const similarity = this.calculateStringSimilarity(name, existingName);
      if (similarity > 0.8) { // 80% similarity threshold
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
   * Get service status and capabilities
   */
  getServiceStatus() {
    return {
      aiService: {
        available: this.isAIServiceAvailable(),
        name: 'OpenAI GPT',
        capabilities: ['Large documents', 'High accuracy', 'Context understanding']
      },
      customService: {
        available: this.isCustomServiceAvailable(),
        name: 'Custom Pattern Engine',
        capabilities: ['Fast processing', 'No API limits', 'Production-specific', 'OCR support']
      },
      configuration: this.serviceConfig
    };
  }

  /**
   * Update service configuration
   */
  updateConfiguration(newConfig) {
    this.serviceConfig = { ...this.serviceConfig, ...newConfig };
    console.log('⚙️ Service configuration updated:', this.serviceConfig);
  }
}

module.exports = ExtractionServiceManager;
