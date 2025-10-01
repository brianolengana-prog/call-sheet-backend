const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Initialize Prisma
const prismaService = require('./services/prismaService');

const stripeAdminRoutes = require('./routes/stripe-admin');
const authRoutes = require('./routes/auth');
const googleAuthRoutes = require('./routes/googleAuth');
const clerkWebhookRoutes = require('./routes/clerkWebhooks');
const chatRoutes = require('./routes/chat');
const supportRoutes = require('./routes/support');
const subscriptionRoutes = require('./routes/subscription');
const extractionRoutes = require('./routes/extraction');
const usageRoutes = require('./routes/usage');
const stripeEnhancedRoutes = require('./routes/stripeEnhanced');
const contactsRoutes = require('./routes/contacts');
const customExtractionRoutes = require('./routes/customExtraction');
const smartExtractionRoutes = require('./routes/smartExtraction');
const newOptimizedExtractionRoutes = require('./routes/newOptimizedExtraction');
const apiKeyRoutes = require('./routes/apiKeys');
const apiKeyManagementRoutes = require('./routes/apiKeyManagement');
const apiExtractionRoutes = require('./routes/apiExtraction');
const { errorHandler } = require('./middleware/errorHandler');
const {
  securityHeaders,
  csrfProtection,
  apiRateLimit,
  stripeRateLimit,
  portalRateLimit,
  authRateLimit,
  authStatusRateLimit,
  validateRequest,
  securityLogger,
  ipFilter,
  suspiciousActivityDetector
} = require('./middleware/security');
const authLogger = require('./utils/authLogger');
const { structuredLogging } = require('./middleware/logging');

const app = express();
const PORT = process.env.PORT || 3001;

// Log port configuration for debugging
console.log(`🔧 Port configuration: ${PORT}`);
console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
console.log(`🔧 Process env PORT: ${process.env.PORT}`);

// Memory monitoring
const checkMemoryUsage = () => {
  const usage = process.memoryUsage();
  const memoryUsagePercent = (usage.heapUsed / usage.heapTotal) * 100;
  
  if (memoryUsagePercent > 90) {
    console.warn(`🚨 Alert: High memory usage: ${memoryUsagePercent.toFixed(2)}%`);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('🧹 Forced garbage collection');
    }
    
    // Log detailed memory info
    console.log('📊 Memory Details:', {
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`,
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`
    });
  }
  
  // Additional cleanup for PDF processing
  if (memoryUsagePercent > 85) {
    console.log('🧹 Performing additional memory cleanup for PDF processing...');
    
    // Clear any cached data
    if (global.gc) {
      global.gc();
    }
    
    // Log memory usage by component
    console.log('📊 Memory breakdown:', {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
      external: Math.round(usage.external / 1024 / 1024) + 'MB',
      rss: Math.round(usage.rss / 1024 / 1024) + 'MB'
    });
  }
};

// Check memory every 30 seconds
setInterval(checkMemoryUsage, 30000);

// Trust proxy configuration - be more specific to avoid rate limiting issues
// In production, trust only the first proxy (Render's load balancer)
// In development, don't trust any proxies
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

// Memory optimization middleware
app.use((req, res, next) => {
  // Limit request size to prevent memory issues
  const maxSize = 10 * 1024 * 1024; // 10MB limit
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
    return res.status(413).json({ error: 'Request too large' });
  }
  next();
});

// Add cleanup middleware for file uploads
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    // Clean up any temporary data
    if (req.file) {
      // File cleanup handled by multer
    }
    return originalSend.call(this, data);
  };
  next();
});

// IP filtering (should be first)
app.use(ipFilter);

// Suspicious activity detection
app.use(suspiciousActivityDetector);

// Security headers
app.use(securityHeaders);

// Security logging
app.use(securityLogger);

// Structured logging with correlation IDs
app.use(structuredLogging);

// Helmet for additional security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://hooks.stripe.com"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const allowedOrigins = [
  'https://www.callsheetconvert.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://sjcallsheets-project.vercel.app',
  'https://sjcallsheets-project-git-main-servi.vercel.app',
  'https://*.vercel.app',
  'https://www.callsheetconvert.com',
  'https://callsheetconvert.com',
  'https://www.callsheetconverter.com'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('✅ CORS: Allowing request with no origin');
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      console.log('✅ CORS: Origin allowed from allowedOrigins list');
      return callback(null, true);
    }
    
    // Check for Vercel preview domains
    if (origin && origin.endsWith('.vercel.app')) {
      console.log('✅ CORS: Origin allowed (Vercel preview domain)');
      return callback(null, true);
    }
    
    // Check for localhost with any port
    if (origin && origin.startsWith('http://localhost:')) {
      console.log('✅ CORS: Origin allowed (localhost)');
      return callback(null, true);
    }
    
    console.log('❌ CORS: Origin rejected:', origin);
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control', 'Pragma', 'Expires', 'X-Timestamp'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Cookie parsing middleware
app.use(cookieParser());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await prismaService.healthCheck();
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'CallSheet AI Stripe Backend',
      version: '1.0.0',
      database: dbHealth
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      service: 'CallSheet AI Stripe Backend',
      version: '1.0.0',
      error: error.message
    });
  }
});

// Root endpoint for health checks (Render, etc.)
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'CallSheet AI Stripe Backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0',
    port: PORT,
    environment: process.env.NODE_ENV
  });
});

// CSRF protection (after body parsing)
app.use(csrfProtection);

// API routes with specific rate limiting
app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/google-auth', authStatusRateLimit, googleAuthRoutes);
app.use('/api/clerk', clerkWebhookRoutes); // No rate limiting for webhooks
app.use('/api/stripe-admin', stripeRateLimit, stripeAdminRoutes);
app.use('/api/subscription', apiRateLimit, subscriptionRoutes);
app.use('/api/extraction', apiRateLimit, extractionRoutes);
app.use('/api/usage', apiRateLimit, usageRoutes);
app.use('/api/stripe', stripeRateLimit, stripeEnhancedRoutes);
app.use('/api/chat', apiRateLimit, chatRoutes);
app.use('/api/support', apiRateLimit, supportRoutes);
app.use('/api/contacts', apiRateLimit, contactsRoutes);
app.use('/api/jobs', apiRateLimit, contactsRoutes); // Jobs are handled by contacts route
app.use('/api/custom-extraction', apiRateLimit, customExtractionRoutes);
app.use('/api/smart-extraction', apiRateLimit, smartExtractionRoutes);
app.use('/api/new-optimized-extraction', apiRateLimit, newOptimizedExtractionRoutes);
app.use('/api/api-keys', apiRateLimit, apiKeyRoutes);
app.use('/api/api-keys', apiRateLimit, apiKeyManagementRoutes);
app.use('/api', apiRateLimit, apiExtractionRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handling middleware
app.use(errorHandler);

// Startup routine
const initializeServer = async () => {
  try {
    // Validate database configuration
    console.log('🔍 Debug: DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('🔍 Debug: DATABASE_URL value:', process.env.DATABASE_URL);
    console.log('🔍 Debug: DATABASE_URL type:', typeof process.env.DATABASE_URL);
    console.log('🔍 Debug: DATABASE_URL length:', process.env.DATABASE_URL?.length);
    
    if (!process.env.DATABASE_URL) {
      throw new Error('❌ DATABASE_URL environment variable is required');
    }
    
    if (!process.env.DATABASE_URL.startsWith('postgresql://') && !process.env.DATABASE_URL.startsWith('postgres://')) {
      console.log('❌ DATABASE_URL does not start with postgresql:// or postgres://');
      console.log('❌ Actual value:', JSON.stringify(process.env.DATABASE_URL));
      throw new Error('❌ DATABASE_URL must start with postgresql:// or postgres://');
    }
    
    console.log('✅ Database URL configured:', process.env.DATABASE_URL.substring(0, 20) + '...');
    
    // Initialize Prisma database connection
    console.log('🔌 Connecting to database...');
    await prismaService.connect();
    
    // Cleanup old logs on startup
    await authLogger.cleanupOldLogs(90); // Keep logs for 90 days
    
    console.log('✅ Prisma connected to database');
    console.log('🔐 Security monitoring initialized');
    
    // Start the server
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Enhanced Secure Backend Server running on port ${PORT}`);
      console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'Not configured'}`);
      console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💳 Stripe Mode: ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'LIVE' : 'TEST'}`);
      console.log(`📡 Webhook Mode: ${process.env.NODE_ENV === 'production' ? 'Production' : 'Development (manual sync enabled)'}`);
      console.log(`🛡️  Security Features: ✅ Authentication ✅ Rate Limiting ✅ CSRF Protection ✅ Session Management`);
      console.log(`📊 Logging: Authentication events, Security incidents, Rate limiting`);
      console.log(`✅ Server successfully bound to port ${PORT} on 0.0.0.0`);
      console.log(`🌐 Server accessible at: http://0.0.0.0:${PORT}`);
    });

    // Handle server errors
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Graceful shutdown...');
  try {
    await prismaService.disconnect();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Graceful shutdown...');
  try {
    await prismaService.disconnect();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Initialize the server with error handling
initializeServer().catch(error => {
  console.error('❌ Failed to initialize server:', error);
  process.exit(1);
});