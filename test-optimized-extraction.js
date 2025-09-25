/**
 * Test Optimized Extraction Service
 * 
 * Validates the new optimized extraction approach
 */

const fs = require('fs');
const path = require('path');

// Import the optimized service
const OptimizedExtractionService = require('./services/optimizedExtractionService');

async function testOptimizedExtraction() {
  console.log('🧪 Testing Optimized Extraction Service...\n');

  try {
    // Test with a sample call sheet text
    const sampleCallSheet = `
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

    console.log('📄 Sample call sheet text length:', sampleCallSheet.length);
    console.log('📄 First 200 characters:');
    console.log(sampleCallSheet.substring(0, 200));
    console.log('...\n');

    // Create a mock file buffer
    const fileBuffer = Buffer.from(sampleCallSheet, 'utf8');
    const mimeType = 'text/plain';
    const fileName = 'test-call-sheet.txt';

    console.log('🚀 Starting optimized extraction...');
    const startTime = Date.now();

    // Test the optimized extraction
    const result = await OptimizedExtractionService.extractContacts(
      fileBuffer,
      mimeType,
      fileName,
      { testMode: true }
    );

    const processingTime = Date.now() - startTime;

    console.log('\n✅ Extraction Results:');
    console.log('📊 Contacts found:', result.contacts.length);
    console.log('⏱️ Processing time:', processingTime + 'ms');
    console.log('🎯 Extraction method:', result.metadata.extractionMethod);
    console.log('📋 Document type:', result.metadata.documentType);
    console.log('🧠 Memory optimized:', result.metadata.memoryOptimized);

    console.log('\n📝 Extracted Contacts:');
    result.contacts.forEach((contact, index) => {
      console.log(`${index + 1}. ${contact.name}`);
      console.log(`   Email: ${contact.email || 'N/A'}`);
      console.log(`   Phone: ${contact.phone || 'N/A'}`);
      console.log(`   Role: ${contact.role || 'N/A'}`);
      console.log(`   Company: ${contact.company || 'N/A'}`);
      console.log(`   Confidence: ${contact.confidence?.toFixed(2) || 'N/A'}`);
      console.log(`   Source: ${contact.source || 'N/A'}`);
      console.log('');
    });

    // Validate results
    const expectedContacts = [
      'Sarah Johnson', 'Mike Chen', 'Alex Rodriguez', 'Tom Wilson',
      'Lisa Park', 'Emma Davis', 'Rachel Green', 'Jessica Smith',
      'David Brown', 'Maria Garcia'
    ];

    const foundNames = result.contacts.map(c => c.name);
    const missingContacts = expectedContacts.filter(name => 
      !foundNames.some(found => found.includes(name.split(' ')[0]))
    );

    console.log('📈 Analysis:');
    console.log(`✅ Found ${result.contacts.length} contacts`);
    console.log(`🎯 Expected ~${expectedContacts.length} contacts`);
    console.log(`📊 Success rate: ${((result.contacts.length / expectedContacts.length) * 100).toFixed(1)}%`);
    
    if (missingContacts.length > 0) {
      console.log(`⚠️ Missing contacts: ${missingContacts.join(', ')}`);
    }

    // Test memory usage
    const memoryUsage = process.memoryUsage();
    const memoryPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
    console.log(`\n💾 Memory Usage: ${(memoryPercent * 100).toFixed(2)}%`);

    if (memoryPercent > 0.8) {
      console.log('⚠️ High memory usage detected');
    } else {
      console.log('✅ Memory usage is healthy');
    }

    console.log('\n🎉 Optimized extraction test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testOptimizedExtraction();
