/**
 * AI-Powered Pattern Extractor
 * 
 * Enhanced contact extraction using machine learning, NLP, and advanced pattern recognition
 * for better accuracy and context understanding
 */

// Optional AI dependencies
let natural, SentimentAnalyzer;
try {
  natural = require('natural');
  SentimentAnalyzer = natural.SentimentAnalyzer;
} catch (error) {
  console.warn('⚠️ Natural language processing library not available. AI features will be limited.');
  natural = null;
  SentimentAnalyzer = null;
}

class AIPatternExtractor {
  constructor() {
    // Initialize NLP tools (if available)
    if (natural) {
      this.tokenizer = new natural.WordTokenizer();
      this.stemmer = natural.PorterStemmer;
      this.sentimentAnalyzer = new SentimentAnalyzer('English', this.stemmer, 'afinn');
    } else {
      // Fallback implementations
      this.tokenizer = { tokenize: (text) => text.split(/\s+/) };
      this.stemmer = { stem: (word) => word };
      this.sentimentAnalyzer = { getSentiment: () => 0 };
    }
    
    // Enhanced regex patterns with context awareness
    this.patterns = this.initializePatterns();
    
    // Contact validation rules
    this.validationRules = this.initializeValidationRules();
    
    // Context analysis for better extraction
    this.contextAnalyzer = new ContextAnalyzer();
  }

  /**
   * Initialize enhanced regex patterns
   */
  initializePatterns() {
    return {
      email: {
        pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        confidence: 0.9,
        context: ['email', 'contact', 'reach', 'send', 'message']
      },
      phone: {
        patterns: [
          {
            regex: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
            format: 'US',
            confidence: 0.8
          },
          {
            regex: /(\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
            format: 'International',
            confidence: 0.7
          },
          {
            regex: /(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/g,
            format: 'Simple',
            confidence: 0.6
          }
        ],
        context: ['phone', 'call', 'mobile', 'cell', 'direct', 'office', 'fax']
      },
      name: {
        patterns: [
          {
            regex: /\b([A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
            type: 'Full Name',
            confidence: 0.8
          },
          {
            regex: /\b([A-Z][a-z]+ [A-Z]\.\s*[A-Z][a-z]+)\b/g,
            type: 'Name with Initial',
            confidence: 0.7
          },
          {
            regex: /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g,
            type: 'Two Word Name',
            confidence: 0.6
          }
        ],
        context: ['name', 'contact', 'person', 'individual', 'representative']
      },
      role: {
        patterns: [
          {
            regex: /\b(Director|Producer|Executive Producer|Line Producer|Associate Producer)\b/gi,
            category: 'Above the Line',
            confidence: 0.9
          },
          {
            regex: /\b(Cinematographer|DP|Director of Photography|Camera Operator|First AC|Second AC)\b/gi,
            category: 'Camera',
            confidence: 0.9
          },
          {
            regex: /\b(Editor|Assistant Editor|Post Production Supervisor|Colorist|Sound Editor)\b/gi,
            category: 'Post Production',
            confidence: 0.9
          },
          {
            regex: /\b(Sound Mixer|Boom Operator|Sound Designer|Composer|Music Supervisor)\b/gi,
            category: 'Sound',
            confidence: 0.9
          },
          {
            regex: /\b(Gaffer|Best Boy Electric|Electrician|Lighting Designer|Key Grip|Grip)\b/gi,
            category: 'Lighting/Grip',
            confidence: 0.9
          },
          {
            regex: /\b(Production Designer|Art Director|Set Decorator|Props Master|Costume Designer)\b/gi,
            category: 'Art Department',
            confidence: 0.9
          },
          {
            regex: /\b(First AD|Second AD|Script Supervisor|Continuity|Production Coordinator)\b/gi,
            category: 'Production',
            confidence: 0.9
          },
          {
            regex: /\b(Location Manager|Transportation Coordinator|Catering|Craft Services)\b/gi,
            category: 'Logistics',
            confidence: 0.8
          }
        ],
        context: ['role', 'position', 'title', 'job', 'department']
      },
      company: {
        patterns: [
          {
            regex: /\b([A-Z][a-zA-Z\s&.,-]+(?:Inc|LLC|Corp|Corporation|Company|Productions|Studios|Entertainment|Media|Films|Pictures))\b/g,
            type: 'Production Company',
            confidence: 0.8
          },
          {
            regex: /\b([A-Z][a-zA-Z\s&.,-]+(?:Agency|Group|Associates|Partners|Entertainment))\b/g,
            type: 'Agency',
            confidence: 0.7
          }
        ],
        context: ['company', 'studio', 'agency', 'production', 'firm']
      },
      department: {
        patterns: [
          {
            regex: /\b(Production|Camera|Sound|Lighting|Grip|Art|Wardrobe|Makeup|Hair|Transportation|Catering)\b/gi,
            confidence: 0.8
          }
        ],
        context: ['department', 'crew', 'team', 'unit']
      }
    };
  }

  /**
   * Initialize validation rules
   */
  initializeValidationRules() {
    return {
      email: {
        required: true,
        format: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        minLength: 5,
        maxLength: 254
      },
      phone: {
        required: false,
        format: /^[\+]?[\d\s\-\(\)]{10,}$/,
        minLength: 10,
        maxLength: 20
      },
      name: {
        required: true,
        format: /^[a-zA-Z\s\-'.]+$/,
        minLength: 2,
        maxLength: 100
      },
      role: {
        required: false,
        format: /^[a-zA-Z\s\-&]+$/,
        minLength: 2,
        maxLength: 50
      },
      company: {
        required: false,
        format: /^[a-zA-Z0-9\s&.,-]+$/,
        minLength: 2,
        maxLength: 100
      }
    };
  }

  /**
   * Enhanced contact extraction with AI
   * @param {string} text - Extracted text
   * @param {Object} documentAnalysis - Document analysis result
   * @returns {Array} Array of extracted contacts
   */
  async extractContacts(text, documentAnalysis) {
    console.log('🤖 Starting AI-powered contact extraction...');
    
    try {
      // Step 1: Context-aware text preprocessing
      const processedText = await this.preprocessText(text, documentAnalysis);
      
      // Step 2: Extract raw patterns
      const rawPatterns = await this.extractRawPatterns(processedText);
      
      // Step 3: Group patterns into potential contacts
      const contactGroups = await this.groupPatterns(rawPatterns, processedText);
      
      // Step 4: Validate and enhance contacts
      const validatedContacts = await this.validateAndEnhanceContacts(contactGroups, documentAnalysis);
      
      // Step 5: Apply AI-based confidence scoring
      const scoredContacts = await this.applyAIConfidenceScoring(validatedContacts, documentAnalysis);
      
      // Step 6: Remove duplicates with fuzzy matching
      const uniqueContacts = this.removeDuplicatesWithAI(scoredContacts);
      
      console.log(`✅ AI extraction complete: ${uniqueContacts.length} contacts found`);
      
      return uniqueContacts;
      
    } catch (error) {
      console.error('❌ AI contact extraction failed:', error);
      return [];
    }
  }

  /**
   * Preprocess text with context awareness
   */
  async preprocessText(text, documentAnalysis) {
    // Clean and normalize text
    let processedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();

    // Apply document-type specific preprocessing
    if (documentAnalysis.type === 'call_sheet') {
      processedText = this.preprocessCallSheet(processedText);
    } else if (documentAnalysis.type === 'contact_list') {
      processedText = this.preprocessContactList(processedText);
    } else if (documentAnalysis.type === 'resume') {
      processedText = this.preprocessResume(processedText);
    }

    return processedText;
  }

  /**
   * Preprocess call sheet text
   */
  preprocessCallSheet(text) {
    // Extract crew sections
    const crewSections = text.match(/crew[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi) || [];
    const castSections = text.match(/cast[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi) || [];
    
    return [...crewSections, ...castSections].join('\n');
  }

  /**
   * Preprocess contact list text
   */
  preprocessContactList(text) {
    // Remove headers and footers
    const lines = text.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && 
             !trimmed.match(/^(page|total|count|list)/i) &&
             !trimmed.match(/^\d+$/);
    });
    
    return filteredLines.join('\n');
  }

  /**
   * Preprocess resume text
   */
  preprocessResume(text) {
    // Extract contact information section
    const contactSection = text.match(/contact[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi) || [];
    const headerSection = text.split('\n').slice(0, 10).join('\n');
    
    return [...contactSection, headerSection].join('\n');
  }

  /**
   * Extract raw patterns from text
   */
  async extractRawPatterns(text) {
    const patterns = {
      emails: [],
      phones: [],
      names: [],
      roles: [],
      companies: [],
      departments: []
    };

    // Extract emails
    const emailMatches = text.match(this.patterns.email.pattern) || [];
    patterns.emails = emailMatches.map(email => ({
      value: email.toLowerCase(),
      confidence: this.patterns.email.confidence,
      context: this.findContext(text, email, this.patterns.email.context)
    }));

    // Extract phones
    for (const phonePattern of this.patterns.phone.patterns) {
      const phoneMatches = text.match(phonePattern.regex) || [];
      patterns.phones.push(...phoneMatches.map(phone => ({
        value: phone,
        format: phonePattern.format,
        confidence: phonePattern.confidence,
        context: this.findContext(text, phone, this.patterns.phone.context)
      })));
    }

    // Extract names
    for (const namePattern of this.patterns.name.patterns) {
      const nameMatches = text.match(namePattern.regex) || [];
      patterns.names.push(...nameMatches.map(name => ({
        value: name.trim(),
        type: namePattern.type,
        confidence: namePattern.confidence,
        context: this.findContext(text, name, this.patterns.name.context)
      })));
    }

    // Extract roles
    for (const rolePattern of this.patterns.role.patterns) {
      const roleMatches = text.match(rolePattern.regex) || [];
      patterns.roles.push(...roleMatches.map(role => ({
        value: role.trim(),
        category: rolePattern.category,
        confidence: rolePattern.confidence,
        context: this.findContext(text, role, this.patterns.role.context)
      })));
    }

    // Extract companies
    for (const companyPattern of this.patterns.company.patterns) {
      const companyMatches = text.match(companyPattern.regex) || [];
      patterns.companies.push(...companyMatches.map(company => ({
        value: company.trim(),
        type: companyPattern.type,
        confidence: companyPattern.confidence,
        context: this.findContext(text, company, this.patterns.company.context)
      })));
    }

    // Extract departments
    for (const deptPattern of this.patterns.department.patterns) {
      const deptMatches = text.match(deptPattern.regex) || [];
      patterns.departments.push(...deptMatches.map(dept => ({
        value: dept.trim(),
        confidence: deptPattern.confidence,
        context: this.findContext(text, dept, this.patterns.department.context)
      })));
    }

    return patterns;
  }

  /**
   * Find context around a pattern match
   */
  findContext(text, match, contextKeywords) {
    const matchIndex = text.indexOf(match);
    const contextStart = Math.max(0, matchIndex - 50);
    const contextEnd = Math.min(text.length, matchIndex + match.length + 50);
    const context = text.slice(contextStart, contextEnd);
    
    // Check if context contains relevant keywords
    const hasRelevantContext = contextKeywords.some(keyword => 
      context.toLowerCase().includes(keyword.toLowerCase())
    );
    
    return {
      text: context,
      hasRelevantContext,
      relevanceScore: hasRelevantContext ? 0.8 : 0.3
    };
  }

  /**
   * Group patterns into potential contacts
   */
  async groupPatterns(rawPatterns, text) {
    const contactGroups = [];
    const lines = text.split('\n');
    
    // Process each line for potential contacts
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();
      
      // Skip empty lines
      if (line.trim().length === 0) continue;
      
      // Find patterns in this line
      const linePatterns = {
        emails: rawPatterns.emails.filter(p => line.includes(p.value)),
        phones: rawPatterns.phones.filter(p => line.includes(p.value)),
        names: rawPatterns.names.filter(p => line.includes(p.value)),
        roles: rawPatterns.roles.filter(p => line.includes(p.value)),
        companies: rawPatterns.companies.filter(p => line.includes(p.value)),
        departments: rawPatterns.departments.filter(p => line.includes(p.value))
      };
      
      // If we found any patterns, create a contact group
      if (Object.values(linePatterns).some(arr => arr.length > 0)) {
        contactGroups.push({
          lineNumber: i,
          lineText: line,
          patterns: linePatterns,
          confidence: this.calculateLineConfidence(linePatterns)
        });
      }
    }
    
    // Also try to extract contacts from the entire text as a fallback
    if (contactGroups.length === 0) {
      // Look for common contact patterns in the entire text
      const fullTextPatterns = this.extractContactsFromFullText(text);
      if (fullTextPatterns.length > 0) {
        contactGroups.push(...fullTextPatterns);
      }
    }
    
    return contactGroups;
  }

  /**
   * Extract contacts from full text as fallback
   */
  extractContactsFromFullText(text) {
    const contacts = [];
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for patterns like "Name - Role - Email - Phone"
      const contactPattern = /([A-Za-z\s]+?)\s*[-–]\s*([A-Za-z\s]+?)\s*[-–]\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s*[-–]\s*([\(\)\d\s\-\.]+)/;
      const match = line.match(contactPattern);
      
      if (match) {
        contacts.push({
          lineNumber: i,
          lineText: line,
          patterns: {
            names: [{ value: match[1].trim(), confidence: 0.8 }],
            roles: [{ value: match[2].trim(), confidence: 0.7 }],
            emails: [{ value: match[3].trim(), confidence: 0.9 }],
            phones: [{ value: match[4].trim(), confidence: 0.8 }],
            companies: [],
            departments: []
          },
          confidence: 0.8
        });
      }
    }
    
    return contacts;
  }

  /**
   * Calculate confidence for a line based on patterns found
   */
  calculateLineConfidence(linePatterns) {
    let confidence = 0;
    let patternCount = 0;
    
    Object.values(linePatterns).forEach(patterns => {
      if (patterns.length > 0) {
        confidence += patterns.reduce((sum, p) => sum + p.confidence, 0);
        patternCount += patterns.length;
      }
    });
    
    return patternCount > 0 ? confidence / patternCount : 0;
  }

  /**
   * Validate and enhance contacts
   */
  async validateAndEnhanceContacts(contactGroups, documentAnalysis) {
    const contacts = [];
    
    for (const group of contactGroups) {
      const contact = {
        name: this.extractBestName(group.patterns.names),
        email: this.extractBestEmail(group.patterns.emails),
        phone: this.extractBestPhone(group.patterns.phones),
        role: this.extractBestRole(group.patterns.roles),
        company: this.extractBestCompany(group.patterns.companies),
        department: this.extractBestDepartment(group.patterns.departments),
        notes: this.extractNotes(group.lineText, group.patterns),
        confidence: group.confidence,
        source: {
          lineNumber: group.lineNumber,
          lineText: group.lineText,
          documentType: documentAnalysis.type,
          productionType: documentAnalysis.productionType
        }
      };
      
      // Only include contacts that meet minimum requirements
      if (this.isValidContact(contact)) {
        contacts.push(contact);
      }
    }
    
    return contacts;
  }

  /**
   * Extract best name from patterns
   */
  extractBestName(names) {
    if (names.length === 0) return null;
    
    // Sort by confidence and return the best
    const sortedNames = names.sort((a, b) => b.confidence - a.confidence);
    return sortedNames[0].value;
  }

  /**
   * Extract best email from patterns
   */
  extractBestEmail(emails) {
    if (emails.length === 0) return null;
    
    // Sort by confidence and return the best
    const sortedEmails = emails.sort((a, b) => b.confidence - a.confidence);
    return sortedEmails[0].value;
  }

  /**
   * Extract best phone from patterns
   */
  extractBestPhone(phones) {
    if (phones.length === 0) return null;
    
    // Sort by confidence and return the best
    const sortedPhones = phones.sort((a, b) => b.confidence - a.confidence);
    return sortedPhones[0].value;
  }

  /**
   * Extract best role from patterns
   */
  extractBestRole(roles) {
    if (roles.length === 0) return null;
    
    // Sort by confidence and return the best
    const sortedRoles = roles.sort((a, b) => b.confidence - a.confidence);
    return sortedRoles[0].value;
  }

  /**
   * Extract best company from patterns
   */
  extractBestCompany(companies) {
    if (companies.length === 0) return null;
    
    // Sort by confidence and return the best
    const sortedCompanies = companies.sort((a, b) => b.confidence - a.confidence);
    return sortedCompanies[0].value;
  }

  /**
   * Extract best department from patterns
   */
  extractBestDepartment(departments) {
    if (departments.length === 0) return null;
    
    // Sort by confidence and return the best
    const sortedDepartments = departments.sort((a, b) => b.confidence - a.confidence);
    return sortedDepartments[0].value;
  }

  /**
   * Extract notes from line text
   */
  extractNotes(lineText, patterns) {
    // Remove extracted patterns from line to get remaining text
    let notes = lineText;
    
    Object.values(patterns).forEach(patternList => {
      patternList.forEach(pattern => {
        notes = notes.replace(pattern.value, '');
      });
    });
    
    // Clean up the notes
    notes = notes.replace(/\s+/g, ' ').trim();
    
    return notes.length > 0 ? notes : null;
  }

  /**
   * Check if contact meets minimum requirements
   */
  isValidContact(contact) {
    // Must have at least name or email
    if (!contact.name && !contact.email) {
      return false;
    }
    
    // Validate email format if present
    if (contact.email && !this.validationRules.email.format.test(contact.email)) {
      return false;
    }
    
    // Validate phone format if present
    if (contact.phone && !this.validationRules.phone.format.test(contact.phone)) {
      return false;
    }
    
    // Validate name format if present
    if (contact.name && !this.validationRules.name.format.test(contact.name)) {
      return false;
    }
    
    return true;
  }

  /**
   * Apply AI-based confidence scoring
   */
  async applyAIConfidenceScoring(contacts, documentAnalysis) {
    return contacts.map(contact => {
      let confidence = contact.confidence;
      
      // Boost confidence for production-specific roles
      if (contact.role && this.isProductionRole(contact.role)) {
        confidence += 0.1;
      }
      
      // Boost confidence for valid email domains
      if (contact.email && this.isValidEmailDomain(contact.email)) {
        confidence += 0.1;
      }
      
      // Boost confidence for complete contact information
      if (contact.name && contact.email && contact.phone) {
        confidence += 0.2;
      }
      
      // Apply document type specific scoring
      if (documentAnalysis.type === 'call_sheet' && contact.role) {
        confidence += 0.1;
      }
      
      if (documentAnalysis.type === 'contact_list' && contact.email) {
        confidence += 0.1;
      }
      
      return {
        ...contact,
        confidence: Math.min(confidence, 1.0)
      };
    });
  }

  /**
   * Check if role is production-related
   */
  isProductionRole(role) {
    const productionRoles = [
      'director', 'producer', 'cinematographer', 'editor', 'sound',
      'lighting', 'grip', 'art', 'wardrobe', 'makeup', 'hair'
    ];
    
    return productionRoles.some(prodRole => 
      role.toLowerCase().includes(prodRole)
    );
  }

  /**
   * Check if email domain is valid
   */
  isValidEmailDomain(email) {
    const validDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      'aol.com', 'icloud.com', 'me.com', 'mac.com'
    ];
    
    const domain = email.split('@')[1];
    return validDomains.includes(domain) || domain.includes('.');
  }

  /**
   * Remove duplicates with AI-powered fuzzy matching
   */
  removeDuplicatesWithAI(contacts) {
    const uniqueContacts = [];
    const seenContacts = new Set();
    
    for (const contact of contacts) {
      const key = this.generateContactKey(contact);
      
      if (!seenContacts.has(key)) {
        // Check for fuzzy duplicates
        const isDuplicate = uniqueContacts.some(existing => 
          this.calculateContactSimilarity(contact, existing) > 0.8
        );
        
        if (!isDuplicate) {
          uniqueContacts.push(contact);
          seenContacts.add(key);
        }
      }
    }
    
    return uniqueContacts;
  }

  /**
   * Generate a unique key for contact
   */
  generateContactKey(contact) {
    const email = contact.email ? contact.email.toLowerCase() : '';
    const name = contact.name ? contact.name.toLowerCase() : '';
    const phone = contact.phone ? contact.phone.replace(/\D/g, '') : '';
    
    return `${email}|${name}|${phone}`;
  }

  /**
   * Calculate similarity between two contacts
   */
  calculateContactSimilarity(contact1, contact2) {
    let similarity = 0;
    let factors = 0;
    
    // Email similarity
    if (contact1.email && contact2.email) {
      similarity += contact1.email.toLowerCase() === contact2.email.toLowerCase() ? 1 : 0;
      factors++;
    }
    
    // Name similarity
    if (contact1.name && contact2.name) {
      const nameSimilarity = this.calculateStringSimilarity(
        contact1.name.toLowerCase(), 
        contact2.name.toLowerCase()
      );
      similarity += nameSimilarity;
      factors++;
    }
    
    // Phone similarity
    if (contact1.phone && contact2.phone) {
      const phone1 = contact1.phone.replace(/\D/g, '');
      const phone2 = contact2.phone.replace(/\D/g, '');
      similarity += phone1 === phone2 ? 1 : 0;
      factors++;
    }
    
    return factors > 0 ? similarity / factors : 0;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

/**
 * Context Analyzer for better pattern understanding
 */
class ContextAnalyzer {
  constructor() {
    this.contextPatterns = {
      contact: ['contact', 'reach', 'call', 'email', 'message'],
      production: ['crew', 'cast', 'team', 'staff', 'personnel'],
      business: ['company', 'studio', 'agency', 'firm', 'corporation']
    };
  }

  /**
   * Analyze context around a pattern
   */
  analyzeContext(text, pattern, contextType) {
    const contextKeywords = this.contextPatterns[contextType] || [];
    const patternIndex = text.indexOf(pattern);
    const contextStart = Math.max(0, patternIndex - 100);
    const contextEnd = Math.min(text.length, patternIndex + pattern.length + 100);
    const context = text.slice(contextStart, contextEnd);
    
    const relevanceScore = contextKeywords.reduce((score, keyword) => {
      return score + (context.toLowerCase().includes(keyword) ? 1 : 0);
    }, 0) / contextKeywords.length;
    
    return {
      text: context,
      relevanceScore,
      contextType
    };
  }
}

module.exports = AIPatternExtractor;
