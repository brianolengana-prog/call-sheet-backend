# Call Sheet Converter Backend

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the backend directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Frontend URL
FRONTEND_URL=http://localhost:5173

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRY=24h
REFRESH_TOKEN_EXPIRY=7d

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback

# Email Configuration (Optional - for password reset and verification emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com

# Security Configuration
CORS_ORIGIN=http://localhost:5173
TRUST_PROXY=false
```

### 3. Start the Server
```bash
npm start
```

## Features

### Authentication
- **Email/Password Authentication**: Complete registration and login flow
- **Google OAuth**: Seamless Google sign-in integration
- **Password Reset**: Secure password reset with email tokens
- **Email Verification**: Email verification for new accounts
- **JWT Tokens**: Secure token-based authentication
- **Account Lockout**: Brute force protection

### Security
- **CSRF Protection**: Cross-site request forgery protection
- **Rate Limiting**: Per-endpoint rate limiting
- **Input Validation**: Server-side validation for all inputs
- **Secure Headers**: Helmet.js security headers
- **Password Hashing**: bcrypt with 12 salt rounds

### Email Service
- **Password Reset Emails**: Professional HTML email templates
- **Verification Emails**: Email verification with secure tokens
- **Security Alerts**: Automated security notifications
- **Graceful Degradation**: Works without email configuration

## API Endpoints

### Authentication
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh tokens

### Password Management
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Email Verification
- `POST /api/auth/verify-email` - Verify email with token
- `POST /api/auth/resend-verification` - Resend verification email

### Google OAuth
- `POST /api/google-auth/google/callback` - Google OAuth callback
- `GET /api/google-auth/me` - Get Google user info
- `POST /api/google-auth/signout` - Google logout

### Security
- `GET /api/auth/security-audit` - Get security audit log

## Development Notes

### Email Configuration
The email service is optional and will gracefully degrade if not configured. When email is not configured:
- Password reset tokens are logged to the console
- Verification tokens are logged to the console
- Security alerts are logged to the console

### Database
Currently uses in-memory storage for demo purposes. For production:
- Replace in-memory storage with a proper database
- Implement proper user management
- Add data persistence for tokens and sessions

### Security
- Change JWT_SECRET in production
- Use environment variables for all sensitive data
- Enable HTTPS in production
- Configure proper CORS origins

## Production Deployment

1. Set up a proper database (PostgreSQL recommended)
2. Configure email service with a reliable provider
3. Set up environment variables
4. Enable HTTPS
5. Configure proper CORS origins
6. Set up monitoring and logging
7. Implement proper backup strategies