/**
 * Monitoring Service
 * 
 * Comprehensive monitoring and alerting system for AI processing
 * Tracks performance metrics, resource usage, and system health
 */

const os = require('os');
const fs = require('fs').promises;
const path = require('path');

class MonitoringService {
  constructor() {
    this.metrics = {
      system: {
        uptime: 0,
        memoryUsage: {},
        cpuUsage: 0,
        diskUsage: {},
        loadAverage: []
      },
      ai: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageProcessingTime: 0,
        totalProcessingTime: 0,
        queueStats: {},
        cacheStats: {}
      },
      api: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        totalResponseTime: 0,
        rateLimitHits: 0
      },
      alerts: []
    };

    this.thresholds = {
      memoryUsage: 80, // 80%
      cpuUsage: 80, // 80%
      diskUsage: 90, // 90%
      responseTime: 5000, // 5 seconds
      errorRate: 10, // 10%
      queueBacklog: 100 // 100 jobs
    };

    this.alertHistory = [];
    this.isMonitoring = false;
    this.monitoringInterval = null;

    this.initializeMonitoring();
  }

  /**
   * Initialize monitoring system
   */
  async initializeMonitoring() {
    console.log('🔍 Initializing monitoring service...');
    
    // Start system monitoring
    this.startSystemMonitoring();
    
    // Setup alert handlers
    this.setupAlertHandlers();
    
    console.log('✅ Monitoring service initialized');
  }

  /**
   * Start system monitoring
   */
  startSystemMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      await this.collectSystemMetrics();
      await this.checkThresholds();
    }, 5000); // Check every 5 seconds

    console.log('📊 System monitoring started');
  }

  /**
   * Stop system monitoring
   */
  stopSystemMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    console.log('⏹️ System monitoring stopped');
  }

  /**
   * Collect system metrics
   */
  async collectSystemMetrics() {
    try {
      // System uptime
      this.metrics.system.uptime = process.uptime();
      
      // Memory usage
      const memUsage = process.memoryUsage();
      this.metrics.system.memoryUsage = {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers
      };
      
      // CPU usage (simplified)
      this.metrics.system.cpuUsage = await this.getCPUUsage();
      
      // Load average
      this.metrics.system.loadAverage = os.loadavg();
      
      // Disk usage
      this.metrics.system.diskUsage = await this.getDiskUsage();
      
    } catch (error) {
      console.error('❌ Error collecting system metrics:', error);
    }
  }

  /**
   * Get CPU usage percentage
   * @returns {Promise<number>} CPU usage percentage
   */
  async getCPUUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const cpuUsage = (endUsage.user + endUsage.system) / 1000000; // Convert to seconds
        resolve(Math.min(100, cpuUsage * 100));
      }, 100);
    });
  }

  /**
   * Get disk usage
   * @returns {Promise<Object>} Disk usage information
   */
  async getDiskUsage() {
    try {
      const stats = await fs.statfs('/');
      const total = stats.bavail + stats.blocks;
      const used = stats.blocks - stats.bavail;
      const free = stats.bavail;
      
      return {
        total: total * stats.bsize,
        used: used * stats.bsize,
        free: free * stats.bsize,
        percentage: Math.round((used / total) * 100)
      };
    } catch (error) {
      // Fallback for Windows or if statfs is not available
      return {
        total: 0,
        used: 0,
        free: 0,
        percentage: 0
      };
    }
  }

  /**
   * Update AI metrics
   * @param {Object} metrics - AI metrics to update
   */
  updateAIMetrics(metrics) {
    this.metrics.ai = { ...this.metrics.ai, ...metrics };
    
    // Calculate success rate
    if (this.metrics.ai.totalRequests > 0) {
      this.metrics.ai.successRate = 
        (this.metrics.ai.successfulRequests / this.metrics.ai.totalRequests) * 100;
    }
    
    // Calculate average processing time
    if (this.metrics.ai.successfulRequests > 0) {
      this.metrics.ai.averageProcessingTime = 
        this.metrics.ai.totalProcessingTime / this.metrics.ai.successfulRequests;
    }
  }

  /**
   * Update API metrics
   * @param {Object} metrics - API metrics to update
   */
  updateAPIMetrics(metrics) {
    this.metrics.api = { ...this.metrics.api, ...metrics };
    
    // Calculate success rate
    if (this.metrics.api.totalRequests > 0) {
      this.metrics.api.successRate = 
        (this.metrics.api.successfulRequests / this.metrics.api.totalRequests) * 100;
    }
    
    // Calculate average response time
    if (this.metrics.api.successfulRequests > 0) {
      this.metrics.api.averageResponseTime = 
        this.metrics.api.totalResponseTime / this.metrics.api.successfulRequests;
    }
  }

  /**
   * Update queue statistics
   * @param {Object} queueStats - Queue statistics
   */
  updateQueueStats(queueStats) {
    this.metrics.ai.queueStats = queueStats;
  }

  /**
   * Update cache statistics
   * @param {Object} cacheStats - Cache statistics
   */
  updateCacheStats(cacheStats) {
    this.metrics.ai.cacheStats = cacheStats;
  }

  /**
   * Check system thresholds and generate alerts
   */
  async checkThresholds() {
    const alerts = [];
    
    // Memory usage check
    const memoryUsage = (this.metrics.system.memoryUsage.heapUsed / this.metrics.system.memoryUsage.heapTotal) * 100;
    if (memoryUsage > this.thresholds.memoryUsage) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: `High memory usage: ${memoryUsage.toFixed(2)}%`,
        value: memoryUsage,
        threshold: this.thresholds.memoryUsage,
        timestamp: new Date().toISOString()
      });
    }
    
    // CPU usage check
    if (this.metrics.system.cpuUsage > this.thresholds.cpuUsage) {
      alerts.push({
        type: 'cpu',
        severity: 'warning',
        message: `High CPU usage: ${this.metrics.system.cpuUsage.toFixed(2)}%`,
        value: this.metrics.system.cpuUsage,
        threshold: this.thresholds.cpuUsage,
        timestamp: new Date().toISOString()
      });
    }
    
    // Disk usage check
    if (this.metrics.system.diskUsage.percentage > this.thresholds.diskUsage) {
      alerts.push({
        type: 'disk',
        severity: 'critical',
        message: `High disk usage: ${this.metrics.system.diskUsage.percentage}%`,
        value: this.metrics.system.diskUsage.percentage,
        threshold: this.thresholds.diskUsage,
        timestamp: new Date().toISOString()
      });
    }
    
    // API response time check
    if (this.metrics.api.averageResponseTime > this.thresholds.responseTime) {
      alerts.push({
        type: 'response_time',
        severity: 'warning',
        message: `High API response time: ${this.metrics.api.averageResponseTime.toFixed(2)}ms`,
        value: this.metrics.api.averageResponseTime,
        threshold: this.thresholds.responseTime,
        timestamp: new Date().toISOString()
      });
    }
    
    // AI error rate check
    if (this.metrics.ai.totalRequests > 0) {
      const errorRate = ((this.metrics.ai.totalRequests - this.metrics.ai.successfulRequests) / this.metrics.ai.totalRequests) * 100;
      if (errorRate > this.thresholds.errorRate) {
        alerts.push({
          type: 'error_rate',
          severity: 'critical',
          message: `High AI error rate: ${errorRate.toFixed(2)}%`,
          value: errorRate,
          threshold: this.thresholds.errorRate,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Queue backlog check
    if (this.metrics.ai.queueStats) {
      const totalBacklog = Object.values(this.metrics.ai.queueStats).reduce((sum, queue) => 
        sum + (queue.waiting || 0), 0);
      
      if (totalBacklog > this.thresholds.queueBacklog) {
        alerts.push({
          type: 'queue_backlog',
          severity: 'warning',
          message: `High queue backlog: ${totalBacklog} jobs`,
          value: totalBacklog,
          threshold: this.thresholds.queueBacklog,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Process alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  /**
   * Process an alert
   * @param {Object} alert - Alert object
   */
  async processAlert(alert) {
    // Add to alert history
    this.alertHistory.push(alert);
    
    // Keep only last 1000 alerts
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }
    
    // Log alert
    const logLevel = alert.severity === 'critical' ? 'error' : 'warn';
    console[logLevel](`🚨 Alert: ${alert.message}`);
    
    // Store in metrics
    this.metrics.alerts.push(alert);
    
    // Keep only last 100 alerts in metrics
    if (this.metrics.alerts.length > 100) {
      this.metrics.alerts = this.metrics.alerts.slice(-100);
    }
  }

  /**
   * Setup alert handlers
   */
  setupAlertHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.processAlert({
        type: 'uncaught_exception',
        severity: 'critical',
        message: `Uncaught exception: ${error.message}`,
        error: error.stack,
        timestamp: new Date().toISOString()
      });
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.processAlert({
        type: 'unhandled_rejection',
        severity: 'critical',
        message: `Unhandled promise rejection: ${reason}`,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Get comprehensive metrics
   * @returns {Object} All metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      thresholds: this.thresholds,
      isMonitoring: this.isMonitoring,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get system health status
   * @returns {Object} Health status
   */
  getHealthStatus() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      system: {
        uptime: this.metrics.system.uptime,
        memoryUsage: this.metrics.system.memoryUsage,
        cpuUsage: this.metrics.system.cpuUsage,
        diskUsage: this.metrics.system.diskUsage
      },
      ai: {
        totalRequests: this.metrics.ai.totalRequests,
        successRate: this.metrics.ai.successRate || 0,
        averageProcessingTime: this.metrics.ai.averageProcessingTime
      },
      api: {
        totalRequests: this.metrics.api.totalRequests,
        successRate: this.metrics.api.successRate || 0,
        averageResponseTime: this.metrics.api.averageResponseTime
      },
      alerts: this.metrics.alerts.length,
      recentAlerts: this.metrics.alerts.slice(-5)
    };
    
    // Determine overall health status
    const criticalAlerts = this.metrics.alerts.filter(alert => alert.severity === 'critical');
    if (criticalAlerts.length > 0) {
      health.status = 'critical';
    } else if (this.metrics.alerts.length > 10) {
      health.status = 'warning';
    }
    
    return health;
  }

  /**
   * Get alert history
   * @param {number} limit - Number of alerts to return
   * @returns {Array} Alert history
   */
  getAlertHistory(limit = 100) {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Clear alert history
   */
  clearAlertHistory() {
    this.alertHistory = [];
    this.metrics.alerts = [];
    console.log('✅ Alert history cleared');
  }

  /**
   * Update thresholds
   * @param {Object} newThresholds - New threshold values
   */
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('✅ Monitoring thresholds updated');
  }

  /**
   * Stop monitoring service
   */
  stop() {
    this.stopSystemMonitoring();
    console.log('✅ Monitoring service stopped');
  }
}

module.exports = MonitoringService;
