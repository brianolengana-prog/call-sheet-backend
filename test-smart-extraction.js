/**
 * Test Smart Extraction System
 * 
 * Demonstrates the enhanced extraction system with diverse call sheet structures
 */

require('dotenv').config();
const SmartExtractionRouter = require('./services/smartExtractionRouter');

async function testSmartExtraction() {
  console.log('🧠 Testing Smart Extraction System...\n');
  
  const smartRouter = new SmartExtractionRouter();
  
  // Test 1: Standard Call Sheet (should use custom extraction)
  console.log('📋 Test 1: Standard Call Sheet (Custom Extraction)');
  const standardCallSheet = `
TALENT NAME CONTACT CELL TRANSPORTATION CALL LOCATION
Editor in Chief, Cosmopolitan Willa Bennet willa.bennett@hearst.com
Annabel.Iwegbue@hearst.com - Self Transportation 8:00 AM Gum Studios, Stage B
Cosmopolitan Talent Will Coleman contact@chefwillcoleman.com 313-433-7743 Self Transportation 11:30 AM Gum Studios, Stage B
Director Anton Dupreeze hello@antondupreez.com - Self Transportation 7:00 AM Gum Studios, Stage B
Director of Photography Steven Mastorelli stevenmastorelli@gmail.com 973-975-6257 Self Transportation 7:00 AM Gum Studios, Stage B
Key Grip John Alvarez nycinejon@gmail.com - Self Transportation 7:00 AM Gum Studios, Stage B
HMU Maria Ortega merimon@southjames.com - Self Transportation 7:30 AM Gum Studios, Stage B
  `;

  try {
    const result1 = await smartRouter.extractContacts(
      Buffer.from(standardCallSheet),
      'text/plain',
      'standard_call_sheet.txt',
      { rolePreferences: ['Director', 'Producer', 'Crew'] }
    );
    
    console.log(`✅ Standard Call Sheet Results:`);
    console.log(`  Method: ${result1.metadata.extractionMethod}`);
    console.log(`  Strategy: ${result1.metadata.routingStrategy.reason}`);
    console.log(`  Contacts: ${result1.contacts.length}`);
    console.log(`  Processing Time: ${result1.metadata.processingTime}ms`);
    
    result1.contacts.forEach((contact, index) => {
      console.log(`  ${index + 1}. ${contact.name} - ${contact.role} (${contact.email})`);
    });
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Test 2: Complex Unstructured Document (should use AI extraction)
  console.log('🤖 Test 2: Complex Unstructured Document (AI Extraction)');
  const unstructuredDocument = `
Production Team Contact Information

We have assembled an incredible team for this project. The director is Sarah Johnson who can be reached at sarah.johnson@production.com or (555) 123-4567. 
Our cinematographer is Michael Chen, contact him at michael.chen@camera.com or (555) 234-5678.
The sound mixer is David Wilson, reach him at david.wilson@sound.com or (555) 345-6789.
Our production designer is Lisa Brown, contact her at lisa.brown@art.com or (555) 456-7890.
The editor is Tom Davis, reach him at tom.davis@edit.com or (555) 567-8901.
We also have our gaffer John Smith at john.smith@lighting.com or (555) 678-9012.
The key grip is Mike Johnson, contact him at mike.johnson@grip.com or (555) 789-0123.
Our wardrobe stylist is Emma Wilson, reach her at emma.wilson@wardrobe.com or (555) 890-1234.
The makeup artist is Anna Davis, contact her at anna.davis@makeup.com or (555) 901-2345.
Our production coordinator is Chris Brown, reach him at chris.brown@production.com or (555) 012-3456.
  `;

  try {
    const result2 = await smartRouter.extractContacts(
      Buffer.from(unstructuredDocument),
      'text/plain',
      'unstructured_document.txt',
      { rolePreferences: ['Director', 'Producer', 'Crew'] }
    );
    
    console.log(`✅ Unstructured Document Results:`);
    console.log(`  Method: ${result2.metadata.extractionMethod}`);
    console.log(`  Strategy: ${result2.metadata.routingStrategy.reason}`);
    console.log(`  Contacts: ${result2.contacts.length}`);
    console.log(`  Processing Time: ${result2.metadata.processingTime}ms`);
    
    result2.contacts.forEach((contact, index) => {
      console.log(`  ${index + 1}. ${contact.name} - ${contact.role} (${contact.email})`);
    });
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Test 3: Hybrid Extraction (both custom and AI)
  console.log('🔄 Test 3: Hybrid Extraction (Custom + AI)');
  const hybridDocument = `
CREW LIST - PRODUCTION TEAM

Above the Line:
Director: Sarah Johnson - sarah.johnson@production.com - (555) 123-4567
Producer: Mike Davis - mike.davis@production.com - (555) 234-5678

Camera Department:
Cinematographer: Michael Chen - michael.chen@camera.com - (555) 345-6789
First AC: Lisa Brown - lisa.brown@camera.com - (555) 456-7890
Second AC: Tom Wilson - tom.wilson@camera.com - (555) 567-8901

Sound Department:
Sound Mixer: David Wilson - david.wilson@sound.com - (555) 678-9012
Boom Operator: Anna Smith - anna.smith@sound.com - (555) 789-0123

Lighting Department:
Gaffer: John Smith - john.smith@lighting.com - (555) 890-1234
Key Grip: Mike Johnson - mike.johnson@grip.com - (555) 901-2345

Art Department:
Production Designer: Emma Davis - emma.davis@art.com - (555) 012-3456
Set Designer: Chris Brown - chris.brown@art.com - (555) 123-4567
Wardrobe: Lisa Wilson - lisa.wilson@wardrobe.com - (555) 234-5678

Post Production:
Editor: Tom Davis - tom.davis@edit.com - (555) 345-6789
Colorist: Anna Johnson - anna.johnson@post.com - (555) 456-7890
  `;

  try {
    const result3 = await smartRouter.extractContacts(
      Buffer.from(hybridDocument),
      'text/plain',
      'hybrid_document.txt',
      { useHybrid: true, rolePreferences: ['Director', 'Producer', 'Crew'] }
    );
    
    console.log(`✅ Hybrid Extraction Results:`);
    console.log(`  Method: ${result3.metadata.extractionMethod}`);
    console.log(`  Strategy: ${result3.metadata.routingStrategy.reason}`);
    console.log(`  Contacts: ${result3.contacts.length}`);
    console.log(`  Processing Time: ${result3.metadata.processingTime}ms`);
    
    if (result3.metadata.customContacts && result3.metadata.aiContacts) {
      console.log(`  Custom Contacts: ${result3.metadata.customContacts}`);
      console.log(`  AI Contacts: ${result3.metadata.aiContacts}`);
      console.log(`  Merged Contacts: ${result3.metadata.mergedContacts}`);
    }
    
    result3.contacts.forEach((contact, index) => {
      console.log(`  ${index + 1}. ${contact.name} - ${contact.role} (${contact.email})`);
    });
  } catch (error) {
    console.error('❌ Test 3 failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Test 4: Force Custom Extraction
  console.log('🔧 Test 4: Force Custom Extraction');
  try {
    const result4 = await smartRouter.extractContacts(
      Buffer.from(standardCallSheet),
      'text/plain',
      'forced_custom.txt',
      { forceCustom: true, rolePreferences: ['Director', 'Producer', 'Crew'] }
    );
    
    console.log(`✅ Forced Custom Results:`);
    console.log(`  Method: ${result4.metadata.extractionMethod}`);
    console.log(`  Strategy: ${result4.metadata.routingStrategy.reason}`);
    console.log(`  Contacts: ${result4.contacts.length}`);
    console.log(`  Processing Time: ${result4.metadata.processingTime}ms`);
    
    result4.contacts.forEach((contact, index) => {
      console.log(`  ${index + 1}. ${contact.name} - ${contact.role} (${contact.email})`);
    });
  } catch (error) {
    console.error('❌ Test 4 failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Test 5: Force AI Extraction
  console.log('🤖 Test 5: Force AI Extraction');
  try {
    const result5 = await smartRouter.extractContacts(
      Buffer.from(standardCallSheet),
      'text/plain',
      'forced_ai.txt',
      { forceAI: true, rolePreferences: ['Director', 'Producer', 'Crew'] }
    );
    
    console.log(`✅ Forced AI Results:`);
    console.log(`  Method: ${result5.metadata.extractionMethod}`);
    console.log(`  Strategy: ${result5.metadata.routingStrategy.reason}`);
    console.log(`  Contacts: ${result5.contacts.length}`);
    console.log(`  Processing Time: ${result5.metadata.processingTime}ms`);
    
    result5.contacts.forEach((contact, index) => {
      console.log(`  ${index + 1}. ${contact.name} - ${contact.role} (${contact.email})`);
    });
  } catch (error) {
    console.error('❌ Test 5 failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Show metrics
  console.log('📊 Smart Extraction Metrics:');
  const metrics = smartRouter.getMetrics();
  console.log(`  Total Extractions: ${metrics.totalExtractions}`);
  console.log(`  Custom Extractions: ${metrics.customExtractions} (${(metrics.customRatio * 100).toFixed(1)}%)`);
  console.log(`  AI Extractions: ${metrics.aiExtractions} (${(metrics.aiRatio * 100).toFixed(1)}%)`);
  console.log(`  Hybrid Extractions: ${metrics.hybridExtractions} (${(metrics.hybridRatio * 100).toFixed(1)}%)`);
  console.log(`  Average Processing Time: ${metrics.averageProcessingTime.toFixed(0)}ms`);
  
  console.log('\n🎉 Smart Extraction Testing Complete!');
  console.log('\n📋 Summary:');
  console.log('  ✅ Standard call sheets → Custom extraction (fast, accurate)');
  console.log('  ✅ Unstructured documents → AI extraction (intelligent, flexible)');
  console.log('  ✅ Complex documents → Hybrid extraction (best of both)');
  console.log('  ✅ User preferences → Force specific methods');
  console.log('  ✅ Automatic routing → Optimal performance for each document type');
}

// Run the test
testSmartExtraction().catch(console.error);
