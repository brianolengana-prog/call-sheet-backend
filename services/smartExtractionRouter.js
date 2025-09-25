/**
 * Smart Extraction Router
 * 
 * Simplified router that uses the unified extraction service
 */

const UnifiedExtractionService = require('./unifiedExtractionService');

class SmartExtractionRouter {
  constructor() {
    // Use unified extraction service
    this.unifiedService = new UnifiedExtractionService();
    
    // Performance metrics
    this.metrics = {
      totalExtractions: 0,
      successfulExtractions: 0,
      averageProcessingTime: 0
    };
  }

  /**
   * Main extraction method - uses unified service
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    const startTime = Date.now();
    console.log('🧠 Starting unified extraction...');
    
    try {
      this.metrics.totalExtractions++;
      
      // Use unified service for all extractions
      const result = await this.unifiedService.extractContacts(fileBuffer, mimeType, fileName, options);
      
      // Update metrics
      this.metrics.successfulExtractions++;
      const processingTime = Date.now() - startTime;
      this.metrics.averageProcessingTime = 
        (this.metrics.averageProcessingTime * (this.metrics.successfulExtractions - 1) + processingTime) / 
        this.metrics.successfulExtractions;
      
      // Add routing metadata
      result.metadata = {
        ...result.metadata,
        routingStrategy: { method: 'unified', reason: 'ai_enhanced', confidence: 0.95 },
        processingTime
      };
      
      console.log(`✅ Unified extraction completed in ${processingTime}ms`);
      return result;
      
    } catch (error) {
      console.error('❌ Unified extraction failed:', error);
      throw error;
    }
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalExtractions > 0 
        ? (this.metrics.successfulExtractions / this.metrics.totalExtractions) * 100 
        : 0
    };
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    return {
      status: 'healthy',
      service: 'SmartExtractionRouter',
      unifiedService: this.unifiedService.getStats(),
      metrics: this.getMetrics()
    };
  }
}

module.exports = SmartExtractionRouter;