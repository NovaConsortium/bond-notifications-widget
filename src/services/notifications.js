const twilioService = require('./twilio');
const emailService = require('./email');
const discordService = require('./discord');
const telegramService = require('./telegram');
const { NotificationChannel } = require('../models/subscription');

class NotificationService {
  async sendLowBalanceNotifications(subscriptionId, bondAddress, currentBalance, threshold, brand = 'jpool') {
    const channels = await NotificationChannel.findBySubscription(subscriptionId);
    const results = {
      sms: [],
      email: [],
      discord: [],
      telegram: []
    };

    for (const channel of channels) {
      try {
        switch (channel.channel_type) {
          case 'sms':
            await twilioService.sendLowBalanceNotification(
              channel.channel_value,
              bondAddress,
              currentBalance,
              threshold,
              brand
            );
            results.sms.push({ channel: channel.channel_value, success: true });
            break;

          case 'email':
            await emailService.sendLowBalanceNotification(
              channel.channel_value,
              bondAddress,
              currentBalance,
              threshold,
              brand
            );
            results.email.push({ channel: channel.channel_value, success: true });
            break;

          case 'discord':
            await discordService.sendLowBalanceNotification(
              channel.channel_value,
              bondAddress,
              currentBalance,
              threshold,
              brand
            );
            results.discord.push({ channel: channel.channel_value, success: true });
            break;

          case 'telegram':
            await telegramService.sendLowBalanceNotification(
              channel.channel_value,
              bondAddress,
              currentBalance,
              threshold,
              brand
            );
            results.telegram.push({ channel: channel.channel_value, success: true });
            break;

          default:
            console.warn(`Unknown channel type: ${channel.channel_type}`);
        }
      } catch (error) {
        console.error(`Failed to send notification via ${channel.channel_type}:`, error);
        const channelResults = results[channel.channel_type] || [];
        channelResults.push({
          channel: channel.channel_value,
          success: false,
          error: error.message
        });
        results[channel.channel_type] = channelResults;
      }
    }

    return results;
  }

  async sendVerificationCode(channelType, channelValue, code, brand = 'jpool') {
    switch (channelType) {
      case 'sms':
        return await twilioService.sendSMS(channelValue, code, brand);

      case 'email':
        return await emailService.sendOTP(channelValue, code, brand);

      case 'discord':
        return await discordService.sendVerificationCode(channelValue, code, brand);

      case 'telegram':
        return await telegramService.sendVerificationCode(channelValue, code, brand);

      default:
        throw new Error(`Unknown channel type: ${channelType}`);
    }
  }
}

module.exports = new NotificationService();

