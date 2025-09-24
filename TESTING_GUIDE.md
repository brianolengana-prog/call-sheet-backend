# Phase 1 Testing Guide

This guide covers comprehensive testing of Phase 1 implementation including authentication, validation, logging, and antivirus scanning.

## Prerequisites

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Environment Setup:**
   ```bash
   cp .env.example .env.test
   # Edit .env.test with test configuration
   ```

3. **Install Test Dependencies:**
   ```bash
   npm install --save-dev jest supertest
   ```

## Running Tests

### Run All Phase 1 Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Authentication tests only
npm test -- --testNamePattern="Authentication"

# Input validation tests only
npm test -- --testNamePattern="Input Validation"

# API key management tests only
npm test -- --testNamePattern="API Key Management"
```

### Run with Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

## Test Categories

### 1. Authentication Tests
- **JWT Authentication**: Valid/invalid tokens, missing tokens
- **API Key Authentication**: Valid/invalid keys, missing keys
- **Permission-based Access**: Role-based access control
- **Token Expiration**: Expired token handling

### 2. Input Validation Tests
- **Custom Extraction Upload**: Valid/invalid file types, sizes, options
- **Custom Extraction Test**: Text validation, document type validation
- **API Key Creation**: Permission validation, expiration dates
- **Request Body Validation**: Malformed JSON, missing fields

### 3. API Key Management Tests
- **Create API Key**: Valid/invalid requests
- **List API Keys**: User-specific key retrieval
- **Revoke API Key**: Key deactivation
- **Usage Tracking**: API key usage monitoring

### 4. Health Check Tests
- **Main Health Check**: Database connectivity, service status
- **Custom Extraction Health**: Component readiness
- **Service Dependencies**: External service availability

### 5. Structured Logging Tests
- **Correlation IDs**: Request tracking
- **Event Logging**: Extraction events, API key usage
- **Error Logging**: Error tracking and debugging

### 6. Security Tests
- **CORS Headers**: Cross-origin request handling
- **Security Headers**: XSS protection, content type options
- **Rate Limiting**: Request throttling
- **File Upload Security**: File type validation, size limits

### 7. Antivirus Scanning Tests
- **Clean File Scanning**: Safe file processing
- **Infected File Detection**: Malware detection and blocking
- **Scan Performance**: Scan timing and efficiency
- **Multiple Scan Engines**: ClamAV, VirusTotal integration

## Test Data

### Sample Files
- `test-file.pdf`: Clean PDF for testing
- `test-upload.pdf`: File upload testing
- `test-large.pdf`: File size limit testing
- `test-infected.pdf`: Malware testing (mock)

### Sample API Keys
- `sk_test_1234567890abcdef`: Valid test key
- `sk_invalid_key`: Invalid key for testing
- `sk_expired_key`: Expired key for testing

### Sample JWT Tokens
- `test-jwt-token`: Valid JWT for testing
- `invalid-jwt-token`: Invalid JWT for testing
- `expired-jwt-token`: Expired JWT for testing

## Expected Test Results

### ✅ Passing Tests
- All authentication mechanisms work correctly
- Input validation catches invalid data
- API key management functions properly
- Health checks return correct status
- Structured logging captures events
- Security headers are present
- File uploads are processed correctly
- Antivirus scanning blocks malicious files

### ❌ Failing Tests
- Invalid authentication tokens are rejected
- Malformed input data is rejected
- Unauthorized API key access is blocked
- Health checks fail when services are down
- Security headers are missing
- File size limits are enforced
- Infected files are blocked

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Kill process on port 3001
   lsof -ti:3001 | xargs kill -9
   ```

2. **Database Connection Issues**
   ```bash
   # Check database connection
   npm run test:db-check
   ```

3. **File Permission Issues**
   ```bash
   # Fix file permissions
   chmod 755 tests/
   chmod 644 tests/*.test.js
   ```

4. **Mock Service Issues**
   ```bash
   # Clear Jest cache
   npm test -- --clearCache
   ```

### Debug Mode
```bash
# Run tests with debug output
DEBUG=* npm test
```

### Verbose Output
```bash
# Run tests with verbose output
npm test -- --verbose
```

## Performance Testing

### Load Testing
```bash
# Run load tests
npm run test:load
```

### Memory Testing
```bash
# Run memory tests
npm run test:memory
```

### Stress Testing
```bash
# Run stress tests
npm run test:stress
```

## Continuous Integration

### GitHub Actions
```yaml
name: Phase 1 Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

### Pre-commit Hooks
```bash
# Install pre-commit hooks
npm install --save-dev husky lint-staged
```

## Test Reports

### Coverage Report
- HTML coverage report: `coverage/lcov-report/index.html`
- LCOV coverage report: `coverage/lcov.info`
- Text coverage report: `coverage/coverage.txt`

### Test Results
- Jest test results: `test-results.json`
- Performance metrics: `performance-results.json`
- Security scan results: `security-results.json`

## Monitoring

### Test Metrics
- Test execution time
- Test pass/fail rates
- Coverage percentages
- Performance benchmarks
- Security scan results

### Alerts
- Test failures
- Coverage drops
- Performance regressions
- Security vulnerabilities

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Mock External Services**: Don't rely on external APIs
3. **Clean Test Data**: Clean up after each test
4. **Assertive Testing**: Test both positive and negative cases
5. **Performance Testing**: Include performance benchmarks
6. **Security Testing**: Test security vulnerabilities
7. **Documentation**: Document test scenarios and expected results

## Next Steps

After Phase 1 testing is complete:

1. **Phase 2 Testing**: Queue system and async processing
2. **Integration Testing**: End-to-end workflow testing
3. **Performance Testing**: Load and stress testing
4. **Security Testing**: Penetration testing
5. **User Acceptance Testing**: Real-world scenario testing
