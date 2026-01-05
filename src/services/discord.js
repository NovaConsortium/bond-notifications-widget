const { Client, GatewayIntentBits } = require('discord.js');
const { getBrandName } = require('../config/brands');

class DiscordService {
  constructor() {
    this.client = null;
    this.botToken = process.env.DISCORD_BOT_TOKEN;
    this.verificationCodes = new Map();
    this.subscriptionMap = new Map();
    
    if (this.botToken) {
      this.initializeBot();
    } else {
      console.warn('Discord bot token not configured');
    }
  }

  initializeBot() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    this.client.once('ready', () => {
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot || message.guild) return;

      const content = message.content.trim();
      const userId = message.author.id;

      if (this.verificationCodes.has(userId)) {
        const stored = this.verificationCodes.get(userId);
        if (content === stored.code) {
          this.verificationCodes.delete(userId);
          await message.reply('✅ Verification successful! You will now receive balance notifications.');
          if (this.onVerificationSuccess) {
            this.onVerificationSuccess(userId, message.author.tag, stored.subscriptionId);
          }
        } else {
          await message.reply('❌ Invalid verification code. Please try again.');
        }
      }
    });

    this.client.login(this.botToken).catch(err => {
      console.error('Failed to login Discord bot:', err);
    });
  }

  generateVerificationCode(userId, subscriptionId = null) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.verificationCodes.set(userId, {
      code,
      subscriptionId,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });
    return code;
  }

  storeSubscriptionForVerification(code, subscriptionId) {
    this.subscriptionMap.set(code, {
      subscriptionId,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });
  }

  async sendVerificationCode(userId, code, brand = 'jpool') {
    if (!this.client) {
      throw new Error('Discord bot not initialized');
    }

    try {
      const brandName = getBrandName(brand);
      const user = await this.client.users.fetch(userId);
      await user.send(
        `🔐 **${brandName} Balance Notification Verification**\n\n` +
        `Your verification code is: **${code}**\n` +
        `This code expires in 10 minutes.\n\n` +
        `Reply to this message with the code to verify.`
      );
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to send Discord DM: ${error.message}`);
    }
  }

  setVerificationCallback(callback) {
    this.onVerificationSuccess = callback;
  }

  async sendLowBalanceNotification(userId, bondAddress, currentBalance, threshold, brand = 'jpool') {
    if (!this.client) {
      throw new Error('Discord bot not initialized');
    }

    try {
      const brandName = getBrandName(brand);
      const user = await this.client.users.fetch(userId);
      const shortAddress = bondAddress.substring(0, 8) + '...';
      
      await user.send(
        `⚠️ **${brandName} Balance Alert**\n\n` +
        `**Bond Address:** \`${shortAddress}\`\n` +
        `**Current Balance:** ${currentBalance.toFixed(4)} SOL\n` +
        `**Threshold:** ${threshold} SOL\n\n` +
        `Your balance has dropped below your set threshold!`
      );
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to send Discord notification: ${error.message}`);
    }
  }

  isValidUserId(userId) {
    return /^\d{17,19}$/.test(userId);
  }

  getInviteLink() {
    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId) {
      return null;
    }
    const permissions = '2048';
    return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=bot`;
  }

  isReady() {
    return this.client && this.client.isReady();
  }
}

module.exports = new DiscordService();

