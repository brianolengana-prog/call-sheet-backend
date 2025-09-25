const fs = require('fs');
const path = require('path');

// Test the AI-first extraction architecture
async function testAIFirstExtraction() {
  console.log('🚀 Testing AI-First Extraction Architecture...\n');

  try {
    // Initialize the unified service
    const UnifiedExtractionService = require('./services/unifiedExtractionService');
    const unifiedService = new UnifiedExtractionService();

    console.log('✅ Unified Extraction Service initialized');
    console.log('🤖 AI Available:', unifiedService.aiAvailable);
    console.log('📊 Service Stats:', unifiedService.getStats());

    // Test with a sample call sheet
    const testCallSheet = `
TALENT NAME CONTACT CELL TRANSPORTATION CALL LOCATION
Editor in Chief, Cosmopolitan Willa Bennet willa.bennet@hearst.com Annabel.Iwegbue@hearst.com - Self Transportation 8:00 AM Gum Studios, Stage B
Cosmopolitan Talent Will Coleman contact@chefwillcoleman.com 313-433-7743 Self Transportation 11:30 AM Gum Studios, Stage B
Cosmopolitan Talent Roti Brown samantha@aire-ny.com lauren@aire-ny.com 914-806-9276 Self Transportation 11:30 AM Gum Studios, Stage B

AMAZON NAME CONTACT CELL TRANSPORTATION CALL LOCATION
Amazon Jude Garfias judegar@amazon.com - Self Transportation 8:45 AM Gum Studios, Stage B
Amazon Damaneke Santiago damaneke@amazon.com - Self Transportation 8:45 AM Gum Studios, Stage B
Amazon Kensey Johnson kenseyjo@amazon.com - Self Transportation 8:45 AM Gum Studios, Stage B

HEARST NAME CONTACT CELL TRANSPORTATION CALL LOCATION
Head Of Creative Laura Alesci laura.alesci@hearst.com 646-799-7498 Self Transportation 7:00 AM Gum Studios, Stage B
Director Ashley Billone ashley.billone@hearst.com - Self Transportation 7:00 AM Gum Studios, Stage B
Art Director Armine Altiparmakian aaltiparmakian@hearst.com 917-312-0518 Self Transportation 7:00 AM Gum Studios, Stage B
Producer Hannah Miler hmiller@hearst.com 847-293-4148 Self Transportation 7:00 AM Gum Studios, Stage B
Coordinator Camryn DeCosta camryn.decosta@hearst.com 203-241-2545 Self Transportation 7:00 AM Gum Studios, Stage B

VIDEO NAME CONTACT CELL TRANSPORTATION CALL TIME LOCATION
Director Anton Dupreeze hello@antondupreez.com - Self Transportation 7:00 AM Gum Studios, Stage B
Director of Photography Steven Mastorelli stevenmastorelli@gmail.com 973-975-6257 Self Transportation 7:00 AM Gum Studios, Stage B
1st AC Taylor Myers taylorandrewmyers@gmail.com - Self Transportation 7:00 AM Gum Studios, Stage B
2nd AC Hailey Port haileycport@gmail.com 828-702-2718 Self Transportation 7:00 AM Gum Studios, Stage B
Gaffer John Izarpate john@rayofilmsinc.com - Self Transportation 7:00 AM Gum Studios, Stage B
`;

    console.log('\n📋 Test Call Sheet (Sample):');
    console.log('Length:', testCallSheet.length, 'characters');
    console.log('Estimated contacts: 15+');

    // Convert to buffer for testing
    const fileBuffer = Buffer.from(testCallSheet, 'utf8');

    console.log('\n🧠 Starting AI-First Extraction...');
    const startTime = Date.now();

    // Test the AI-first extraction
    const result = await unifiedService.extractContacts(
      fileBuffer,
      'text/plain',
      'test_call_sheet.txt',
      {}
    );

    const processingTime = Date.now() - startTime;

    console.log('\n✅ AI-First Extraction Results:');
    console.log('Method:', result.metadata.extractionMethod);
    console.log('Processing Time:', processingTime, 'ms');
    console.log('Contacts Found:', result.contacts.length);
    console.log('AI Enhanced:', result.metadata.aiEnhanced);
    console.log('AI Limitations Handled:', result.metadata.aiLimitationsHandled);
    console.log('Confidence:', result.metadata.confidence);

    console.log('\n📊 Extracted Contacts:');
    result.contacts.forEach((contact, index) => {
      console.log(`${index + 1}. ${contact.name} - ${contact.role} (${contact.email || contact.phone})`);
    });

    console.log('\n📈 Service Performance:');
    const stats = unifiedService.getStats();
    console.log('Total Extractions:', stats.totalExtractions);
    console.log('Successful Extractions:', stats.successfulExtractions);
    console.log('AI Enhanced Extractions:', stats.aiEnhancedExtractions);
    console.log('Fallback Extractions:', stats.fallbackExtractions);
    console.log('Success Rate:', stats.successRate.toFixed(2) + '%');

    console.log('\n🎯 AI-First Architecture Benefits:');
    console.log('✅ AI Document Analysis - Understands document structure');
    console.log('✅ AI Text Preprocessing - Cleans and structures text');
    console.log('✅ AI Pattern Recognition - Finds contacts intelligently');
    console.log('✅ AI Production Intelligence - Enhances with production context');
    console.log('✅ AI Quality Assurance - Validates and scores contacts');
    console.log('✅ Custom Fallbacks - Handles AI limitations');
    console.log('✅ Quality Merging - Combines AI and custom results');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testAIFirstExtraction();
