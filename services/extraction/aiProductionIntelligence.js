/**
 * AI-Powered Production Intelligence
 * 
 * Enhanced contact processing using industry knowledge, production context,
 * and intelligent contact enhancement for better accuracy and relevance
 */

// Optional AI dependencies
let natural;
try {
  natural = require('natural');
} catch (error) {
  console.warn('⚠️ Natural language processing library not available. AI features will be limited.');
  natural = null;
}

class AIProductionIntelligence {
  constructor() {
    // Initialize NLP tools (if available)
    if (natural) {
      this.tokenizer = new natural.WordTokenizer();
      this.stemmer = natural.PorterStemmer;
    } else {
      // Fallback implementations
      this.tokenizer = { tokenize: (text) => text.split(/\s+/) };
      this.stemmer = { stem: (word) => word };
    }
    
    // Production industry knowledge base
    this.industryKnowledge = this.initializeIndustryKnowledge();
    
    // Contact enhancement rules
    this.enhancementRules = this.initializeEnhancementRules();
    
    // Production context analyzer
    this.contextAnalyzer = new ProductionContextAnalyzer();
  }

  /**
   * Initialize industry knowledge base
   */
  initializeIndustryKnowledge() {
    return {
      roles: {
        'above_the_line': {
          roles: ['Director', 'Producer', 'Executive Producer', 'Line Producer', 'Associate Producer', 'Co-Producer'],
          hierarchy: ['Executive Producer', 'Producer', 'Line Producer', 'Associate Producer', 'Co-Producer'],
          departments: ['Production'],
          typicalContacts: ['email', 'phone', 'assistant']
        },
        'camera': {
          roles: ['Cinematographer', 'Director of Photography', 'DP', 'Camera Operator', 'First AC', 'Second AC', 'Camera Assistant', 'Steadicam Operator'],
          hierarchy: ['Cinematographer', 'Director of Photography', 'Camera Operator', 'First AC', 'Second AC'],
          departments: ['Camera'],
          typicalContacts: ['email', 'phone', 'camera_rental']
        },
        'sound': {
          roles: ['Sound Mixer', 'Boom Operator', 'Sound Designer', 'Composer', 'Music Supervisor', 'Audio Engineer'],
          hierarchy: ['Sound Mixer', 'Boom Operator', 'Audio Engineer'],
          departments: ['Sound', 'Music'],
          typicalContacts: ['email', 'phone', 'equipment_rental']
        },
        'lighting': {
          roles: ['Gaffer', 'Best Boy Electric', 'Electrician', 'Lighting Designer', 'Key Grip', 'Grip'],
          hierarchy: ['Gaffer', 'Best Boy Electric', 'Electrician'],
          departments: ['Lighting', 'Grip'],
          typicalContacts: ['email', 'phone', 'equipment_rental']
        },
        'art': {
          roles: ['Production Designer', 'Art Director', 'Set Decorator', 'Props Master', 'Costume Designer', 'Wardrobe Supervisor'],
          hierarchy: ['Production Designer', 'Art Director', 'Set Decorator', 'Props Master'],
          departments: ['Art Department', 'Wardrobe'],
          typicalContacts: ['email', 'phone', 'vendor']
        },
        'post_production': {
          roles: ['Editor', 'Assistant Editor', 'Post Production Supervisor', 'Colorist', 'Sound Editor', 'VFX Supervisor'],
          hierarchy: ['Editor', 'Assistant Editor', 'Post Production Supervisor'],
          departments: ['Post Production'],
          typicalContacts: ['email', 'phone', 'facility']
        },
        'production': {
          roles: ['First AD', 'Second AD', 'Script Supervisor', 'Continuity', 'Production Coordinator', 'Location Manager'],
          hierarchy: ['First AD', 'Second AD', 'Script Supervisor', 'Production Coordinator'],
          departments: ['Production'],
          typicalContacts: ['email', 'phone', 'location']
        }
      },
      departments: {
        'Production': {
          description: 'Overall production management and coordination',
          typicalRoles: ['Producer', 'Director', 'First AD', 'Production Coordinator'],
          hierarchy: ['Producer', 'Director', 'First AD', 'Production Coordinator']
        },
        'Camera': {
          description: 'Camera and cinematography department',
          typicalRoles: ['Cinematographer', 'Camera Operator', 'First AC', 'Second AC'],
          hierarchy: ['Cinematographer', 'Camera Operator', 'First AC', 'Second AC']
        },
        'Sound': {
          description: 'Audio recording and sound design',
          typicalRoles: ['Sound Mixer', 'Boom Operator', 'Sound Designer'],
          hierarchy: ['Sound Mixer', 'Boom Operator']
        },
        'Lighting': {
          description: 'Lighting and electrical department',
          typicalRoles: ['Gaffer', 'Best Boy Electric', 'Electrician'],
          hierarchy: ['Gaffer', 'Best Boy Electric', 'Electrician']
        },
        'Art Department': {
          description: 'Production design and visual elements',
          typicalRoles: ['Production Designer', 'Art Director', 'Set Decorator'],
          hierarchy: ['Production Designer', 'Art Director', 'Set Decorator']
        },
        'Post Production': {
          description: 'Editing and post-production services',
          typicalRoles: ['Editor', 'Assistant Editor', 'Colorist'],
          hierarchy: ['Editor', 'Assistant Editor']
        }
      },
      productionTypes: {
        'film': {
          typicalRoles: ['Director', 'Producer', 'Cinematographer', 'Editor', 'Sound Mixer'],
          budgetRanges: ['low', 'medium', 'high'],
          typicalDuration: 'weeks to months',
          keyContacts: ['Director', 'Producer', 'Cinematographer']
        },
        'television': {
          typicalRoles: ['Showrunner', 'Executive Producer', 'Director', 'Producer'],
          budgetRanges: ['medium', 'high'],
          typicalDuration: 'episodes to seasons',
          keyContacts: ['Showrunner', 'Executive Producer']
        },
        'commercial': {
          typicalRoles: ['Director', 'Producer', 'Cinematographer', 'Client'],
          budgetRanges: ['low', 'medium'],
          typicalDuration: 'days to weeks',
          keyContacts: ['Director', 'Producer', 'Client']
        },
        'corporate': {
          typicalRoles: ['Producer', 'Director', 'Client', 'Account Manager'],
          budgetRanges: ['low', 'medium'],
          typicalDuration: 'days to weeks',
          keyContacts: ['Producer', 'Client']
        }
      }
    };
  }

  /**
   * Initialize enhancement rules
   */
  initializeEnhancementRules() {
    return {
      roleEnhancement: {
        // Enhance role titles based on context
        'Director': {
          aliases: ['Dir', 'Director', 'Film Director', 'TV Director'],
          department: 'Production',
          hierarchy: 'above_the_line'
        },
        'Producer': {
          aliases: ['Prod', 'Producer', 'Line Producer', 'Executive Producer'],
          department: 'Production',
          hierarchy: 'above_the_line'
        },
        'Cinematographer': {
          aliases: ['DP', 'Director of Photography', 'Cinematographer', 'Camera'],
          department: 'Camera',
          hierarchy: 'camera'
        }
      },
      contactEnhancement: {
        // Add missing information based on role
        'Director': {
          typicalContacts: ['email', 'phone', 'assistant'],
          commonCompanies: ['Production Company', 'Studio', 'Agency']
        },
        'Producer': {
          typicalContacts: ['email', 'phone', 'assistant'],
          commonCompanies: ['Production Company', 'Studio', 'Network']
        },
        'Cinematographer': {
          typicalContacts: ['email', 'phone', 'camera_rental'],
          commonCompanies: ['Camera Rental', 'Production Company']
        }
      },
      validationRules: {
        // Validate contacts based on role expectations
        'Director': {
          requiredFields: ['name', 'email'],
          optionalFields: ['phone', 'company', 'assistant'],
          minConfidence: 0.7
        },
        'Producer': {
          requiredFields: ['name', 'email'],
          optionalFields: ['phone', 'company', 'assistant'],
          minConfidence: 0.7
        },
        'Cinematographer': {
          requiredFields: ['name', 'email'],
          optionalFields: ['phone', 'company', 'equipment'],
          minConfidence: 0.6
        }
      }
    };
  }

  /**
   * Enhanced contact processing with AI
   * @param {Array} contacts - Raw contacts
   * @param {Object} documentAnalysis - Document analysis result
   * @param {Object} options - Processing options
   * @returns {Array} Enhanced contacts
   */
  async processContacts(contacts, documentAnalysis, options = {}) {
    console.log('🧠 Starting AI production intelligence processing...');
    
    try {
      // Step 1: Analyze production context
      const productionContext = await this.analyzeProductionContext(documentAnalysis, options);
      
      // Step 2: Enhance contacts with industry knowledge
      const enhancedContacts = await this.enhanceContactsWithIndustryKnowledge(contacts, productionContext);
      
      // Step 3: Apply production-specific validation
      const validatedContacts = await this.applyProductionValidation(enhancedContacts, productionContext);
      
      // Step 4: Add intelligent contact suggestions
      const suggestedContacts = await this.generateContactSuggestions(validatedContacts, productionContext);
      
      // Step 5: Apply confidence scoring based on production context
      const scoredContacts = await this.applyProductionConfidenceScoring(validatedContacts, productionContext);
      
      console.log(`✅ AI production intelligence complete: ${scoredContacts.length} enhanced contacts`);
      
      return scoredContacts;
      
    } catch (error) {
      console.error('❌ AI production intelligence failed:', error);
      return contacts; // Return original contacts if enhancement fails
    }
  }

  /**
   * Analyze production context
   */
  async analyzeProductionContext(documentAnalysis, options) {
    const context = {
      documentType: documentAnalysis.type,
      productionType: documentAnalysis.productionType,
      estimatedBudget: this.estimateBudget(documentAnalysis, options),
      productionStage: this.determineProductionStage(documentAnalysis, options),
      keyDepartments: this.identifyKeyDepartments(documentAnalysis, options),
      missingRoles: [],
      suggestedRoles: []
    };
    
    // Analyze what roles are typically needed for this production type
    if (this.industryKnowledge.productionTypes[context.productionType]) {
      const typicalRoles = this.industryKnowledge.productionTypes[context.productionType].typicalRoles;
      context.suggestedRoles = typicalRoles;
    }
    
    return context;
  }

  /**
   * Estimate budget based on document analysis
   */
  estimateBudget(documentAnalysis, options) {
    // Simple budget estimation based on document type and content
    if (documentAnalysis.type === 'call_sheet') {
      return 'medium'; // Call sheets typically indicate active production
    } else if (documentAnalysis.type === 'budget') {
      return 'high'; // Budget documents indicate larger productions
    } else if (documentAnalysis.type === 'contact_list') {
      return 'low'; // Simple contact lists often indicate smaller productions
    }
    
    return 'unknown';
  }

  /**
   * Determine production stage
   */
  determineProductionStage(documentAnalysis, options) {
    if (documentAnalysis.type === 'call_sheet') {
      return 'production';
    } else if (documentAnalysis.type === 'budget') {
      return 'pre_production';
    } else if (documentAnalysis.type === 'contact_list') {
      return 'pre_production';
    }
    
    return 'unknown';
  }

  /**
   * Identify key departments
   */
  identifyKeyDepartments(documentAnalysis, options) {
    const departments = [];
    
    if (documentAnalysis.type === 'call_sheet') {
      departments.push('Production', 'Camera', 'Sound', 'Lighting');
    } else if (documentAnalysis.type === 'contact_list') {
      departments.push('Production', 'Camera', 'Sound');
    }
    
    return departments;
  }

  /**
   * Enhance contacts with industry knowledge
   */
  async enhanceContactsWithIndustryKnowledge(contacts, productionContext) {
    return contacts.map(contact => {
      const enhancedContact = { ...contact };
      
      // Enhance role information
      if (contact.role) {
        const roleEnhancement = this.enhanceRole(contact.role, productionContext);
        enhancedContact.role = roleEnhancement.enhancedRole;
        enhancedContact.department = roleEnhancement.department;
        enhancedContact.hierarchy = roleEnhancement.hierarchy;
      }
      
      // Add production context
      enhancedContact.productionContext = {
        documentType: productionContext.documentType,
        productionType: productionContext.productionType,
        estimatedBudget: productionContext.estimatedBudget,
        productionStage: productionContext.productionStage
      };
      
      // Add industry-specific metadata
      enhancedContact.industryMetadata = this.generateIndustryMetadata(enhancedContact, productionContext);
      
      return enhancedContact;
    });
  }

  /**
   * Enhance role information
   */
  enhanceRole(role, productionContext) {
    const roleLower = role.toLowerCase();
    
    // Find matching role in industry knowledge
    for (const [category, categoryData] of Object.entries(this.industryKnowledge.roles)) {
      const matchingRole = categoryData.roles.find(r => 
        r.toLowerCase().includes(roleLower) || roleLower.includes(r.toLowerCase())
      );
      
      if (matchingRole) {
        return {
          enhancedRole: matchingRole,
          department: categoryData.departments[0],
          hierarchy: category
        };
      }
    }
    
    // Default enhancement
    return {
      enhancedRole: role,
      department: 'Production',
      hierarchy: 'unknown'
    };
  }

  /**
   * Generate industry-specific metadata
   */
  generateIndustryMetadata(contact, productionContext) {
    const metadata = {
      roleCategory: contact.hierarchy || 'unknown',
      department: contact.department || 'unknown',
      productionRelevance: this.calculateProductionRelevance(contact, productionContext),
      typicalResponsibilities: this.getTypicalResponsibilities(contact.role),
      commonContacts: this.getCommonContacts(contact.role)
    };
    
    return metadata;
  }

  /**
   * Calculate production relevance
   */
  calculateProductionRelevance(contact, productionContext) {
    let relevance = 0.5; // Base relevance
    
    // Boost relevance for key roles
    if (contact.role && this.isKeyRole(contact.role, productionContext)) {
      relevance += 0.3;
    }
    
    // Boost relevance for complete contact information
    if (contact.email && contact.phone) {
      relevance += 0.2;
    }
    
    return Math.min(relevance, 1.0);
  }

  /**
   * Check if role is key for production
   */
  isKeyRole(role, productionContext) {
    const keyRoles = ['Director', 'Producer', 'Cinematographer', 'Editor', 'Sound Mixer'];
    return keyRoles.some(keyRole => 
      role.toLowerCase().includes(keyRole.toLowerCase())
    );
  }

  /**
   * Get typical responsibilities for a role
   */
  getTypicalResponsibilities(role) {
    const responsibilities = {
      'Director': ['Creative vision', 'Actor direction', 'Shot composition', 'Overall production oversight'],
      'Producer': ['Budget management', 'Schedule coordination', 'Crew management', 'Client relations'],
      'Cinematographer': ['Visual composition', 'Camera operation', 'Lighting design', 'Technical quality'],
      'Editor': ['Post-production', 'Story assembly', 'Color correction', 'Sound mixing'],
      'Sound Mixer': ['Audio recording', 'Sound quality', 'Equipment management', 'Technical audio']
    };
    
    return responsibilities[role] || ['Role-specific responsibilities'];
  }

  /**
   * Get common contacts for a role
   */
  getCommonContacts(role) {
    const commonContacts = {
      'Director': ['Assistant Director', 'Script Supervisor', 'Producer'],
      'Producer': ['Line Producer', 'Production Coordinator', 'Client'],
      'Cinematographer': ['Camera Operator', 'Gaffer', 'First AC'],
      'Editor': ['Assistant Editor', 'Post Production Supervisor', 'Director'],
      'Sound Mixer': ['Boom Operator', 'Sound Designer', 'Producer']
    };
    
    return commonContacts[role] || [];
  }

  /**
   * Apply production-specific validation
   */
  async applyProductionValidation(contacts, productionContext) {
    return contacts.filter(contact => {
      // Apply role-specific validation
      if (contact.role && this.enhancementRules.validationRules[contact.role]) {
        const rules = this.enhancementRules.validationRules[contact.role];
        
        // Check required fields
        for (const field of rules.requiredFields) {
          if (!contact[field]) {
            return false;
          }
        }
        
        // Check minimum confidence
        if (contact.confidence < rules.minConfidence) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Generate contact suggestions
   */
  async generateContactSuggestions(contacts, productionContext) {
    const suggestions = [];
    
    // Find missing key roles
    const existingRoles = contacts.map(c => c.role).filter(Boolean);
    const missingRoles = productionContext.suggestedRoles.filter(role => 
      !existingRoles.some(existing => 
        existing.toLowerCase().includes(role.toLowerCase()) || 
        role.toLowerCase().includes(existing.toLowerCase())
      )
    );
    
    // Generate suggestions for missing roles
    for (const role of missingRoles) {
      suggestions.push({
        type: 'missing_role',
        role: role,
        department: this.getDepartmentForRole(role),
        priority: this.getRolePriority(role, productionContext),
        suggestion: `Consider adding a ${role} to your contact list`
      });
    }
    
    return suggestions;
  }

  /**
   * Get department for role
   */
  getDepartmentForRole(role) {
    for (const [category, categoryData] of Object.entries(this.industryKnowledge.roles)) {
      if (categoryData.roles.includes(role)) {
        return categoryData.departments[0];
      }
    }
    
    return 'Production';
  }

  /**
   * Get role priority
   */
  getRolePriority(role, productionContext) {
    const highPriorityRoles = ['Director', 'Producer', 'Cinematographer'];
    const mediumPriorityRoles = ['Editor', 'Sound Mixer', 'First AD'];
    
    if (highPriorityRoles.includes(role)) return 'high';
    if (mediumPriorityRoles.includes(role)) return 'medium';
    return 'low';
  }

  /**
   * Apply production confidence scoring
   */
  async applyProductionConfidenceScoring(contacts, productionContext) {
    return contacts.map(contact => {
      let confidence = contact.confidence || 0.5;
      
      // Boost confidence for production-relevant roles
      if (contact.role && this.isProductionRelevant(contact.role, productionContext)) {
        confidence += 0.1;
      }
      
      // Boost confidence for complete contact information
      if (contact.email && contact.phone && contact.name) {
        confidence += 0.1;
      }
      
      // Boost confidence for industry-standard roles
      if (contact.role && this.isIndustryStandard(contact.role)) {
        confidence += 0.1;
      }
      
      // Apply production type specific scoring
      if (productionContext.productionType === 'film' && contact.role === 'Director') {
        confidence += 0.1;
      }
      
      if (productionContext.productionType === 'television' && contact.role === 'Showrunner') {
        confidence += 0.1;
      }
      
      return {
        ...contact,
        confidence: Math.min(confidence, 1.0)
      };
    });
  }

  /**
   * Check if role is production relevant
   */
  isProductionRelevant(role, productionContext) {
    const relevantRoles = [
      'Director', 'Producer', 'Cinematographer', 'Editor', 'Sound Mixer',
      'Gaffer', 'First AD', 'Script Supervisor', 'Production Coordinator'
    ];
    
    return relevantRoles.some(relevantRole => 
      role.toLowerCase().includes(relevantRole.toLowerCase())
    );
  }

  /**
   * Check if role is industry standard
   */
  isIndustryStandard(role) {
    const standardRoles = [
      'Director', 'Producer', 'Cinematographer', 'Editor', 'Sound Mixer',
      'Gaffer', 'First AD', 'Script Supervisor', 'Production Coordinator',
      'Camera Operator', 'Boom Operator', 'Electrician', 'Grip'
    ];
    
    return standardRoles.some(standardRole => 
      role.toLowerCase().includes(standardRole.toLowerCase())
    );
  }
}

/**
 * Production Context Analyzer
 */
class ProductionContextAnalyzer {
  constructor() {
    this.contextPatterns = {
      preProduction: ['budget', 'schedule', 'planning', 'prep', 'development'],
      production: ['shooting', 'filming', 'recording', 'call sheet', 'day'],
      postProduction: ['editing', 'post', 'color', 'sound', 'finishing']
    };
  }

  /**
   * Analyze production context from text
   */
  analyzeContext(text, documentType) {
    const lowerText = text.toLowerCase();
    const context = {
      stage: 'unknown',
      departments: [],
      roles: [],
      confidence: 0
    };
    
    // Determine production stage
    for (const [stage, patterns] of Object.entries(this.contextPatterns)) {
      const matches = patterns.filter(pattern => lowerText.includes(pattern)).length;
      if (matches > 0) {
        context.stage = stage;
        context.confidence += 0.3;
      }
    }
    
    return context;
  }
}

module.exports = AIProductionIntelligence;
