/**
 * Email notification service for payment events
 * This service handles sending emails for various payment-related events
 */

const nodemailer = require('nodemailer');

class NotificationService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    // Initialize email transporter based on environment
    if (process.env.SENDGRID_API_KEY) {
      this.transporter = nodemailer.createTransporter({
        service: 'sendgrid',
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY
        }
      });
    } else if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      console.warn('⚠️ No email configuration found. Email notifications will be disabled.');
    }
  }

  async sendPaymentFailureNotification(email, data) {
    if (!this.transporter) {
      console.log('📧 Email notification disabled - no transporter configured');
      return;
    }

    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@sjcallsheets.com',
        to: email,
        subject: 'Payment Failed - Action Required',
        html: this.generatePaymentFailureEmail(data),
        text: this.generatePaymentFailureEmailText(data)
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`📧 Payment failure notification sent to ${email}`);
    } catch (error) {
      console.error('❌ Error sending payment failure notification:', error);
    }
  }

  async sendTrialEndingNotification(email, data) {
    if (!this.transporter) {
      console.log('📧 Email notification disabled - no transporter configured');
      return;
    }

    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@sjcallsheets.com',
        to: email,
        subject: `Your trial ends in ${data.daysLeft} days`,
        html: this.generateTrialEndingEmail(data),
        text: this.generateTrialEndingEmailText(data)
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`📧 Trial ending notification sent to ${email}`);
    } catch (error) {
      console.error('❌ Error sending trial ending notification:', error);
    }
  }

  async sendSubscriptionRenewalReminder(email, data) {
    if (!this.transporter) {
      console.log('📧 Email notification disabled - no transporter configured');
      return;
    }

    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@sjcallsheets.com',
        to: email,
        subject: 'Subscription Renewal Reminder',
        html: this.generateRenewalReminderEmail(data),
        text: this.generateRenewalReminderEmailText(data)
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`📧 Renewal reminder sent to ${email}`);
    } catch (error) {
      console.error('❌ Error sending renewal reminder:', error);
    }
  }

  async sendPaymentActionRequiredNotification(email, data) {
    if (!this.transporter) {
      console.log('📧 Email notification disabled - no transporter configured');
      return;
    }

    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@sjcallsheets.com',
        to: email,
        subject: 'Payment Action Required',
        html: this.generatePaymentActionRequiredEmail(data),
        text: this.generatePaymentActionRequiredEmailText(data)
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`📧 Payment action required notification sent to ${email}`);
    } catch (error) {
      console.error('❌ Error sending payment action required notification:', error);
    }
  }

  generatePaymentFailureEmail(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Payment Failed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Failed</h1>
          </div>
          <div class="content">
            <h2>We couldn't process your payment</h2>
            <p>Your recent payment of <strong>$${(data.amount / 100).toFixed(2)}</strong> has failed.</p>
            <p><strong>Reason:</strong> ${data.failureReason || 'Payment was declined'}</p>
            <p>To continue using CallSheet AI, please update your payment method and retry the payment.</p>
            <a href="${data.retryUrl}" class="button">Retry Payment</a>
            <p>If you continue to experience issues, please contact our support team.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from CallSheet AI. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generatePaymentFailureEmailText(data) {
    return `
Payment Failed

We couldn't process your payment of $${(data.amount / 100).toFixed(2)}.

Reason: ${data.failureReason || 'Payment was declined'}

To continue using CallSheet AI, please update your payment method and retry the payment.

Retry Payment: ${data.retryUrl}

If you continue to experience issues, please contact our support team.

This is an automated message from CallSheet AI.
    `;
  }

  generateTrialEndingEmail(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Trial Ending Soon</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Trial Ending Soon</h1>
          </div>
          <div class="content">
            <h2>Your trial ends in ${data.daysLeft} days</h2>
            <p>Don't lose access to your CallSheet AI features. Choose a plan to continue using our service.</p>
            <a href="${data.upgradeUrl}" class="button">Choose a Plan</a>
            <p>If you have any questions, our support team is here to help.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from CallSheet AI. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateTrialEndingEmailText(data) {
    return `
Trial Ending Soon

Your trial ends in ${data.daysLeft} days.

Don't lose access to your CallSheet AI features. Choose a plan to continue using our service.

Choose a Plan: ${data.upgradeUrl}

If you have any questions, our support team is here to help.

This is an automated message from CallSheet AI.
    `;
  }

  generateRenewalReminderEmail(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Subscription Renewal Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Subscription Renewal Reminder</h1>
          </div>
          <div class="content">
            <h2>Your subscription renews on ${new Date(data.renewalDate).toLocaleDateString()}</h2>
            <p>Your ${data.planName} subscription will automatically renew for $${(data.amount / 100).toFixed(2)}.</p>
            <p>If you need to make any changes to your subscription, please visit your billing portal.</p>
            <a href="${data.portalUrl}" class="button">Manage Subscription</a>
          </div>
          <div class="footer">
            <p>This is an automated message from CallSheet AI. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateRenewalReminderEmailText(data) {
    return `
Subscription Renewal Reminder

Your subscription renews on ${new Date(data.renewalDate).toLocaleDateString()}

Your ${data.planName} subscription will automatically renew for $${(data.amount / 100).toFixed(2)}.

If you need to make any changes to your subscription, please visit your billing portal.

Manage Subscription: ${data.portalUrl}

This is an automated message from CallSheet AI.
    `;
  }

  generatePaymentActionRequiredEmail(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Payment Action Required</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Action Required</h1>
          </div>
          <div class="content">
            <h2>Additional action needed for your payment</h2>
            <p>Your payment of <strong>$${(data.amount / 100).toFixed(2)}</strong> requires additional verification.</p>
            <p><strong>Reason:</strong> ${data.failureReason || 'Additional verification required'}</p>
            <p>Please complete the required action to process your payment.</p>
            <a href="${data.actionUrl}" class="button">Complete Payment</a>
          </div>
          <div class="footer">
            <p>This is an automated message from CallSheet AI. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generatePaymentActionRequiredEmailText(data) {
    return `
Payment Action Required

Additional action needed for your payment of $${(data.amount / 100).toFixed(2)}.

Reason: ${data.failureReason || 'Additional verification required'}

Please complete the required action to process your payment.

Complete Payment: ${data.actionUrl}

This is an automated message from CallSheet AI.
    `;
  }
}

module.exports = new NotificationService();
