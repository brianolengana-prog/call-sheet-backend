/**
 * Secure Extraction Service
 * 
 * Enhanced extraction service with encryption and validation
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { encryptionService } from '../utils/encryption';
import { 
  fileUploadSchema, 
  contactSchema, 
  extractionRequestSchema,
  ValidationResult 
} from '../schemas/validation';
import { CustomExtractionService } from './customExtractionService';
import { ExtractionService } from './extractionService';
import { ExtractionServiceManager } from './extractionServiceManager';

export interface SecureExtractionResult {
  success: boolean;
  contacts: any[];
  metadata: {
    extractionMethod: string;
    processingTime: number;
    encryptedFields: string[];
    validationPassed: boolean;
  };
  error?: string;
}

export class SecureExtractionService {
  private customService: CustomExtractionService;
  private aiService: ExtractionService;
  private manager: ExtractionServiceManager;

  constructor() {
    this.customService = new CustomExtractionService();
    this.aiService = new ExtractionService();
    this.manager = new ExtractionServiceManager();
  }

  /**
   * Validate and sanitize extraction request
   */
  private validateExtractionRequest(req: Request): ValidationResult {
    try {
      // Validate file upload
      const fileValidation = fileUploadSchema.safeParse({ file: req.file });
      if (!fileValidation.success) {
        return {
          success: false,
          errors: fileValidation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: 'FILE_VALIDATION_ERROR'
          }))
        };
      }

      // Validate extraction request body
      const bodyValidation = extractionRequestSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return {
          success: false,
          errors: bodyValidation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: 'BODY_VALIDATION_ERROR'
          }))
        };
      }

      return {
        success: true,
        data: {
          file: fileValidation.data.file,
          extractionRequest: bodyValidation.data
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          field: 'validation',
          message: error instanceof Error ? error.message : 'Validation failed',
          code: 'VALIDATION_ERROR'
        }]
      };
    }
  }

  /**
   * Validate and sanitize contacts
   */
  private validateContacts(contacts: any[]): ValidationResult {
    const errors: any[] = [];
    const validatedContacts: any[] = [];

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const contactValidation = contactSchema.safeParse(contact);
      
      if (!contactValidation.success) {
        errors.push({
          field: `contacts[${i}]`,
          message: contactValidation.error.errors.map(e => e.message).join(', '),
          code: 'CONTACT_VALIDATION_ERROR'
        });
        continue;
      }

      validatedContacts.push(contactValidation.data);
    }

    return {
      success: errors.length === 0,
      data: validatedContacts,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Encrypt sensitive contact data
   */
  private encryptContacts(contacts: any[]): any[] {
    return contacts.map(contact => {
      try {
        return encryptionService.encryptContact(contact);
      } catch (error) {
        console.warn('Failed to encrypt contact:', error);
        return contact; // Return original if encryption fails
      }
    });
  }

  /**
   * Decrypt sensitive contact data
   */
  private decryptContacts(contacts: any[]): any[] {
    return contacts.map(contact => {
      try {
        return encryptionService.decryptContact(contact);
      } catch (error) {
        console.warn('Failed to decrypt contact:', error);
        return contact; // Return as-is if decryption fails
      }
    });
  }

  /**
   * Extract contacts with security measures
   */
  async extractContacts(
    fileBuffer: Buffer,
    mimeType: string,
    fileName: string,
    options: any = {}
  ): Promise<SecureExtractionResult> {
    const startTime = Date.now();
    const encryptedFields: string[] = [];

    try {
      console.log('🔒 Starting secure extraction...');
      console.log('📁 File:', fileName, 'Type:', mimeType, 'Size:', fileBuffer.length);

      // Determine extraction method
      const extractionMethod = options.extractionMethod || 'auto';
      let result: any;

      // Perform extraction based on method
      switch (extractionMethod) {
        case 'ai':
          console.log('🤖 Using AI extraction with security');
          const extractedText = await this.aiService.processFile(fileBuffer, mimeType, fileName);
          result = await this.aiService.extractContacts(
            extractedText,
            options.rolePreferences || [],
            options,
            options.userId
          );
          break;

        case 'custom':
          console.log('🔧 Using custom extraction with security');
          result = await this.customService.extractContacts(
            fileBuffer,
            mimeType,
            fileName,
            options
          );
          break;

        case 'auto':
        default:
          console.log('🎯 Using intelligent extraction with security');
          result = await this.manager.extractContacts(
            fileBuffer,
            mimeType,
            fileName,
            options
          );
          break;
      }

      if (!result.success) {
        throw new Error(result.error || 'Extraction failed');
      }

      // Validate extracted contacts
      const contactValidation = this.validateContacts(result.contacts);
      if (!contactValidation.success) {
        console.warn('⚠️ Some contacts failed validation:', contactValidation.errors);
        // Continue with valid contacts only
        result.contacts = contactValidation.data || [];
      }

      // Encrypt sensitive fields
      const encryptedContacts = this.encryptContacts(result.contacts);
      
      // Track which fields were encrypted
      if (encryptedContacts.length > 0) {
        const sampleContact = encryptedContacts[0];
        if (encryptionService.isEncrypted(sampleContact.email)) encryptedFields.push('email');
        if (encryptionService.isEncrypted(sampleContact.phone)) encryptedFields.push('phone');
        if (encryptionService.isEncrypted(sampleContact.notes)) encryptedFields.push('notes');
      }

      const processingTime = Date.now() - startTime;
      console.log(`🔒 Secure extraction completed in ${processingTime}ms`);
      console.log(`📊 Encrypted fields: ${encryptedFields.join(', ')}`);

      return {
        success: true,
        contacts: encryptedContacts,
        metadata: {
          extractionMethod,
          processingTime,
          encryptedFields,
          validationPassed: contactValidation.success
        }
      };

    } catch (error) {
      console.error('❌ Secure extraction failed:', error);
      return {
        success: false,
        contacts: [],
        metadata: {
          extractionMethod: options.extractionMethod || 'auto',
          processingTime: Date.now() - startTime,
          encryptedFields: [],
          validationPassed: false
        },
        error: error instanceof Error ? error.message : 'Extraction failed'
      };
    }
  }

  /**
   * Decrypt contacts for display
   */
  async decryptContactsForDisplay(contacts: any[]): Promise<any[]> {
    try {
      return this.decryptContacts(contacts);
    } catch (error) {
      console.error('❌ Failed to decrypt contacts:', error);
      return contacts; // Return encrypted contacts if decryption fails
    }
  }

  /**
   * Get encryption status
   */
  getEncryptionStatus(): any {
    return encryptionService.getEncryptionStatus();
  }

  /**
   * Validate file upload
   */
  validateFileUpload(req: Request, res: Response, next: Function) {
    const validation = this.validateExtractionRequest(req);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    req.validatedData = validation.data;
    next();
  }
}

// Export singleton instance
export const secureExtractionService = new SecureExtractionService();
