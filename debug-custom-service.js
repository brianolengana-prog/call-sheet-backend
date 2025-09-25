/**
 * Debug Custom Extraction Service Pipeline
 * 
 * Test the exact same flow as the real extraction to find the issue
 */

const CustomExtractionService = require('./services/customExtractionService');

async function debugCustomService() {
  console.log('🔍 Debugging Custom Extraction Service Pipeline...\n');
  
  try {
    const customService = new CustomExtractionService();
    
    // Create a mock PDF buffer with the exact content
    const mockPdfContent = `CPD LOP FERIA/COLORSONIC/PREFERENCE PHOTO + VIDEO
CALL SHEET DATE: Tuesday, August 19th, 2025

PRODUCTION Name Phone Call Time Location E-mail
Executive Producer Sarah Carey 845-926-7006 N/A Remote sarahcarey@primecontent.com
Producer Annalisa Gesterkamp 973-567-8552 8:00 AM LS annalisa@primecontent.com
Photographer Lara Callahan 774-210-0503 8:00 AM LS lara@laracallahan.com
Digital Tech Cate Groupert - - 8:00 AM LS categroubert@gmail.com
First Assistant Meg McConville 828-575-3538 8:00 AM LS megemccon@gmail.com
Second Assistant Britney Bautista - - 8:00 AM LS britneybautista2@gmail.com
Director of Photography Dan Rothman 315-430-6875 8:00 AM LS dan@danielrothmandp.com
AC Sam Schnorr 212-620-7021 8:00 AM LS sam.schnorr@gmail.com
Gaffer Sean Moser 917-363-2794 8:00 AM LS seancmoser@gmail.com
Grip Matt Jackson 917-446-3939 8:00 AM LS mattcmjackson@me.com

TALENT Name Phone Call Time Location E-mail
Sublime (Parts) Dorothea Wetmore - - 8:00 AM LS laurel@statemgmt.com
Sublime (Parts) Azlin Nicolette - - 8:00 AM LS sam@curvmgmt.com
Sublime (Parts) Sara Beneke - - 8:00 AM LS Chrissy@bicoastalmgmt.com
Feria Kennedy Taylor - - 8:30 AM LS kennedydonntaylor@gmail.com
Feria Natasha Mercedes - - 8:30 AM LS emily@statemgmt.com

CLIENTS Name Phone Call Time Location E-mail
Jade Dibling - - 8:15 AM LS Jade.dibling@loreal.com
Julia Newman - - 8:15 AM LS Julia.newman@loreal.com
Nico Cortez - - 8:15 AM LS Nicholas.cortez@loreal.com
Miranda Spears - - 8:15 AM LS miranda.spears@loreal.com`;

    // Pad to match the exact length from logs (4004 characters)
    const padding = ' '.repeat(4004 - mockPdfContent.length);
    const fullContent = mockPdfContent + padding;
    
    console.log(`📄 Content length: ${fullContent.length} (target: 4004)`);
    
    // Test with the exact same parameters as the logs
    const result = await customService.extractContacts(
      Buffer.from(fullContent), 
      'application/pdf', 
      'CALL SHEET 8.19 CPD LOP FERIA_COLORSONIC_PREFERENCE PHOTO + VIDEO  - Sheet1.pdf',
      {}
    );
    
    console.log('\n✅ Custom Extraction Service Results:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Contacts: ${result.contacts.length}`);
    console.log(`  Processing Time: ${result.metadata?.processingTime}ms`);
    console.log(`  Total Contacts: ${result.metadata?.totalContacts}`);
    console.log(`  Average Confidence: ${result.metadata?.averageConfidence}`);
    
    console.log('\n📋 Extracted Contacts:');
    result.contacts.forEach((contact, index) => {
      console.log(`  ${index + 1}. ${contact.name} - ${contact.role} (${contact.email})`);
    });
    
    // Test the individual steps
    console.log('\n🔍 Step-by-step debugging:');
    
    // Step 1: Text extraction
    console.log('\n1. Testing text extraction...');
    const extractedText = await customService.extractTextFromDocument(
      Buffer.from(fullContent), 
      'application/pdf', 
      'test.pdf'
    );
    console.log(`   Text length: ${extractedText.length}`);
    console.log(`   First 200 chars: ${extractedText.substring(0, 200)}...`);
    
    // Step 2: Document analysis
    console.log('\n2. Testing document analysis...');
    const documentAnalysis = await customService.analyzeDocument(Buffer.from(fullContent), 'application/pdf', 'test.pdf');
    console.log(`   Document analysis:`, documentAnalysis);
    
    // Step 3: Pattern extraction
    console.log('\n3. Testing pattern extraction...');
    const patternExtractor = require('./services/extraction/patternExtractor');
    const extractor = new patternExtractor();
    const patternContacts = await extractor.extractContacts(extractedText, documentAnalysis);
    console.log(`   Pattern extraction found: ${patternContacts.length} contacts`);
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugCustomService();
