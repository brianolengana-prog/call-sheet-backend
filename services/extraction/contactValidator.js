/**
 * Contact Validation and Quality Control
 * 
 * Validates extracted contacts and ensures data quality
 */

class ContactValidator {
  constructor() {
    this.validationRules = this.initializeValidationRules();
    this.qualityThresholds = this.initializeQualityThresholds();
  }

  initializeValidationRules() {
    return {
      email: {
        pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        required: false,
        weight: 0.3
      },
      phone: {
        pattern: /^[\+]?[\d\s\-\(\)]{10,}$/,
        required: false,
        weight: 0.2
      },
      name: {
        pattern: /^[A-Za-z\s:.,-]+$/,
        required: true,
        weight: 0.3
      },
      role: {
        pattern: /^[A-Za-z\s]+$/,
        required: false,
        weight: 0.1
      },
      company: {
        pattern: /^[A-Za-z0-9\s&.,-]+$/,
        required: false,
        weight: 0.1
      }
    };
  }

  initializeQualityThresholds() {
    return {
      minimumScore: 0.3,
      highQualityScore: 0.8,
      mediumQualityScore: 0.6,
      lowQualityScore: 0.4
    };
  }

  async validateContacts(contacts) {
    console.log('✅ Starting contact validation...');
    
    const validatedContacts = [];
    
    for (const contact of contacts) {
      const validation = this.validateContact(contact);
      
      if (validation.isValid) {
        validatedContacts.push({
          ...contact,
          validation: validation,
          qualityScore: validation.score
        });
      } else {
        console.log(`⚠️ Invalid contact filtered out: ${contact.name} - ${validation.reasons.join(', ')}`);
      }
    }
    
    console.log(`✅ Validation complete: ${validatedContacts.length}/${contacts.length} contacts valid`);
    return validatedContacts;
  }

  validateContact(contact) {
    const validation = {
      isValid: true,
      score: 0,
      reasons: [],
      warnings: []
    };

    // Validate email
    if (contact.email) {
      if (this.validationRules.email.pattern.test(contact.email)) {
        validation.score += this.validationRules.email.weight;
      } else {
        validation.reasons.push('Invalid email format');
        validation.isValid = false;
      }
    }

    // Validate phone
    if (contact.phone) {
      if (this.validationRules.phone.pattern.test(contact.phone)) {
        validation.score += this.validationRules.phone.weight;
      } else {
        validation.warnings.push('Invalid phone format');
      }
    }

    // Validate name
    if (contact.name && contact.name !== 'Unknown') {
      if (this.validationRules.name.pattern.test(contact.name)) {
        validation.score += this.validationRules.name.weight;
      } else {
        validation.reasons.push('Invalid name format');
        validation.isValid = false;
      }
    } else if (this.validationRules.name.required) {
      validation.reasons.push('Name is required');
      validation.isValid = false;
    }

    // Validate role
    if (contact.role) {
      if (this.validationRules.role.pattern.test(contact.role)) {
        validation.score += this.validationRules.role.weight;
      } else {
        validation.warnings.push('Invalid role format');
      }
    }

    // Validate company
    if (contact.company) {
      if (this.validationRules.company.pattern.test(contact.company)) {
        validation.score += this.validationRules.company.weight;
      } else {
        validation.warnings.push('Invalid company format');
      }
    }

    // Check minimum score
    if (validation.score < this.qualityThresholds.minimumScore) {
      validation.reasons.push('Quality score too low');
      validation.isValid = false;
    }

    // Add quality level
    validation.qualityLevel = this.getQualityLevel(validation.score);

    return validation;
  }

  getQualityLevel(score) {
    if (score >= this.qualityThresholds.highQualityScore) {
      return 'high';
    } else if (score >= this.qualityThresholds.mediumQualityScore) {
      return 'medium';
    } else if (score >= this.qualityThresholds.lowQualityScore) {
      return 'low';
    } else {
      return 'very_low';
    }
  }

  /**
   * Clean and normalize contact data
   */
  cleanContactData(contact) {
    const cleaned = { ...contact };

    // Clean email
    if (cleaned.email) {
      cleaned.email = cleaned.email.toLowerCase().trim();
    }

    // Clean name
    if (cleaned.name) {
      cleaned.name = this.cleanName(cleaned.name);
    }

    // Clean phone
    if (cleaned.phone) {
      cleaned.phone = this.cleanPhone(cleaned.phone);
    }

    // Clean role
    if (cleaned.role) {
      cleaned.role = this.cleanRole(cleaned.role);
    }

    // Clean company
    if (cleaned.company) {
      cleaned.company = this.cleanCompany(cleaned.company);
    }

    return cleaned;
  }

  cleanName(name) {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  cleanPhone(phone) {
    return phone
      .replace(/\D/g, '')
      .replace(/^1/, '')
      .replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  }

  cleanRole(role) {
    return role
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  cleanCompany(company) {
    return company
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s&.,-]/g, '');
  }

  /**
   * Get validation statistics
   */
  getValidationStats(contacts) {
    const stats = {
      totalContacts: contacts.length,
      validContacts: 0,
      invalidContacts: 0,
      qualityDistribution: {
        high: 0,
        medium: 0,
        low: 0,
        very_low: 0
      },
      averageScore: 0,
      commonIssues: {}
    };

    let totalScore = 0;

    for (const contact of contacts) {
      if (contact.validation) {
        if (contact.validation.isValid) {
          stats.validContacts++;
        } else {
          stats.invalidContacts++;
        }

        stats.qualityDistribution[contact.validation.qualityLevel]++;
        totalScore += contact.validation.score;

        // Track common issues
        for (const reason of contact.validation.reasons) {
          stats.commonIssues[reason] = (stats.commonIssues[reason] || 0) + 1;
        }
      }
    }

    stats.averageScore = contacts.length > 0 ? totalScore / contacts.length : 0;

    return stats;
  }
}

module.exports = ContactValidator;
