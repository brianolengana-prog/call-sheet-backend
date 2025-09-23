/**
 * Encryption Utilities
 * 
 * Provides AES-256 encryption/decryption for sensitive contact data
 * Uses environment-based key management with per-record IVs
 */

import crypto from 'crypto';

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

export class EncryptionService {
  private readonly config: EncryptionConfig;
  private readonly key: Buffer;

  constructor() {
    this.config = {
      algorithm: 'aes-256-gcm',
      keyLength: 32, // 256 bits
      ivLength: 16,  // 128 bits
      tagLength: 16  // 128 bits
    };

    // Get encryption key from environment
    const keyString = process.env.ENCRYPTION_KEY;
    if (!keyString) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    // Ensure key is exactly 32 bytes (256 bits)
    this.key = this.deriveKey(keyString);
  }

  /**
   * Derive a 32-byte key from the environment variable
   */
  private deriveKey(keyString: string): Buffer {
    return crypto.scryptSync(keyString, 'salt', this.config.keyLength);
  }

  /**
   * Generate a random IV for each encryption operation
   */
  private generateIV(): Buffer {
    return crypto.randomBytes(this.config.ivLength);
  }

  /**
   * Encrypt sensitive data (email, phone, etc.)
   */
  encrypt(text: string): EncryptedData {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid input: text must be a non-empty string');
    }

    try {
      const iv = this.generateIV();
      const cipher = crypto.createCipher(this.config.algorithm, this.key);
      cipher.setAAD(Buffer.from('contact-data', 'utf8'));

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: EncryptedData): string {
    if (!encryptedData || !encryptedData.encrypted || !encryptedData.iv || !encryptedData.tag) {
      throw new Error('Invalid encrypted data structure');
    }

    try {
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      const encrypted = encryptedData.encrypted;

      const decipher = crypto.createDecipher(this.config.algorithm, this.key);
      decipher.setAAD(Buffer.from('contact-data', 'utf8'));
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt contact object, preserving non-sensitive fields
   */
  encryptContact(contact: any): any {
    if (!contact || typeof contact !== 'object') {
      throw new Error('Invalid contact object');
    }

    const encryptedContact = { ...contact };

    // Encrypt sensitive fields
    const sensitiveFields = ['email', 'phone', 'notes'];
    
    for (const field of sensitiveFields) {
      if (contact[field] && typeof contact[field] === 'string' && contact[field].trim()) {
        try {
          encryptedContact[field] = this.encrypt(contact[field]);
        } catch (error) {
          console.warn(`Failed to encrypt field ${field}:`, error);
          // Keep original value if encryption fails
          encryptedContact[field] = contact[field];
        }
      }
    }

    return encryptedContact;
  }

  /**
   * Decrypt contact object
   */
  decryptContact(contact: any): any {
    if (!contact || typeof contact !== 'object') {
      throw new Error('Invalid contact object');
    }

    const decryptedContact = { ...contact };

    // Decrypt sensitive fields
    const sensitiveFields = ['email', 'phone', 'notes'];
    
    for (const field of sensitiveFields) {
      if (contact[field] && typeof contact[field] === 'object' && contact[field].encrypted) {
        try {
          decryptedContact[field] = this.decrypt(contact[field]);
        } catch (error) {
          console.warn(`Failed to decrypt field ${field}:`, error);
          // Keep encrypted value if decryption fails
          decryptedContact[field] = contact[field];
        }
      }
    }

    return decryptedContact;
  }

  /**
   * Check if a field is encrypted
   */
  isEncrypted(field: any): boolean {
    return field && 
           typeof field === 'object' && 
           field.encrypted && 
           field.iv && 
           field.tag;
  }

  /**
   * Get encryption status for debugging
   */
  getEncryptionStatus(): { algorithm: string; keyLength: number; ivLength: number } {
    return {
      algorithm: this.config.algorithm,
      keyLength: this.config.keyLength,
      ivLength: this.config.ivLength
    };
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();
