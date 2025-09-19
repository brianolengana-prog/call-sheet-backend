/**
 * Security Service
 * Handles security features like rate limiting, account lockout, and audit logging
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');

class SecurityService {
  constructor() {
    this.failedAttempts = new Map(); // In production, use Redis
    this.lockedAccounts = new Set(); // In production, use Redis
    this.auditLog = []; // In production, use database
    this.maxFailedAttempts = 5;
    this.lockoutDuration = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Hash password with bcrypt
   */
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate 2FA code
   */
  generate2FACode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Check if account is locked
   */
  isAccountLocked(email) {
    const lockInfo = this.lockedAccounts.get(email);
    if (!lockInfo) return false;
    
    if (Date.now() > lockInfo.expiresAt) {
      this.lockedAccounts.delete(email);
      this.failedAttempts.delete(email);
      return false;
    }
    
    return true;
  }

  /**
   * Record failed login attempt
   */
  recordFailedAttempt(email, ip, userAgent) {
    const now = Date.now();
    const attempts = this.failedAttempts.get(email) || [];
    
    attempts.push({
      timestamp: now,
      ip,
      userAgent
    });
    
    // Keep only recent attempts (last hour)
    const recentAttempts = attempts.filter(attempt => 
      now - attempt.timestamp < 60 * 60 * 1000
    );
    
    this.failedAttempts.set(email, recentAttempts);
    
    // Check if account should be locked
    if (recentAttempts.length >= this.maxFailedAttempts) {
      this.lockAccount(email);
      this.logSecurityEvent('ACCOUNT_LOCKED', email, {
        reason: 'Too many failed attempts',
        attempts: recentAttempts.length,
        ip,
        userAgent
      });
    }
    
    this.logSecurityEvent('FAILED_LOGIN', email, {
      attempts: recentAttempts.length,
      ip,
      userAgent
    });
  }

  /**
   * Lock account
   */
  lockAccount(email) {
    this.lockedAccounts.set(email, {
      lockedAt: Date.now(),
      expiresAt: Date.now() + this.lockoutDuration
    });
  }

  /**
   * Clear failed attempts (successful login)
   */
  clearFailedAttempts(email) {
    this.failedAttempts.delete(email);
    this.lockedAccounts.delete(email);
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password) {
    const errors = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    // Check for common passwords
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common, please choose a stronger password');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate email format
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generate device fingerprint
   */
  generateDeviceFingerprint(userAgent, ip) {
    const data = `${userAgent}-${ip}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Log security event
   */
  logSecurityEvent(eventType, email, details) {
    const logEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      eventType,
      email,
      details,
      severity: this.getEventSeverity(eventType)
    };
    
    this.auditLog.push(logEntry);
    
    // Keep only last 1000 entries in memory
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
    
    console.log(`🔒 Security Event: ${eventType} for ${email}`, details);
  }

  /**
   * Get event severity level
   */
  getEventSeverity(eventType) {
    const severityMap = {
      'LOGIN_SUCCESS': 'INFO',
      'LOGIN_FAILED': 'WARNING',
      'ACCOUNT_LOCKED': 'HIGH',
      'PASSWORD_RESET': 'MEDIUM',
      'EMAIL_VERIFIED': 'INFO',
      'SUSPICIOUS_ACTIVITY': 'HIGH',
      'ADMIN_ACTION': 'MEDIUM'
    };
    
    return severityMap[eventType] || 'INFO';
  }

  /**
   * Get security audit log
   */
  getAuditLog(email = null, limit = 100) {
    let logs = this.auditLog;
    
    if (email) {
      logs = logs.filter(log => log.email === email);
    }
    
    return logs
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Check for suspicious activity
   */
  detectSuspiciousActivity(email, ip, userAgent) {
    const recentLogs = this.auditLog.filter(log => 
      log.email === email && 
      new Date(log.timestamp) > new Date(Date.now() - 60 * 60 * 1000) // Last hour
    );
    
    const failedLogins = recentLogs.filter(log => log.eventType === 'LOGIN_FAILED');
    const differentIPs = new Set(recentLogs.map(log => log.details?.ip)).size;
    
    // Suspicious if more than 3 failed attempts or multiple IPs
    if (failedLogins.length > 3 || differentIPs > 2) {
      this.logSecurityEvent('SUSPICIOUS_ACTIVITY', email, {
        failedAttempts: failedLogins.length,
        differentIPs,
        currentIP: ip,
        userAgent
      });
      return true;
    }
    
    return false;
  }

  /**
   * Generate password reset token
   */
  generatePasswordResetToken() {
    return {
      token: this.generateSecureToken(32),
      expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
    };
  }

  /**
   * Generate email verification token
   */
  generateEmailVerificationToken() {
    return {
      token: this.generateSecureToken(32),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
  }
}

module.exports = new SecurityService();
