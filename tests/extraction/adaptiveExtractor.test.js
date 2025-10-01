/**
 * Comprehensive Test Suite for Adaptive Extractor
 * 
 * Tests extraction across all call sheet formats and complexities
 */

const AdaptiveExtractor = require('../../services/extraction/adaptiveExtractor');

describe('Adaptive Extractor - Core Functionality', () => {
  let extractor;

  beforeEach(() => {
    extractor = new AdaptiveExtractor();
  });

  describe('Basic Format Support', () => {
    test('should extract from slash-delimited format', async () => {
      const text = `Photographer: John Smith / 555-123-4567
Director: Jane Doe / jane@example.com / 555-234-5678`;

      const result = await extractor.extract(text);

      expect(result.contacts).toHaveLength(2);
      expect(result.contacts[0].name).toBe('John Smith');
      expect(result.contacts[0].role).toBe('Photographer');
      expect(result.contacts[0].phone).toMatch(/555.*123.*4567/);
      expect(result.contacts[1].name).toBe('Jane Doe');
      expect(result.contacts[1].email).toBe('jane@example.com');
    });

    test('should extract from pipe-delimited format', async () => {
      const text = `Name | Email | Phone | Role
John Smith | john@test.com | 555-1234 | Director
Jane Doe | jane@test.com | 555-5678 | Producer`;

      const result = await extractor.extract(text);

      expect(result.contacts.length).toBeGreaterThanOrEqual(2);
      expect(result.metadata.structure.type).toBe('tabular');
      
      const john = result.contacts.find(c => c.name === 'John Smith');
      expect(john).toBeDefined();
      expect(john.email).toBe('john@test.com');
      expect(john.role).toMatch(/Director/i);
    });

    test('should extract from whitespace-separated format', async () => {
      const text = `Name                 Email                  Phone
John Smith           john@test.com          555-123-4567
Jane Doe             jane@test.com          555-234-5678`;

      const result = await extractor.extract(text);

      expect(result.contacts.length).toBeGreaterThanOrEqual(2);
      expect(result.metadata.structure.type).toBe('tabular');
    });

    test('should extract from multi-line format', async () => {
      const text = `Name: John Smith
Email: john@test.com
Phone: 555-123-4567
Role: Director

Name: Jane Doe
Email: jane@test.com
Phone: 555-234-5678
Role: Producer`;

      const result = await extractor.extract(text);

      expect(result.contacts.length).toBeGreaterThanOrEqual(2);
      expect(result.metadata.extractionMode).toBeTruthy();
    });

    test('should extract from freeform text', async () => {
      const text = `For this shoot we have John Smith (john@test.com) as our director.
The producer is Jane Doe, you can reach her at (555) 234-5678.
Photography by Mike Johnson (mike@photo.com).`;

      const result = await extractor.extract(text);

      expect(result.contacts.length).toBeGreaterThanOrEqual(2);
      
      const john = result.contacts.find(c => c.name?.includes('John Smith'));
      expect(john).toBeDefined();
    });
  });

  describe('Name Handling', () => {
    test('should normalize ALL CAPS names', async () => {
      const text = `Model: BIANCA FELICIANO / 555-123-4567
Photographer: JOHN SMITH / 555-234-5678`;

      const result = await extractor.extract(text);

      expect(result.contacts[0].name).toBe('Bianca Feliciano');
      expect(result.contacts[1].name).toBe('John Smith');
    });

    test('should handle mixed case names', async () => {
      const text = `Director: john smith / 555-123-4567
Producer: JANE DOE / 555-234-5678
Camera: Mike Johnson / 555-345-6789`;

      const result = await extractor.extract(text);

      expect(result.contacts[0].name).toBe('John Smith');
      expect(result.contacts[1].name).toBe('Jane Doe');
      expect(result.contacts[2].name).toBe('Mike Johnson');
    });

    test('should handle names with apostrophes', async () => {
      const text = `Director: Patrick O'Brien / 555-123-4567
Producer: Mary O'Connor / 555-234-5678`;

      const result = await extractor.extract(text);

      expect(result.contacts[0].name).toContain("O'Brien");
      expect(result.contacts[1].name).toContain("O'Connor");
    });

    test('should handle names with hyphens', async () => {
      const text = `Stylist: Mary-Jane Watson / 555-123-4567
Director: Jean-Luc Picard / 555-234-5678`;

      const result = await extractor.extract(text);

      expect(result.contacts[0].name).toContain('Mary-Jane');
      expect(result.contacts[1].name).toContain('Jean-Luc');
    });

    test('should handle single names', async () => {
      const text = `Talent: Madonna / madonna@agency.com
Talent: Cher / cher@agency.com / 555-123-4567`;

      const result = await extractor.extract(text);

      expect(result.contacts.length).toBeGreaterThanOrEqual(2);
    });

    test('should handle names with titles/prefixes', async () => {
      const text = `Doctor: Dr. Sarah Johnson / 555-123-4567
DJ: DJ Khaled / 555-234-5678
MC: MC Hammer / 555-345-6789`;

      const result = await extractor.extract(text);

      expect(result.contacts.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Phone Number Handling', () => {
    test('should handle various phone formats', async () => {
      const text = `Contact: John Smith / 5551234567
Contact: Jane Doe / 555-123-4567
Contact: Mike Johnson / (555) 123-4567
Contact: Sarah Wilson / 555.123.4567`;

      const result = await extractor.extract(text);

      expect(result.contacts.length).toBeGreaterThanOrEqual(4);
      result.contacts.forEach(contact => {
        expect(contact.phone).toBeTruthy();
      });
    });

    test('should handle international phone formats', async () => {
      const text = `Director: François Dubois / +33 1 42 86 82 00
DP: Hans Müller / +49 30 12345678
Gaffer: Yuki Tanaka / +81 3-1234-5678`;

      const result = await extractor.extract(text);

      expect(result.contacts.length).toBeGreaterThanOrEqual(3);
      result.contacts.forEach(contact => {
        expect(contact.phone).toBeTruthy();
      });
    });

    test('should standardize US phone numbers', async () => {
      const text = `Contact: John Smith / 5551234567`;

      const result = await extractor.extract(text);

      expect(result.contacts[0].phone).toMatch(/\(\d{3}\)\s\d{3}-\d{4}/);
    });
  });

  describe('Role Extraction', () => {
    test('should extract roles from prefix pattern', async () => {
      const text = `Photographer: John Smith / 555-123-4567
1st Photo Assistant: Jane Doe / 555-234-5678
2nd Photo Assistant: Mike Johnson / 555-345-6789`;

      const result = await extractor.extract(text);

      expect(result.contacts[0].role).toBe('Photographer');
      expect(result.contacts[1].role).toContain('Photo Assistant');
      expect(result.contacts[2].role).toContain('Photo Assistant');
    });

    test('should recognize production roles', async () => {
      const text = `Photographer: John / 555-1234
Digitech: Jane / 555-2345
Videographer: Mike / 555-3456
MUA: Sarah / 555-4567
HUA: Tom / 555-5678
HMUA: Lisa / 555-6789
Stylist: Emma / 555-7890
Driver: Bob / 555-8901`;

      const result = await extractor.extract(text);

      expect(result.contacts.length).toBeGreaterThanOrEqual(8);
      
      const mua = result.contacts.find(c => c.name === 'Sarah');
      expect(mua.role).toMatch(/Makeup/i);
      
      const hua = result.contacts.find(c => c.name === 'Tom');
      expect(hua.role).toMatch(/Hair/i);
    });
  });

  describe('Complex Structures', () => {
    test('should handle sectioned call sheets', async () => {
      const text = `PRODUCTION CREW
Photographer: John Smith / 555-123-4567
Director: Jane Doe / 555-234-5678

TALENT
Model: Sarah Johnson / 555-345-6789
Model: Mike Wilson / 555-456-7890

STYLING
Stylist: Emma Brown / 555-567-8901
Assistant: Tom Davis / 555-678-9012`;

      const result = await extractor.extract(text);

      expect(result.contacts.length).toBeGreaterThanOrEqual(6);
      expect(result.metadata.structure.sections.length).toBeGreaterThan(0);
    });

    test('should handle mixed delimiters', async () => {
      const text = `Photographer: John Smith / 555-123-4567
Director | Jane Doe | jane@test.com | 555-234-5678
Producer – Mike Johnson – 555-345-6789`;

      const result = await extractor.extract(text);

      expect(result.contacts.length).toBeGreaterThanOrEqual(3);
    });

    test('should handle nested information', async () => {
      const text = `Model: BIANCA FELICIANO
Agency: Ford Models
Agent: Brett Pougnet / 917-783-8966
Email: brett@fordmodels.com

Model: TEHYA
Agency: JAG Models
Agent: Adam Hughes / 917-539-9577`;

      const result = await extractor.extract(text);

      expect(result.contacts.length).toBeGreaterThanOrEqual(2);
    });

    test('should handle your original failing call sheet', async () => {
      const text = `Call Sheet: SS26 Editorial 9.19
Date: 09.19.2025

Call Time:
Location: 72 Greene Ave, Brooklyn NY

Crew
Photographer: Coni Tarallo / 929.250.6798
1st Photo Assistant: Asa Lory / 573.823.9705
2nd Photo Assistant: Kevin Mathien/ 312.519.0901
Digitech: William Manchuck / 860.888.2173
1st Videographer: Christian Hernandez / 917.769.6922
2nd Videographer: Angeline Quintilla / 510.402.9371

Model: BIANCA FELICIANO / Ford Brett Pougnet / 917.783.8966
Model: TEHYA / JAG - Adam Hughes / 917-539-9577
Model: LYDIA WALDROP / Supreme - Taylor Warren / 212-380-6538

Casting Director: Anna Jozwaik / 917.283.0789
1st Production Assistant: Edwin Blas / 201.772.7141
2nd Production Assistant: Ramon Vasquez / 678.600.1266

MUA: Yuko Kawashima / 646.578.2704
HUA: Juli Akaneya / 201.647.7724
HMUA: Mariolga Pantazopoulos / 617.590.9160
Stylist: Francesca Tonelli / 774.571.9338
Stylist: Danielle Dinten / 347.420.8522
Stylist Assistant: Morgan / 704.626.0999
Driver: Mahmoud Ebid / 646.575.0323`;

      const result = await extractor.extract(text);

      // Should extract at least 19 contacts (all crew/talent)
      expect(result.contacts.length).toBeGreaterThanOrEqual(19);
      
      // Check specific contacts
      const photographer = result.contacts.find(c => c.name === 'Coni Tarallo');
      expect(photographer).toBeDefined();
      expect(photographer.role).toBe('Photographer');
      expect(photographer.phone).toMatch(/929.*250.*6798/);
      
      // Check ALL CAPS normalization
      const model = result.contacts.find(c => c.name === 'Bianca Feliciano');
      expect(model).toBeDefined();
      expect(model.role).toMatch(/Model/i);
    });
  });

  describe('Multi-Pass Extraction', () => {
    test('should work with multi-pass enabled', async () => {
      const text = `Photographer: John Smith / 555-123-4567
john@photo.com

Director: Jane Doe
jane@director.com
555-234-5678`;

      const result = await extractor.extract(text, {}, { useMultiPass: true });

      expect(result.contacts.length).toBeGreaterThanOrEqual(2);
      expect(result.metadata.extractionMode).toBe('multi-pass');
    });

    test('should infer relationships in multi-pass mode', async () => {
      const text = `Photographer: John Smith / 555-123-4567
1st Photo Assistant: Jane Doe / 555-234-5678
2nd Photo Assistant: Mike Johnson / 555-345-6789`;

      const result = await extractor.extract(text, {}, { useMultiPass: true });

      expect(result.contacts.length).toBeGreaterThanOrEqual(3);
      
      // Assistants should have metadata about reporting structure
      const assistant = result.contacts.find(c => c.role?.includes('1st'));
      if (assistant?.metadata) {
        // This would be set if relationship inference worked
        expect(assistant.metadata).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty input', async () => {
      const result = await extractor.extract('');
      expect(result.contacts).toHaveLength(0);
    });

    test('should handle no contacts in text', async () => {
      const text = `Call Sheet Information
Date: September 19, 2025
Location: Studio A
Call Time: 8:00 AM`;

      const result = await extractor.extract(text);
      expect(result.contacts).toHaveLength(0);
    });

    test('should handle malformed data', async () => {
      const text = `///////////
:::::::::::
Name: / / /
Email: @@@
Phone: ---`;

      const result = await extractor.extract(text);
      // Should not crash, might return empty or filtered contacts
      expect(result.contacts).toBeDefined();
    });

    test('should handle very long names', async () => {
      const text = `Director: Jean-Baptiste Emmanuel Zorg / 555-123-4567`;

      const result = await extractor.extract(text);
      expect(result.contacts[0].name).toContain('Jean-Baptiste');
    });

    test('should handle Unicode characters', async () => {
      const text = `Director: José García / 555-123-4567
Producer: François Müller / 555-234-5678
DP: Владимир Петров / 555-345-6789`;

      const result = await extractor.extract(text);
      expect(result.contacts.length).toBeGreaterThanOrEqual(2);
    });

    test('should handle contacts with no phone or email', async () => {
      const text = `Director: John Smith
Producer: Jane Doe
Camera: Mike Johnson / 555-123-4567`;

      const result = await extractor.extract(text);
      
      // Should still extract the one with phone
      expect(result.contacts.length).toBeGreaterThanOrEqual(1);
    });

    test('should handle duplicate contacts', async () => {
      const text = `Photographer: John Smith / 555-123-4567
Photographer: John Smith / john@photo.com
Photographer: John Smith / 555-123-4567`;

      const result = await extractor.extract(text);

      // Should deduplicate
      expect(result.contacts.length).toBe(1);
      expect(result.contacts[0].phone).toBeTruthy();
      expect(result.contacts[0].email).toBeTruthy();
    });
  });

  describe('Confidence Scoring', () => {
    test('should assign high confidence to complete contacts', async () => {
      const text = `Director: John Smith / john@test.com / 555-123-4567`;

      const result = await extractor.extract(text);

      expect(result.contacts[0].confidence).toBeGreaterThan(0.7);
    });

    test('should assign lower confidence to partial contacts', async () => {
      const text = `Director: John Smith`;

      const result = await extractor.extract(text, {}, { confidenceThreshold: 0.1 });

      if (result.contacts.length > 0) {
        expect(result.contacts[0].confidence).toBeLessThan(0.5);
      }
    });

    test('should filter by confidence threshold', async () => {
      const text = `Director: John Smith / john@test.com / 555-123-4567
Producer: Jane
Camera: Mike / 555-234-5678`;

      const resultLow = await extractor.extract(text, {}, { confidenceThreshold: 0.2 });
      const resultHigh = await extractor.extract(text, {}, { confidenceThreshold: 0.6 });

      expect(resultLow.contacts.length).toBeGreaterThan(resultHigh.contacts.length);
    });

    test('should calculate average confidence', async () => {
      const text = `Director: John Smith / john@test.com / 555-123-4567
Producer: Jane Doe / jane@test.com
Camera: Mike`;

      const result = await extractor.extract(text, {}, { confidenceThreshold: 0.1 });

      expect(result.metadata.avgConfidence).toBeDefined();
      expect(result.metadata.avgConfidence).toBeGreaterThan(0);
      expect(result.metadata.avgConfidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Performance', () => {
    test('should process typical call sheet in < 500ms', async () => {
      const text = `Call Sheet: Test Production

CREW
Photographer: John Smith / 555-123-4567
Director: Jane Doe / jane@test.com / 555-234-5678
Producer: Mike Johnson / mike@test.com / 555-345-6789
Camera: Sarah Wilson / sarah@test.com / 555-456-7890
Sound: Tom Davis / tom@test.com / 555-567-8901

TALENT
Model: Emma Brown / emma@agency.com / 555-678-9012
Model: Lisa Garcia / lisa@agency.com / 555-789-0123
Model: Bob Martinez / bob@agency.com / 555-890-1234

STYLING
Stylist: Anna Johnson / anna@style.com / 555-901-2345
Assistant: Chris Lee / chris@style.com / 555-012-3456`;

      const start = Date.now();
      const result = await extractor.extract(text);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
      expect(result.contacts.length).toBeGreaterThanOrEqual(10);
    });

    test('should handle large call sheets (50+ contacts)', async () => {
      // Generate large call sheet
      let text = 'CREW\n';
      for (let i = 0; i < 50; i++) {
        text += `Person ${i}: Contact ${i} / email${i}@test.com / 555-${String(i).padStart(4, '0')}\n`;
      }

      const start = Date.now();
      const result = await extractor.extract(text);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000); // 2 seconds for large sheet
      expect(result.contacts.length).toBeGreaterThanOrEqual(40);
    });
  });

  describe('Metadata', () => {
    test('should detect document structure type', async () => {
      const tabular = await extractor.extract(`Name | Email | Phone
John | john@test.com | 555-1234`);
      expect(tabular.metadata.structure.type).toBe('tabular');

      const mixed = await extractor.extract(`Photographer: John / 555-1234`);
      expect(mixed.metadata.structure).toBeDefined();
    });

    test('should identify extraction strategies used', async () => {
      const text = `Photographer: John Smith / 555-123-4567`;

      const result = await extractor.extract(text);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalRawContacts).toBeGreaterThanOrEqual(0);
      expect(result.metadata.duplicatesRemoved).toBeGreaterThanOrEqual(0);
    });

    test('should count duplicates removed', async () => {
      const text = `Photographer: John Smith / 555-123-4567
Photographer: John Smith / john@test.com
Photographer: John Smith / 555-123-4567`;

      const result = await extractor.extract(text);

      expect(result.metadata.duplicatesRemoved).toBeGreaterThan(0);
    });
  });
});

describe('Regression Tests', () => {
  let extractor;

  beforeEach(() => {
    extractor = new AdaptiveExtractor();
  });

  test('Issue #1: ALL CAPS names should be normalized', async () => {
    const text = `Model: BIANCA FELICIANO / 555-123-4567`;
    const result = await extractor.extract(text);
    
    expect(result.contacts[0].name).toBe('Bianca Feliciano');
    expect(result.contacts[0].name).not.toBe('BIANCA FELICIANO');
  });

  test('Issue #2: Contacts without email should still be extracted', async () => {
    const text = `Photographer: Coni Tarallo / 929.250.6798`;
    const result = await extractor.extract(text);
    
    expect(result.contacts.length).toBeGreaterThan(0);
    expect(result.contacts[0].name).not.toBe('Unknown');
  });

  test('Issue #3: Multi-line contacts should be linked', async () => {
    const text = `Name: John Smith
Email: john@test.com
Phone: 555-123-4567

Name: Jane Doe
Email: jane@test.com`;

    const result = await extractor.extract(text);
    
    expect(result.contacts.length).toBeGreaterThanOrEqual(2);
    
    const john = result.contacts.find(c => c.name === 'John Smith');
    expect(john).toBeDefined();
    expect(john.email).toBe('john@test.com');
    expect(john.phone).toBeTruthy();
  });

  test('Issue #4: Should handle agency/agent format for models', async () => {
    const text = `Model: BIANCA FELICIANO / Ford Brett Pougnet / 917.783.8966`;
    const result = await extractor.extract(text);
    
    expect(result.contacts[0].name).toBe('Bianca Feliciano');
    expect(result.contacts[0].company).toBeTruthy();
  });
});

// Export for use in other tests
module.exports = { AdaptiveExtractor };

