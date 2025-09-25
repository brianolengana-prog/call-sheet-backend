/**
 * Enhanced Call Sheet Extractor
 * 
 * Specialized extractor for diverse call sheet structures
 * Handles various formats, layouts, and production types
 */

class EnhancedCallSheetExtractor {
  constructor() {
    this.patterns = this.initializeCallSheetPatterns();
    this.structureDetectors = this.initializeStructureDetectors();
    this.roleMappings = this.initializeRoleMappings();
  }

  /**
   * Initialize call sheet specific patterns
   */
  initializeCallSheetPatterns() {
    return {
      // Section headers that indicate crew/cast sections
      sectionHeaders: [
        'TALENT NAME', 'CONTACT', 'CELL', 'TRANSPORTATION', 'CALL', 'LOCATION',
        'NAME CONTACT', 'VIDEO NAME', 'GLAM NAME', 'SET DESIGN NAME', 'WARDROBE NAME',
        'HEARST NAME', 'AMAZON NAME', 'OMNICOM NAME', 'PRODUCTION TEAM', 'CREW',
        'CAST', 'TALENT', 'STAFF', 'PERSONNEL', 'TEAM MEMBERS', 'CONTACT LIST'
      ],
      
      // Role patterns specific to call sheets
      roles: {
        aboveTheLine: [
          'Director', 'Producer', 'Executive Producer', 'Line Producer', 'Associate Producer',
          'Showrunner', 'Creator', 'Writer', 'Show Creator'
        ],
        camera: [
          'Director of Photography', 'DP', 'Cinematographer', 'Camera Operator', 'First AC', 'Second AC',
          'Camera Assistant', 'Steadicam Operator', 'Drone Operator'
        ],
        sound: [
          'Sound Mixer', 'Boom Operator', 'Sound Designer', 'Composer', 'Music Supervisor',
          'Audio Tech', 'Sound Engineer', 'Audio Engineer'
        ],
        lighting: [
          'Gaffer', 'Best Boy Electric', 'Electrician', 'Lighting Designer', 'Key Grip', 'Grip',
          'BBE', 'BBG', 'Swing Electric', 'Swing Grip'
        ],
        art: [
          'Production Designer', 'Art Director', 'Set Decorator', 'Props Master', 'Costume Designer',
          'Set Designer', 'Set Design Assistant', 'Wardrobe', 'Stylist'
        ],
        production: [
          'First AD', 'Second AD', 'Script Supervisor', 'Continuity', 'Production Coordinator',
          'Production Manager', 'Unit Production Manager', 'Location Manager'
        ],
        post: [
          'Editor', 'Assistant Editor', 'Post Production Supervisor', 'Colorist', 'Sound Editor',
          'Visual Effects Supervisor', 'VFX Supervisor'
        ],
        glamour: [
          'HMU', 'Hair', 'Makeup', 'Makeup Artist', 'Hair Stylist', 'Wardrobe Stylist',
          'Costume Designer', 'Assistant'
        ],
        logistics: [
          'Transportation Coordinator', 'Catering', 'Craft Services', 'Security', 'PA',
          'Production Assistant', 'Runner'
        ]
      },
      
      // Company patterns
      companies: [
        'Hearst', 'Amazon', 'Omnicom', 'Cosmopolitan', 'Studios', 'Productions',
        'Entertainment', 'Media', 'Films', 'Pictures', 'Agency', 'Group'
      ],
      
      // Contact patterns
      contactPatterns: {
        email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        phone: /(\+?[\d\s\-\(\)]{10,})/g,
        name: /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3}\b/g
      }
    };
  }

  /**
   * Initialize structure detectors for different call sheet formats
   */
  initializeStructureDetectors() {
    return {
      // Standard call sheet format
      standard: {
        indicators: ['TALENT NAME', 'CONTACT', 'CELL', 'TRANSPORTATION'],
        confidence: 0.9,
        extractor: 'standardCallSheet'
      },
      
      // Table format
      table: {
        indicators: ['|', '\t', 'Name', 'Email', 'Phone', 'Role'],
        confidence: 0.8,
        extractor: 'tableFormat'
      },
      
      // List format
      list: {
        indicators: ['•', '-', '1.', '2.', 'Name:', 'Email:', 'Phone:'],
        confidence: 0.7,
        extractor: 'listFormat'
      },
      
      // Section-based format
      sections: {
        indicators: ['CREW', 'CAST', 'PRODUCTION TEAM', 'STAFF'],
        confidence: 0.8,
        extractor: 'sectionBased'
      }
    };
  }

  /**
   * Initialize role mappings for better categorization
   */
  initializeRoleMappings() {
    return {
      'Director': 'Above the Line',
      'Producer': 'Above the Line',
      'Cinematographer': 'Camera',
      'DP': 'Camera',
      'Director of Photography': 'Camera',
      'First AC': 'Camera',
      'Second AC': 'Camera',
      'Sound Mixer': 'Sound',
      'Boom Operator': 'Sound',
      'Audio Tech': 'Sound',
      'Gaffer': 'Lighting',
      'Key Grip': 'Lighting',
      'BBE': 'Lighting',
      'BBG': 'Lighting',
      'HMU': 'Glamour',
      'Hair': 'Glamour',
      'Makeup': 'Glamour',
      'Set Designer': 'Art',
      'Art Director': 'Art',
      'Wardrobe': 'Art',
      'Stylist': 'Art',
      'First AD': 'Production',
      'Second AD': 'Production',
      'Production Coordinator': 'Production',
      'Editor': 'Post',
      'Colorist': 'Post',
      'Transportation': 'Logistics',
      'Catering': 'Logistics',
      'PA': 'Logistics',
      'Production Assistant': 'Logistics'
    };
  }

  /**
   * Main extraction method for call sheets
   */
  async extractCallSheetContacts(text, documentAnalysis) {
    console.log('🎬 Starting enhanced call sheet extraction...');
    
    try {
      // Step 1: Detect call sheet structure
      const structure = this.detectCallSheetStructure(text);
      console.log('📋 Detected structure:', structure);
      
      // Step 2: Extract contacts based on structure
      const contacts = await this.extractContactsByStructure(text, structure, documentAnalysis);
      console.log('👥 Extracted contacts:', contacts.length);
      
      // Step 3: Enhance contacts with role categorization
      const enhancedContacts = this.enhanceContactsWithRoles(contacts);
      console.log('✨ Enhanced contacts:', enhancedContacts.length);
      
      // Step 4: Apply call sheet specific validation
      const validatedContacts = this.validateCallSheetContacts(enhancedContacts);
      console.log('✅ Validated contacts:', validatedContacts.length);
      
      return validatedContacts;
      
    } catch (error) {
      console.error('❌ Call sheet extraction failed:', error);
      return [];
    }
  }

  /**
   * Detect call sheet structure
   */
  detectCallSheetStructure(text) {
    const textLower = text.toLowerCase();
    let bestMatch = null;
    let highestConfidence = 0;
    
    for (const [structureName, detector] of Object.entries(this.structureDetectors)) {
      const matches = detector.indicators.filter(indicator => 
        textLower.includes(indicator.toLowerCase())
      );
      
      const confidence = matches.length / detector.indicators.length;
      
      if (confidence > highestConfidence) {
        highestConfidence = confidence;
        bestMatch = {
          name: structureName,
          confidence,
          extractor: detector.extractor,
          matches
        };
      }
    }
    
    return bestMatch || {
      name: 'unknown',
      confidence: 0,
      extractor: 'generic',
      matches: []
    };
  }

  /**
   * Extract contacts based on detected structure
   */
  async extractContactsByStructure(text, structure, documentAnalysis) {
    switch (structure.extractor) {
      case 'standardCallSheet':
        return this.extractStandardCallSheet(text);
      case 'tableFormat':
        return this.extractTableFormat(text);
      case 'listFormat':
        return this.extractListFormat(text);
      case 'sectionBased':
        return this.extractSectionBased(text);
      default:
        return this.extractGenericFormat(text);
    }
  }

  /**
   * Extract from standard call sheet format
   */
  extractStandardCallSheet(text) {
    const contacts = [];
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length === 0) continue;
      
      // Look for email patterns
      const emailMatches = [...line.matchAll(this.patterns.contactPatterns.email)];
      
      for (const emailMatch of emailMatches) {
        const email = emailMatch[0];
        const contact = this.buildContactFromLine(line, email, i, lines);
        if (contact) {
          contacts.push(contact);
        }
      }
    }
    
    return contacts;
  }

  /**
   * Extract from table format
   */
  extractTableFormat(text) {
    const contacts = [];
    const lines = text.split('\n');
    
    // Find header row
    let headerRow = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('name') && (line.includes('email') || line.includes('contact'))) {
        headerRow = i;
        break;
      }
    }
    
    if (headerRow === -1) {
      return this.extractGenericFormat(text);
    }
    
    // Extract data rows
    for (let i = headerRow + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length === 0) continue;
      
      const parts = line.split(/\s+/);
      if (parts.length < 2) continue;
      
      const contact = this.buildContactFromTableRow(parts, line);
      if (contact) {
        contacts.push(contact);
      }
    }
    
    return contacts;
  }

  /**
   * Extract from list format
   */
  extractListFormat(text) {
    const contacts = [];
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length === 0) continue;
      
      // Look for list indicators
      if (line.match(/^[•\-\*]\s/) || line.match(/^\d+\.\s/)) {
        const contact = this.buildContactFromListItem(line, i, lines);
        if (contact) {
          contacts.push(contact);
        }
      }
    }
    
    return contacts;
  }

  /**
   * Extract from section-based format
   */
  extractSectionBased(text) {
    const contacts = [];
    const sections = this.identifySections(text);
    
    for (const section of sections) {
      const sectionContacts = this.extractContactsFromSection(section);
      contacts.push(...sectionContacts);
    }
    
    return contacts;
  }

  /**
   * Extract from generic format
   */
  extractGenericFormat(text) {
    const contacts = [];
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length === 0) continue;
      
      // Look for any email pattern
      const emailMatches = [...line.matchAll(this.patterns.contactPatterns.email)];
      
      for (const emailMatch of emailMatches) {
        const email = emailMatch[0];
        const contact = this.buildContactFromLine(line, email, i, lines);
        if (contact) {
          contacts.push(contact);
        }
      }
    }
    
    return contacts;
  }

  /**
   * Build contact from line with email
   */
  buildContactFromLine(line, email, lineIndex, allLines) {
    const contact = {
      email: email,
      name: this.extractNameFromLine(line, email),
      phone: this.extractPhoneFromLine(line),
      role: this.extractRoleFromLine(line, allLines, lineIndex),
      company: this.extractCompanyFromLine(line),
      department: this.extractDepartmentFromLine(line, allLines, lineIndex),
      notes: line.trim(),
      confidence: 0.8,
      source: {
        lineNumber: lineIndex,
        lineText: line,
        type: 'call_sheet'
      }
    };
    
    return contact;
  }

  /**
   * Extract name from line
   */
  extractNameFromLine(line, email) {
    const emailIndex = line.indexOf(email);
    if (emailIndex > 0) {
      const beforeEmail = line.substring(0, emailIndex).trim();
      const nameMatches = [...beforeEmail.matchAll(this.patterns.contactPatterns.name)];
      
      if (nameMatches.length > 0) {
        return nameMatches[0][0];
      }
      
      // Try to extract from words before email
      const words = beforeEmail.split(/\s+/).filter(word => word.length > 1);
      if (words.length >= 2) {
        return words.slice(-2).join(' ');
      }
    }
    
    return 'Unknown';
  }

  /**
   * Extract phone from line
   */
  extractPhoneFromLine(line) {
    const phoneMatches = [...line.matchAll(this.patterns.contactPatterns.phone)];
    return phoneMatches.length > 0 ? phoneMatches[0][0] : '';
  }

  /**
   * Extract role from line
   */
  extractRoleFromLine(line, allLines, lineIndex) {
    // Look for role in current line
    for (const [role, category] of Object.entries(this.roleMappings)) {
      if (line.toLowerCase().includes(role.toLowerCase())) {
        return role;
      }
    }
    
    // Look for role in nearby lines
    for (let i = Math.max(0, lineIndex - 2); i <= Math.min(allLines.length - 1, lineIndex + 2); i++) {
      if (i === lineIndex) continue;
      
      const nearbyLine = allLines[i];
      for (const [role, category] of Object.entries(this.roleMappings)) {
        if (nearbyLine.toLowerCase().includes(role.toLowerCase())) {
          return role;
        }
      }
    }
    
    // Look for section headers that might indicate role
    for (let i = Math.max(0, lineIndex - 3); i <= Math.min(allLines.length - 1, lineIndex + 3); i++) {
      const checkLine = allLines[i];
      
      if (checkLine.includes('VIDEO NAME')) return 'Video Crew';
      if (checkLine.includes('GLAM NAME')) return 'Glamour';
      if (checkLine.includes('SET DESIGN NAME')) return 'Set Design';
      if (checkLine.includes('WARDROBE NAME')) return 'Wardrobe';
      if (checkLine.includes('HEARST NAME')) return 'Hearst Staff';
      if (checkLine.includes('AMAZON NAME')) return 'Amazon Staff';
      if (checkLine.includes('TALENT NAME')) return 'Talent';
    }
    
    return 'Crew Member';
  }

  /**
   * Extract company from line
   */
  extractCompanyFromLine(line) {
    for (const company of this.patterns.companies) {
      if (line.toLowerCase().includes(company.toLowerCase())) {
        return company;
      }
    }
    
    return '';
  }

  /**
   * Extract department from line
   */
  extractDepartmentFromLine(line, allLines, lineIndex) {
    // Look for department keywords
    const departmentKeywords = ['Production', 'Creative', 'Technical', 'Administrative', 'Finance', 'Marketing'];
    const lowerLine = line.toLowerCase();
    
    for (const dept of departmentKeywords) {
      if (lowerLine.includes(dept.toLowerCase())) {
        return dept;
      }
    }
    
    return 'Unknown';
  }

  /**
   * Build contact from table row
   */
  buildContactFromTableRow(parts, line) {
    const contact = {
      name: parts[0] || 'Unknown',
      email: '',
      phone: '',
      role: 'Crew Member',
      company: '',
      department: 'Unknown',
      notes: line.trim(),
      confidence: 0.7,
      source: {
        lineText: line,
        type: 'table_format'
      }
    };
    
    // Find email in parts
    for (const part of parts) {
      if (part.includes('@')) {
        contact.email = part;
        break;
      }
    }
    
    // Find phone in parts
    for (const part of parts) {
      if (part.match(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/)) {
        contact.phone = part;
        break;
      }
    }
    
    return contact;
  }

  /**
   * Build contact from list item
   */
  buildContactFromListItem(line, lineIndex, allLines) {
    const contact = {
      name: 'Unknown',
      email: '',
      phone: '',
      role: 'Crew Member',
      company: '',
      department: 'Unknown',
      notes: line.trim(),
      confidence: 0.6,
      source: {
        lineNumber: lineIndex,
        lineText: line,
        type: 'list_format'
      }
    };
    
    // Extract email
    const emailMatches = [...line.matchAll(this.patterns.contactPatterns.email)];
    if (emailMatches.length > 0) {
      contact.email = emailMatches[0][0];
    }
    
    // Extract phone
    const phoneMatches = [...line.matchAll(this.patterns.contactPatterns.phone)];
    if (phoneMatches.length > 0) {
      contact.phone = phoneMatches[0][0];
    }
    
    // Extract name
    const nameMatches = [...line.matchAll(this.patterns.contactPatterns.name)];
    if (nameMatches.length > 0) {
      contact.name = nameMatches[0][0];
    }
    
    return contact;
  }

  /**
   * Identify sections in text
   */
  identifySections(text) {
    const sections = [];
    const lines = text.split('\n');
    let currentSection = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this line is a section header
      const isHeader = this.patterns.sectionHeaders.some(header => 
        line.toUpperCase().includes(header)
      );
      
      if (isHeader) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          header: line,
          startLine: i,
          lines: []
        };
      } else if (currentSection) {
        currentSection.lines.push(line);
      }
    }
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections;
  }

  /**
   * Extract contacts from section
   */
  extractContactsFromSection(section) {
    const contacts = [];
    
    for (const line of section.lines) {
      if (line.length === 0) continue;
      
      const emailMatches = [...line.matchAll(this.patterns.contactPatterns.email)];
      
      for (const emailMatch of emailMatches) {
        const email = emailMatch[0];
        const contact = this.buildContactFromLine(line, email, 0, section.lines);
        if (contact) {
          contact.department = this.inferDepartmentFromSection(section.header);
          contacts.push(contact);
        }
      }
    }
    
    return contacts;
  }

  /**
   * Infer department from section header
   */
  inferDepartmentFromSection(header) {
    const headerLower = header.toLowerCase();
    
    if (headerLower.includes('video')) return 'Video';
    if (headerLower.includes('glam')) return 'Glamour';
    if (headerLower.includes('set design')) return 'Set Design';
    if (headerLower.includes('wardrobe')) return 'Wardrobe';
    if (headerLower.includes('hearst')) return 'Hearst';
    if (headerLower.includes('amazon')) return 'Amazon';
    if (headerLower.includes('talent')) return 'Talent';
    
    return 'Production';
  }

  /**
   * Enhance contacts with role categorization
   */
  enhanceContactsWithRoles(contacts) {
    return contacts.map(contact => {
      const role = contact.role;
      const category = this.roleMappings[role] || 'Unknown';
      
      return {
        ...contact,
        roleCategory: category,
        isKeyRole: this.isKeyRole(role),
        priority: this.getRolePriority(role)
      };
    });
  }

  /**
   * Check if role is key role
   */
  isKeyRole(role) {
    const keyRoles = [
      'Director', 'Producer', 'Cinematographer', 'Editor', 'Sound Mixer',
      'First AD', 'Production Coordinator'
    ];
    
    return keyRoles.some(keyRole => 
      role.toLowerCase().includes(keyRole.toLowerCase())
    );
  }

  /**
   * Get role priority
   */
  getRolePriority(role) {
    const priorities = {
      'Director': 1,
      'Producer': 1,
      'Cinematographer': 2,
      'First AD': 2,
      'Editor': 2,
      'Sound Mixer': 3,
      'Gaffer': 3,
      'Key Grip': 3,
      'Production Coordinator': 3
    };
    
    return priorities[role] || 4;
  }

  /**
   * Validate call sheet contacts
   */
  validateCallSheetContacts(contacts) {
    return contacts.filter(contact => {
      // Must have at least name or email
      if (!contact.name || contact.name === 'Unknown') {
        if (!contact.email) return false;
      }
      
      // Email must be valid if present
      if (contact.email && !this.isValidEmail(contact.email)) {
        return false;
      }
      
      // Name must be valid if present
      if (contact.name && contact.name.length < 2) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }
}

module.exports = EnhancedCallSheetExtractor;
