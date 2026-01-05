const TelegramBot = require('node-telegram-bot-api');
const { getBrandName } = require('../config/brands');

class TelegramService {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.bot = null;
    this.verificationCodes = new Map();
    this.subscriptionMap = new Map();
    
    if (this.botToken) {
      this.initializeBot();
    } else {
      console.warn('Telegram bot token not configured');
    }
  }

  initializeBot() {
    this.bot = new TelegramBot(this.botToken, { polling: true });

    this.bot.on('polling_error', (error) => {
      console.error('Telegram bot polling error:', error);
    });

    this.bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;
      const userId = msg.from.id.toString();

      if (text && text.startsWith('/verify')) {
        const parts = text.split(' ');
        if (parts.length === 2) {
          const code = parts[1];
          
          const subscriptionData = this.subscriptionMap.get(code);
          if (subscriptionData && subscriptionData.expiresAt > Date.now()) {
            this.subscriptionMap.delete(code);
            await this.bot.sendMessage(chatId, '✅ Verification successful! You will now receive balance notifications.');
            if (this.onVerificationSuccess) {
              this.onVerificationSuccess(userId, msg.from.username || msg.from.first_name, subscriptionData.subscriptionId);
            }
            return;
          }
          
          if (this.verificationCodes.has(userId)) {
            const stored = this.verificationCodes.get(userId);
            if (code === stored.code) {
              this.verificationCodes.delete(userId);
              await this.bot.sendMessage(chatId, '✅ Verification successful! You will now receive balance notifications.');
              if (this.onVerificationSuccess) {
                this.onVerificationSuccess(userId, msg.from.username || msg.from.first_name, stored.subscriptionId);
              }
            } else {
              await this.bot.sendMessage(chatId, '❌ Invalid verification code. Please try again.');
            }
          } else {
            await this.bot.sendMessage(chatId, '❌ Invalid or expired verification code. Please get a new code from the website.');
          }
        } else {
          await this.bot.sendMessage(chatId, 'Usage: /verify <code>\n\nEnter the 6-digit verification code you received from the website.');
        }
        return;
      }

      if (text === '/start') {
        await this.bot.sendMessage(
          chatId,
          '👋 Welcome to Balance Notifications!\n\n' +
          'To verify your Telegram account, use the command:\n' +
          '/verify <code>\n\n' +
          'You will receive a verification code after subscribing on the website.'
        );
        return;
      }

      if (this.verificationCodes.has(userId) && text && /^\d{6}$/.test(text)) {
        const expectedCode = this.verificationCodes.get(userId).code;
        if (text === expectedCode) {
          this.verificationCodes.delete(userId);
          await this.bot.sendMessage(chatId, '✅ Verification successful! You will now receive balance notifications.');
          if (this.onVerificationSuccess) {
            this.onVerificationSuccess(userId, msg.from.username || msg.from.first_name);
          }
        } else {
          await this.bot.sendMessage(chatId, '❌ Invalid verification code. Please try again or use /verify <code>');
        }
      }
    });

    console.log('Telegram bot initialized');
  }

  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  storeSubscriptionForVerification(code, subscriptionId) {
    this.subscriptionMap.set(code, {
      subscriptionId,
      expiresAt: Date.now() + 10 * 60 * 1000
    });
  }

  generateVerificationCode(userId) {
    const code = this.generateOTP();
    this.verificationCodes.set(userId, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000
    });
    return code;
  }

  async sendVerificationCode(userId, code, brand = 'jpool') {
    if (!this.bot) {
      throw new Error('Telegram bot not initialized');
    }

    try {
      const brandName = getBrandName(brand);
      await this.bot.sendMessage(
        userId,
        `🔐 *${brandName} Balance Notification Verification*\n\n` +
        `Your verification code is: *${code}*\n` +
        `This code expires in 10 minutes.\n\n` +
        `To verify, send the command:\n` +
        `\`/verify ${code}\``,
        { parse_mode: 'Markdown' }
      );
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to send Telegram message: ${error.message}`);
    }
  }

  setVerificationCallback(callback) {
    this.onVerificationSuccess = callback;
  }

  async sendLowBalanceNotification(userId, bondAddress, currentBalance, threshold, brand = 'jpool') {
    if (!this.bot) {
      throw new Error('Telegram bot not initialized');
    }

    try {
      const brandName = getBrandName(brand);
      const shortAddress = bondAddress.substring(0, 8) + '...';
      
      await this.bot.sendMessage(
        userId,
        `⚠️ *${brandName} Balance Alert*\n\n` +
        `*Bond Address:* \`${shortAddress}\`\n` +
        `*Current Balance:* ${currentBalance.toFixed(4)} SOL\n` +
        `*Threshold:* ${threshold} SOL\n\n` +
        `Your balance has dropped below your set threshold!`,
        { parse_mode: 'Markdown' }
      );
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to send Telegram notification: ${error.message}`);
    }
  }

  isValidUserId(userId) {
    return /^\d+$/.test(userId);
  }

  async getBotUsername() {
    if (!this.bot) {
      return null;
    }
    try {
      const me = await this.bot.getMe();
      return me.username;
    } catch {
      return null;
    }
  }

  isReady() {
    return this.bot !== null;
  }
}

module.exports = new TelegramService();

