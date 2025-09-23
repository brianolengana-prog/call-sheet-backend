/**
 * Test Extraction Service Manager
 * 
 * Test the intelligent service selection and hybrid extraction
 */

require('dotenv').config();
const ExtractionServiceManager = require('./services/extractionServiceManager');

async function testExtractionManager() {
  console.log('🧪 Testing Extraction Service Manager...\n');
  
  const manager = new ExtractionServiceManager();
  
  // Test 1: Service status
  console.log('📊 Test 1: Service status');
  const status = manager.getServiceStatus();
  console.log('✅ Service status:');
  console.log(`  AI Service: ${status.aiService.available ? 'Available' : 'Not Available'}`);
  console.log(`  Custom Service: ${status.customService.available ? 'Available' : 'Not Available'}`);
  console.log(`  Configuration:`, status.configuration);
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Small document (should use custom)
  console.log('📝 Test 2: Small document (custom service)');
  const smallDocument = `
    John Smith - Director
    Email: john.smith@example.com
    Phone: (555) 123-4567
  `;
  
  try {
    const result = await manager.extractContacts(
      Buffer.from(smallDocument),
      'text/plain',
      'small_doc.txt',
      {}
    );
    
    console.log('✅ Small document extraction:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Strategy: ${result.metadata.serviceStrategy}`);
    console.log(`  Contacts: ${result.contacts.length}`);
    console.log(`  Processing Time: ${result.metadata.processingTime}ms`);
    
    result.contacts.forEach((contact, index) => {
      console.log(`    ${index + 1}. ${contact.name} - ${contact.role} (${contact.email})`);
    });
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: Medium document (should use hybrid if available)
  console.log('📄 Test 3: Medium document (hybrid service)');
  const mediumDocument = `
    CALL SHEET - DAY 1
    Production: "The Great Movie"
    
    PRODUCTION TEAM:
    Director: Michael Johnson
    Email: michael.johnson@production.com
    Phone: (555) 111-2222
    
    Producer: Sarah Wilson
    Email: sarah.wilson@production.com
    Phone: (555) 333-4444
    
    First AD: David Brown
    Email: david.brown@production.com
    Phone: (555) 555-6666
    
    CREW:
    Cinematographer: Lisa Davis
    Email: lisa.davis@production.com
    Phone: (555) 777-8888
    
    Sound Mixer: Tom Anderson
    Email: tom.anderson@production.com
    Phone: (555) 999-0000
    
    LIGHTING:
    Gaffer: Mike Wilson
    Email: mike.wilson@production.com
    Phone: (555) 111-3333
    
    Key Grip: Steve Johnson
    Email: steve.johnson@production.com
    Phone: (555) 222-4444
  `;
  
  try {
    const result = await manager.extractContacts(
      Buffer.from(mediumDocument),
      'text/plain',
      'medium_doc.txt',
      {}
    );
    
    console.log('✅ Medium document extraction:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Strategy: ${result.metadata.serviceStrategy}`);
    console.log(`  Contacts: ${result.contacts.length}`);
    console.log(`  Processing Time: ${result.metadata.processingTime}ms`);
    
    if (result.metadata.serviceStrategy === 'hybrid') {
      console.log(`  Custom Contacts: ${result.metadata.customContacts}`);
      console.log(`  AI Contacts: ${result.metadata.aiContacts}`);
      console.log(`  Combined Contacts: ${result.metadata.combinedContacts}`);
    }
    
    result.contacts.forEach((contact, index) => {
      console.log(`    ${index + 1}. ${contact.name} - ${contact.role} (${contact.email})`);
    });
  } catch (error) {
    console.error('❌ Test 3 failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 4: Configuration update
  console.log('⚙️ Test 4: Configuration update');
  try {
    manager.updateConfiguration({
      preferredService: 'custom',
      hybridMode: false
    });
    
    const newStatus = manager.getServiceStatus();
    console.log('✅ Configuration updated:');
    console.log(`  Preferred Service: ${newStatus.configuration.preferredService}`);
    console.log(`  Hybrid Mode: ${newStatus.configuration.hybridMode}`);
  } catch (error) {
    console.error('❌ Test 4 failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 5: Service selection logic
  console.log('🎯 Test 5: Service selection logic');
  try {
    // Test different file sizes
    const testCases = [
      { size: 1000, expected: 'custom' },
      { size: 10000, expected: 'custom' },
      { size: 50000, expected: 'custom' },
      { size: 150000, expected: 'custom' } // AI threshold is 100KB
    ];
    
    for (const testCase of testCases) {
      const buffer = Buffer.alloc(testCase.size);
      const strategy = manager.determineServiceStrategy(buffer, 'text/plain', 'test.txt', {});
      console.log(`  ${testCase.size} bytes -> ${strategy} (expected: ${testCase.expected})`);
    }
  } catch (error) {
    console.error('❌ Test 5 failed:', error.message);
  }
  
  console.log('\n🎉 Extraction Service Manager testing complete!');
}

// Run the tests
testExtractionManager().catch(console.error);
