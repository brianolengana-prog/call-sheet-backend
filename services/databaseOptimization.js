/**
 * Database Optimization Service
 * Implements database scaling and optimization strategies
 */

// Use the shared Prisma service instead of creating a new client
const prismaService = require('./prismaService');

class DatabaseOptimization {
  constructor() {
    this.prisma = prismaService.getClient();
    
    this.setupOptimizations();
  }

  /**
   * Setup database optimizations
   */
  setupOptimizations() {
    // Connection pooling
    this.connectionPool = {
      min: 5,
      max: 20,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200
    };

    // Query optimization
    this.queryOptimizations = {
      batchSize: 1000,
      timeout: 30000,
      retries: 3
    };
  }

  /**
   * Batch insert contacts for better performance
   */
  async batchInsertContacts(contacts, batchSize = 1000) {
    const batches = [];
    for (let i = 0; i < contacts.length; i += batchSize) {
      batches.push(contacts.slice(i, i + batchSize));
    }

    const results = [];
    for (const batch of batches) {
      try {
        const result = await this.prisma.contact.createMany({
          data: batch,
          skipDuplicates: true
        });
        results.push(result);
      } catch (error) {
        console.error('❌ Batch insert failed:', error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Optimized contact search with indexing
   */
  async searchContacts(userId, searchTerm, limit = 50) {
    return await this.prisma.contact.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { role: { contains: searchTerm, mode: 'insensitive' } },
          { company: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      take: limit,
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Paginated contact retrieval
   */
  async getContactsPaginated(userId, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    
    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.contact.count({
        where: { userId }
      })
    ]);

    return {
      contacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Database health check
   */
  async healthCheck() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, timestamp: new Date() };
    }
  }

  /**
   * Performance monitoring
   */
  async getPerformanceMetrics() {
    const metrics = await this.prisma.$metrics.json();
    return {
      connectionPool: this.connectionPool,
      queryMetrics: metrics,
      timestamp: new Date()
    };
  }
}

module.exports = new DatabaseOptimization();
