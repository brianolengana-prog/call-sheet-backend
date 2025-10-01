/**
 * Test Adaptive Extraction with Various Call Sheet Formats
 */

const AdaptiveExtractor = require('./services/extraction/adaptiveExtractor');

// Test cases covering different formats
const testCases = [
  {
    name: 'Slash-delimited with roles',
    text: `Call Sheet: SS26 Editorial 9.19

Photographer: Coni Tarallo / 929.250.6798
1st Photo Assistant: Asa Lory / 573.823.9705
Digitech: William Manchuck / 860.888.2173
Model: BIANCA FELICIANO / Ford Brett Pougnet / 917.783.8966`
  },
  
  {
    name: 'ALL CAPS names with emails',
    text: `CREW LIST

JOHN SMITH | john@studio.com | (555) 123-4567 | Director
SARAH JOHNSON | sarah@agency.com | (555) 234-5678 | Producer
MIKE DAVIS | mike@production.com | (555) 345-6789 | Camera Operator`
  },
  
  {
    name: 'Tabular format (whitespace-separated)',
    text: `Name               Email                    Phone             Role
-------------------------------------------------------------------
James Wilson       james@example.com        (555) 456-7890    Gaffer
Emily Brown        emily@studio.com         (555) 567-8901    Script Supervisor
David Martinez     david@production.com     (555) 678-9012    Sound Mixer`
  },
  
  {
    name: 'Multi-line format',
    text: `Contact 1
Name: Jennifer Lee
Email: jennifer@agency.com
Phone: (555) 789-0123
Role: Art Director

Contact 2
Name: Robert Taylor
Email: robert@studio.com
Phone: (555) 890-1234
Role: Set Designer`
  },
  
  {
    name: 'Mixed case with dashes',
    text: `Production Team:
Lisa Anderson - (555) 901-2345
Mark Thompson - (555) 012-3456 - Lighting Director
Jessica Garcia – jessica@production.com – (555) 123-4567`
  },
  
  {
    name: 'Pipe-delimited table',
    text: `TALENT
Name | Agency | Agent | Phone
SOPHIA RODRIGUEZ | IMG | Maria Santos | 555-234-5678
LUCAS MARTINEZ | Next | John Kim | 555-345-6789
EMMA WILSON | Supreme | Taylor Warren | 212-380-6538`
  },
  
  {
    name: 'Freeform with scattered info',
    text: `For this shoot we have Anna Johnson (anna@studio.com) as our makeup artist. 
The hair stylist is Marcus Lee, you can reach him at (555) 456-7890.
Photography by Isabella Chen (isabella.chen@photo.com).
Contact the producer Rachel Kim at rachel@production.com or call (555) 567-8901.`
  },
  
  {
    name: 'International phone formats',
    text: `International Crew:
François Dubois / +33 1 42 86 82 00 / Director (France)
Hans Müller / +49 30 12345678 / DP (Germany)  
Yuki Tanaka / +81 3-1234-5678 / Gaffer (Japan)
Maria García / maria@studio.es / +34 91 123 4567 / Producer (Spain)`
  },
  
  {
    name: 'Single names and nicknames',
    text: `Talent:
- Madonna / madonna@agency.com
- Cher / 555-678-9012
- DJ Khaled / djkhaled@music.com / (555) 789-0123
- MC Hammer / hammer@entertainment.com`
  },
  
  {
    name: 'Names with apostrophes and hyphens',
    text: `Crew List:
Patrick O'Brien / patrick.obrien@studio.com / (555) 890-1234 / Camera Operator
Mary-Jane Watson / maryjane@agency.com / (555) 901-2345 / Wardrobe
Jean-Luc Picard / jeanluc@production.com / (555) 012-3456 / Director`
  },
  
  {
    name: 'Complex format with everything',
    text: `=== PRODUCTION CALL SHEET ===
Project: Summer Fashion 2025
Date: September 19, 2025
Location: Brooklyn Studios, 72 Greene Ave

CREW
====
Photographer: Coni Tarallo / 929.250.6798 / coni@studio.com
1st Photo Assistant: Asa Lory / 573.823.9705
2nd Photo Assistant: Kevin Mathien / 312.519.0901 / kevin.m@photography.com
Digital Tech: William Manchuck / 860.888.2173

TALENT
======
Model: BIANCA FELICIANO
Agency: Ford Models
Agent: Brett Pougnet / 917.783.8966
Email: brett@fordmodels.com

Model: TEHYA
Agency: JAG Models
Agent: Adam Hughes / 917-539-9577

HAIR & MAKEUP
=============
MUA: Yuko Kawashima / 646.578.2704
HUA: Juli Akaneya / 201.647.7724
HMUA: Mariolga Pantazopoulos / mariolga@beauty.com / 617.590.9160

STYLING
=======
Lead Stylist: Francesca Tonelli / 774.571.9338 / francesca@style.com
Stylist: Danielle Dinten / 347.420.8522
Assistant: Morgan / 704.626.0999

PRODUCTION
==========
1st PA: Edwin Blas / 201.772.7141 / edwin.blas@production.com
2nd PA: Ramon Vasquez / 678.600.1266
Casting: Anna Jozwaik / ‭917.283.0789‬ / anna@casting.com
Driver: Mahmoud Ebid / 646.575.0323

Contact: For billing questions, email melanie@marcellanyc.com
Dietary restrictions: zoe@marcellanyc.com`
  }
];

async function runTests() {
  const extractor = new AdaptiveExtractor();
  
  console.log('🧪 Testing Adaptive Extraction System');
  console.log('=====================================\n');
  
  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log('─'.repeat(60));
    
    try {
      const result = await extractor.extract(testCase.text);
      
      console.log(`✅ Extracted ${result.contacts.length} contacts`);
      console.log(`📊 Structure: ${result.metadata.structure.type}`);
      console.log(`🎯 Strategies used: ${result.metadata.strategiesUsed || 'N/A'}`);
      
      // Show contacts
      result.contacts.forEach((contact, index) => {
        const parts = [];
        if (contact.name) parts.push(`Name: ${contact.name}`);
        if (contact.role) parts.push(`Role: ${contact.role}`);
        if (contact.phone) parts.push(`Phone: ${contact.phone}`);
        if (contact.email) parts.push(`Email: ${contact.email}`);
        if (contact.company) parts.push(`Company: ${contact.company}`);
        parts.push(`Confidence: ${(contact.confidence * 100).toFixed(0)}%`);
        
        console.log(`  ${index + 1}. ${parts.join(' | ')}`);
      });
      
      // Show stats
      console.log(`\n📈 Stats:`);
      console.log(`   - Total raw: ${result.metadata.totalRawContacts}`);
      console.log(`   - Duplicates removed: ${result.metadata.duplicatesRemoved}`);
      console.log(`   - Final: ${result.contacts.length}`);
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      console.error(error.stack);
    }
  }
  
  console.log('\n\n✅ All tests completed!\n');
}

// Run tests
runTests().catch(console.error);

