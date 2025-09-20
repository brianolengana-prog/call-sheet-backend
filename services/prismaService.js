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

  // ========================================
  // SUBSCRIPTION METHODS
  // ========================================

  /**
   * Get all plans
   */
  async getPlans() {
    try {
      return await this.prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { price: 'asc' }
      });
    } catch (error) {
      console.error('❌ Error getting plans:', error);
      throw error;
    }
  }

  /**
   * Get plan by ID
   */
  async getPlanById(planId) {
    try {
      return await this.prisma.plan.findUnique({
        where: { id: planId }
      });
    } catch (error) {
      console.error('❌ Error getting plan by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new plan
   */
  async createPlan(planData) {
    try {
      return await this.prisma.plan.create({
        data: planData
      });
    } catch (error) {
      console.error('❌ Error creating plan:', error);
      throw error;
    }
  }

  /**
   * Get user's subscription
   */
  async getUserSubscription(userId) {
    try {
      return await this.prisma.subscription.findFirst({
        where: { userId },
        include: { user: true }
      });
    } catch (error) {
      console.error('❌ Error getting user subscription:', error);
      throw error;
    }
  }

  /**
   * Create a new subscription
   */
  async createSubscription(subscriptionData) {
    try {
      return await this.prisma.subscription.create({
        data: subscriptionData,
        include: { user: true }
      });
    } catch (error) {
      console.error('❌ Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(subscriptionId, updateData) {
    try {
      return await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: updateData,
        include: { user: true }
      });
    } catch (error) {
      console.error('❌ Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Get user's current usage
   */
  async getUserUsage(userId) {
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      let usage = await this.prisma.usage.findUnique({
        where: {
          userId_month: {
            userId,
            month
          }
        }
      });

      // If no usage record exists, create one
      if (!usage) {
        const subscription = await this.getUserSubscription(userId);
        const plan = subscription ? await this.getPlanById(subscription.planId) : null;
        
        usage = await this.prisma.usage.create({
          data: {
            userId,
            subscriptionId: subscription?.id,
            month,
            uploadsLimit: plan?.uploadsPerMonth || 1,
            storageLimitGB: plan?.storageGB || 1,
            aiMinutesLimit: plan?.aiProcessingMinutes || 60,
            apiCallsLimit: plan?.apiCallsPerMonth || 100
          }
        });
      }

      return usage;
    } catch (error) {
      console.error('❌ Error getting user usage:', error);
      throw error;
    }
  }

  /**
   * Update user usage
   */
  async updateUserUsage(userId, usageData) {
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      return await this.prisma.usage.upsert({
        where: {
          userId_month: {
            userId,
            month
          }
        },
        update: usageData,
        create: {
          userId,
          month,
          ...usageData
        }
      });
    } catch (error) {
      console.error('❌ Error updating user usage:', error);
      throw error;
    }
  }

  /**
   * Increment usage counter
   */
  async incrementUsage(userId, field, amount = 1) {
    try {
      const usage = await this.getUserUsage(userId);
      
      const updateData = {};
      updateData[field] = usage[field] + amount;
      
      return await this.updateUserUsage(userId, updateData);
    } catch (error) {
      console.error('❌ Error incrementing usage:', error);
      throw error;
    }
  }

  /**
   * Check if user can perform action
   */
  async canPerformAction(userId, action) {
    try {
      const usage = await this.getUserUsage(userId);
      const subscription = await this.getUserSubscription(userId);
      
      if (!subscription) {
        return { canPerform: false, reason: 'No active subscription' };
      }
      
      const plan = await this.getPlanById(subscription.planId);
      
      switch (action) {
        case 'upload':
          return {
            canPerform: usage.uploadsUsed < usage.uploadsLimit,
            reason: usage.uploadsUsed >= usage.uploadsLimit ? 'Upload limit reached' : ''
          };
        case 'ai_processing':
          return {
            canPerform: usage.aiMinutesUsed < usage.aiMinutesLimit,
            reason: usage.aiMinutesUsed >= usage.aiMinutesLimit ? 'AI processing limit reached' : ''
          };
        case 'api_call':
          return {
            canPerform: usage.apiCalls < plan.apiCallsPerMonth,
            reason: usage.apiCalls >= plan.apiCallsPerMonth ? 'API call limit reached' : ''
          };
        default:
          return { canPerform: false, reason: 'Unknown action' };
      }
    } catch (error) {
      console.error('❌ Error checking action permission:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new PrismaService();
