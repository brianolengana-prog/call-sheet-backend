/**
 * Production Intelligence Layer
 * 
 * Industry-specific contact processing and enhancement
 */

class ProductionIntelligence {
  constructor() {
    this.roleHierarchy = this.initializeRoleHierarchy();
    this.departmentMapping = this.initializeDepartmentMapping();
    this.productionKeywords = this.initializeProductionKeywords();
  }

  initializeRoleHierarchy() {
    return {
      'Director': { level: 1, department: 'Creative', priority: 'high' },
      'Producer': { level: 1, department: 'Production', priority: 'high' },
      'Executive Producer': { level: 1, department: 'Production', priority: 'high' },
      'Line Producer': { level: 2, department: 'Production', priority: 'high' },
      'Assistant Director': { level: 2, department: 'Production', priority: 'high' },
      'First AD': { level: 2, department: 'Production', priority: 'high' },
      'Second AD': { level: 3, department: 'Production', priority: 'medium' },
      'Cinematographer': { level: 2, department: 'Technical', priority: 'high' },
      'Director of Photography': { level: 2, department: 'Technical', priority: 'high' },
      'Camera Operator': { level: 3, department: 'Technical', priority: 'medium' },
      'Editor': { level: 2, department: 'Technical', priority: 'high' },
      'Sound Mixer': { level: 3, department: 'Technical', priority: 'medium' },
      'Boom Operator': { level: 4, department: 'Technical', priority: 'low' },
      'Gaffer': { level: 3, department: 'Technical', priority: 'medium' },
      'Key Grip': { level: 3, department: 'Technical', priority: 'medium' },
      'Wardrobe': { level: 4, department: 'Creative', priority: 'low' },
      'Makeup': { level: 4, department: 'Creative', priority: 'low' },
      'Hair': { level: 4, department: 'Creative', priority: 'low' },
      'Transportation': { level: 4, department: 'Administrative', priority: 'low' },
      'Catering': { level: 4, department: 'Administrative', priority: 'low' }
    };
  }

  initializeDepartmentMapping() {
    return {
      'Creative': ['Director', 'Producer', 'Writer', 'Actor', 'Actress', 'Talent', 'Wardrobe', 'Makeup', 'Hair'],
      'Technical': ['Cinematographer', 'Editor', 'Sound', 'Lighting', 'Grip', 'Electric', 'Camera', 'Audio'],
      'Production': ['Producer', 'Line Producer', 'Assistant Director', 'Coordinator', 'Manager'],
      'Administrative': ['Transportation', 'Catering', 'Office', 'Finance', 'Marketing']
    };
  }

  initializeProductionKeywords() {
    return {
      film: ['feature', 'movie', 'cinema', 'theatrical', 'festival', 'director', 'cinematographer'],
      television: ['tv', 'series', 'episode', 'season', 'broadcast', 'network', 'cable'],
      commercial: ['ad', 'advertisement', 'brand', 'marketing', 'agency', 'client', 'campaign'],
      corporate: ['business', 'company', 'office', 'meeting', 'presentation', 'conference'],
      theatre: ['stage', 'play', 'musical', 'performance', 'broadway', 'regional']
    };
  }

  async processContacts(contacts, documentAnalysis, options = {}) {
    console.log('🎬 Starting production intelligence processing...');
    
    let processedContacts = [...contacts];
    
    // Apply role hierarchy and department mapping
    processedContacts = this.applyRoleHierarchy(processedContacts);
    
    // Enhance with production context
    processedContacts = this.enhanceWithProductionContext(processedContacts, documentAnalysis);
    
    // Apply user preferences
    if (options.rolePreferences && options.rolePreferences.length > 0) {
      processedContacts = this.applyRolePreferences(processedContacts, options.rolePreferences);
    }
    
    // Sort by priority and importance
    processedContacts = this.sortByPriority(processedContacts);
    
    // Add production-specific metadata
    processedContacts = this.addProductionMetadata(processedContacts, documentAnalysis);
    
    console.log(`🎬 Production processing complete: ${processedContacts.length} contacts`);
    return processedContacts;
  }

  applyRoleHierarchy(contacts) {
    return contacts.map(contact => {
      const role = contact.role;
      const roleInfo = this.roleHierarchy[role];
      
      if (roleInfo) {
        contact.department = roleInfo.department;
        contact.priority = roleInfo.priority;
        contact.hierarchyLevel = roleInfo.level;
      } else {
        // Try to match partial role names
        const matchedRole = this.findMatchingRole(role);
        if (matchedRole) {
          const roleInfo = this.roleHierarchy[matchedRole];
          contact.role = matchedRole;
          contact.department = roleInfo.department;
          contact.priority = roleInfo.priority;
          contact.hierarchyLevel = roleInfo.level;
        } else {
          contact.department = 'Unknown';
          contact.priority = 'low';
          contact.hierarchyLevel = 5;
        }
      }
      
      return contact;
    });
  }

  findMatchingRole(role) {
    const lowerRole = role.toLowerCase();
    
    for (const [key, value] of Object.entries(this.roleHierarchy)) {
      if (key.toLowerCase().includes(lowerRole) || lowerRole.includes(key.toLowerCase())) {
        return key;
      }
    }
    
    return null;
  }

  enhanceWithProductionContext(contacts, documentAnalysis) {
    return contacts.map(contact => {
      // Add production type context
      contact.productionType = documentAnalysis.productionType;
      
      // Add document type context
      contact.documentType = documentAnalysis.type;
      
      // Enhance company information
      if (!contact.company && contact.department) {
        contact.company = this.inferCompanyFromDepartment(contact.department, documentAnalysis);
      }
      
      // Add production-specific notes
      if (documentAnalysis.type === 'call_sheet') {
        contact.notes = `Call Sheet Contact - ${contact.role}`;
      }
      
      return contact;
    });
  }

  inferCompanyFromDepartment(department, documentAnalysis) {
    const companyMappings = {
      'Creative': 'Production Company',
      'Technical': 'Technical Services',
      'Production': 'Production Company',
      'Administrative': 'Support Services'
    };
    
    return companyMappings[department] || 'Production Company';
  }

  applyRolePreferences(contacts, rolePreferences) {
    const preferredRoles = rolePreferences.map(role => role.toLowerCase());
    
    return contacts.map(contact => {
      const contactRole = contact.role.toLowerCase();
      const isPreferred = preferredRoles.some(pref => 
        contactRole.includes(pref) || pref.includes(contactRole)
      );
      
      if (isPreferred) {
        contact.priority = 'high';
        contact.isPreferred = true;
      }
      
      return contact;
    });
  }

  sortByPriority(contacts) {
    const priorityOrder = { 'high': 1, 'medium': 2, 'low': 3 };
    
    return contacts.sort((a, b) => {
      // First sort by priority
      const priorityDiff = (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by hierarchy level
      const hierarchyDiff = (a.hierarchyLevel || 5) - (b.hierarchyLevel || 5);
      if (hierarchyDiff !== 0) return hierarchyDiff;
      
      // Then by confidence
      return (b.confidence || 0) - (a.confidence || 0);
    });
  }

  addProductionMetadata(contacts, documentAnalysis) {
    return contacts.map(contact => {
      contact.metadata = {
        extractedAt: new Date().toISOString(),
        documentType: documentAnalysis.type,
        productionType: documentAnalysis.productionType,
        extractionMethod: 'custom',
        confidence: contact.confidence || 0.5,
        priority: contact.priority || 'low',
        hierarchyLevel: contact.hierarchyLevel || 5
      };
      
      return contact;
    });
  }

  /**
   * Get production statistics
   */
  getProductionStats(contacts) {
    const stats = {
      totalContacts: contacts.length,
      byDepartment: {},
      byPriority: {},
      byRole: {},
      highPriorityCount: 0,
      averageConfidence: 0
    };
    
    let totalConfidence = 0;
    
    for (const contact of contacts) {
      // Count by department
      const dept = contact.department || 'Unknown';
      stats.byDepartment[dept] = (stats.byDepartment[dept] || 0) + 1;
      
      // Count by priority
      const priority = contact.priority || 'low';
      stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
      
      // Count by role
      const role = contact.role || 'Unknown';
      stats.byRole[role] = (stats.byRole[role] || 0) + 1;
      
      // Count high priority
      if (priority === 'high') {
        stats.highPriorityCount++;
      }
      
      // Sum confidence
      totalConfidence += contact.confidence || 0;
    }
    
    stats.averageConfidence = contacts.length > 0 ? totalConfidence / contacts.length : 0;
    
    return stats;
  }
}

module.exports = ProductionIntelligence;
