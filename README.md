# CallSheet AI Enhanced Secure Backend

This is the Express.js backend server that handles Stripe payment operations and provides robust authentication and security features for the CallSheet AI CRM system.

## 🛡️ Security Features

- **Enhanced JWT Authentication** with proper signature verification
- **Session Management** with device fingerprinting
- **Rate Limiting** per endpoint type (auth, API, payments)
- **Comprehensive Security Headers** (CSP, HSTS, XSS protection)
- **Request Validation** and XSS prevention
- **Security Event Logging** and monitoring
- **CSRF Protection** and IP filtering
- **Suspicious Activity Detection**

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Copy the environment template and fill in your values:
```bash
cp env.template .env
```

**Required Environment Variables:**
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook endpoint secret from Stripe
- `FRONTEND_URL` - Your React frontend URL (default: http://localhost:3000)

### 3. Start the Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will run on port 3001 by default.

## 🏗️ Architecture

```
Frontend (React) → Express Backend → Stripe API
                ↓
            Payment Processing
            Subscription Management
            Webhook Handling
```

## 📡 API Endpoints

## 🔐 Authentication & Security

This backend implements enterprise-grade security features:

### New Authentication Endpoints

#### `POST /api/auth/validate`
Validate current authentication token and retrieve user info.

#### `POST /api/auth/logout`
Logout and invalidate current session.

#### `POST /api/auth/logout-all`
Logout from all devices (invalidate all user sessions).

#### `GET /api/auth/sessions`
Get active sessions for current user.

#### `GET /api/auth/profile`
Get user profile with security information.

#### `GET /api/auth/security-log` (Admin Only)
Generate security reports and view authentication logs.

### Security Middleware

All endpoints are protected by:
- Rate limiting (5 auth attempts per 15 min, 60 API requests per min)
- Request validation and XSS prevention
- Security headers (CSP, HSTS, X-Frame-Options)
- Session fingerprinting
- IP filtering and suspicious activity detection
- Comprehensive security logging

### Stripe Endpoints (Authentication Required)

#### `POST /api/stripe/create-checkout-session`
Creates a Stripe checkout session for subscription signup.

**Request Body:**
```json
{
  "priceId": "price_starter_monthly",
  "successUrl": "http://localhost:3000/billing?success=true",
  "cancelUrl": "http://localhost:3000/billing?canceled=true",
  "customerEmail": "user@example.com",
  "metadata": {
    "planId": "starter"
  }
}
```

#### `POST /api/stripe/create-portal-session`
Creates a Stripe customer portal session for subscription management.

**Request Body:**
```json
{
  "returnUrl": "http://localhost:3000/billing"
}
```

#### `GET /api/stripe/customer`
Retrieves customer information and subscription details.

#### `POST /api/stripe/cancel-subscription`
Cancels a user's subscription.

**Request Body:**
```json
{
  "subscriptionId": "sub_..."
}
```

#### `POST /api/stripe/update-subscription`
Changes a user's subscription plan.

**Request Body:**
```json
{
  "subscriptionId": "sub_...",
  "newPriceId": "price_professional_monthly"
}
```

#### `GET /api/stripe/billing-history`
Retrieves customer billing history.

### Public Endpoints

#### `GET /api/stripe/plans`
Retrieves available subscription plans from Stripe.

#### `POST /api/stripe/webhook`
Handles Stripe webhook events (requires webhook signature verification).

## 🔐 Authentication

The backend uses JWT tokens from Supabase for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 🛡️ Security Features

- **Helmet.js** - Security headers
- **Rate Limiting** - Prevents abuse
- **CORS Protection** - Configurable origins
- **Webhook Verification** - Stripe signature validation
- **Input Validation** - Request body validation

## 🧪 Testing

### Health Check
```bash
curl http://localhost:3001/health
```

### Test Stripe Endpoints
```bash
# Get available plans
curl http://localhost:3001/api/stripe/plans

# Health check
curl http://localhost:3001/health
```

## 🔧 Development

### File Structure
```
backend/
├── middleware/
│   ├── auth.js              # JWT authentication
│   ├── errorHandler.js      # Global error handling
│   └── stripeWebhook.js     # Webhook validation
├── routes/
│   └── stripe.js            # Stripe API routes
├── server.js                # Main server file
├── package.json             # Dependencies
├── env.template             # Environment variables template
└── README.md                # This file
```

### Adding New Routes
1. Create a new route file in `routes/`
2. Import and use it in `server.js`
3. Add appropriate middleware (auth, validation, etc.)

### Error Handling
All errors are caught by the global error handler middleware and formatted consistently.

## 🚀 Deployment

### Environment Variables
Ensure all required environment variables are set in production.

### Security
- Use strong JWT secrets
- Enable HTTPS in production
- Set appropriate CORS origins
- Configure rate limiting for production load

### Monitoring
- Health check endpoint: `/health`
- Error logging to console
- Stripe webhook event logging

## 🔗 Integration with Frontend

The frontend should:
1. Send JWT tokens in Authorization headers
2. Handle Stripe checkout redirects
3. Process webhook events for real-time updates
4. Use the billing endpoints for subscription management

## 📚 Resources

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Express.js Documentation](https://expressjs.com/)
- [Supabase Documentation](https://supabase.com/docs)

## 🆘 Troubleshooting

### Common Issues

1. **CORS Errors**: Check `FRONTEND_URL` in environment variables
2. **Authentication Failures**: Verify JWT token format and expiration
3. **Stripe Errors**: Check `STRIPE_SECRET_KEY` and API version
4. **Webhook Failures**: Verify `STRIPE_WEBHOOK_SECRET`

### Logs
Check console output for detailed error messages and Stripe webhook events.
