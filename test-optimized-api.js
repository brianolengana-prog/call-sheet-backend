/**
 * Test Optimized Extraction API Endpoint
 * 
 * Tests the /api/new-optimized-extraction/upload endpoint
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testOptimizedAPI() {
  console.log('🧪 Testing Optimized Extraction API Endpoint...\n');

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
    const tempFilePath = path.join(__dirname, 'temp-test-call-sheet.txt');
    fs.writeFileSync(tempFilePath, testCallSheet);

    console.log('📁 Created test file:', tempFilePath);
    console.log('📄 File size:', fs.statSync(tempFilePath).size, 'bytes');

    // Test the API endpoint
    const form = new FormData();
    form.append('file', fs.createReadStream(tempFilePath), {
      filename: 'test-call-sheet.txt',
      contentType: 'text/plain'
    });
    form.append('options', JSON.stringify({ testMode: true }));

    console.log('🚀 Testing API endpoint: /api/new-optimized-extraction/upload');
    const startTime = Date.now();

    const response = await fetch('http://localhost:3001/api/new-optimized-extraction/upload', {
      method: 'POST',
      body: form,
      headers: {
        'Authorization': 'Bearer test-token', // Mock token for testing
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
    console.log('📊 Contacts found:', result.contacts?.length || 0);
    console.log('🎯 Extraction method:', result.metadata?.extractionMethod);
    console.log('⏱️ Processing time:', result.metadata?.processingTime + 'ms');
    console.log('📋 Document type:', result.metadata?.documentType);
    console.log('🧠 Memory optimized:', result.metadata?.memoryOptimized);

    if (result.contacts && result.contacts.length > 0) {
      console.log('\n📝 Sample contacts:');
      result.contacts.slice(0, 3).forEach((contact, index) => {
        console.log(`${index + 1}. ${contact.name}`);
        console.log(`   Email: ${contact.email || 'N/A'}`);
        console.log(`   Phone: ${contact.phone || 'N/A'}`);
        console.log(`   Role: ${contact.role || 'N/A'}`);
        console.log(`   Confidence: ${contact.confidence?.toFixed(2) || 'N/A'}`);
      });
    }

    // Clean up
    fs.unlinkSync(tempFilePath);
    console.log('\n🧹 Cleaned up test file');

    console.log('\n🎉 API endpoint test completed successfully!');

  } catch (error) {
    console.error('❌ API test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testOptimizedAPI();
