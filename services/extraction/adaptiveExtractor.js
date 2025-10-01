/**
 * Adaptive Contact Extractor
 * 
 * Robust, format-agnostic extraction that handles any call sheet format
 * Uses multi-strategy approach with intelligent fusion
 */

class AdaptiveExtractor {
  constructor() {
    this.extractionStrategies = this.initializeStrategies();
    this.patternLibrary = this.buildPatternLibrary();
    this.namePatterns = this.buildNamePatterns();
  }

  /**
   * Initialize all extraction strategies
   */
  initializeStrategies() {
    return {
      structured: this.extractStructured.bind(this),
      lineByLine: this.extractLineByLine.bind(this),
      multiLine: this.extractMultiLine.bind(this),
      tabular: this.extractTabular.bind(this),
      freeform: this.extractFreeform.bind(this)
    };
  }

  /**
   * Build comprehensive pattern library for different formats
   */
  buildPatternLibrary() {
    return {
      // Contact line patterns (in order of specificity)
      contactPatterns: [
        // Pattern 1: Role: Name / Company Agent / Phone
        {
          regex: /^([^:]+):\s*([A-Z\s]+)\s*\/\s*([^\/]+)\s*\/\s*(.+)/i,
          extract: (match, line) => ({
            role: match[1].trim(),
            name: this.normalizeName(match[2]),
            company: match[3].trim(),
            phone: this.extractPhone(match[4]),
            confidence: 0.9
          })
        },
        // Pattern 2: Role: Name / Phone
        {
          regex: /^([^:]+):\s*([^\/]+)\s*\/\s*(.+)/,
          extract: (match, line) => ({
            role: match[1].trim(),
            name: this.normalizeName(match[2]),
            phone: this.extractPhone(match[3]),
            confidence: 0.85
          })
        },
        // Pattern 3: Name | Email | Phone | Role
        {
          regex: /^([^|]+)\|([^|]+)\|([^|]+)\|(.+)$/,
          extract: (match, line) => ({
            name: this.normalizeName(match[1]),
            email: this.extractEmail(match[2]),
            phone: this.extractPhone(match[3]),
            role: match[4].trim(),
            confidence: 0.9
          })
        },
        // Pattern 4: Name    Email    Phone (whitespace separated)
        {
          regex: /^([A-Z][A-Za-z\s'-]+)\s{2,}([^\s]+@[^\s]+)\s{2,}(.+)$/,
          extract: (match, line) => ({
            name: this.normalizeName(match[1]),
            email: match[2].trim(),
            phone: this.extractPhone(match[3]),
            confidence: 0.8
          })
        },
        // Pattern 5: Email with name and phone on same line
        {
          regex: /([A-Za-z\s'-]+)\s*[<(]?\s*([^\s@]+@[^\s>)]+)\s*[>)]?\s*(.+)/,
          extract: (match, line) => ({
            name: this.normalizeName(match[1]),
            email: match[2].trim(),
            phone: this.extractPhone(match[3]),
            confidence: 0.75
          })
        },
        // Pattern 6: Phone with name (no email)
        {
          regex: /([A-Za-z\s'-]+)\s*[-–—]\s*(\+?[\d\s\-()]{10,})/,
          extract: (match, line) => ({
            name: this.normalizeName(match[1]),
            phone: this.extractPhone(match[2]),
            confidence: 0.7
          })
        }
      ],

      // Delimiter detection
      delimiters: ['/', '|', '\t', '  ', '-', '–', '—', '•'],

      // Section headers
      sectionHeaders: [
        /^(CREW|TALENT|CLIENTS?|PRODUCTION|CAST|STAFF|TEAM|CONTACTS?)/i,
        /^(Hair & Makeup|Wardrobe|Camera|Sound|Lighting|Grip|Electric)/i,
        /^(Models?|Actors?|Presenters?|Voice)/i
      ],

      // Skip patterns (non-contact lines)
      skipPatterns: [
        /^(Call Time|Location|Date|Shoot Date|Project|Client|Agency):/i,
        /^(Note|Notes|Important|Please|Contact for|Send to):/i,
        /^\d{1,2}:\d{2}\s*(AM|PM)/i, // Time
        /^\d+\s+(AM|PM)/i, // Time
        /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i,
        /^[\d\s\-\/]+$/, // Dates only
        /^(Table|Row|Column|Page)/i
      ]
    };
  }

  /**
   * Build flexible name patterns
   */
  buildNamePatterns() {
    return {
      // Matches: "John Smith", "JOHN SMITH", "john smith", "John O'Brien", "Mary-Jane Watson"
      fullName: /\b([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+)+)\b/g,
      
      // Matches: "JANE DOE" (all caps)
      allCapsName: /\b([A-Z]{2,}(?:\s+[A-Z]{2,})+)\b/g,
      
      // Matches: "Smith, John" (last, first)
      lastFirst: /\b([A-Z][a-z]+),\s+([A-Z][a-z]+)\b/g,
      
      // Matches single names (with context)
      singleName: /\b([A-Z][a-z]{2,})\b/g
    };
  }

  /**
   * Main extraction method - adaptive and robust
   */
  async extract(text, documentAnalysis = {}, options = {}) {
    console.log('🧠 Starting adaptive extraction...');
    
    // Step 0: Quick validation for garbage text
    if (this.isPDFGarbage(text)) {
      throw new Error('Text appears to contain PDF structure/binary data. Text extraction may have failed. Try OCR or re-save as text-based PDF.');
    }
    
    // Step 1: Detect format and structure
    const structure = this.analyzeStructure(text);
    console.log('📊 Document structure:', structure);

    // Step 2: Choose extraction approach
    const useMultiPass = options.useMultiPass || false;
    
    let allContacts = [];
    if (useMultiPass) {
      allContacts = await this.extractWithMultiPass(text, structure);
    } else {
      allContacts = await this.extractWithStrategies(text, structure);
    }

    console.log(`📋 Total raw contacts: ${allContacts.length}`);

    // Step 3: Merge and deduplicate with confidence scoring
    const mergedContacts = this.intelligentMerge(allContacts);
    console.log(`🔄 Merged to ${mergedContacts.length} unique contacts`);

    // Step 4: Enrich and normalize
    const enrichedContacts = this.enrichContacts(mergedContacts, text, structure);
    console.log(`✨ Enriched ${enrichedContacts.length} contacts`);

    // Step 5: Infer relationships (if multi-pass)
    let finalContacts = enrichedContacts;
    if (useMultiPass) {
      finalContacts = this.inferRelationships(enrichedContacts, text, structure);
      console.log(`🔗 Relationships inferred`);
    }

    // Step 6: Confidence-based filtering
    const threshold = options.confidenceThreshold || 0.3;
    const filteredContacts = this.filterByConfidence(finalContacts, threshold);
    console.log(`✅ Final: ${filteredContacts.length} contacts (threshold: ${threshold})`);

    return {
      contacts: filteredContacts,
      metadata: {
        structure,
        extractionMode: useMultiPass ? 'multi-pass' : 'multi-strategy',
        strategiesUsed: this.selectStrategies(structure).map(s => s.name),
        totalRawContacts: allContacts.length,
        duplicatesRemoved: allContacts.length - mergedContacts.length,
        avgConfidence: this.calculateAverageConfidence(filteredContacts)
      }
    };
  }

  /**
   * Standard multi-strategy extraction (parallel)
   */
  async extractWithStrategies(text, structure) {
    const strategies = this.selectStrategies(structure);
    console.log('🎯 Selected strategies:', strategies.map(s => s.name));

    const allContacts = [];
    for (const strategy of strategies) {
      try {
        const contacts = await strategy.fn(text, structure);
        console.log(`✅ ${strategy.name} found ${contacts.length} contacts`);
        allContacts.push(...contacts.map(c => ({ ...c, extractionMethod: strategy.name })));
      } catch (error) {
        console.warn(`⚠️ ${strategy.name} failed:`, error.message);
      }
    }

    return allContacts;
  }

  /**
   * Multi-pass extraction (sequential refinement)
   */
  async extractWithMultiPass(text, structure) {
    console.log('🔄 Starting multi-pass extraction...');
    
    // PASS 1: Extract all entities independently
    const entities = {
      names: this.extractAllNames(text),
      emails: this.extractAllEmails(text),
      phones: this.extractAllPhones(text),
      roles: this.extractAllRoles(text)
    };
    console.log('✅ Pass 1: Entities extracted', {
      names: entities.names.length,
      emails: entities.emails.length,
      phones: entities.phones.length,
      roles: entities.roles.length
    });
    
    // PASS 2: Link entities based on proximity
    const linkedContacts = this.linkEntitiesByProximity(entities, text);
    console.log('✅ Pass 2: Linked', linkedContacts.length, 'contacts');
    
    // PASS 3: Run standard strategies for additional coverage
    const strategyContacts = await this.extractWithStrategies(text, structure);
    console.log('✅ Pass 3: Strategy extraction found', strategyContacts.length, 'contacts');
    
    // PASS 4: Combine results
    const combined = [...linkedContacts, ...strategyContacts];
    console.log('✅ Pass 4: Combined', combined.length, 'total contacts');
    
    return combined;
  }

  /**
   * Analyze document structure
   */
  analyzeStructure(text) {
    const lines = text.split('\n');
    
    // Detect delimiters
    const delimiterCounts = {};
    this.patternLibrary.delimiters.forEach(delim => {
      delimiterCounts[delim] = text.split(delim).length - 1;
    });
    const primaryDelimiter = Object.entries(delimiterCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    // Detect if tabular
    const hasConsistentColumns = this.detectColumns(lines);
    
    // Detect sections
    const sections = this.detectSections(lines);
    
    // Detect multi-line contacts
    const hasMultiLine = this.detectMultiLinePattern(lines);

    return {
      type: hasConsistentColumns ? 'tabular' : hasMultiLine ? 'multiline' : 'mixed',
      delimiter: primaryDelimiter || '/',
      hasHeaders: hasConsistentColumns,
      sections: sections,
      lineCount: lines.length,
      avgLineLength: text.length / lines.length,
      hasPhones: /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(text),
      hasEmails: /@/.test(text)
    };
  }

  /**
   * Detect if document has consistent columns
   */
  detectColumns(lines) {
    // Check if multiple lines have similar tab/space patterns
    const patterns = lines.slice(0, 20).map(line => {
      return line.split(/\s{2,}|\t/).length;
    });
    
    const avgColumns = patterns.reduce((a, b) => a + b, 0) / patterns.length;
    const consistency = patterns.filter(p => Math.abs(p - avgColumns) <= 1).length / patterns.length;
    
    return consistency > 0.7 && avgColumns >= 3;
  }

  /**
   * Detect sections in document
   */
  detectSections(lines) {
    const sections = [];
    
    lines.forEach((line, index) => {
      for (const headerPattern of this.patternLibrary.sectionHeaders) {
        if (headerPattern.test(line)) {
          sections.push({
            name: line.trim(),
            startLine: index,
            type: this.inferSectionType(line)
          });
          break;
        }
      }
    });
    
    return sections;
  }

  /**
   * Infer section type from header
   */
  inferSectionType(header) {
    const lower = header.toLowerCase();
    if (/crew|staff|team|production/i.test(lower)) return 'crew';
    if (/talent|cast|model|actor/i.test(lower)) return 'talent';
    if (/client|agency/i.test(lower)) return 'client';
    return 'general';
  }

  /**
   * Detect multi-line contact pattern
   */
  detectMultiLinePattern(lines) {
    // Check if we have standalone name, email, phone lines
    let consecutiveFieldLines = 0;
    let maxConsecutive = 0;
    
    lines.forEach(line => {
      const hasEmail = /@/.test(line) && !this.hasOtherContent(line);
      const hasPhone = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(line) && !this.hasOtherContent(line);
      
      if (hasEmail || hasPhone) {
        consecutiveFieldLines++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveFieldLines);
      } else {
        consecutiveFieldLines = 0;
      }
    });
    
    return maxConsecutive >= 2;
  }

  /**
   * Check if line has other content besides contact info
   */
  hasOtherContent(line) {
    const cleaned = line.replace(/@[^\s]+/, '').replace(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/, '');
    return cleaned.trim().split(/\s+/).length > 2;
  }

  /**
   * Select optimal extraction strategies
   */
  selectStrategies(structure) {
    const strategies = [];
    
    // Always include line-by-line as baseline
    strategies.push({ name: 'Line-by-Line', fn: this.extractLineByLine.bind(this) });
    
    // Add structure-specific strategies
    if (structure.type === 'tabular') {
      strategies.push({ name: 'Tabular', fn: this.extractTabular.bind(this) });
    }
    
    if (structure.type === 'multiline') {
      strategies.push({ name: 'Multi-Line', fn: this.extractMultiLine.bind(this) });
    }
    
    if (structure.sections.length > 0) {
      strategies.push({ name: 'Structured', fn: this.extractStructured.bind(this) });
    }
    
    // Always add freeform as catch-all
    strategies.push({ name: 'Freeform', fn: this.extractFreeform.bind(this) });
    
    return strategies;
  }

  /**
   * Extract contacts line-by-line (most common format)
   */
  extractLineByLine(text, structure) {
    const contacts = [];
    const lines = text.split('\n');
    
    lines.forEach((line, index) => {
      // Skip empty lines, headers, and non-contact lines
      if (!line.trim() || this.shouldSkipLine(line)) return;
      
      // Try each pattern in order
      for (const pattern of this.patternLibrary.contactPatterns) {
        const match = line.match(pattern.regex);
        if (match) {
          const contact = pattern.extract(match, line);
          if (this.isValidContact(contact)) {
            contact.lineNumber = index + 1;
            contact.rawLine = line;
            contacts.push(contact);
            break; // Stop at first match
          }
        }
      }
      
      // If no pattern matched, try general extraction
      if (!contacts.find(c => c.lineNumber === index + 1)) {
        const contact = this.extractGeneral(line, index + 1);
        if (contact && this.isValidContact(contact)) {
          contacts.push(contact);
        }
      }
    });
    
    return contacts;
  }

  /**
   * Extract from multi-line format
   */
  extractMultiLine(text, structure) {
    const contacts = [];
    const lines = text.split('\n');
    let currentContact = {};
    let contactLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        // Empty line = end of contact
        if (Object.keys(currentContact).length > 0) {
          currentContact.rawLine = contactLines.join(' | ');
          if (this.isValidContact(currentContact)) {
            contacts.push(currentContact);
          }
          currentContact = {};
          contactLines = [];
        }
        continue;
      }
      
      // Check if this is a field line
      const email = this.extractEmail(line);
      const phone = this.extractPhone(line);
      const name = this.extractNameFromLine(line);
      
      if (email && !currentContact.email) {
        currentContact.email = email;
        contactLines.push(line);
      } else if (phone && !currentContact.phone) {
        currentContact.phone = phone;
        contactLines.push(line);
      } else if (name && !currentContact.name && !this.shouldSkipLine(line)) {
        currentContact.name = name;
        currentContact.role = this.inferRole(line);
        contactLines.push(line);
      } else if (currentContact.name && !currentContact.role) {
        // Might be a role line
        currentContact.role = line;
        contactLines.push(line);
      }
    }
    
    // Don't forget last contact
    if (Object.keys(currentContact).length > 0 && this.isValidContact(currentContact)) {
      currentContact.rawLine = contactLines.join(' | ');
      contacts.push(currentContact);
    }
    
    return contacts.map(c => ({ ...c, confidence: 0.7 }));
  }

  /**
   * Extract from tabular format
   */
  extractTabular(text, structure) {
    const contacts = [];
    const lines = text.split('\n');
    let headers = null;
    let delimiter = structure.delimiter || '\t';
    
    // If delimiter is multiple spaces, use regex split
    const splitLine = (line) => {
      if (delimiter === '  ') {
        return line.split(/\s{2,}/);
      }
      return line.split(delimiter);
    };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const cells = splitLine(line).map(c => c.trim());
      
      // First non-empty line might be headers
      if (!headers && this.looksLikeHeader(cells)) {
        headers = cells.map(h => h.toLowerCase());
        continue;
      }
      
      // Skip if too few cells
      if (cells.length < 2) continue;
      
      // Extract contact from cells
      const contact = this.extractFromCells(cells, headers);
      if (contact && this.isValidContact(contact)) {
        contact.lineNumber = i + 1;
        contact.rawLine = line;
        contact.confidence = 0.85;
        contacts.push(contact);
      }
    }
    
    return contacts;
  }

  /**
   * Check if cells look like headers
   */
  looksLikeHeader(cells) {
    const headerKeywords = ['name', 'email', 'phone', 'role', 'position', 'contact', 'company', 'title'];
    const matchCount = cells.filter(cell => 
      headerKeywords.some(keyword => cell.toLowerCase().includes(keyword))
    ).length;
    return matchCount >= 2;
  }

  /**
   * Extract contact from table cells
   */
  extractFromCells(cells, headers) {
    const contact = {};
    
    if (headers) {
      // Use headers to map cells
      headers.forEach((header, index) => {
        const value = cells[index]?.trim();
        if (!value) return;
        
        if (header.includes('name')) contact.name = this.normalizeName(value);
        else if (header.includes('email')) contact.email = value;
        else if (header.includes('phone') || header.includes('tel')) contact.phone = this.extractPhone(value);
        else if (header.includes('role') || header.includes('position') || header.includes('title')) contact.role = value;
        else if (header.includes('company')) contact.company = value;
      });
    } else {
      // Guess based on content
      cells.forEach((cell, index) => {
        if (!cell) return;
        
        if (this.extractEmail(cell)) {
          contact.email = this.extractEmail(cell);
        } else if (this.extractPhone(cell)) {
          contact.phone = this.extractPhone(cell);
        } else if (!contact.name && this.looksLikeName(cell)) {
          contact.name = this.normalizeName(cell);
        } else if (!contact.role && index > 0) {
          contact.role = cell;
        }
      });
    }
    
    return Object.keys(contact).length > 0 ? contact : null;
  }

  /**
   * Extract from structured sections
   */
  extractStructured(text, structure) {
    const contacts = [];
    const lines = text.split('\n');
    
    structure.sections.forEach((section, sectionIndex) => {
      const startLine = section.startLine;
      const endLine = structure.sections[sectionIndex + 1]?.startLine || lines.length;
      
      // Extract contacts from this section
      for (let i = startLine + 1; i < endLine; i++) {
        const line = lines[i].trim();
        if (!line || this.shouldSkipLine(line)) continue;
        
        const contact = this.extractGeneral(line, i + 1);
        if (contact && this.isValidContact(contact)) {
          contact.section = section.name;
          contact.sectionType = section.type;
          contacts.push(contact);
        }
      }
    });
    
    return contacts;
  }

  /**
   * Extract from freeform text (fallback)
   */
  extractFreeform(text, structure) {
    const contacts = [];
    
    // Extract all emails
    const emails = [...text.matchAll(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g)];
    
    // Extract all phones
    const phones = [...text.matchAll(/(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g)];
    
    // Extract all potential names
    const names = this.extractAllNames(text);
    
    // Try to associate names with emails/phones based on proximity
    emails.forEach(emailMatch => {
      const emailPos = emailMatch.index;
      const email = emailMatch[0];
      
      // Find closest name
      const closestName = this.findClosestName(names, emailPos);
      
      if (closestName) {
        contacts.push({
          name: closestName.name,
          email: email,
          confidence: 0.6,
          extractionMethod: 'proximity'
        });
      }
    });
    
    phones.forEach(phoneMatch => {
      const phonePos = phoneMatch.index;
      const phone = phoneMatch[0];
      
      // Find closest name
      const closestName = this.findClosestName(names, phonePos);
      
      if (closestName && !contacts.find(c => c.name === closestName.name && c.phone)) {
        const existing = contacts.find(c => c.name === closestName.name);
        if (existing) {
          existing.phone = phone;
        } else {
          contacts.push({
            name: closestName.name,
            phone: phone,
            confidence: 0.5,
            extractionMethod: 'proximity'
          });
        }
      }
    });
    
    return contacts;
  }

  /**
   * Extract all potential names from text
   */
  extractAllNames(text) {
    const names = [];
    
    // Try all name patterns
    Object.entries(this.namePatterns).forEach(([type, pattern]) => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        names.push({
          name: this.normalizeName(match[1]),
          position: match.index,
          type: type
        });
      });
    });
    
    return names;
  }

  /**
   * Find closest name to a position
   */
  findClosestName(names, position) {
    if (names.length === 0) return null;
    
    let closest = null;
    let minDistance = Infinity;
    
    names.forEach(nameObj => {
      const distance = Math.abs(nameObj.position - position);
      if (distance < minDistance && distance < 200) { // Within 200 characters
        minDistance = distance;
        closest = nameObj;
      }
    });
    
    return closest;
  }

  /**
   * General extraction from a single line
   */
  extractGeneral(line, lineNumber) {
    const email = this.extractEmail(line);
    const phone = this.extractPhone(line);
    const name = this.extractNameFromLine(line);
    const role = this.inferRole(line);
    
    if (!name && !email && !phone) return null;
    
    return {
      name: name || '',
      email: email || '',
      phone: phone || '',
      role: role || '',
      lineNumber: lineNumber,
      rawLine: line,
      confidence: (name ? 0.3 : 0) + (email ? 0.3 : 0) + (phone ? 0.2 : 0)
    };
  }

  /**
   * Check if line should be skipped
   */
  shouldSkipLine(line) {
    return this.patternLibrary.skipPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Extract name from line (IMPROVED - handles all formats)
   */
  extractNameFromLine(line) {
    // Remove email and phone to isolate name
    let cleaned = line
      .replace(/@[^\s]+/g, '')
      .replace(/\+?[\d\s\-().]{10,}/g, '')
      .replace(/^([^:]+):\s*/, ''); // Remove role prefix
    
    // Try different name patterns
    
    // 1. ALL CAPS name (2+ words)
    const allCapsMatch = cleaned.match(/\b([A-Z]{2,}(?:\s+[A-Z]{2,})+)\b/);
    if (allCapsMatch) {
      return this.normalizeName(allCapsMatch[1]);
    }
    
    // 2. Title case name
    const titleCaseMatch = cleaned.match(/\b([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)+)\b/);
    if (titleCaseMatch) {
      return this.normalizeName(titleCaseMatch[1]);
    }
    
    // 3. Before slash/pipe/dash
    const beforeDelim = cleaned.split(/[\/|–—-]/)[0].trim();
    if (beforeDelim && this.looksLikeName(beforeDelim)) {
      return this.normalizeName(beforeDelim);
    }
    
    return null;
  }

  /**
   * Check if text looks like a name
   */
  looksLikeName(text) {
    // Must have at least 2 characters
    if (text.length < 2) return false;
    
    // Must start with letter
    if (!/^[A-Za-z]/.test(text)) return false;
    
    // Must not be a common non-name word
    const nonNameWords = ['AM', 'PM', 'TBD', 'TBA', 'N/A', 'None', 'Remote', 'Location'];
    if (nonNameWords.includes(text.trim())) return false;
    
    // Must not be mostly numbers
    const digitCount = (text.match(/\d/g) || []).length;
    if (digitCount > text.length / 2) return false;
    
    return true;
  }

  /**
   * Normalize name (handle ALL CAPS, Title Case, etc.)
   */
  normalizeName(name) {
    if (!name) return '';
    
    const cleaned = name.trim();
    
    // Check if ALL CAPS
    if (cleaned === cleaned.toUpperCase() && cleaned.match(/[A-Z]/)) {
      // Convert to Title Case
      return cleaned
        .split(/\s+/)
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
    }
    
    // Otherwise return as-is (might already be properly formatted)
    return cleaned;
  }

  /**
   * Extract email from text
   */
  extractEmail(text) {
    const match = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    return match ? match[0] : null;
  }

  /**
   * Extract phone from text
   */
  extractPhone(text) {
    const match = text.match(/(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/);
    if (!match) return null;
    
    // Format as (XXX) XXX-XXXX
    const digits = match[0].replace(/\D/g, '');
    const cleaned = digits.startsWith('1') ? digits.substring(1) : digits;
    
    if (cleaned.length === 10) {
      return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
    }
    
    return match[0]; // Return as-is if not standard format
  }

  /**
   * Infer role from line
   */
  inferRole(line) {
    // Check for role prefix (e.g., "Photographer: ...")
    const rolePrefix = line.match(/^([^:]+):/);
    if (rolePrefix) {
      return rolePrefix[1].trim();
    }
    
    // Check for role keywords
    const roleKeywords = {
      'photographer': 'Photographer',
      'photo assistant': 'Photo Assistant',
      'digitech': 'Digital Technician',
      'videographer': 'Videographer',
      'director': 'Director',
      'producer': 'Producer',
      'model': 'Model',
      'casting': 'Casting Director',
      'makeup': 'Makeup Artist',
      'mua': 'Makeup Artist',
      'hair': 'Hair Artist',
      'hua': 'Hair Artist',
      'hmua': 'Hair & Makeup Artist',
      'stylist': 'Stylist',
      'assistant': 'Production Assistant',
      'driver': 'Driver'
    };
    
    const lineLower = line.toLowerCase();
    for (const [keyword, role] of Object.entries(roleKeywords)) {
      if (lineLower.includes(keyword)) {
        return role;
      }
    }
    
    return '';
  }

  /**
   * Check if contact has minimum required information
   */
  isValidContact(contact) {
    // Must have at least a name OR (email OR phone)
    return (contact.name && contact.name.length > 1) || 
           (contact.email || contact.phone);
  }

  /**
   * Intelligent merge with confidence scoring
   */
  intelligentMerge(contacts) {
    const merged = [];
    const seen = new Map();
    
    contacts.forEach(contact => {
      // Create a key for duplicate detection
      const key = this.createContactKey(contact);
      
      if (seen.has(key)) {
        // Merge with existing
        const existing = seen.get(key);
        const updated = this.mergeContactData(existing, contact);
        seen.set(key, updated);
      } else {
        seen.set(key, contact);
      }
    });
    
    return Array.from(seen.values());
  }

  /**
   * Create unique key for contact
   */
  createContactKey(contact) {
    // Use phone or email as primary key, fallback to normalized name
    if (contact.phone) {
      return `phone:${contact.phone.replace(/\D/g, '')}`;
    }
    if (contact.email) {
      return `email:${contact.email.toLowerCase()}`;
    }
    if (contact.name) {
      return `name:${contact.name.toLowerCase().replace(/\s+/g, '')}`;
    }
    return `unknown:${Math.random()}`;
  }

  /**
   * Merge two contact records
   */
  mergeContactData(existing, newContact) {
    return {
      name: existing.name || newContact.name,
      email: existing.email || newContact.email,
      phone: existing.phone || newContact.phone,
      role: existing.role || newContact.role,
      company: existing.company || newContact.company,
      confidence: Math.max(existing.confidence || 0, newContact.confidence || 0),
      extractionMethod: [existing.extractionMethod, newContact.extractionMethod].filter(Boolean).join(', '),
      lineNumber: existing.lineNumber || newContact.lineNumber,
      rawLine: existing.rawLine || newContact.rawLine
    };
  }

  /**
   * Enrich contacts with additional information
   */
  enrichContacts(contacts, text, structure) {
    return contacts.map(contact => {
      // Ensure confidence score
      if (!contact.confidence) {
        contact.confidence = this.calculateConfidence(contact);
      }
      
      // Standardize phone format
      if (contact.phone && !contact.phone.includes('(')) {
        contact.phone = this.extractPhone(contact.phone) || contact.phone;
      }
      
      // Ensure name is normalized
      if (contact.name) {
        contact.name = this.normalizeName(contact.name);
      }
      
      // Add metadata
      contact.extractedAt = new Date().toISOString();
      
      return contact;
    });
  }

  /**
   * Calculate confidence score for contact
   */
  calculateConfidence(contact) {
    let score = 0;
    
    if (contact.name && contact.name.length > 2) score += 0.3;
    if (contact.name && contact.name.includes(' ')) score += 0.1; // Full name
    if (contact.email) score += 0.3;
    if (contact.phone) score += 0.2;
    if (contact.role) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  /**
   * Filter contacts by confidence threshold
   */
  filterByConfidence(contacts, threshold = 0.5) {
    return contacts.filter(contact => 
      (contact.confidence || 0) >= threshold
    );
  }

  /**
   * Extract all emails from text
   */
  extractAllEmails(text) {
    const emails = [];
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const matches = [...text.matchAll(emailRegex)];
    
    matches.forEach(match => {
      emails.push({
        value: match[0],
        position: match.index
      });
    });
    
    return emails;
  }

  /**
   * Extract all phone numbers from text
   */
  extractAllPhones(text) {
    const phones = [];
    const phoneRegex = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
    const matches = [...text.matchAll(phoneRegex)];
    
    matches.forEach(match => {
      phones.push({
        value: match[0],
        position: match.index
      });
    });
    
    return phones;
  }

  /**
   * Extract all role keywords from text
   */
  extractAllRoles(text) {
    const roles = [];
    const roleKeywords = [
      'photographer', 'photo assistant', 'digitech', 'videographer',
      'director', 'producer', 'model', 'casting', 'makeup', 'hair',
      'stylist', 'assistant', 'driver', 'gaffer', 'grip', 'sound'
    ];
    
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      // Check for "Role:" prefix
      const roleMatch = line.match(/^([^:]+):/);
      if (roleMatch) {
        roles.push({
          value: roleMatch[1].trim(),
          position: text.indexOf(line),
          lineNumber: index
        });
      } else {
        // Check for role keywords
        const lineLower = line.toLowerCase();
        roleKeywords.forEach(keyword => {
          if (lineLower.includes(keyword)) {
            roles.push({
              value: keyword,
              position: text.indexOf(line),
              lineNumber: index
            });
          }
        });
      }
    });
    
    return roles;
  }

  /**
   * Link entities based on proximity in text
   */
  linkEntitiesByProximity(entities, text) {
    const contacts = [];
    const maxDistance = 200; // characters
    
    // For each name, find closest email and phone
    entities.names.forEach(nameObj => {
      const contact = {
        name: nameObj.name,
        email: '',
        phone: '',
        role: '',
        confidence: 0.5,
        extractionMethod: 'proximity-linking'
      };
      
      // Find closest email
      let closestEmail = null;
      let minEmailDist = Infinity;
      entities.emails.forEach(emailObj => {
        const dist = Math.abs(emailObj.position - nameObj.position);
        if (dist < minEmailDist && dist < maxDistance) {
          minEmailDist = dist;
          closestEmail = emailObj;
        }
      });
      if (closestEmail) {
        contact.email = closestEmail.value;
        contact.confidence += 0.2;
      }
      
      // Find closest phone
      let closestPhone = null;
      let minPhoneDist = Infinity;
      entities.phones.forEach(phoneObj => {
        const dist = Math.abs(phoneObj.position - nameObj.position);
        if (dist < minPhoneDist && dist < maxDistance) {
          minPhoneDist = dist;
          closestPhone = phoneObj;
        }
      });
      if (closestPhone) {
        contact.phone = this.extractPhone(closestPhone.value);
        contact.confidence += 0.2;
      }
      
      // Find closest role
      let closestRole = null;
      let minRoleDist = Infinity;
      entities.roles.forEach(roleObj => {
        const dist = Math.abs(roleObj.position - nameObj.position);
        if (dist < minRoleDist && dist < maxDistance) {
          minRoleDist = dist;
          closestRole = roleObj;
        }
      });
      if (closestRole) {
        contact.role = closestRole.value;
        contact.confidence += 0.1;
      }
      
      // Only add if we found at least email or phone
      if (contact.email || contact.phone) {
        contacts.push(contact);
      }
    });
    
    return contacts;
  }

  /**
   * Infer relationships between contacts
   */
  inferRelationships(contacts, text, structure) {
    const enhanced = [];
    
    for (let i = 0; i < contacts.length; i++) {
      const contact = { ...contacts[i] };
      
      // Detect agent relationships
      // Pattern: "Model: NAME / Agency Agent / Phone"
      if (contact.role?.toLowerCase().includes('model') && contact.company) {
        const agentMatch = contact.company.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+[-–—]?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/);
        if (agentMatch) {
          contact.agency = agentMatch[1];
          contact.agentName = agentMatch[2];
          contact.metadata = contact.metadata || {};
          contact.metadata.hasAgent = true;
        }
      }
      
      // Detect hierarchies (1st, 2nd, 3rd assistants)
      if (contact.role?.match(/^(1st|2nd|3rd)\s+/i)) {
        const baseRole = contact.role.replace(/^(1st|2nd|3rd)\s+/i, '');
        const lead = contacts.find(c => 
          c.role?.toLowerCase().includes(baseRole.toLowerCase()) && 
          !c.role?.match(/^(1st|2nd|3rd)/i)
        );
        if (lead) {
          contact.metadata = contact.metadata || {};
          contact.metadata.reportsTo = lead.name;
        }
      }
      
      // Detect company affiliations (same email domain)
      if (contact.email) {
        const domain = contact.email.split('@')[1];
        const colleagues = contacts.filter(c => 
          c.email?.includes(domain) && c.name !== contact.name
        );
        if (colleagues.length > 0) {
          contact.metadata = contact.metadata || {};
          contact.metadata.colleagues = colleagues.map(c => c.name);
        }
      }
      
      enhanced.push(contact);
    }
    
    return enhanced;
  }

  /**
   * Calculate average confidence across all contacts
   */
  calculateAverageConfidence(contacts) {
    if (contacts.length === 0) return 0;
    const sum = contacts.reduce((acc, c) => acc + (c.confidence || 0), 0);
    return parseFloat((sum / contacts.length).toFixed(2));
  }

  /**
   * Detect if text is PDF garbage (failed extraction)
   */
  isPDFGarbage(text) {
    if (!text || text.trim().length < 10) return false;
    
    // Check for PDF structure markers
    const pdfMarkers = [
      'endobj', 'stream', 'endstream', 'xref', 'trailer', 
      'startxref', '%%EOF', '/Type', '/Subtype', '/Filter'
    ];
    
    const markerCount = pdfMarkers.filter(marker => text.includes(marker)).length;
    
    // If 3+ PDF markers, it's likely garbage
    if (markerCount >= 3) {
      console.warn('⚠️ Detected PDF structure markers in text - likely failed extraction');
      return true;
    }
    
    // Check for high ratio of non-printable characters
    const nonPrintable = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g) || []).length;
    const nonPrintableRatio = nonPrintable / text.length;
    
    if (nonPrintableRatio > 0.2) {
      console.warn(`⚠️ Text is ${(nonPrintableRatio * 100).toFixed(1)}% non-printable - likely binary`);
      return true;
    }
    
    return false;
  }
}

module.exports = AdaptiveExtractor;


