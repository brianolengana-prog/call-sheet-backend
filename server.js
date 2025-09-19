const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const stripeRoutes = require('./routes/stripe');
const stripeAdminRoutes = require('./routes/stripe-admin');
const authRoutes = require('./routes/auth');
const googleAuthRoutes = require('./routes/googleAuth');
const clerkWebhookRoutes = require('./routes/clerkWebhooks');
const chatRoutes = require('./routes/chat');
const supportRoutes = require('./routes/support');
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

// Security logging
app.use(securityLogger);

// Enhanced security headers (replaces basic helmet)
app.use(securityHeaders);

// Basic helmet with custom config
app.use(helmet({
  contentSecurityPolicy: false, // We handle this in securityHeaders
  crossOriginEmbedderPolicy: false // Custom handled
}));

// Request validation
app.use(validateRequest);

// General rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS configuration with multiple allowed origins
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:5173', // Vite dev server
  'http://localhost:3000', // React dev server
  'https://sjcallsheets-project.vercel.app', // Production frontend
  'https://sjcallsheets-project-git-main-servi.vercel.app', // Vercel preview
  'https://*.vercel.app', // Vercel preview domains
  'https://www.callsheetconvert.com', // Live production domain
  'https://callsheetconvert.com',
  'https://www.callsheetconverter.com'
];

// Log CORS configuration on startup
console.log('🌐 CORS Configuration:');
console.log('  - FRONTEND_URL:', process.env.FRONTEND_URL || 'http://localhost:3000');
console.log('  - Allowed Origins:', allowedOrigins);

app.use(cors({
    origin: function (origin, callback) {
      // Log CORS requests for debugging
      console.log('🔍 CORS Request from origin:', origin);
      
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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
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
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'CallSheet AI Stripe Backend',
    version: '1.0.0'
  });
});

// CSRF protection (after body parsing)
app.use(csrfProtection);

// API routes with specific rate limiting
app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/google-auth', authStatusRateLimit, googleAuthRoutes);
app.use('/api/clerk', clerkWebhookRoutes); // No rate limiting for webhooks
app.use('/api/stripe', stripeRateLimit, stripeRoutes);
app.use('/api/stripe-admin', stripeRateLimit, stripeAdminRoutes);
app.use('/api/chat', apiRateLimit, chatRoutes);
app.use('/api/support', apiRateLimit, supportRoutes);

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
    // Cleanup old logs on startup
    await authLogger.cleanupOldLogs(90); // Keep logs for 90 days
    
    // Initialize security monitoring
    console.log('🔐 Security monitoring initialized');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Enhanced Secure Backend Server running on port ${PORT}`);
      console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💳 Stripe Mode: ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'TEST' : 'LIVE'}`);
      console.log(`📡 Webhook Mode: Development (manual sync enabled)`);
      console.log(`🛡️  Security Features: ✅ Authentication ✅ Rate Limiting ✅ CSRF Protection ✅ Session Management`);
      console.log(`📊 Logging: Authentication events, Security incidents, Rate limiting`);
      
      // Schedule periodic log cleanup (daily)
      setInterval(async () => {
        try {
          await authLogger.cleanupOldLogs(90);
        } catch (error) {
          console.error('Log cleanup error:', error);
        }
      }, 24 * 60 * 60 * 1000); // 24 hours
    });
    
  } catch (error) {
    console.error('Server initialization failed:', error);
    process.exit(1);
  }
};

// Initialize the server
initializeServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;
