# Phase 1 Setup Guide

This guide will help you set up and test Phase 1 implementation of the production-ready extraction tool.

## Prerequisites

### System Requirements
- Node.js 18+ 
- npm 8+
- PostgreSQL (for database)
- Redis (optional, for Phase 2)
- ClamAV (optional, for antivirus scanning)

### Development Tools
- Git
- VS Code (recommended)
- Postman (for API testing)

## Installation

### 1. Clone and Setup
```bash
# Clone the repository
git clone <your-repo-url>
cd sjcallsheets-project/backend

# Install dependencies
npm install

# Install test dependencies
npm install --save-dev jest supertest
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.template .env

# Edit .env with your configuration
nano .env
```

### 3. Required Environment Variables
```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/sjcallsheets"

# JWT Secret
JWT_SECRET="your-super-secret-jwt-key"

# Server Configuration
PORT=3001
NODE_ENV=development

# Antivirus Configuration (Optional)
CLAMAV_ENABLED=false
CLAMAV_PATH=clamscan
VIRUSTOTAL_ENABLED=false
VIRUSTOTAL_API_KEY=your-virustotal-api-key

# CORS Configuration
FRONTEND_URL=http://localhost:5173
```

## Antivirus Scanning Setup

### Option 1: ClamAV (Recommended for Development)
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install clamav clamav-daemon

# macOS
brew install clamav

# Start ClamAV daemon
sudo systemctl start clamav-daemon
sudo systemctl enable clamav-daemon

# Update virus definitions
sudo freshclam

# Test installation
clamscan --version
```

### Option 2: VirusTotal API (Recommended for Production)
1. Sign up at [VirusTotal](https://www.virustotal.com/)
2. Get your API key
3. Set `VIRUSTOTAL_ENABLED=true` in `.env`
4. Add your API key to `VIRUSTOTAL_API_KEY`

### Option 3: Hybrid Scanning
```bash
# Enable both ClamAV and VirusTotal
CLAMAV_ENABLED=true
VIRUSTOTAL_ENABLED=true
HYBRID_SCANNING=true
```

## Database Setup

### 1. PostgreSQL Installation
```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# macOS
brew install postgresql

# Start PostgreSQL
sudo systemctl start postgresql
```

### 2. Database Configuration
```bash
# Create database
sudo -u postgres createdb sjcallsheets

# Create user
sudo -u postgres createuser -P sjcallsheets_user

# Grant permissions
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE sjcallsheets TO sjcallsheets_user;"
```

### 3. Prisma Setup
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database (optional)
npx prisma db seed
```

## Testing Setup

### 1. Test Environment
```bash
# Create test environment file
cp .env .env.test

# Edit test configuration
nano .env.test
```

### 2. Test Database
```bash
# Create test database
sudo -u postgres createdb sjcallsheets_test

# Update test environment
DATABASE_URL="postgresql://username:password@localhost:5432/sjcallsheets_test"
```

### 3. Run Tests
```bash
# Run all Phase 1 tests
npm test

# Run specific test suites
npm test -- --testNamePattern="Authentication"

# Run with coverage
npm run test:coverage

# Run test runner script
node run-tests.js
```

## API Testing

### 1. Start the Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 2. Test Authentication
```bash
# Test JWT authentication
curl -X GET http://localhost:3001/api/custom-extraction/capabilities \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test API key authentication
curl -X GET http://localhost:3001/api/custom-extraction/capabilities \
  -H "X-API-Key: sk_YOUR_API_KEY"
```

### 3. Test File Upload
```bash
# Test file upload with JWT
curl -X POST http://localhost:3001/api/custom-extraction/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@test.pdf" \
  -F "rolePreferences=[\"Director\",\"Producer\"]" \
  -F "options={\"includeNotes\":true}"

# Test file upload with API key
curl -X POST http://localhost:3001/api/custom-extraction/upload \
  -H "X-API-Key: sk_YOUR_API_KEY" \
  -F "file=@test.pdf"
```

### 4. Test API Key Management
```bash
# Create API key
curl -X POST http://localhost:3001/api/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Key", "permissions": ["extract", "test"]}'

# List API keys
curl -X GET http://localhost:3001/api/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Revoke API key
curl -X DELETE http://localhost:3001/api/api-keys/KEY_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Health Checks

### 1. Main Health Check
```bash
curl http://localhost:3001/health
```

### 2. Custom Extraction Health
```bash
curl http://localhost:3001/api/custom-extraction/health
```

### 3. Service Capabilities
```bash
curl http://localhost:3001/api/custom-extraction/capabilities
```

## Monitoring and Logging

### 1. Structured Logging
All requests now include correlation IDs and structured logging:
```bash
# Check logs for correlation IDs
tail -f logs/app.log | grep "correlation-id"
```

### 2. Security Logging
Security events are logged separately:
```bash
# Check security logs
tail -f logs/security.log
```

### 3. Performance Monitoring
```bash
# Check request timing
tail -f logs/app.log | grep "duration"
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Issues
```bash
# Check database connection
psql -h localhost -U sjcallsheets_user -d sjcallsheets

# Check Prisma connection
npx prisma db pull
```

#### 2. Authentication Issues
```bash
# Check JWT secret
echo $JWT_SECRET

# Verify JWT token
node -e "console.log(require('jsonwebtoken').verify('YOUR_TOKEN', 'YOUR_SECRET'))"
```

#### 3. File Upload Issues
```bash
# Check file permissions
ls -la uploads/

# Check disk space
df -h

# Check file size limits
grep -r "fileSize" backend/
```

#### 4. Antivirus Scanning Issues
```bash
# Check ClamAV status
sudo systemctl status clamav-daemon

# Test ClamAV manually
clamscan /path/to/test/file

# Check VirusTotal API
curl -X GET "https://www.virustotal.com/vtapi/v2/ip-address/report?apikey=YOUR_API_KEY&ip=8.8.8.8"
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm run dev

# Enable specific debug modules
DEBUG=app:*,auth:*,extraction:* npm run dev
```

## Production Deployment

### 1. Environment Variables
```bash
# Production environment
NODE_ENV=production
PORT=3001
JWT_SECRET=your-production-jwt-secret
DATABASE_URL=your-production-database-url
CLAMAV_ENABLED=true
VIRUSTOTAL_ENABLED=true
```

### 2. Security Configuration
```bash
# Enable all security features
CORS_ORIGINS=https://yourdomain.com
RATE_LIMIT_ENABLED=true
ANTIVIRUS_SCANNING=true
```

### 3. Monitoring Setup
```bash
# Install monitoring tools
npm install --save pino pino-pretty

# Configure log rotation
sudo logrotate -f /etc/logrotate.d/your-app
```

## Next Steps

After Phase 1 is working correctly:

1. **Phase 2 Implementation**: Queue system and async processing
2. **Performance Optimization**: Caching and load balancing
3. **Monitoring Setup**: Metrics and alerting
4. **Documentation**: API documentation and user guides
5. **Testing**: Load testing and security testing

## Support

If you encounter issues:

1. Check the logs: `tail -f logs/app.log`
2. Run the test suite: `npm test`
3. Check the health endpoints: `curl http://localhost:3001/health`
4. Review the troubleshooting section above
5. Check the GitHub issues for known problems

## Success Criteria

Phase 1 is complete when:

- ✅ All tests pass
- ✅ Authentication works (JWT + API keys)
- ✅ Input validation catches invalid data
- ✅ File uploads work with antivirus scanning
- ✅ Health checks return healthy status
- ✅ Structured logging captures all events
- ✅ Security headers are present
- ✅ API key management works
- ✅ Rate limiting is enforced
- ✅ Error handling is comprehensive

Once all criteria are met, you're ready for Phase 2!
