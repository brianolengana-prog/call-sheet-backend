/**
 * Confidence Scoring System
 * 
 * Calculates confidence scores for extracted contacts
 */

class ConfidenceScorer {
  constructor() {
    this.scoringWeights = this.initializeScoringWeights();
    this.contextFactors = this.initializeContextFactors();
  }

  initializeScoringWeights() {
    return {
      email: 0.3,
      name: 0.25,
      phone: 0.2,
      role: 0.15,
      company: 0.1
    };
  }

  initializeContextFactors() {
    return {
      documentType: {
        call_sheet: 1.2,
        contact_list: 1.1,
        production_document: 1.0,
        resume: 0.9,
        business_card: 1.1,
        unknown: 0.8
      },
      productionType: {
        film: 1.1,
        television: 1.0,
        commercial: 1.0,
        corporate: 0.9,
        theatre: 1.0,
        unknown: 0.8
      }
    };
  }

  async scoreContacts(contacts, documentAnalysis) {
    console.log('📊 Starting confidence scoring...');
    
    const scoredContacts = contacts.map(contact => {
      const score = this.calculateConfidenceScore(contact, documentAnalysis);
      return {
        ...contact,
        confidence: score,
        confidenceLevel: this.getConfidenceLevel(score)
      };
    });
    
    console.log(`📊 Confidence scoring complete for ${scoredContacts.length} contacts`);
    return scoredContacts;
  }

  calculateConfidenceScore(contact, documentAnalysis) {
    let baseScore = 0;
    
    // Calculate base score from individual fields
    baseScore += this.scoreField(contact.email, 'email');
    baseScore += this.scoreField(contact.name, 'name');
    baseScore += this.scoreField(contact.phone, 'phone');
    baseScore += this.scoreField(contact.role, 'role');
    baseScore += this.scoreField(contact.company, 'company');
    
    // Apply context factors
    const documentFactor = this.contextFactors.documentType[documentAnalysis.type] || 1.0;
    const productionFactor = this.contextFactors.productionType[documentAnalysis.productionType] || 1.0;
    
    const adjustedScore = baseScore * documentFactor * productionFactor;
    
    // Apply additional scoring factors
    const finalScore = this.applyAdditionalFactors(adjustedScore, contact, documentAnalysis);
    
    return Math.min(Math.max(finalScore, 0), 1); // Clamp between 0 and 1
  }

  scoreField(value, fieldType) {
    if (!value || value === 'Unknown' || value === '') {
      return 0;
    }
    
    const weight = this.scoringWeights[fieldType] || 0;
    
    // Field-specific scoring
    switch (fieldType) {
      case 'email':
        return this.scoreEmail(value) * weight;
      case 'name':
        return this.scoreName(value) * weight;
      case 'phone':
        return this.scorePhone(value) * weight;
      case 'role':
        return this.scoreRole(value) * weight;
      case 'company':
        return this.scoreCompany(value) * weight;
      default:
        return weight;
    }
  }

  scoreEmail(email) {
    if (!email) return 0;
    
    let score = 0.5; // Base score
    
    // Check for common email patterns
    if (email.includes('@gmail.com')) score += 0.2;
    if (email.includes('@yahoo.com')) score += 0.2;
    if (email.includes('@outlook.com')) score += 0.2;
    if (email.includes('@hotmail.com')) score += 0.2;
    
    // Check for professional domains
    if (email.includes('@') && !email.includes('@gmail.com') && !email.includes('@yahoo.com')) {
      score += 0.3;
    }
    
    // Check for suspicious patterns
    if (email.includes('test') || email.includes('example')) score -= 0.3;
    
    return Math.min(score, 1);
  }

  scoreName(name) {
    if (!name || name === 'Unknown') return 0;
    
    let score = 0.5; // Base score
    
    // Check for proper capitalization
    const words = name.split(' ');
    if (words.every(word => word[0] === word[0].toUpperCase())) {
      score += 0.2;
    }
    
    // Check for reasonable length
    if (name.length >= 3 && name.length <= 50) {
      score += 0.2;
    }
    
    // Check for common names
    const commonNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Lisa', 'Chris', 'Amy'];
    if (commonNames.some(commonName => name.toLowerCase().includes(commonName.toLowerCase()))) {
      score += 0.1;
    }
    
    return Math.min(score, 1);
  }

  scorePhone(phone) {
    if (!phone) return 0;
    
    let score = 0.5; // Base score
    
    // Check for proper formatting
    if (phone.match(/^\(\d{3}\) \d{3}-\d{4}$/)) {
      score += 0.3;
    } else if (phone.match(/^\d{10}$/)) {
      score += 0.2;
    } else if (phone.match(/^\+1\d{10}$/)) {
      score += 0.2;
    }
    
    // Check for reasonable length
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) {
      score += 0.2;
    }
    
    return Math.min(score, 1);
  }

  scoreRole(role) {
    if (!role || role === 'Contact') return 0;
    
    let score = 0.5; // Base score
    
    // Check for production-specific roles
    const productionRoles = [
      'Director', 'Producer', 'Cinematographer', 'Editor', 'Sound',
      'Lighting', 'Grip', 'Electric', 'Camera', 'Audio', 'Wardrobe',
      'Makeup', 'Hair', 'Transportation', 'Catering'
    ];
    
    if (productionRoles.some(prodRole => role.toLowerCase().includes(prodRole.toLowerCase()))) {
      score += 0.3;
    }
    
    // Check for proper capitalization
    if (role[0] === role[0].toUpperCase()) {
      score += 0.2;
    }
    
    return Math.min(score, 1);
  }

  scoreCompany(company) {
    if (!company) return 0;
    
    let score = 0.5; // Base score
    
    // Check for common company suffixes
    const companySuffixes = ['Inc', 'LLC', 'Corp', 'Ltd', 'Company', 'Productions', 'Studios'];
    if (companySuffixes.some(suffix => company.includes(suffix))) {
      score += 0.2;
    }
    
    // Check for reasonable length
    if (company.length >= 2 && company.length <= 100) {
      score += 0.2;
    }
    
    // Check for proper capitalization
    if (company[0] === company[0].toUpperCase()) {
      score += 0.1;
    }
    
    return Math.min(score, 1);
  }

  applyAdditionalFactors(baseScore, contact, documentAnalysis) {
    let adjustedScore = baseScore;
    
    // Bonus for having multiple fields
    const fieldCount = [contact.email, contact.name, contact.phone, contact.role, contact.company]
      .filter(field => field && field !== 'Unknown' && field !== '').length;
    
    if (fieldCount >= 3) {
      adjustedScore += 0.1;
    }
    
    // Bonus for high-quality document types
    if (documentAnalysis.type === 'call_sheet' || documentAnalysis.type === 'contact_list') {
      adjustedScore += 0.1;
    }
    
    // Penalty for very low confidence
    if (adjustedScore < 0.2) {
      adjustedScore *= 0.5;
    }
    
    return adjustedScore;
  }

  getConfidenceLevel(score) {
    if (score >= 0.8) return 'high';
    if (score >= 0.6) return 'medium';
    if (score >= 0.4) return 'low';
    return 'very_low';
  }

  /**
   * Get confidence statistics
   */
  getConfidenceStats(contacts) {
    const stats = {
      totalContacts: contacts.length,
      averageConfidence: 0,
      confidenceDistribution: {
        high: 0,
        medium: 0,
        low: 0,
        very_low: 0
      },
      highConfidenceCount: 0,
      lowConfidenceCount: 0
    };

    let totalConfidence = 0;

    for (const contact of contacts) {
      const confidence = contact.confidence || 0;
      totalConfidence += confidence;
      
      const level = contact.confidenceLevel || 'very_low';
      stats.confidenceDistribution[level]++;
      
      if (confidence >= 0.8) {
        stats.highConfidenceCount++;
      } else if (confidence < 0.4) {
        stats.lowConfidenceCount++;
      }
    }

    stats.averageConfidence = contacts.length > 0 ? totalConfidence / contacts.length : 0;

    return stats;
  }
}

module.exports = ConfidenceScorer;
