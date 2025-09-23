/**
 * Pattern-Based Contact Extraction Engine
 * 
 * Advanced regex patterns and context-aware extraction
 */

class PatternExtractor {
  constructor() {
    this.patterns = this.initializePatterns();
    this.contextRules = this.initializeContextRules();
  }

  initializePatterns() {
    return {
      email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      phone: /(\+?[\d\s\-\(\)]{10,})/g,
      name: /\b[A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b/g,
      company: /(?:at|from|@)\s+([A-Za-z\s&]+)/gi,
      role: /\b(Director|Producer|Manager|Coordinator|Assistant|Editor|Cinematographer|Sound|Lighting|Grip|Electric|Camera|Audio|Wardrobe|Makeup|Hair|Transportation|Catering|Writer|Actor|Actress|Talent|Crew|Staff|Team|Personnel)\b/gi
    };
  }

  initializeContextRules() {
    return {
      proximityThreshold: 50, // characters
      nameEmailDistance: 30,
      roleNameDistance: 20
    };
  }

  async extractContacts(text, documentAnalysis) {
    console.log('🔍 Starting pattern-based extraction...');
    
    const contacts = [];
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineContacts = this.extractContactsFromLine(line, i, lines, documentAnalysis);
      contacts.push(...lineContacts);
    }
    
    // Post-process contacts for better accuracy
    const processedContacts = this.postProcessContacts(contacts, documentAnalysis);
    
    console.log(`📊 Pattern extraction found ${processedContacts.length} contacts`);
    return processedContacts;
  }

  extractContactsFromLine(line, lineIndex, allLines, documentAnalysis) {
    const contacts = [];
    
    // Find all emails in this line
    const emailMatches = [...line.matchAll(this.patterns.email)];
    
    for (const emailMatch of emailMatches) {
      const email = emailMatch[0];
      const contact = this.buildContactFromEmail(email, line, lineIndex, allLines, documentAnalysis);
      if (contact) {
        contacts.push(contact);
      }
    }
    
    // If no emails found, look for phone numbers
    if (contacts.length === 0) {
      const phoneMatches = [...line.matchAll(this.patterns.phone)];
      for (const phoneMatch of phoneMatches) {
        const phone = phoneMatch[0];
        const contact = this.buildContactFromPhone(phone, line, lineIndex, allLines, documentAnalysis);
        if (contact) {
          contacts.push(contact);
        }
      }
    }
    
    return contacts;
  }

  buildContactFromEmail(email, line, lineIndex, allLines, documentAnalysis) {
    const contact = {
      email: email,
      name: this.extractNameNearEmail(email, line, allLines, lineIndex),
      phone: this.extractPhoneNearEmail(email, line, allLines, lineIndex),
      role: this.extractRoleNearEmail(email, line, allLines, lineIndex),
      company: this.extractCompanyNearEmail(email, line, allLines, lineIndex),
      department: this.extractDepartmentNearEmail(email, line, allLines, lineIndex),
      notes: line.trim(),
      confidence: 0.8
    };
    
    // Validate contact
    if (contact.name && contact.name.length > 2) {
      return contact;
    }
    
    return null;
  }

  buildContactFromPhone(phone, line, lineIndex, allLines, documentAnalysis) {
    const contact = {
      phone: phone,
      name: this.extractNameNearPhone(phone, line, allLines, lineIndex),
      email: this.extractEmailNearPhone(phone, line, allLines, lineIndex),
      role: this.extractRoleNearPhone(phone, line, allLines, lineIndex),
      company: this.extractCompanyNearPhone(phone, line, allLines, lineIndex),
      department: this.extractDepartmentNearPhone(phone, line, allLines, lineIndex),
      notes: line.trim(),
      confidence: 0.6
    };
    
    // Validate contact
    if (contact.name && contact.name.length > 2) {
      return contact;
    }
    
    return null;
  }

  extractNameNearEmail(email, line, allLines, lineIndex) {
    // Look for names in the same line
    const nameMatches = [...line.matchAll(this.patterns.name)];
    for (const match of nameMatches) {
      const name = match[0];
      if (this.isValidName(name)) {
        return name;
      }
    }
    
    // Look in nearby lines
    for (let i = Math.max(0, lineIndex - 2); i <= Math.min(allLines.length - 1, lineIndex + 2); i++) {
      if (i === lineIndex) continue;
      
      const nearbyLine = allLines[i];
      const nameMatches = [...nearbyLine.matchAll(this.patterns.name)];
      for (const match of nameMatches) {
        const name = match[0];
        if (this.isValidName(name)) {
          return name;
        }
      }
    }
    
    return 'Unknown';
  }

  extractPhoneNearEmail(email, line, allLines, lineIndex) {
    const phoneMatches = [...line.matchAll(this.patterns.phone)];
    if (phoneMatches.length > 0) {
      return phoneMatches[0][0];
    }
    
    // Look in nearby lines
    for (let i = Math.max(0, lineIndex - 1); i <= Math.min(allLines.length - 1, lineIndex + 1); i++) {
      if (i === lineIndex) continue;
      
      const nearbyLine = allLines[i];
      const phoneMatches = [...nearbyLine.matchAll(this.patterns.phone)];
      if (phoneMatches.length > 0) {
        return phoneMatches[0][0];
      }
    }
    
    return '';
  }

  extractRoleNearEmail(email, line, allLines, lineIndex) {
    const roleMatches = [...line.matchAll(this.patterns.role)];
    if (roleMatches.length > 0) {
      return roleMatches[0][0];
    }
    
    // Look in nearby lines
    for (let i = Math.max(0, lineIndex - 1); i <= Math.min(allLines.length - 1, lineIndex + 1); i++) {
      if (i === lineIndex) continue;
      
      const nearbyLine = allLines[i];
      const roleMatches = [...nearbyLine.matchAll(this.patterns.role)];
      if (roleMatches.length > 0) {
        return roleMatches[0][0];
      }
    }
    
    return 'Contact';
  }

  extractCompanyNearEmail(email, line, allLines, lineIndex) {
    const companyMatches = [...line.matchAll(this.patterns.company)];
    if (companyMatches.length > 0) {
      return companyMatches[0][1];
    }
    
    return '';
  }

  extractDepartmentNearEmail(email, line, allLines, lineIndex) {
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

  extractNameNearPhone(phone, line, allLines, lineIndex) {
    return this.extractNameNearEmail('', line, allLines, lineIndex);
  }

  extractEmailNearPhone(phone, line, allLines, lineIndex) {
    const emailMatches = [...line.matchAll(this.patterns.email)];
    if (emailMatches.length > 0) {
      return emailMatches[0][0];
    }
    
    return '';
  }

  extractRoleNearPhone(phone, line, allLines, lineIndex) {
    return this.extractRoleNearEmail('', line, allLines, lineIndex);
  }

  extractCompanyNearPhone(phone, line, allLines, lineIndex) {
    return this.extractCompanyNearEmail('', line, allLines, lineIndex);
  }

  extractDepartmentNearPhone(phone, line, allLines, lineIndex) {
    return this.extractDepartmentNearEmail('', line, allLines, lineIndex);
  }

  isValidName(name) {
    if (!name || name.length < 3) return false;
    
    // Check if it's not a common word
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'production', 'company', 'inc', 'llc', 'corp'];
    if (commonWords.includes(name.toLowerCase())) return false;
    
    // Check if it has proper capitalization
    const words = name.split(' ');
    return words.every(word => word[0] === word[0].toUpperCase() && word.length > 1);
  }

  postProcessContacts(contacts, documentAnalysis) {
    // Remove duplicates
    const uniqueContacts = this.removeDuplicates(contacts);
    
    // Enhance with document context
    const enhancedContacts = this.enhanceWithContext(uniqueContacts, documentAnalysis);
    
    // Calculate final confidence scores
    const scoredContacts = this.calculateFinalScores(enhancedContacts, documentAnalysis);
    
    return scoredContacts;
  }

  removeDuplicates(contacts) {
    const unique = [];
    const seen = new Set();
    
    for (const contact of contacts) {
      const key = `${contact.email || ''}-${contact.name || ''}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(contact);
      }
    }
    
    return unique;
  }

  enhanceWithContext(contacts, documentAnalysis) {
    return contacts.map(contact => {
      // Enhance role based on document type
      if (documentAnalysis.type === 'call_sheet' && contact.role === 'Contact') {
        contact.role = 'Crew Member';
      }
      
      // Enhance department based on production type
      if (documentAnalysis.productionType === 'film' && !contact.department) {
        contact.department = 'Production';
      }
      
      return contact;
    });
  }

  calculateFinalScores(contacts, documentAnalysis) {
    return contacts.map(contact => {
      let score = 0.5; // Base score
      
      if (contact.email) score += 0.3;
      if (contact.name && contact.name !== 'Unknown') score += 0.2;
      if (contact.phone) score += 0.1;
      if (contact.role && contact.role !== 'Contact') score += 0.1;
      if (contact.company) score += 0.1;
      
      contact.confidence = Math.min(score, 1.0);
      return contact;
    });
  }
}

module.exports = PatternExtractor;
