/**
 * Test Server Setup
 * 
 * Creates a test-specific Express server for testing
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

// Import routes
const customExtractionRoutes = require('../routes/customExtraction');
const optimizedExtractionRoutes = require('../routes/optimizedExtraction');
const apiKeyRoutes = require('../routes/apiKeys');

// Mock the services to prevent Redis connection issues
jest.mock('../services/queueService');
jest.mock('../services/cacheService');
jest.mock('../services/monitoringService');
jest.mock('../services/optimizedAIExtractionService');

// Import middleware
const { errorHandler } = require('../middleware/errorHandler');
const { securityHeaders, apiRateLimit } = require('../middleware/security');
const { structuredLogging } = require('../middleware/logging');

const app = express();

// Basic middleware for testing
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Security headers
app.use(securityHeaders);

// Rate limiting
app.use(apiRateLimit);

// Structured logging
app.use(structuredLogging);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    service: 'test',
    database: 'connected'
  });
});

// Capabilities endpoint for testing
app.get('/api/custom-extraction/capabilities', (req, res) => {
  res.json({
    success: true,
    capabilities: {
      documentTypes: ['call_sheet', 'contact_list', 'production_document'],
      extractionMethods: ['ai', 'custom'],
      supportedFormats: ['pdf', 'docx', 'xlsx']
    }
  });
});

// Routes
app.use('/api/custom-extraction', customExtractionRoutes);
app.use('/api/optimized-extraction', optimizedExtractionRoutes);
app.use('/api/api-keys', apiKeyRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handler
app.use(errorHandler);

module.exports = app;
