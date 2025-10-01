/**
 * Integration Tests for Complete Extraction Pipeline
 * 
 * Tests the full flow from file upload to contact extraction
 */

const UnifiedExtractionService = require('../../services/unifiedExtractionService');
const fs = require('fs').promises;
const path = require('path');

describe('Extraction Integration Tests', () => {
  let service;

  beforeEach(() => {
    service = new UnifiedExtractionService();
  });

  describe('End-to-End Text Extraction', () => {
    test('should extract from plain text call sheet', async () => {
      const callSheet = `Call Sheet: Summer Fashion 2025
      
CREW
Photographer: Coni Tarallo / 929.250.6798
1st Photo Assistant: Asa Lory / 573.823.9705
Digitech: William Manchuck / 860.888.2173

TALENT
Model: BIANCA FELICIANO / Ford Brett Pougnet / 917.783.8966

STYLING
MUA: Yuko Kawashima / 646.578.2704
Stylist: Francesca Tonelli / 774.571.9338`;

      const buffer = Buffer.from(callSheet);
      const result = await service.extractContacts(buffer, 'text/plain', 'test.txt');

      expect(result.success).toBe(true);
      expect(result.contacts.length).toBeGreaterThanOrEqual(6);
      
      // Verify specific contacts
      const photographer = result.contacts.find(c => c.name?.includes('Coni'));
      expect(photographer).toBeDefined();
      expect(photographer.role).toMatch(/Photographer/i);
      
      // Verify ALL CAPS normalization
      const model = result.contacts.find(c => c.name?.includes('Bianca'));
      expect(model).toBeDefined();
      expect(model.name).not.toMatch(/^[A-Z\s]+$/); // Should not be all caps
    });

    test('should extract from complex sectioned call sheet', async () => {
      const callSheet = `=== PRODUCTION CALL SHEET ===
Project: Fashion Editorial
Date: September 19, 2025

PRODUCTION TEAM
Executive Producer: Sarah Carey / sarahcarey@primecontent.com / (845) 926-7006
Producer: Michael Ross / michael@production.com / (555) 123-4567
Line Producer: Emma Wilson / emma@production.com / (555) 234-5678

CAMERA DEPARTMENT
Director of Photography: James Chen / james@camera.com / (555) 345-6789
1st AC: Lisa Martinez / lisa@camera.com / (555) 456-7890
2nd AC: Tom Anderson / tom@camera.com / (555) 567-8901

TALENT
Model: SOPHIA RODRIGUEZ / IMG / Maria Santos / 555-234-5678
Model: LUCAS MARTINEZ / Next / John Kim / 555-345-6789

HAIR & MAKEUP
Makeup Artist: Anna Johnson / anna@beauty.com / (555) 678-9012
Hair Stylist: Chris Lee / chris@beauty.com / (555) 789-0123

WARDROBE
Stylist: Rachel Kim / rachel@style.com / (555) 890-1234
Stylist Assistant: David Park / david@style.com / (555) 901-2345`;

      const buffer = Buffer.from(callSheet);
      const result = await service.extractContacts(buffer, 'text/plain', 'complex.txt');

      expect(result.success).toBe(true);
      expect(result.contacts.length).toBeGreaterThanOrEqual(12);
      
      // Verify sections were recognized
      const producer = result.contacts.find(c => c.role?.includes('Producer'));
      expect(producer).toBeDefined();
      
      const dop = result.contacts.find(c => c.role?.includes('Photography'));
      expect(dop).toBeDefined();
      
      const model = result.contacts.find(c => c.role?.includes('Model'));
      expect(model).toBeDefined();
    });

    test('should handle tabular format with headers', async () => {
      const callSheet = `Production: Test Shoot

Name               | Role              | Email                  | Phone
-------------------|-------------------|------------------------|---------------
John Smith         | Director          | john@test.com          | (555) 123-4567
Jane Doe           | Producer          | jane@test.com          | (555) 234-5678
Mike Johnson       | Camera Operator   | mike@test.com          | (555) 345-6789
Sarah Wilson       | Sound Mixer       | sarah@test.com         | (555) 456-7890
Tom Davis          | Gaffer            | tom@test.com           | (555) 567-8901`;

      const buffer = Buffer.from(callSheet);
      const result = await service.extractContacts(buffer, 'text/plain', 'table.txt');

      expect(result.success).toBe(true);
      expect(result.contacts.length).toBeGreaterThanOrEqual(5);
      
      // All should have email and phone
      result.contacts.forEach(contact => {
        if (contact.name && !contact.name.includes('Production')) {
          expect(contact.email || contact.phone).toBeTruthy();
        }
      });
    });

    test('should handle international formats', async () => {
      const callSheet = `International Crew

Director: François Dubois / francois@cinema.fr / +33 1 42 86 82 00
DP: Hans Müller / hans@film.de / +49 30 12345678
Gaffer: Yuki Tanaka / yuki@production.jp / +81 3-1234-5678
Producer: María García / maria@studio.es / +34 91 123 4567`;

      const buffer = Buffer.from(callSheet);
      const result = await service.extractContacts(buffer, 'text/plain', 'intl.txt');

      expect(result.success).toBe(true);
      expect(result.contacts.length).toBeGreaterThanOrEqual(4);
      
      // Should preserve international phone formats
      result.contacts.forEach(contact => {
        expect(contact.phone).toBeTruthy();
        expect(contact.email).toBeTruthy();
      });
    });
  });

  describe('Configuration Integration', () => {
    test('should respect confidence threshold from config', async () => {
      const callSheet = `Director: John Smith / john@test.com / 555-123-4567
Producer: Jane
Camera: Mike / 555-234-5678`;

      const buffer = Buffer.from(callSheet);
      
      // With low threshold
      service.extractionConfig.confidenceThreshold = 0.2;
      const resultLow = await service.extractContacts(buffer, 'text/plain', 'test.txt');
      
      // With high threshold
      service.extractionConfig.confidenceThreshold = 0.7;
      const resultHigh = await service.extractContacts(buffer, 'text/plain', 'test.txt');

      expect(resultLow.contacts.length).toBeGreaterThan(resultHigh.contacts.length);
    });

    test('should use adaptive extractor when enabled', async () => {
      const callSheet = `Photographer: Coni Tarallo / 929.250.6798`;
      const buffer = Buffer.from(callSheet);

      service.extractionConfig.useAdaptiveExtractor = true;
      const result = await service.extractContacts(buffer, 'text/plain', 'test.txt');

      expect(result.success).toBe(true);
      expect(service.stats.adaptiveExtractions).toBeGreaterThan(0);
    });

    test('should fall back to legacy when adaptive disabled', async () => {
      const callSheet = `Photographer: Coni Tarallo / 929.250.6798`;
      const buffer = Buffer.from(callSheet);

      service.extractionConfig.useAdaptiveExtractor = false;
      const result = await service.extractContacts(buffer, 'text/plain', 'test.txt');

      expect(result.success).toBe(true);
      // Should not increment adaptive counter
      const adaptiveBefore = service.stats.adaptiveExtractions;
      await service.extractContacts(buffer, 'text/plain', 'test2.txt');
      expect(service.stats.adaptiveExtractions).toBe(adaptiveBefore);
    });
  });

  describe('Error Handling', () => {
    test('should handle empty file gracefully', async () => {
      const buffer = Buffer.from('');
      const result = await service.extractContacts(buffer, 'text/plain', 'empty.txt');

      // Should not crash
      expect(result).toBeDefined();
    });

    test('should handle malformed text', async () => {
      const buffer = Buffer.from('////////////\n::::::::\n@@@@@@@');
      const result = await service.extractContacts(buffer, 'text/plain', 'malformed.txt');

      expect(result).toBeDefined();
      expect(result.contacts).toBeDefined();
    });

    test('should handle unsupported characters', async () => {
      const buffer = Buffer.from('Test: 你好 / 测试@test.com / 123-456-7890');
      const result = await service.extractContacts(buffer, 'text/plain', 'unicode.txt');

      expect(result).toBeDefined();
    });
  });

  describe('Performance Benchmarks', () => {
    test('should process typical call sheet in reasonable time', async () => {
      const callSheet = `CREW
Photographer: John Smith / 555-123-4567
Director: Jane Doe / jane@test.com / 555-234-5678
Producer: Mike Johnson / mike@test.com / 555-345-6789
Camera: Sarah Wilson / sarah@test.com / 555-456-7890
Sound: Tom Davis / tom@test.com / 555-567-8901
Gaffer: Emma Brown / emma@test.com / 555-678-9012
Grip: Lisa Garcia / lisa@test.com / 555-789-0123
Makeup: Bob Martinez / bob@test.com / 555-890-1234
Hair: Anna Johnson / anna@test.com / 555-901-2345
Wardrobe: Chris Lee / chris@test.com / 555-012-3456`;

      const buffer = Buffer.from(callSheet);
      
      const start = Date.now();
      const result = await service.extractContacts(buffer, 'text/plain', 'benchmark.txt');
      const duration = Date.now() - start;

      expect(result.success).toBe(true);
      expect(result.contacts.length).toBeGreaterThanOrEqual(10);
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });

    test('should handle concurrent extractions', async () => {
      const callSheet = `Photographer: John Smith / 555-123-4567
Director: Jane Doe / 555-234-5678`;
      const buffer = Buffer.from(callSheet);

      // Run 5 extractions concurrently
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(service.extractContacts(buffer, 'text/plain', `concurrent${i}.txt`));
      }

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.contacts.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Statistics Tracking', () => {
    test('should track extraction statistics', async () => {
      const callSheet = `Photographer: John Smith / 555-123-4567`;
      const buffer = Buffer.from(callSheet);

      const statsBefore = service.getStats();
      await service.extractContacts(buffer, 'text/plain', 'stats.txt');
      const statsAfter = service.getStats();

      expect(statsAfter.totalExtractions).toBe(statsBefore.totalExtractions + 1);
      expect(statsAfter.successfulExtractions).toBeGreaterThan(statsBefore.successfulExtractions);
    });

    test('should calculate success rate', async () => {
      const callSheet = `Photographer: John Smith / 555-123-4567`;
      const buffer = Buffer.from(callSheet);

      await service.extractContacts(buffer, 'text/plain', 'rate1.txt');
      await service.extractContacts(buffer, 'text/plain', 'rate2.txt');

      const stats = service.getStats();
      expect(stats.successRate).toBeGreaterThan(0);
      expect(stats.successRate).toBeLessThanOrEqual(100);
    });
  });

  describe('Real-World Scenarios', () => {
    test('should handle your original failing call sheet', async () => {
      const callSheet = `Call Sheet: SS26 Editorial 9.19
Date: 09.19.2025

Crew
Photographer: Coni Tarallo / 929.250.6798
1st Photo Assistant: Asa Lory / 573.823.9705
2nd Photo Assistant: Kevin Mathien/ 312.519.0901
Digitech: William Manchuck / 860.888.2173

Model: BIANCA FELICIANO / Ford Brett Pougnet / 917.783.8966
Model: TEHYA / JAG - Adam Hughes / 917-539-9577

MUA: Yuko Kawashima / 646.578.2704
HUA: Juli Akaneya / 201.647.7724
HMUA: Mariolga Pantazopoulos / 617.590.9160
Stylist: Francesca Tonelli / 774.571.9338
Stylist: Danielle Dinten / 347.420.8522

Driver: Mahmoud Ebid / 646.575.0323`;

      const buffer = Buffer.from(callSheet);
      const result = await service.extractContacts(buffer, 'text/plain', 'original.txt');

      expect(result.success).toBe(true);
      expect(result.contacts.length).toBeGreaterThanOrEqual(12);
      
      // Verify no "Unknown" names
      result.contacts.forEach(contact => {
        expect(contact.name).not.toBe('Unknown');
        expect(contact.name.length).toBeGreaterThan(1);
      });
      
      // Verify ALL CAPS normalization
      const bianca = result.contacts.find(c => c.name?.includes('Bianca'));
      expect(bianca).toBeDefined();
      expect(bianca.name).toBe('Bianca Feliciano');
    });

    test('should extract from dense multi-section call sheet', async () => {
      const callSheet = `PRODUCTION CALL SHEET
Project: CPD LOP FERIA/COLORSONIC/PREFERENCE PHOTO + VIDEO
Date: Tuesday, August 19th, 2025
Location: L'Oreal Studios, Jersey City, NJ

=== PRODUCTION ===
Executive Producer: Sarah Carey / sarahcarey@primecontent.com / (845) 926-7006
Producer: Lisa Johnson / lisa@production.com / (212) 555-0100
Line Producer: Mike Anderson / mike@production.com / (212) 555-0101

=== CAMERA ===
Director of Photography: James Wilson / james@camera.com / (212) 555-0102
1st AC: Emma Davis / emma@camera.com / (212) 555-0103
2nd AC: Tom Martinez / tom@camera.com / (212) 555-0104

=== LIGHTING ===
Gaffer: Sarah Lee / sarah@lighting.com / (212) 555-0105
Best Boy Electric: Chris Kim / chris@lighting.com / (212) 555-0106

=== TALENT ===
Model: SOPHIA RODRIGUEZ / IMG / Maria Santos / (212) 555-0107
Model: EMMA WILSON / Next / Taylor Brown / (212) 555-0108
Model: LUCAS MARTINEZ / Supreme / Jordan Lee / (212) 555-0109

=== HAIR & MAKEUP ===
Key Makeup Artist: Anna Chen / anna@beauty.com / (212) 555-0110
Makeup Assistant: Rachel Park / rachel@beauty.com / (212) 555-0111
Key Hair Stylist: David Johnson / david@hair.com / (212) 555-0112
Hair Assistant: Jessica Lee / jessica@hair.com / (212) 555-0113

=== WARDROBE ===
Stylist: Michael Kim / michael@style.com / (212) 555-0114
Stylist Assistant: Lisa Chen / lisa@style.com / (212) 555-0115
Wardrobe Supervisor: Tom Anderson / tom@wardrobe.com / (212) 555-0116

Contact for issues: production@loreal.com`;

      const buffer = Buffer.from(callSheet);
      const result = await service.extractContacts(buffer, 'text/plain', 'dense.txt');

      expect(result.success).toBe(true);
      expect(result.contacts.length).toBeGreaterThanOrEqual(16);
      
      // Verify different departments
      const producer = result.contacts.find(c => c.role?.includes('Producer'));
      expect(producer).toBeDefined();
      
      const dop = result.contacts.find(c => c.role?.includes('Photography'));
      expect(dop).toBeDefined();
      
      const model = result.contacts.find(c => c.role?.includes('Model'));
      expect(model).toBeDefined();
      
      const makeup = result.contacts.find(c => c.role?.includes('Makeup'));
      expect(makeup).toBeDefined();
    });
  });
});

