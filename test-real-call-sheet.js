const fs = require('fs');
const path = require('path');

// Test with the actual call sheet content
async function testRealCallSheet() {
  console.log('🚀 Testing Real Call Sheet Extraction...\n');

  try {
    // Initialize the unified service
    const UnifiedExtractionService = require('./services/unifiedExtractionService');
    const unifiedService = new UnifiedExtractionService();

    console.log('✅ Unified Extraction Service initialized');
    console.log('🤖 AI Available:', unifiedService.aiAvailable);

    // Test with the actual call sheet content
    const realCallSheet = `CPD LOP FERIA/COLORSONIC/PREFERENCE PHOTO + VIDEO
CALL SHEET DATE: Tuesday, August 19th, 2025
MAIN CONTACT: LOCATION:
Annalisa Gesterkamp L'Oreal Studios
annalisa@primecontent.com 111 Town Square Pl - 10th Fl
973-567-8552 Jersey City, NJ 07310
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
On Set Retoucher Lolly Koon - - 8:00 AM LS koon.lolly@gmail.com
iPhone Video Charlie Gilette 914-482-0466 8:00 AM LS Gillettecharlie@gmail.com
Colorist Patricia Slattery - - 10:00 AM LS Patricia.SLATTERY@loreal.com
Colorist Mariano Cuevas - - 10:00 AM LS mariano.cuevas@loreal.com
Colorist Jovan Clowers - - 10:00 AM LS jovan.clowers@loreal.com
Colorist Alexis Rosati - - 10:00 AM LS Alexis.Rosati@loreal.com
Colorist Alyxandria Rutter - - 10:00 AM LS alyxandria.vandewalle@loreal.com
Colorist Noelle Odermatt - - 10:00 AM LS noelle.odermatt@loreal.com
Hair Stylist Cynthia Alvarez - - 8:00 AM LS jay@twenty4eleven.com
Hair Assistant Eric Rosado - - 8:00 AM LS ericjrosado@gmail.com
Barber Ken Marcelle - - 9:00 AM LS Matblakhair@gmail.com
Makeup Artist Ashleigh Ciucci - - 8:00 AM LS adele@seemanagement.com
Makeup Assistant Will Metivier 832-334-6846 8:00 AM LS willmetiviermua@gmail.com
Makeup Assistant Elena Nheme 754-302-4071 8:00 AM LS elenanhememua@gmail.com
Wardrobe Stylist Zoey Radford Scott 929-351-5910 8:00 AM LS zoeyradfordscott@gmail.com
Wardrobe Assistant Alexia Barrirtt - - 8:00 AM LS alexiabarritt@gmail.com
Set Design Alix Winsby 617-838-4338 8:00 AM LS alix.winsby@gmail.com
Set Design Assistant Alexis Thompson - - 8:00 AM LS malexisthompson@gmail.com
Production Assistant James Bold 401-793-1383 8:00 AM LS jamesjbold@gmail.com
TALENT Name Phone Call Time Location E-mail
Sublime (Parts) Dorothea Wetmore - - 8:00 AM LS laurel@statemgmt.com
Sublime (Parts) Azlin Nicolette - - 8:00 AM LS sam@curvmgmt.com
Sublime (Parts) Sara Beneke - - 8:00 AM LS Chrissy@bicoastalmgmt.com
Feria Kennedy Taylor - - 8:30 AM LS kennedydonntaylor@gmail.com
Feria Natasha Mercedes - - 8:30 AM LS emily@statemgmt.com`;

    console.log('📋 Real Call Sheet Content:');
    console.log('Length:', realCallSheet.length, 'characters');
    console.log('Expected contacts: 40+');

    // Convert to buffer for testing
    const fileBuffer = Buffer.from(realCallSheet, 'utf8');

    console.log('\n🧠 Starting AI-First Extraction...');
    const startTime = Date.now();

    // Test the AI-first extraction
    const result = await unifiedService.extractContacts(
      fileBuffer,
      'text/plain',
      'real_call_sheet.txt',
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

    console.log('\n📈 Expected vs Actual:');
    console.log('Expected: 40+ contacts');
    console.log('Actual:', result.contacts.length, 'contacts');
    console.log('Success Rate:', ((result.contacts.length / 40) * 100).toFixed(1) + '%');

    if (result.contacts.length < 20) {
      console.log('\n❌ ISSUE: Low contact extraction detected');
      console.log('This suggests the AI-first architecture needs improvement');
    } else {
      console.log('\n✅ SUCCESS: Good contact extraction');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testRealCallSheet();


