/**
 * Authentication and security event logging service
 */

const fs = require('fs').promises;
const path = require('path');

class AuthLogger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.ensureLogDirectory();
  }

  async ensureLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * Get log file path for a specific date
   */
  getLogFilePath(type = 'auth') {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `${type}-${date}.log`);
  }

  /**
   * Write log entry to file
   */
  async writeLogEntry(type, entry) {
    try {
      const logFile = this.getLogFilePath(type);
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${JSON.stringify(entry)}\n`;
      
      await fs.appendFile(logFile, logEntry);
    } catch (error) {
      console.error('Failed to write log entry:', error);
    }
  }

  /**
   * Log authentication attempt
   */
  async logAuthAttempt(success, details) {
    const entry = {
      event: 'auth_attempt',
      success,
      ip: details.ip,
      userAgent: details.userAgent,
      email: details.email,
      userId: details.userId,
      path: details.path,
      method: details.method,
      duration: details.duration,
      errorType: details.errorType,
      fingerprint: details.fingerprint
    };

    await this.writeLogEntry('auth', entry);
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Auth ${success ? 'SUCCESS' : 'FAILURE'}:`, entry);
    }
  }

  /**
   * Log session events
   */
  async logSessionEvent(event, details) {
    const entry = {
      event: `session_${event}`,
      sessionId: details.sessionId,
      userId: details.userId,
      ip: details.ip,
      userAgent: details.userAgent,
      fingerprint: details.fingerprint,
      metadata: details.metadata
    };

    await this.writeLogEntry('session', entry);
  }

  /**
   * Log authorization failures
   */
  async logAuthorizationFailure(details) {
    const entry = {
      event: 'authorization_failure',
      userId: details.userId,
      userEmail: details.userEmail,
      userRole: details.userRole,
      requiredRole: details.requiredRole,
      requiredPermissions: details.requiredPermissions,
      path: details.path,
      method: details.method,
      ip: details.ip,
      userAgent: details.userAgent
    };

    await this.writeLogEntry('security', entry);
    
    // High-priority security events should be logged to console
    console.warn('AUTHORIZATION FAILURE:', entry);
  }

  /**
   * Log security incidents
   */
  async logSecurityIncident(type, details) {
    const entry = {
      event: 'security_incident',
      incidentType: type,
      severity: details.severity || 'medium',
      ip: details.ip,
      userAgent: details.userAgent,
      path: details.path,
      method: details.method,
      userId: details.userId,
      description: details.description,
      metadata: details.metadata
    };

    await this.writeLogEntry('security', entry);
    
    // High-severity incidents should trigger alerts
    if (details.severity === 'high') {
      console.error('HIGH SEVERITY SECURITY INCIDENT:', entry);
      // In production, you might want to send alerts here
      await this.sendSecurityAlert(entry);
    }
  }

  /**
   * Log rate limiting events
   */
  async logRateLimit(details) {
    const entry = {
      event: 'rate_limit_exceeded',
      ip: details.ip,
      userAgent: details.userAgent,
      path: details.path,
      method: details.method,
      userId: details.userId,
      attemptCount: details.attemptCount,
      windowMs: details.windowMs
    };

    await this.writeLogEntry('rate_limit', entry);
  }

  /**
   * Send security alerts (placeholder for production implementation)
   */
  async sendSecurityAlert(incident) {
    // In production, implement actual alerting:
    // - Email notifications
    // - Slack/Discord webhooks
    // - SMS alerts
    // - Integration with security monitoring tools
    
    console.error('SECURITY ALERT - Implement notification system:', incident);
  }

  /**
   * Generate security report for a date range
   */
  async generateSecurityReport(startDate, endDate) {
    try {
      const report = {
        period: { startDate, endDate },
        authAttempts: { total: 0, successful: 0, failed: 0 },
        securityIncidents: [],
        rateLimitEvents: 0,
        topFailureReasons: {},
        suspiciousIPs: new Set(),
        generatedAt: new Date().toISOString()
      };

      // Read log files for the date range
      const start = new Date(startDate);
      const end = new Date(endDate);
      const current = new Date(start);

      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        
        try {
          // Process auth logs
          const authLogPath = path.join(this.logDir, `auth-${dateStr}.log`);
          const authContent = await fs.readFile(authLogPath, 'utf8');
          const authLines = authContent.trim().split('\n').filter(line => line);
          
          for (const line of authLines) {
            try {
              const entry = JSON.parse(line.split('] ')[1]);
              report.authAttempts.total++;
              
              if (entry.success) {
                report.authAttempts.successful++;
              } else {
                report.authAttempts.failed++;
                report.topFailureReasons[entry.errorType] = 
                  (report.topFailureReasons[entry.errorType] || 0) + 1;
                report.suspiciousIPs.add(entry.ip);
              }
            } catch (e) {
              // Skip malformed entries
            }
          }
          
          // Process security logs
          const securityLogPath = path.join(this.logDir, `security-${dateStr}.log`);
          const securityContent = await fs.readFile(securityLogPath, 'utf8');
          const securityLines = securityContent.trim().split('\n').filter(line => line);
          
          for (const line of securityLines) {
            try {
              const entry = JSON.parse(line.split('] ')[1]);
              if (entry.event === 'security_incident') {
                report.securityIncidents.push(entry);
              }
            } catch (e) {
              // Skip malformed entries
            }
          }
          
        } catch (error) {
          // Log file doesn't exist for this date, skip
        }
        
        current.setDate(current.getDate() + 1);
      }

      report.suspiciousIPs = Array.from(report.suspiciousIPs);
      
      return report;
    } catch (error) {
      console.error('Failed to generate security report:', error);
      throw error;
    }
  }

  /**
   * Clean up old log files
   */
  async cleanupOldLogs(retentionDays = 90) {
    try {
      const files = await fs.readdir(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      for (const file of files) {
        const match = file.match(/^(auth|security|session|rate_limit)-(\d{4}-\d{2}-\d{2})\.log$/);
        if (match) {
          const fileDate = new Date(match[2]);
          if (fileDate < cutoffDate) {
            await fs.unlink(path.join(this.logDir, file));
            console.log(`Cleaned up old log file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }
}

// Create singleton instance
const authLogger = new AuthLogger();

module.exports = authLogger;
