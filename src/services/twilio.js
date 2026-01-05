const twilio = require('twilio');
const { getBrandName } = require('../config/brands');

class TwilioService {
  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      console.warn('Twilio credentials not configured');
      this.client = null;
    } else {
      this.client = twilio(accountSid, authToken);
    }
    
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  }

  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendSMS(phoneNumber, otp, brand = 'jpool') {
    if (!this.client) {
      throw new Error('Twilio client not configured');
    }

    try {
      const brandName = getBrandName(brand);
      const message = await this.client.messages.create({
        body: `Your ${brandName} balance notification verification code is: ${otp}. This code expires in 10 minutes.`,
        from: this.phoneNumber,
        to: phoneNumber
      });
      return { success: true, messageSid: message.sid };
    } catch (error) {
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  async sendCall(phoneNumber, otp, brand = 'jpool') {
    if (!this.client) {
      throw new Error('Twilio client not configured');
    }

    try {
      const brandName = getBrandName(brand);
      const otpSpeech = otp.split('').join(' ');
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="alice">Your ${brandName} balance notification verification code is: ${otpSpeech}. This code expires in 10 minutes.</Say>
        </Response>`;

      const call = await this.client.calls.create({
        twiml: twiml,
        from: this.phoneNumber,
        to: phoneNumber
      });
      return { success: true, callSid: call.sid };
    } catch (error) {
      throw new Error(`Failed to make call: ${error.message}`);
    }
  }

  async sendLowBalanceNotification(phoneNumber, bondAddress, currentBalance, threshold, brand = 'jpool') {
    if (!this.client) {
      throw new Error('Twilio client not configured');
    }

    try {
      const brandName = getBrandName(brand);
      const message = await this.client.messages.create({
        body: `⚠️ ${brandName} Alert: Your bond address ${bondAddress.substring(0, 8)}... has a low balance of ${currentBalance.toFixed(4)} SOL (threshold: ${threshold} SOL)`,
        from: this.phoneNumber,
        to: phoneNumber
      });
      return { success: true, messageSid: message.sid };
    } catch (error) {
      throw new Error(`Failed to send notification SMS: ${error.message}`);
    }
  }

  async sendLowBalanceCall(phoneNumber, bondAddress, currentBalance, threshold, brand = 'jpool') {
    if (!this.client) {
      throw new Error('Twilio client not configured');
    }

    try {
      const brandName = getBrandName(brand);
      const shortAddress = bondAddress.substring(0, 8);
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="alice">Alert: Your ${brandName} bond address ${shortAddress} has a low balance of ${currentBalance.toFixed(4)} SOL. Your threshold is ${threshold} SOL.</Say>
        </Response>`;

      const call = await this.client.calls.create({
        twiml: twiml,
        from: this.phoneNumber,
        to: phoneNumber
      });
      return { success: true, callSid: call.sid };
    } catch (error) {
      throw new Error(`Failed to make notification call: ${error.message}`);
    }
  }

  isValidPhoneNumber(phoneNumber) {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }
}

module.exports = new TwilioService();

