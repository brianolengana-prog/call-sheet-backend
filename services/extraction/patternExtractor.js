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
      // Improved name pattern - more specific for call sheets
      name: /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2}(?:\s[A-Z][a-z]+)?\b/g,
      company: /(?:at|from|@)\s+([A-Za-z\s&]+)/gi,
      // Enhanced role patterns for call sheets
      role: /\b(Director|Producer|Manager|Coordinator|Assistant|Editor|Cinematographer|Sound|Lighting|Grip|Electric|Camera|Audio|Wardrobe|Makeup|Hair|Transportation|Catering|Writer|Actor|Actress|Talent|Crew|Staff|Team|Personnel|HMU|1st AC|2nd AC|BBE|BBG|Key Grip|Swing|Stylist|Set Designer|Art Director|Head Of Creative|Program Manager|Sales|Talent|Amazon|Cosmopolitan|Hearst|Omnicom)\b/gi,
      // Call sheet specific patterns
      callSheetRole: /\b(Editor in Chief|Head Of Creative|Director|Art Director|Producer|Coordinator|Program Manager|Sales|Talent|HMU|Assistant|Set Designer|Stylist|Director of Photography|1st AC|2nd AC|Gaffer|BBE|Swing: Electric|Key Grip|BBG|Swing: Grip|Audio Tech)\b/gi
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
    console.log('📄 Text being processed (first 200 chars):', text.substring(0, 200));
    
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
    
    // Enhanced extraction for structured call sheets
    if (this.isStructuredCallSheetLine(line)) {
      const structuredContacts = this.extractFromStructuredLine(line, lineIndex, allLines, documentAnalysis);
      contacts.push(...structuredContacts);
    }
    
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
    // For call sheets, try to extract name from the line structure
    if (this.isCallSheetFormat(line, allLines, lineIndex)) {
      const callSheetName = this.extractCallSheetName(email, line, allLines, lineIndex);
      if (callSheetName && this.isValidName(callSheetName)) {
        return callSheetName;
      }
    }
    
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
    // First try call sheet specific roles
    const callSheetRoleMatches = [...line.matchAll(this.patterns.callSheetRole)];
    if (callSheetRoleMatches.length > 0) {
      return callSheetRoleMatches[0][0];
    }
    
    // Then try general roles
    const roleMatches = [...line.matchAll(this.patterns.role)];
    if (roleMatches.length > 0) {
      return roleMatches[0][0];
    }
    
    // Look in nearby lines for call sheet roles
    for (let i = Math.max(0, lineIndex - 1); i <= Math.min(allLines.length - 1, lineIndex + 1); i++) {
      if (i === lineIndex) continue;
      
      const nearbyLine = allLines[i];
      const callSheetRoleMatches = [...nearbyLine.matchAll(this.patterns.callSheetRole)];
      if (callSheetRoleMatches.length > 0) {
        return callSheetRoleMatches[0][0];
      }
      
      const roleMatches = [...nearbyLine.matchAll(this.patterns.role)];
      if (roleMatches.length > 0) {
        return roleMatches[0][0];
      }
    }
    
    // For call sheets, try to infer role from context
    if (this.isCallSheetFormat(line, allLines, lineIndex)) {
      return this.inferCallSheetRole(email, line, allLines, lineIndex);
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
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'production', 'company', 'inc', 'llc', 'corp', 'self', 'transportation', 'amazon', 'cosmopolitan', 'hearst', 'omnicom'];
    if (commonWords.includes(name.toLowerCase())) return false;
    
    // Check if it has proper capitalization
    const words = name.split(' ');
    return words.every(word => word[0] === word[0].toUpperCase() && word.length > 1);
  }

  isCallSheetFormat(line, allLines, lineIndex) {
    // Check if this looks like a call sheet format
    const callSheetIndicators = [
      'TALENT NAME', 'CONTACT', 'CELL', 'TRANSPORTATION', 'CALL', 'LOCATION',
      'NAME CONTACT', 'VIDEO NAME', 'GLAM NAME', 'SET DESIGN NAME', 'WARDROBE NAME'
    ];
    
    // Check current line and nearby lines for call sheet indicators
    for (let i = Math.max(0, lineIndex - 1); i <= Math.min(allLines.length - 1, lineIndex + 1); i++) {
      const checkLine = allLines[i];
      for (const indicator of callSheetIndicators) {
        if (checkLine.includes(indicator)) {
          return true;
        }
      }
    }
    
    return false;
  }

  extractCallSheetName(email, line, allLines, lineIndex) {
    // For call sheets, the name is usually before the email
    // Look for pattern: "Name Name email@domain.com"
    const emailIndex = line.indexOf(email);
    if (emailIndex > 0) {
      const beforeEmail = line.substring(0, emailIndex).trim();
      
      // Try to extract name from the part before email
      const nameMatches = [...beforeEmail.matchAll(this.patterns.name)];
      for (const match of nameMatches) {
        const name = match[0];
        if (this.isValidName(name)) {
          return name;
        }
      }
      
      // If no clear name pattern, try to extract from words before email
      const words = beforeEmail.split(/\s+/).filter(word => word.length > 1);
      if (words.length >= 2) {
        // Take the last 2-3 words as potential name
        const potentialName = words.slice(-2).join(' ');
        if (this.isValidName(potentialName)) {
          return potentialName;
        }
        
        // Try 3 words if 2 doesn't work
        if (words.length >= 3) {
          const potentialName3 = words.slice(-3).join(' ');
          if (this.isValidName(potentialName3)) {
            return potentialName3;
          }
        }
      }
    }
    
    return null;
  }

  inferCallSheetRole(email, line, allLines, lineIndex) {
    // Look for section headers that might indicate role
    for (let i = Math.max(0, lineIndex - 3); i <= Math.min(allLines.length - 1, lineIndex + 3); i++) {
      const checkLine = allLines[i];
      
      // Check for section headers
      if (checkLine.includes('VIDEO NAME')) return 'Video Crew';
      if (checkLine.includes('GLAM NAME')) return 'Glamour';
      if (checkLine.includes('SET DESIGN NAME')) return 'Set Design';
      if (checkLine.includes('WARDROBE NAME')) return 'Wardrobe';
      if (checkLine.includes('HEARST NAME')) return 'Hearst Staff';
      if (checkLine.includes('AMAZON NAME')) return 'Amazon Staff';
      if (checkLine.includes('TALENT NAME')) return 'Talent';
    }
    
    // Check email domain for hints
    if (email.includes('@hearst.com')) return 'Hearst Staff';
    if (email.includes('@amazon.com')) return 'Amazon Staff';
    if (email.includes('@omnicommediagroup.com')) return 'Omnicom Staff';
    
    return 'Crew Member';
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
      // Only deduplicate if we have both email and name that are identical
      const email = contact.email?.toLowerCase() || '';
      const name = contact.name?.toLowerCase() || '';
      
      // Create a more specific key for deduplication
      const key = `${email}-${name}`;
      
      // Only skip if we have an exact match with both email and name
      if (email && name && seen.has(key)) {
        continue;
      }
      
      // For contacts with only email or only name, be more lenient
      if (email && seen.has(email)) {
        continue;
      }
      
      if (name && name !== 'unknown' && seen.has(name)) {
        continue;
      }
      
      seen.add(key);
      if (email) seen.add(email);
      if (name && name !== 'unknown') seen.add(name);
      unique.push(contact);
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

  /**
   * Check if line is from a structured call sheet format
   */
  isStructuredCallSheetLine(line) {
    // Look for patterns like "Name Phone Call Time Location Email"
    const structuredPattern = /^[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+[\d\-\(\)\s]+\s+[\d:]+\s+[A-Z]+\s+[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const hasNamePhoneEmail = /^[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+[\d\-\(\)\s]+\s+[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    
    // Also check for lines that look like contact entries (name + phone/email)
    const hasNameAndContact = /^[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+[\d\-\(\)\s]+/;
    const hasNameAndEmail = /^[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    
    return structuredPattern.test(line) || hasNamePhoneEmail.test(line) || 
           hasNameAndContact.test(line) || hasNameAndEmail.test(line);
  }

  /**
   * Extract contacts from structured call sheet lines
   */
  extractFromStructuredLine(line, lineIndex, allLines, documentAnalysis) {
    const contacts = [];
    
    // Split line by multiple spaces to get columns
    const parts = line.split(/\s{2,}/);
    
    if (parts.length >= 2) {
      // Try to identify name, phone, email pattern
      const name = this.extractNameFromStructuredLine(parts);
      const phone = this.extractPhoneFromStructuredLine(parts);
      const email = this.extractEmailFromStructuredLine(parts);
      const role = this.extractRoleFromStructuredLine(parts, lineIndex, allLines);
      
      // More lenient validation - accept contacts with just name and phone/email
      if (name && (phone || email)) {
        const contact = {
          name: name,
          phone: phone || '',
          email: email || '',
          role: role || '',
          company: this.extractCompanyFromContext(lineIndex, allLines),
          confidence: 0.9
        };
        
        // More lenient validation for structured call sheets
        if (name && name.length > 2) {
          contacts.push(contact);
        }
      }
    }
    
    return contacts;
  }

  extractNameFromStructuredLine(parts) {
    // First part is usually the name
    const name = parts[0];
    if (name && name.length > 2 && /^[A-Z][a-z]+/.test(name)) {
      return name;
    }
    return null;
  }

  extractPhoneFromStructuredLine(parts) {
    for (const part of parts) {
      const phoneMatch = part.match(/(\d{3}[-.]?\d{3}[-.]?\d{4})/);
      if (phoneMatch) {
        return phoneMatch[1];
      }
    }
    return null;
  }

  extractEmailFromStructuredLine(parts) {
    for (const part of parts) {
      const emailMatch = part.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        return emailMatch[0];
      }
    }
    return null;
  }

  extractRoleFromStructuredLine(parts, lineIndex, allLines) {
    // Look for role keywords in the line
    const roleKeywords = [
      'Producer', 'Director', 'Photographer', 'Assistant', 'Stylist', 'Makeup', 'Hair', 
      'Grip', 'Electric', 'Camera', 'Audio', 'Wardrobe', 'Set Design', 'Colorist',
      'Talent', 'Client', 'Executive', 'Manager', 'Coordinator'
    ];
    
    const lineText = parts.join(' ');
    for (const keyword of roleKeywords) {
      if (lineText.toLowerCase().includes(keyword.toLowerCase())) {
        return keyword;
      }
    }
    
    // Try to infer role from context (section headers)
    const contextLines = allLines.slice(Math.max(0, lineIndex - 5), lineIndex + 5);
    for (const contextLine of contextLines) {
      if (contextLine.includes('PRODUCTION') || contextLine.includes('TALENT') || contextLine.includes('CLIENTS')) {
        if (contextLine.includes('PRODUCTION')) return 'Production';
        if (contextLine.includes('TALENT')) return 'Talent';
        if (contextLine.includes('CLIENTS')) return 'Client';
      }
    }
    
    return '';
  }

  extractCompanyFromContext(lineIndex, allLines) {
    // Look for company context in nearby lines
    const contextLines = allLines.slice(Math.max(0, lineIndex - 10), lineIndex + 10);
    for (const line of contextLines) {
      if (line.includes('L\'Oreal') || line.includes('Loreal')) return 'L\'Oreal';
      if (line.includes('Prime Content')) return 'Prime Content';
    }
    return '';
  }
}

module.exports = PatternExtractor;
