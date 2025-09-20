const { PrismaClient } = require('@prisma/client');

class PrismaService {
  constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  /**
   * Initialize database connection
   */
  async connect() {
    try {
      await this.prisma.$connect();
      console.log('✅ Prisma connected to database');
    } catch (error) {
      console.error('❌ Prisma connection failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    try {
      await this.prisma.$disconnect();
      console.log('✅ Prisma disconnected from database');
    } catch (error) {
      console.error('❌ Prisma disconnection failed:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }

  /**
   * Get Prisma client instance
   */
  getClient() {
    return this.prisma;
  }

  // ========================================
  // USER MANAGEMENT METHODS
  // ========================================

  /**
   * Create user
   */
  async createUser(userData) {
    return await this.prisma.user.create({
      data: userData
    });
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    return await this.prisma.user.findUnique({
      where: { email }
    });
  }

  /**
   * Get user by ID
   */
  async getUserById(id) {
    return await this.prisma.user.findUnique({
      where: { id }
    });
  }

  /**
   * Get user by provider
   */
  async getUserByProvider(provider, providerId) {
    return await this.prisma.user.findFirst({
      where: {
        provider,
        providerId
      }
    });
  }

  /**
   * Update user
   */
  async updateUser(id, data) {
    return await this.prisma.user.update({
      where: { id },
      data
    });
  }

  /**
   * Delete user
   */
  async deleteUser(id) {
    return await this.prisma.user.delete({
      where: { id }
    });
  }

  // ========================================
  // AUTHENTICATION TOKENS
  // ========================================

  /**
   * Create password reset token
   */
  async createPasswordResetToken(userId, token, expiresAt) {
    return await this.prisma.passwordResetToken.create({
      data: {
        userId,
        token,
        expiresAt
      }
    });
  }

  /**
   * Get password reset token
   */
  async getPasswordResetToken(token) {
    return await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: {
        user: true
      }
    });
  }

  /**
   * Mark password reset token as used
   */
  async markPasswordResetTokenAsUsed(token) {
    return await this.prisma.passwordResetToken.update({
      where: { token },
      data: { used: true }
    });
  }

  /**
   * Create email verification token
   */
  async createEmailVerificationToken(userId, token, expiresAt) {
    return await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        token,
        expiresAt
      }
    });
  }

  /**
   * Get email verification token
   */
  async getEmailVerificationToken(token) {
    return await this.prisma.emailVerificationToken.findUnique({
      where: { token },
      include: {
        user: true
      }
    });
  }

  /**
   * Mark email verification token as used
   */
  async markEmailVerificationTokenAsUsed(token) {
    return await this.prisma.emailVerificationToken.update({
      where: { token },
      data: { used: true }
    });
  }

  /**
   * Create two-factor code
   */
  async createTwoFactorCode(userId, code, expiresAt) {
    return await this.prisma.twoFactorCode.create({
      data: {
        userId,
        code,
        expiresAt
      }
    });
  }

  /**
   * Get two-factor code
   */
  async getTwoFactorCode(userId, code) {
    return await this.prisma.twoFactorCode.findFirst({
      where: {
        userId,
        code,
        used: false,
        expiresAt: {
          gt: new Date()
        }
      }
    });
  }

  /**
   * Mark two-factor code as used
   */
  async markTwoFactorCodeAsUsed(userId, code) {
    return await this.prisma.twoFactorCode.updateMany({
      where: {
        userId,
        code
      },
      data: { used: true }
    });
  }

  // ========================================
  // SESSIONS
  // ========================================

  /**
   * Create session
   */
  async createSession(sessionData) {
    return await this.prisma.session.create({
      data: sessionData
    });
  }

  /**
   * Get session by access token
   */
  async getSessionByAccessToken(accessToken) {
    return await this.prisma.session.findUnique({
      where: { accessToken },
      include: {
        user: true
      }
    });
  }

  /**
   * Get session by refresh token
   */
  async getSessionByRefreshToken(refreshToken) {
    return await this.prisma.session.findUnique({
      where: { refreshToken },
      include: {
        user: true
      }
    });
  }

  /**
   * Update session
   */
  async updateSession(id, data) {
    return await this.prisma.session.update({
      where: { id },
      data
    });
  }

  /**
   * Delete session
   */
  async deleteSession(id) {
    return await this.prisma.session.delete({
      where: { id }
    });
  }

  /**
   * Delete all user sessions
   */
  async deleteAllUserSessions(userId) {
    return await this.prisma.session.deleteMany({
      where: { userId }
    });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    return await this.prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
  }

  // ========================================
  // SECURITY AUDIT
  // ========================================

  /**
   * Log security event
   */
  async logSecurityEvent(eventData) {
    return await this.prisma.securityAuditLog.create({
      data: eventData
    });
  }

  /**
   * Get security audit log for user
   */
  async getSecurityAuditLog(userId, limit = 50) {
    return await this.prisma.securityAuditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers() {
    return await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  // ========================================
  // CORE FUNCTIONALITY - JOBS
  // ========================================

  /**
   * Create job
   */
  async createJob(jobData) {
    return await this.prisma.job.create({
      data: jobData,
      include: {
        user: true,
        contacts: true
      }
    });
  }

  /**
   * Get job by ID
   */
  async getJobById(id) {
    return await this.prisma.job.findUnique({
      where: { id },
      include: {
        user: true,
        contacts: true
      }
    });
  }

  /**
   * Get user jobs
   */
  async getUserJobs(userId, limit = 20, offset = 0) {
    return await this.prisma.job.findMany({
      where: { userId },
      include: {
        contacts: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  /**
   * Update job
   */
  async updateJob(id, data) {
    return await this.prisma.job.update({
      where: { id },
      data,
      include: {
        user: true,
        contacts: true
      }
    });
  }

  /**
   * Delete job
   */
  async deleteJob(id) {
    return await this.prisma.job.delete({
      where: { id }
    });
  }

  // ========================================
  // CORE FUNCTIONALITY - CONTACTS
  // ========================================

  /**
   * Create contact
   */
  async createContact(contactData) {
    return await this.prisma.contact.create({
      data: contactData
    });
  }

  /**
   * Create multiple contacts
   */
  async createContacts(contactsData) {
    return await this.prisma.contact.createMany({
      data: contactsData
    });
  }

  /**
   * Get contacts by job ID
   */
  async getContactsByJobId(jobId) {
    return await this.prisma.contact.findMany({
      where: { jobId },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Update contact
   */
  async updateContact(id, data) {
    return await this.prisma.contact.update({
      where: { id },
      data
    });
  }

  /**
   * Delete contact
   */
  async deleteContact(id) {
    return await this.prisma.contact.delete({
      where: { id }
    });
  }

  /**
   * Delete contacts by job ID
   */
  async deleteContactsByJobId(jobId) {
    return await this.prisma.contact.deleteMany({
      where: { jobId }
    });
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens() {
    const now = new Date();
    
    await Promise.all([
      this.prisma.passwordResetToken.deleteMany({
        where: {
          expiresAt: { lt: now },
          used: false
        }
      }),
      this.prisma.emailVerificationToken.deleteMany({
        where: {
          expiresAt: { lt: now },
          used: false
        }
      }),
      this.prisma.twoFactorCode.deleteMany({
        where: {
          expiresAt: { lt: now },
          used: false
        }
      })
    ]);
  }

  /**
   * Get database statistics
   */
  async getStats() {
    const [
      userCount,
      jobCount,
      contactCount,
      activeSessions
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.job.count(),
      this.prisma.contact.count(),
      this.prisma.session.count({
        where: {
          isActive: true,
          expiresAt: { gt: new Date() }
        }
      })
    ]);

    return {
      users: userCount,
      jobs: jobCount,
      contacts: contactCount,
      activeSessions
    };
  }
}

// Export singleton instance
module.exports = new PrismaService();
