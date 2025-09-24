#!/usr/bin/env node

/**
 * Phase 1 Test Runner
 * 
 * Comprehensive test runner for Phase 1 implementation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Phase 1 Test Runner');
console.log('====================\n');

// Test configuration
const tests = [
  {
    name: 'Authentication Tests',
    command: 'npm test -- --testNamePattern="Authentication"',
    description: 'JWT and API key authentication'
  },
  {
    name: 'Input Validation Tests',
    command: 'npm test -- --testNamePattern="Input Validation"',
    description: 'Request validation and error handling'
  },
  {
    name: 'API Key Management Tests',
    command: 'npm test -- --testNamePattern="API Key Management"',
    description: 'API key creation, listing, and revocation'
  },
  {
    name: 'Health Check Tests',
    command: 'npm test -- --testNamePattern="Health Check"',
    description: 'Service health and readiness checks'
  },
  {
    name: 'Security Tests',
    command: 'npm test -- --testNamePattern="Security"',
    description: 'Security headers and CORS'
  },
  {
    name: 'File Upload Tests',
    command: 'npm test -- --testNamePattern="File Upload"',
    description: 'File upload and antivirus scanning'
  },
  {
    name: 'Integration Tests',
    command: 'npm test -- --testNamePattern="Integration"',
    description: 'End-to-end workflow testing'
  }
];

// Run individual test suites
async function runTestSuite(test) {
  console.log(`\n🔍 Running ${test.name}...`);
  console.log(`   ${test.description}`);
  
  try {
    const startTime = Date.now();
    const output = execSync(test.command, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    const duration = Date.now() - startTime;
    
    console.log(`   ✅ ${test.name} passed (${duration}ms)`);
    return { success: true, duration, output };
  } catch (error) {
    console.log(`   ❌ ${test.name} failed`);
    console.log(`   Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Phase 1 Test Suite...\n');
  
  const results = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalDuration = 0;
  
  for (const test of tests) {
    const result = await runTestSuite(test);
    results.push({ ...test, ...result });
    
    if (result.success) {
      totalPassed++;
      totalDuration += result.duration || 0;
    } else {
      totalFailed++;
    }
  }
  
  // Summary
  console.log('\n📊 Test Summary');
  console.log('================');
  console.log(`Total Tests: ${tests.length}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Total Duration: ${totalDuration}ms`);
  console.log(`Success Rate: ${((totalPassed / tests.length) * 100).toFixed(1)}%`);
  
  // Detailed results
  console.log('\n📋 Detailed Results');
  console.log('===================');
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const duration = result.duration ? `(${result.duration}ms)` : '';
    console.log(`${index + 1}. ${status} ${result.name} ${duration}`);
    
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  // Recommendations
  console.log('\n💡 Recommendations');
  console.log('===================');
  
  if (totalFailed === 0) {
    console.log('🎉 All tests passed! Phase 1 is ready for production.');
    console.log('✅ Proceed to Phase 2 implementation.');
  } else {
    console.log('⚠️  Some tests failed. Please review and fix issues:');
    
    results
      .filter(r => !r.success)
      .forEach(result => {
        console.log(`   - ${result.name}: ${result.error}`);
      });
    
    console.log('\n🔧 Fix the failing tests before proceeding to Phase 2.');
  }
  
  // Save results
  const reportPath = path.join(__dirname, 'test-results.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: tests.length,
      passed: totalPassed,
      failed: totalFailed,
      duration: totalDuration,
      successRate: (totalPassed / tests.length) * 100
    },
    results: results
  }, null, 2));
  
  console.log(`\n📄 Test report saved to: ${reportPath}`);
  
  return totalFailed === 0;
}

// Main execution
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests, runTestSuite };
