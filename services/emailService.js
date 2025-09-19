/**
 * Email Service
 * Handles email sending for authentication flows
 */

const nodemailer = require('nodemailer');
const crypto = require('crypto');

class EmailService {
  constructor() {
    // Only create transporter if email configuration is available
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      this.transporter = null;
      console.warn('⚠️ No email configuration found. Email notifications will be disabled.');
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, resetToken, userName) {
    if (!this.transporter) {
      console.log('📧 Email service not configured. Password reset token:', resetToken);
      return { success: true, message: 'Email service not configured. Check console for reset token.' };
    }

    const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: `"Call Sheet Converter" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hello ${userName},</p>
          <p>You requested to reset your password. Click the button below to reset it:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>This link will expire in 1 hour for security reasons.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            If the button doesn't work, copy and paste this link: ${resetUrl}
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('✅ Password reset email sent to:', email);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(email, verificationToken, userName) {
    if (!this.transporter) {
      console.log('📧 Email service not configured. Verification token:', verificationToken);
      return { success: true, message: 'Email service not configured. Check console for verification token.' };
    }

    const verificationUrl = `${process.env.FRONTEND_URL}/auth/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: `"Call Sheet Converter" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Verify Your Email Address</h2>
          <p>Hello ${userName},</p>
          <p>Welcome to Call Sheet Converter! Please verify your email address to complete your registration:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email
            </a>
          </div>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create this account, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            If the button doesn't work, copy and paste this link: ${verificationUrl}
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('✅ Verification email sent to:', email);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send verification email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send 2FA code email
   */
  async send2FACode(email, code, userName) {
    if (!this.transporter) {
      console.log('📧 Email service not configured. 2FA code:', code);
      return { success: true, message: 'Email service not configured. Check console for 2FA code.' };
    }

    const mailOptions = {
      from: `"Call Sheet Converter" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your Two-Factor Authentication Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Two-Factor Authentication</h2>
          <p>Hello ${userName},</p>
          <p>Your two-factor authentication code is:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="background-color: #f8f9fa; border: 2px solid #dee2e6; padding: 15px 30px; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; display: inline-block;">
              ${code}
            </span>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please secure your account immediately.</p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('✅ 2FA code sent to:', email);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send 2FA code:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send security alert email
   */
  async sendSecurityAlert(email, alertType, details, userName) {
    if (!this.transporter) {
      console.log('📧 Email service not configured. Security alert:', { alertType, details });
      return { success: true, message: 'Email service not configured. Check console for security alert.' };
    }

    const mailOptions = {
      from: `"Call Sheet Converter Security" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: `Security Alert: ${alertType}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc3545;">Security Alert</h2>
          <p>Hello ${userName},</p>
          <p>We detected a security event on your account:</p>
          <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>Event:</strong> ${alertType}<br>
            <strong>Time:</strong> ${new Date().toLocaleString()}<br>
            <strong>Details:</strong> ${details}
          </div>
          <p>If this wasn't you, please secure your account immediately by changing your password.</p>
          <p>If you have any concerns, please contact our support team.</p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('✅ Security alert sent to:', email);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send security alert:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();
