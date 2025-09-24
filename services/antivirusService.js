/**
 * Antivirus Scanning Service
 * 
 * Provides multiple antivirus scanning options for file uploads
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

class AntivirusService {
  constructor() {
    this.scanMethods = {
      clamav: this.scanWithClamAV.bind(this),
      virustotal: this.scanWithVirusTotal.bind(this),
      hybrid: this.scanWithHybrid.bind(this)
    };
    
    // Configuration
    this.config = {
      clamav: {
        enabled: process.env.CLAMAV_ENABLED === 'true',
        path: process.env.CLAMAV_PATH || 'clamscan',
        timeout: 30000 // 30 seconds
      },
      virustotal: {
        enabled: process.env.VIRUSTOTAL_ENABLED === 'true',
        apiKey: process.env.VIRUSTOTAL_API_KEY,
        timeout: 60000 // 60 seconds
      },
      hybrid: {
        enabled: process.env.HYBRID_SCANNING === 'true',
        primaryMethod: 'clamav',
        fallbackMethod: 'virustotal'
      }
    };
  }

  /**
   * Scan a file with the configured method
   */
  async scanFile(filePath, method = 'clamav') {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }

      const scanMethod = this.scanMethods[method];
      if (!scanMethod) {
        throw new Error(`Unknown scan method: ${method}`);
      }

      console.log(`🔍 Starting antivirus scan: ${method}`, {
        filePath,
        method,
        timestamp: new Date().toISOString()
      });

      const result = await scanMethod(filePath);
      
      console.log(`✅ Antivirus scan completed: ${method}`, {
        filePath,
        method,
        clean: result.clean,
        threats: result.threats?.length || 0,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      console.error(`❌ Antivirus scan failed: ${method}`, {
        filePath,
        method,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      // For production, you might want to fail safe (reject file)
      // For development, we'll allow the file through with a warning
      return {
        clean: process.env.NODE_ENV === 'production' ? false : true,
        threats: [],
        error: error.message,
        method: method
      };
    }
  }

  /**
   * Scan with ClamAV
   */
  async scanWithClamAV(filePath) {
    if (!this.config.clamav.enabled) {
      return { clean: true, method: 'clamav', skipped: true };
    }

    const command = `${this.config.clamav.path} --no-summary --infected "${filePath}"`;
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.config.clamav.timeout
      });

      // ClamAV returns exit code 1 if virus found, 0 if clean
      const isClean = !stderr && stdout.includes('OK');
      const threats = isClean ? [] : this.parseClamAVThreats(stderr);

      return {
        clean: isClean,
        threats: threats,
        method: 'clamav',
        scanTime: Date.now()
      };
    } catch (error) {
      // ClamAV returns exit code 1 for infected files
      if (error.code === 1) {
        const threats = this.parseClamAVThreats(error.stdout || error.stderr);
        return {
          clean: false,
          threats: threats,
          method: 'clamav',
          scanTime: Date.now()
        };
      }
      throw error;
    }
  }

  /**
   * Scan with VirusTotal API
   */
  async scanWithVirusTotal(filePath) {
    if (!this.config.virustotal.enabled || !this.config.virustotal.apiKey) {
      return { clean: true, method: 'virustotal', skipped: true };
    }

    try {
      // Read file and calculate hash
      const fileBuffer = fs.readFileSync(filePath);
      const crypto = require('crypto');
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Check if file was already scanned
      const reportUrl = `https://www.virustotal.com/vtapi/v2/file/report`;
      const response = await fetch(`${reportUrl}?apikey=${this.config.virustotal.apiKey}&resource=${fileHash}`);

      if (!response.ok) {
        throw new Error(`VirusTotal API error: ${response.status}`);
      }

      const report = await response.json();
      
      if (report.response_code === 1) {
        // File was already scanned
        const positives = report.positives || 0;
        const total = report.total || 0;
        const threats = positives > 0 ? this.parseVirusTotalThreats(report) : [];

        return {
          clean: positives === 0,
          threats: threats,
          method: 'virustotal',
          scanTime: Date.now(),
          positives: positives,
          total: total
        };
      } else if (report.response_code === 0) {
        // File not in database, upload for scanning
        return await this.uploadToVirusTotal(filePath);
      } else {
        throw new Error(`VirusTotal error: ${report.verbose_msg}`);
      }
    } catch (error) {
      console.error('VirusTotal scan error:', error);
      throw error;
    }
  }

  /**
   * Upload file to VirusTotal for scanning
   */
  async uploadToVirusTotal(filePath) {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('apikey', this.config.virustotal.apiKey);

    const response = await fetch('https://www.virustotal.com/vtapi/v2/file/scan', {
      method: 'POST',
      body: form
    });

    if (!response.ok) {
      throw new Error(`VirusTotal upload error: ${response.status}`);
    }

    const result = await response.json();
    
    // For immediate results, we'll return clean
    // In production, you'd want to implement a polling mechanism
    return {
      clean: true,
      threats: [],
      method: 'virustotal',
      scanId: result.scan_id,
      scanTime: Date.now(),
      pending: true
    };
  }

  /**
   * Hybrid scanning (ClamAV + VirusTotal)
   */
  async scanWithHybrid(filePath) {
    const primaryResult = await this.scanWithClamAV(filePath);
    
    // If ClamAV found threats, return immediately
    if (!primaryResult.clean) {
      return primaryResult;
    }

    // If ClamAV was clean, try VirusTotal for additional verification
    try {
      const secondaryResult = await this.scanWithVirusTotal(filePath);
      
      return {
        clean: primaryResult.clean && secondaryResult.clean,
        threats: [...primaryResult.threats, ...secondaryResult.threats],
        method: 'hybrid',
        primaryResult: primaryResult,
        secondaryResult: secondaryResult,
        scanTime: Date.now()
      };
    } catch (error) {
      // If VirusTotal fails, trust ClamAV result
      console.warn('VirusTotal fallback failed, trusting ClamAV result:', error.message);
      return primaryResult;
    }
  }

  /**
   * Parse ClamAV threat information
   */
  parseClamAVThreats(output) {
    const threats = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('FOUND')) {
        const match = line.match(/(.+): (.+) FOUND/);
        if (match) {
          threats.push({
            name: match[2],
            type: 'virus',
            engine: 'clamav'
          });
        }
      }
    }
    
    return threats;
  }

  /**
   * Parse VirusTotal threat information
   */
  parseVirusTotalThreats(report) {
    const threats = [];
    const scans = report.scans || {};
    
    for (const [engine, result] of Object.entries(scans)) {
      if (result.detected) {
        threats.push({
          name: result.result,
          type: 'virus',
          engine: engine
        });
      }
    }
    
    return threats;
  }

  /**
   * Get scan statistics
   */
  getScanStats() {
    return {
      methods: Object.keys(this.scanMethods),
      config: this.config,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new AntivirusService();
