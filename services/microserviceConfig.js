/**
 * Microservices Configuration
 * Defines service boundaries for scalable architecture
 */

const microservices = {
  // Document Processing Service
  documentService: {
    port: 3001,
    responsibilities: [
      'File upload handling',
      'Text extraction from documents',
      'Document format validation',
      'File storage management'
    ],
    dependencies: ['pdfjs-dist', 'mammoth', 'xlsx', 'tesseract.js'],
    scaling: {
      horizontal: true,
      maxInstances: 10,
      loadBalancer: true
    }
  },

  // AI Processing Service
  aiService: {
    port: 3002,
    responsibilities: [
      'Contact extraction using AI',
      'Document structure analysis',
      'Chunking and processing',
      'OpenAI API management'
    ],
    dependencies: ['openai', 'node-fetch'],
    scaling: {
      horizontal: true,
      maxInstances: 20,
      loadBalancer: true,
      rateLimiting: true
    }
  },

  // Queue Management Service
  queueService: {
    port: 3003,
    responsibilities: [
      'Job queue management',
      'Task distribution',
      'Progress tracking',
      'Error handling'
    ],
    dependencies: ['bull', 'ioredis'],
    scaling: {
      horizontal: true,
      maxInstances: 5,
      redis: true
    }
  },

  // API Gateway
  apiGateway: {
    port: 3000,
    responsibilities: [
      'Request routing',
      'Authentication',
      'Rate limiting',
      'Response aggregation'
    ],
    dependencies: ['express', 'cors', 'helmet'],
    scaling: {
      horizontal: true,
      maxInstances: 15,
      loadBalancer: true
    }
  }
};

module.exports = microservices;
