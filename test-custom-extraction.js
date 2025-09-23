/**
 * Test Custom Extraction Service
 * 
 * Comprehensive testing for the custom extraction system
 */

require('dotenv').config();
const CustomExtractionService = require('./services/customExtractionService');

async function testCustomExtraction() {
  console.log('🧪 Testing Custom Extraction Service...\n');
  
  const customExtraction = new CustomExtractionService();
  
  // Test 1: Basic text extraction
  console.log('📝 Test 1: Basic text extraction');
  const sampleText = `
    John Smith - Director
    Email: john.smith@example.com
    Phone: (555) 123-4567
    Company: ABC Productions
    
    Jane Doe - Producer
    Email: jane.doe@example.com
    Phone: (555) 987-6543
    Company: XYZ Studios
  `;
  
  try {
    const result = await customExtraction.patternExtractor.extractContacts(sampleText, {
      type: 'contact_list',
      productionType: 'film',
      hasTableStructure: false,
      hasContactSections: true,
      estimatedContacts: 2
    });
    
    console.log(`✅ Found ${result.length} contacts`);
    result.forEach((contact, index) => {
      console.log(`  ${index + 1}. ${contact.name} - ${contact.role} (${contact.email})`);
    });
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Call sheet extraction
  console.log('🎬 Test 2: Call sheet extraction');
  const callSheetText = `
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
  `;
  
  try {
    const result = await customExtraction.patternExtractor.extractContacts(callSheetText, {
      type: 'call_sheet',
      productionType: 'film',
      hasTableStructure: false,
      hasContactSections: true,
      estimatedContacts: 5
    });
    
    console.log(`✅ Found ${result.length} contacts`);
    result.forEach((contact, index) => {
      console.log(`  ${index + 1}. ${contact.name} - ${contact.role} (${contact.email})`);
    });
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: Document analysis
  console.log('📋 Test 3: Document analysis');
  try {
    const analysis = await customExtraction.documentAnalyzer.analyzeDocument(
      Buffer.from(callSheetText),
      'text/plain',
      'call_sheet.txt'
    );
    
    console.log('✅ Document analysis complete:');
    console.log(`  Type: ${analysis.type}`);
    console.log(`  Production Type: ${analysis.productionType}`);
    console.log(`  Has Table Structure: ${analysis.hasTableStructure}`);
    console.log(`  Has Contact Sections: ${analysis.hasContactSections}`);
    console.log(`  Estimated Contacts: ${analysis.estimatedContacts}`);
    console.log(`  Confidence: ${analysis.confidence}`);
  } catch (error) {
    console.error('❌ Test 3 failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 4: Production intelligence
  console.log('🎭 Test 4: Production intelligence');
  try {
    const contacts = [
      { name: 'John Smith', email: 'john@example.com', role: 'Director' },
      { name: 'Jane Doe', email: 'jane@example.com', role: 'Producer' },
      { name: 'Mike Johnson', email: 'mike@example.com', role: 'Camera Operator' }
    ];
    
    const processed = await customExtraction.productionIntelligence.processContacts(
      contacts,
      { type: 'call_sheet', productionType: 'film' }
    );
    
    console.log('✅ Production intelligence processing complete:');
    processed.forEach((contact, index) => {
      console.log(`  ${index + 1}. ${contact.name} - ${contact.role} (${contact.department}, ${contact.priority})`);
    });
  } catch (error) {
    console.error('❌ Test 4 failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 5: Contact validation
  console.log('✅ Test 5: Contact validation');
  try {
    const contacts = [
      { name: 'John Smith', email: 'john@example.com', role: 'Director' },
      { name: 'Invalid Name', email: 'invalid-email', role: 'Producer' },
      { name: 'Jane Doe', email: 'jane@example.com', role: 'Cinematographer' }
    ];
    
    const validated = await customExtraction.validator.validateContacts(contacts);
    
    console.log('✅ Contact validation complete:');
    console.log(`  Valid contacts: ${validated.length}/${contacts.length}`);
    validated.forEach((contact, index) => {
      console.log(`  ${index + 1}. ${contact.name} - ${contact.validation.qualityLevel} (${contact.validation.score.toFixed(2)})`);
    });
  } catch (error) {
    console.error('❌ Test 5 failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 6: Confidence scoring
  console.log('📊 Test 6: Confidence scoring');
  try {
    const contacts = [
      { name: 'John Smith', email: 'john@example.com', role: 'Director', phone: '(555) 123-4567' },
      { name: 'Jane Doe', email: 'jane@example.com', role: 'Producer' },
      { name: 'Mike', email: 'mike@example.com' }
    ];
    
    const scored = await customExtraction.confidenceScorer.scoreContacts(
      contacts,
      { type: 'call_sheet', productionType: 'film' }
    );
    
    console.log('✅ Confidence scoring complete:');
    scored.forEach((contact, index) => {
      console.log(`  ${index + 1}. ${contact.name} - ${contact.confidenceLevel} (${contact.confidence.toFixed(2)})`);
    });
  } catch (error) {
    console.error('❌ Test 6 failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 7: Full extraction pipeline
  console.log('🚀 Test 7: Full extraction pipeline');
  try {
    const result = await customExtraction.extractContacts(
      Buffer.from(callSheetText),
      'text/plain',
      'call_sheet.txt',
      { rolePreferences: ['Director', 'Producer'] }
    );
    
    console.log('✅ Full extraction pipeline complete:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Contacts: ${result.contacts.length}`);
    console.log(`  Processing Time: ${result.metadata.processingTime}ms`);
    console.log(`  Quality Score: ${result.metadata.qualityScore}`);
    console.log(`  Average Confidence: ${result.metadata.averageConfidence}`);
    
    result.contacts.forEach((contact, index) => {
      console.log(`  ${index + 1}. ${contact.name} - ${contact.role} (${contact.confidenceLevel})`);
    });
  } catch (error) {
    console.error('❌ Test 7 failed:', error.message);
  }
  
  console.log('\n🎉 Custom extraction testing complete!');
}

// Run the tests
testCustomExtraction().catch(console.error);
