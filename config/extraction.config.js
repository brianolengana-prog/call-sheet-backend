/**
 * Extraction Configuration
 * 
 * Controls how contact extraction works in the system
 */

module.exports = {
  // Feature flags
  useAdaptiveExtractor: process.env.USE_ADAPTIVE_EXTRACTOR === 'true' || process.env.NODE_ENV === 'development',
  useMultiPass: process.env.USE_MULTI_PASS === 'true',
  fallbackToAI: process.env.FALLBACK_TO_AI !== 'false', // Default true
  
  // Confidence thresholds
  confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.3,
  highConfidenceThreshold: 0.8,
  mediumConfidenceThreshold: 0.5,
  
  // Strategy selection
  enabledStrategies: process.env.ENABLED_STRATEGIES?.split(',') || [
    'Line-by-Line',
    'Multi-Line',
    'Tabular',
    'Structured',
    'Freeform'
  ],
  
  // Performance limits
  maxProcessingTime: parseInt(process.env.MAX_PROCESSING_TIME) || 30000, // 30 seconds
  maxContactsPerSheet: parseInt(process.env.MAX_CONTACTS_PER_SHEET) || 500,
  
  // Validation rules
  requireName: process.env.REQUIRE_NAME !== 'false', // Default true
  requireContactInfo: process.env.REQUIRE_CONTACT_INFO === 'true', // Default false (permissive)
  minNameLength: parseInt(process.env.MIN_NAME_LENGTH) || 2,
  
  // Debugging
  verboseLogging: process.env.EXTRACTION_VERBOSE === 'true',
  logExtractionDetails: process.env.LOG_EXTRACTION_DETAILS === 'true',
  
  // Quality tiers
  qualityTiers: {
    high: { threshold: 0.8, label: 'High Quality', autoAccept: true },
    medium: { threshold: 0.5, label: 'Medium Quality', autoAccept: true },
    low: { threshold: 0.3, label: 'Low Quality', autoAccept: true },
    reject: { threshold: 0.0, label: 'Rejected', autoAccept: false }
  }
};

