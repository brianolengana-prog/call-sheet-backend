const { PrismaClient } = require('@prisma/client');

class PrismaService {
  constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });
  }

  /**
   * Initialize database connection with retry logic
   */
  async connect() {
    const maxRetries = 3;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        await this.prisma.$connect();
        console.log('✅ Prisma connected to database');
        return;
      } catch (error) {
        retries++;
        console.error(`❌ Prisma connection failed (attempt ${retries}/${maxRetries}):`, error.message);
        
        if (retries >= maxRetries) {
          console.error('❌ Max retries reached. Prisma connection failed permanently.');
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        const waitTime = Math.pow(2, retries) * 1000;
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
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
      if (!this.prisma) {
        return { status: 'unhealthy', error: 'Prisma client not initialized', timestamp: new Date().toISOString() };
      }
      
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
    try {
      // Ensure we don't pass an invalid id - let Prisma generate it
      const { id, ...userDataWithoutId } = userData;
      
      // Debug logging
      console.log('🔍 Creating user with data:', JSON.stringify(userDataWithoutId, null, 2));
      
      // Validate that no UUID fields are being passed incorrectly
      const allowedFields = [
        'email', 'name', 'passwordHash', 'provider', 'providerId', 
        'emailVerified', 'twoFactorEnabled', 'twoFactorSecret',
        'loginAttempts', 'lockedUntil', 'lastLoginAt'
      ];
      
      const filteredData = {};
      for (const [key, value] of Object.entries(userDataWithoutId)) {
        if (allowedFields.includes(key)) {
          // Additional validation for specific fields
          if (key === 'email' && typeof value === 'string') {
            filteredData[key] = value;
          } else if (key === 'name' && typeof value === 'string') {
            filteredData[key] = value;
          } else if (key === 'provider' && typeof value === 'string') {
            filteredData[key] = value;
          } else if (key === 'providerId' && typeof value === 'string') {
            filteredData[key] = value;
          } else if (key === 'emailVerified' && typeof value === 'boolean') {
            filteredData[key] = value;
          } else if (key === 'twoFactorEnabled' && typeof value === 'boolean') {
            filteredData[key] = value;
          } else if (key === 'passwordHash' && (typeof value === 'string' || value === null)) {
            filteredData[key] = value;
          } else if (key === 'twoFactorSecret' && (typeof value === 'string' || value === null)) {
            filteredData[key] = value;
          } else if (key === 'loginAttempts' && typeof value === 'number') {
            filteredData[key] = value;
          } else if (key === 'lockedUntil' && (value instanceof Date || value === null)) {
            filteredData[key] = value;
          } else if (key === 'lastLoginAt' && (value instanceof Date || value === null)) {
            filteredData[key] = value;
          } else {
            console.warn(`⚠️ Invalid field type for ${key}:`, typeof value, value);
          }
        } else {
          console.warn(`⚠️ Unexpected field in userData: ${key} = ${value}`);
        }
      }
      
      // Generate UUID in JavaScript to avoid database issues
      const crypto = require('crypto');
      const userId = crypto.randomUUID();
      
      console.log('🔍 Generated UUID for user:', userId);
      
      return await this.prisma.user.create({
        data: {
          ...filteredData,
          id: userId
        }
      });
    } catch (error) {
      console.error('❌ Error in createUser:', error);
      console.error('❌ userData that caused error:', JSON.stringify(userData, null, 2));
      throw error;
    }
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
    // Ensure a Profile exists for the provided userId to satisfy FK constraint
    if (jobData && jobData.userId) {
      await this.prisma.profile.upsert({
        where: { userId: jobData.userId },
        update: {},
        create: {
          userId: jobData.userId,
          // optional fields; keep minimal to satisfy FK
          avatarUrl: null
        }
      });
    }

    return await this.prisma.job.create({
      data: jobData
    });
  }

  /**
   * Get job by ID
   */
  async getJobById(id) {
    return await this.prisma.job.findUnique({
      where: { id },
      include: { contacts: true, profile: true, production: true }
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
      include: { contacts: true, profile: true, production: true }
    });
  }

  /**
   * Create contacts in chunks to avoid parameter limits
   */
  async createContactsInChunks(contactsData, chunkSize = 500) {
    if (!Array.isArray(contactsData) || contactsData.length === 0) return { count: 0 };
    let total = 0;
    for (let i = 0; i < contactsData.length; i += chunkSize) {
      const chunk = contactsData.slice(i, i + chunkSize);
      const res = await this.prisma.contact.createMany({ data: chunk });
      total += res.count || chunk.length;
    }
    return { count: total };
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
        where: { userId }
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
            aiMinutesLimit: plan?.aiProcessingMinutes || 60
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
      const month = usageData.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
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
   * Get user usage for a specific month
   */
  async getUserUsageForMonth(userId, month) {
    try {
      return await this.prisma.usage.findUnique({
        where: {
          userId_month: {
            userId: userId,
            month: month
          }
        }
      });
    } catch (error) {
      console.error('❌ Error getting user usage for month:', error);
      throw error;
    }
  }

  /**
   * Get all usage records for a specific month (admin)
   */
  async getAllUsageForMonth(month) {
    try {
      return await this.prisma.usage.findMany({
        where: {
          month: month
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });
    } catch (error) {
      console.error('❌ Error getting all usage for month:', error);
      throw error;
    }
  }

  // ========================================
  // STRIPE CUSTOMER METHODS
  // ========================================

  /**
   * Create or update Stripe customer
   */
  async createOrUpdateStripeCustomer(customerData) {
    try {
      return await this.prisma.stripeCustomer.upsert({
        where: {
          userId: customerData.userId
        },
        update: {
          stripeCustomerId: customerData.stripeCustomerId,
          email: customerData.email,
          name: customerData.name
        },
        create: {
          userId: customerData.userId,
          stripeCustomerId: customerData.stripeCustomerId,
          email: customerData.email,
          name: customerData.name
        }
      });
    } catch (error) {
      console.error('❌ Error creating/updating Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Get Stripe customer by user ID
   */
  async getStripeCustomerByUserId(userId) {
    try {
      if (!this.prisma) {
        console.error('❌ Prisma client is not initialized');
        throw new Error('Database connection not initialized');
      }
      
      // Check if stripeCustomer model exists
      if (this.prisma.stripeCustomer && this.prisma.stripeCustomer.findUnique) {
        return await this.prisma.stripeCustomer.findUnique({
          where: {
            userId: userId
          }
        });
      }
      
      // Fallback: get from subscriptions table
      console.log('⚠️ StripeCustomer model not available, falling back to subscriptions table');
      const subscription = await this.prisma.subscription.findFirst({
        where: { userId },
        select: { 
          stripeCustomerId: true,
          user: {
            select: { email: true, name: true }
          }
        }
      });
      
      if (!subscription?.stripeCustomerId) {
        return null;
      }
      
      return {
        userId,
        stripeCustomerId: subscription.stripeCustomerId,
        email: subscription.user?.email || null,
        name: subscription.user?.name || null
      };
    } catch (error) {
      console.error('❌ Error getting Stripe customer:', error);
      throw error;
    }
  }

  // ========================================
  // PLAN METHODS
  // ========================================

  /**
   * Create or update plan
   */
  async createOrUpdatePlan(planData) {
    try {
      return await this.prisma.plan.upsert({
        where: {
          id: planData.id
        },
        update: {
          name: planData.name,
          type: planData.type || 'starter',
          description: planData.description,
          price: planData.price,
          interval: planData.interval,
          stripeProductId: planData.stripeProductId,
          stripePriceId: planData.stripePriceId,
          uploadsPerMonth: planData.uploadsPerMonth,
          maxContacts: planData.maxContacts,
          storageGB: planData.storageGB,
          aiProcessingMinutes: planData.aiProcessingMinutes,
          apiCallsPerMonth: planData.apiCallsPerMonth,
          features: planData.features,
          popular: planData.popular,
          isActive: planData.isActive,
          sortOrder: planData.sortOrder
        },
        create: {
          id: planData.id,
          name: planData.name,
          type: planData.type || 'starter',
          description: planData.description,
          price: planData.price,
          interval: planData.interval,
          stripeProductId: planData.stripeProductId,
          stripePriceId: planData.stripePriceId,
          uploadsPerMonth: planData.uploadsPerMonth,
          maxContacts: planData.maxContacts,
          storageGB: planData.storageGB,
          aiProcessingMinutes: planData.aiProcessingMinutes,
          apiCallsPerMonth: planData.apiCallsPerMonth,
          features: planData.features,
          popular: planData.popular,
          isActive: planData.isActive,
          sortOrder: planData.sortOrder
        }
      });
    } catch (error) {
      console.error('❌ Error creating/updating plan:', error);
      throw error;
    }
  }

  /**
   * Get plan by Stripe price ID
   */
  async getPlanByStripePriceId(stripePriceId) {
    try {
      return await this.prisma.plan.findFirst({
        where: {
          stripePriceId: stripePriceId
        }
      });
    } catch (error) {
      console.error('❌ Error getting plan by Stripe price ID:', error);
      throw error;
    }
  }

  /**
   * Update plan
   */
  async updatePlan(planId, updateData) {
    try {
      return await this.prisma.plan.update({
        where: {
          id: planId
        },
        data: updateData
      });
    } catch (error) {
      console.error('❌ Error updating plan:', error);
      throw error;
    }
  }

  // ========================================
  // SUBSCRIPTION METHODS
  // ========================================

  /**
   * Create or update subscription
   */
  async createOrUpdateSubscription(subscriptionData) {
    try {
      return await this.prisma.subscription.upsert({
        where: {
          stripeSubscriptionId: subscriptionData.stripeSubscriptionId
        },
        update: {
          userId: subscriptionData.userId,
          planId: subscriptionData.planId,
          status: subscriptionData.status,
          currentPeriodStart: subscriptionData.currentPeriodStart,
          currentPeriodEnd: subscriptionData.currentPeriodEnd,
          cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd
        },
        create: {
          userId: subscriptionData.userId,
          planId: subscriptionData.planId,
          stripeCustomerId: subscriptionData.stripeCustomerId || '',
          stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
          status: subscriptionData.status,
          currentPeriodStart: subscriptionData.currentPeriodStart,
          currentPeriodEnd: subscriptionData.currentPeriodEnd,
          cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd
        }
      });
    } catch (error) {
      console.error('❌ Error creating/updating subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(stripeSubscriptionId, updateData) {
    try {
      return await this.prisma.subscription.update({
        where: {
          stripeSubscriptionId: stripeSubscriptionId
        },
        data: updateData
      });
    } catch (error) {
      console.error('❌ Error updating subscription:', error);
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
