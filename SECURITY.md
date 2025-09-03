# Security Implementation Guide

## 🔐 Overview

This document outlines the comprehensive security implementation for the CallSheet AI backend, including authentication, authorization, session management, and security monitoring.

## 🏗️ Security Architecture

### Authentication Flow
```
Client Request → Rate Limiting → IP Filter → Token Validation → Session Check → Route Handler
                ↓                ↓            ↓               ↓             ↓
            Log Event       Security Log   Auth Log       Session Log   Access Log
```

## 🛡️ Security Features

### 1. Enhanced JWT Authentication
- **Signature Verification**: Proper JWT signature validation with Supabase keys
- **Token Structure Validation**: Comprehensive token format checking
- **Expiration Handling**: Advanced expiration checks with clock skew tolerance
- **Development Fallback**: Graceful degradation in development mode

### 2. Session Management
- **Session Tracking**: Unique session IDs for each authentication
- **Fingerprinting**: Device fingerprinting for session validation
- **Session Limits**: Maximum 5 active sessions per user
- **Session Cleanup**: Automatic cleanup of old/inactive sessions

### 3. Rate Limiting
- **Authentication**: 5 attempts per 15 minutes
- **API Endpoints**: 60 requests per minute
- **Stripe Operations**: 10 requests per minute
- **IP-based Tracking**: Per-IP rate limiting with Redis-like storage

### 4. Security Headers
- **Content Security Policy**: Strict CSP with nonce support
- **HSTS**: HTTP Strict Transport Security
- **X-Frame-Options**: Clickjacking protection
- **X-Content-Type-Options**: MIME sniffing protection
- **Referrer Policy**: Privacy-focused referrer handling

### 5. Request Validation
- **XSS Prevention**: Input sanitization and validation
- **Suspicious Pattern Detection**: Automatic blocking of malicious patterns
- **Content Validation**: JSON and query parameter validation

### 6. Comprehensive Logging
- **Authentication Events**: Success/failure tracking
- **Security Incidents**: Automated threat detection
- **Session Management**: Session lifecycle logging
- **Rate Limiting**: Abuse attempt logging

## 📊 Monitoring & Alerting

### Log Files
- `auth-YYYY-MM-DD.log`: Authentication attempts and outcomes
- `security-YYYY-MM-DD.log`: Security incidents and threats
- `session-YYYY-MM-DD.log`: Session management events
- `rate_limit-YYYY-MM-DD.log`: Rate limiting events

### Security Reports
Access via `/api/auth/security-log` (admin only):
```json
{
  "period": { "startDate": "2024-01-01", "endDate": "2024-01-31" },
  "authAttempts": { "total": 1250, "successful": 1200, "failed": 50 },
  "securityIncidents": [...],
  "rateLimitEvents": 15,
  "topFailureReasons": { "token_expired": 30, "invalid_format": 20 },
  "suspiciousIPs": ["192.168.1.100", "10.0.0.50"]
}
```

## 🔧 Configuration

### Environment Variables
```env
# Authentication
JWT_SECRET=your-strong-jwt-secret
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
BLACKLISTED_IPS=192.168.1.100,10.0.0.50
LOG_RETENTION_DAYS=90
ENABLE_SECURITY_LOGGING=true
CSRF_SECRET=your-csrf-secret

# Session Management
SESSION_TIMEOUT_HOURS=24
MAX_SESSIONS_PER_USER=5
```

## 🚀 API Endpoints

### Authentication Routes

#### `POST /api/auth/validate`
Validate current authentication token and session.

**Response:**
```json
{
  "valid": true,
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "role": "authenticated"
  },
  "session": {
    "id": "sess-123...",
    "authTime": "2024-01-01T12:00:00Z",
    "expiresAt": "2024-01-02T12:00:00Z"
  }
}
```

#### `POST /api/auth/refresh`
Refresh authentication session.

#### `POST /api/auth/logout`
Logout and invalidate current session.

#### `POST /api/auth/logout-all`
Logout from all devices (invalidate all sessions).

#### `GET /api/auth/sessions`
Get active sessions for current user.

#### `GET /api/auth/profile`
Get user profile with security information.

#### `GET /api/auth/security-log` (Admin Only)
Generate security report for date range.

## 🔍 Middleware Usage

### Authentication Middleware
```javascript
const { authenticateToken, requireRole, requireOwnership } = require('./middleware/auth');

// Require authentication
app.use('/api/protected', authenticateToken);

// Require specific role
app.use('/api/admin', authenticateToken, requireRole('admin'));

// Require resource ownership
app.use('/api/user/:id', authenticateToken, requireOwnership('id'));
```

### Security Middleware
```javascript
const { securityHeaders, validateRequest, authRateLimit } = require('./middleware/security');

// Apply security headers
app.use(securityHeaders);

// Validate requests
app.use(validateRequest);

// Rate limit authentication endpoints
app.use('/api/auth', authRateLimit);
```

## 🛠️ Development vs Production

### Development Mode
- Relaxed JWT verification (logs warnings)
- Detailed error messages
- Debug logging enabled
- CORS allows localhost

### Production Mode
- Strict JWT verification
- Minimal error disclosure
- Security event alerting
- Restricted CORS

## ⚠️ Security Best Practices

### Token Management
1. **Never log full tokens** - Only log partial hashes
2. **Rotate secrets regularly** - Update JWT secrets periodically
3. **Use HTTPS only** - Enforce TLS in production
4. **Validate token claims** - Check audience, issuer, expiration

### Session Security
1. **Limit concurrent sessions** - Prevent session hijacking
2. **Validate fingerprints** - Detect session theft
3. **Monitor session patterns** - Flag unusual activity
4. **Implement timeout** - Auto-logout inactive sessions

### Monitoring
1. **Alert on anomalies** - Unusual login patterns
2. **Track failed attempts** - Potential brute force
3. **Monitor rate limits** - API abuse detection
4. **Log security events** - Audit trail maintenance

## 🚨 Incident Response

### Suspected Token Compromise
1. Invalidate all user sessions: `POST /api/auth/logout-all`
2. Check security logs for suspicious activity
3. Force password reset (if applicable)
4. Monitor for continued abuse

### Rate Limit Abuse
1. Check IP in security logs
2. Consider IP blacklisting if persistent
3. Adjust rate limits if legitimate traffic
4. Implement additional validation

### Suspicious Activity
1. Review security incident logs
2. Correlate with authentication logs
3. Check for privilege escalation attempts
4. Implement additional monitoring

## 📈 Performance Considerations

### Memory Usage
- Session storage: ~1KB per active session
- Rate limiting: ~100B per tracked IP
- Logging: Async writes to prevent blocking

### Scalability
- In-memory storage suitable for single instance
- For clustering, migrate to Redis:
  - Sessions → Redis with TTL
  - Rate limits → Redis with sliding windows
  - Logs → Centralized logging service

## 🔮 Future Enhancements

### Planned Features
1. **Database Integration**: Persistent session storage
2. **Redis Support**: Distributed rate limiting
3. **Anomaly Detection**: ML-based threat detection
4. **SAML/OAuth2**: Enterprise authentication
5. **2FA Support**: Multi-factor authentication
6. **API Keys**: Service-to-service authentication

### Security Improvements
1. **Behavioral Analysis**: User pattern recognition
2. **Geolocation Checks**: Location-based validation
3. **Device Tracking**: Known device management
4. **Risk Scoring**: Dynamic security levels
5. **Automated Response**: Self-healing security

---

## 📞 Support

For security-related issues or questions:
1. Check security logs first
2. Review this documentation
3. Check environment configuration
4. Contact development team with specific error details

Remember: **Security is a process, not a product.** Regular audits and updates are essential.
