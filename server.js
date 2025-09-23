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

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy configuration - be more specific to avoid rate limiting issues
// In production, trust only the first proxy (Render's load balancer)
// In development, don't trust any proxies
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

// IP filtering (should be first)
app.use(ipFilter);

// Suspicious activity detection
app.use(suspiciousActivityDetector);

// Security headers
app.use(securityHeaders);

// Security logging
app.use(securityLogger);

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
      return callback(null, origin); // Return the actual origin, not true
    }
    
    // Check for Vercel preview domains
    if (origin && origin.endsWith('.vercel.app')) {
      console.log('✅ CORS: Origin allowed (Vercel preview domain)');
      return callback(null, origin); // Return the actual origin
    }
    
    // Check for localhost with any port
    if (origin && origin.startsWith('http://localhost:')) {
      console.log('✅ CORS: Origin allowed (localhost)');
      return callback(null, origin); // Return the actual origin
    }
    
    console.log('❌ CORS: Origin rejected:', origin);
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  preflightContinue: false,
  optionsSuccessStatus: 200
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
    // Initialize Prisma database connection
    console.log('🔌 Connecting to database...');
    await prismaService.connect();
    
    // Cleanup old logs on startup
    await authLogger.cleanupOldLogs(90); // Keep logs for 90 days
    
    console.log('✅ Prisma connected to database');
    console.log('🔐 Security monitoring initialized');
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Enhanced Secure Backend Server running on port ${PORT}`);
      console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'Not configured'}`);
      console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💳 Stripe Mode: ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'LIVE' : 'TEST'}`);
      console.log(`📡 Webhook Mode: ${process.env.NODE_ENV === 'production' ? 'Production' : 'Development (manual sync enabled)'}`);
      console.log(`🛡️  Security Features: ✅ Authentication ✅ Rate Limiting ✅ CSRF Protection ✅ Session Management`);
      console.log(`📊 Logging: Authentication events, Security incidents, Rate limiting`);
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

// Initialize the server
initializeServer();