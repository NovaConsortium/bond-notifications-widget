const nodemailer = require('nodemailer');
const { getBrandName } = require('../config/brands');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    const emailConfig = {
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    };

    if (!emailConfig.host) {
      console.warn('EMAIL_HOST not configured');
      this.transporter = null;
      return;
    }

    if (emailConfig.auth.user && emailConfig.auth.pass) {
      try {
        this.transporter = nodemailer.createTransport(emailConfig);
      } catch (error) {
        console.error('Failed to initialize email transporter:', error);
        this.transporter = null;
      }
    } else {
      console.warn('Email credentials not configured. EMAIL_USER and EMAIL_PASSWORD must be set in .env file.');
      this.transporter = null;
    }
  }

  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendOTP(email, otp, brand = 'jpool') {
    if (!this.transporter) {
      const errorMsg = 'Email transporter not configured. Please check EMAIL_HOST, EMAIL_USER, and EMAIL_PASSWORD environment variables.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (!email || !this.isValidEmail(email)) {
      throw new Error(`Invalid email address: ${email}`);
    }

    try {
      const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;
      if (!fromEmail) {
        throw new Error('EMAIL_FROM or EMAIL_USER must be configured');
      }

      const brandName = getBrandName(brand);
      const mailOptions = {
        from: `"${brandName} Notifications" <${fromEmail}>`, // Add display name
        to: email,
        subject: `${brandName} Balance Notification Verification`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>${brandName} Balance Notification Verification</h2>
            <p>Your verification code is:</p>
            <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
              ${otp}
            </div>
            <p>This code expires in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
        `,
        text: `${brandName} Balance Notification Verification\n\nYour verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`
      };

      const info = await this.transporter.sendMail(mailOptions);
      if (info.rejected && info.rejected.length > 0) {
        console.warn(`Email rejected by server for: ${info.rejected.join(', ')}`);
      }
      
      return { success: true, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
    } catch (error) {
      console.error('Email send error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async sendLowBalanceNotification(email, bondAddress, currentBalance, threshold, brand = 'jpool') {
    if (!this.transporter) {
      throw new Error('Email transporter not configured');
    }

    try {
      const brandName = getBrandName(brand);
      const shortAddress = bondAddress.substring(0, 8) + '...';
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: email,
        subject: `⚠️ ${brandName} Balance Alert - Low Balance Detected`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f44336;">⚠️ ${brandName} Balance Alert</h2>
            <p>Your ${brandName} bond address balance has dropped below your set threshold.</p>
            <div style="background: #fff3cd; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0;">
              <p><strong>Bond Address:</strong> <code>${shortAddress}</code></p>
              <p><strong>Current Balance:</strong> ${currentBalance.toFixed(4)} SOL</p>
              <p><strong>Threshold:</strong> ${threshold} SOL</p>
            </div>
            <p>Please take appropriate action to maintain your bond balance.</p>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      throw new Error(`Failed to send notification email: ${error.message}`);
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

module.exports = new EmailService();

