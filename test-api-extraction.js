/**
 * Test API Key Extraction
 * 
 * Demonstrates how external users can use the API
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testAPIExtraction() {
  console.log('🧪 Testing API Key Extraction...\n');

  try {
    // Create a test call sheet file
    const testCallSheet = `
CALL SHEET
New York Magazine - The Cut // Accessories Shoot
Date: March 15, 2024
Location: Studio 5, Brooklyn

CREW:
Director: Sarah Johnson - sarah.johnson@example.com - (555) 123-4567
Producer: Mike Chen - mike.chen@production.com - 555-987-6543
Editor: Alex Rodriguez - alex@editstudio.com - (555) 456-7890
Gaffer: Tom Wilson - tom.wilson@lighting.com - 555-234-5678
Grip: Lisa Park - lisa.park@grip.com - (555) 345-6789
Stylist: Emma Davis - emma.davis@fashion.com - 555-456-7890
HMU: Rachel Green - rachel@beauty.com - (555) 567-8901

TALENT:
Model: Jessica Smith - jessica.smith@agency.com - 555-678-9012
Model: David Brown - david.brown@agency.com - (555) 789-0123

CLIENT:
Client: New York Magazine - contact@nymag.com - 555-890-1234
Art Director: Maria Garcia - maria.garcia@nymag.com - (555) 901-2345
    `;

    // Create a temporary file
    const tempFilePath = path.join(__dirname, 'temp-api-test.txt');
    fs.writeFileSync(tempFilePath, testCallSheet);

    console.log('📁 Created test file:', tempFilePath);

    // Test the API endpoint
    const form = new FormData();
    form.append('file', fs.createReadStream(tempFilePath), {
      filename: 'test-call-sheet.txt',
      contentType: 'text/plain'
    });

    console.log('🚀 Testing API endpoint: /api/extract');
    console.log('🔑 Using API key: test-api-key-123');
    const startTime = Date.now();

    const response = await fetch('http://localhost:3001/api/extract', {
      method: 'POST',
      body: form,
      headers: {
        'Authorization': 'Bearer test-api-key-123',
        ...form.getHeaders()
      }
    });

    const processingTime = Date.now() - startTime;

    console.log('📡 Response status:', response.status);
    console.log('⏱️ API response time:', processingTime + 'ms');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API request failed:', errorText);
      return;
    }

    const result = await response.json();
    console.log('\n✅ API Response:');
    console.log('📊 Success:', result.success);
    console.log('📊 Contacts found:', result.data?.contacts?.length || 0);
    console.log('🎯 Extraction method:', result.data?.metadata?.extraction_method);
    console.log('⏱️ Processing time:', result.data?.metadata?.processing_time + 'ms');
    console.log('📋 Document type:', result.data?.metadata?.document_type);
    console.log('💾 Memory optimized:', result.data?.metadata?.memory_optimized);

    if (result.data?.contacts && result.data.contacts.length > 0) {
      console.log('\n📝 Sample contacts:');
      result.data.contacts.slice(0, 3).forEach((contact, index) => {
        console.log(`${index + 1}. ${contact.name}`);
        console.log(`   Email: ${contact.email || 'N/A'}`);
        console.log(`   Phone: ${contact.phone || 'N/A'}`);
        console.log(`   Role: ${contact.role || 'N/A'}`);
        console.log(`   Confidence: ${contact.confidence?.toFixed(2) || 'N/A'}`);
      });
    }

    if (result.usage) {
      console.log('\n📊 Usage:');
      console.log('🔢 API calls used:', result.usage.api_calls_used);
      console.log('📈 Remaining calls:', result.usage.remaining_calls);
    }

    // Clean up
    fs.unlinkSync(tempFilePath);
    console.log('\n🧹 Cleaned up test file');

    console.log('\n🎉 API extraction test completed successfully!');

  } catch (error) {
    console.error('❌ API test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Test API documentation
async function testAPIDocumentation() {
  console.log('\n📚 Testing API Documentation...\n');

  try {
    const response = await fetch('http://localhost:3001/api/docs');
    const docs = await response.json();
    
    console.log('📖 API Documentation:');
    console.log('Title:', docs.data.title);
    console.log('Version:', docs.data.version);
    console.log('Description:', docs.data.description);
    
    console.log('\n🔗 Available Endpoints:');
    Object.keys(docs.data.endpoints).forEach(endpoint => {
      console.log(`- ${endpoint}: ${docs.data.endpoints[endpoint].description}`);
    });
    
    console.log('\n🔑 Authentication:');
    console.log('Type:', docs.data.authentication.type);
    console.log('Header:', docs.data.authentication.header);
    
    console.log('\n📊 Rate Limits:');
    Object.keys(docs.data.rate_limits).forEach(tier => {
      console.log(`- ${tier}: ${docs.data.rate_limits[tier]}`);
    });

  } catch (error) {
    console.error('❌ Documentation test failed:', error);
  }
}

// Test health endpoint
async function testHealthEndpoint() {
  console.log('\n🏥 Testing Health Endpoint...\n');

  try {
    const response = await fetch('http://localhost:3001/api/health');
    const health = await response.json();
    
    console.log('💚 Health Status:', health.status);
    console.log('⏰ Timestamp:', health.timestamp);
    console.log('📦 Version:', health.version);
    console.log('💾 Memory:', health.memory.used, '/', health.memory.total, `(${health.memory.percent})`);

  } catch (error) {
    console.error('❌ Health test failed:', error);
  }
}

// Run all tests
async function runAllTests() {
  await testAPIExtraction();
  await testAPIDocumentation();
  await testHealthEndpoint();
}

runAllTests();


