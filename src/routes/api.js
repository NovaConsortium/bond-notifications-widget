const express = require('express');
const router = express.Router();
const { Subscription, NotificationChannel } = require('../models/subscription');
const solanaService = require('../services/solana');
const twilioService = require('../services/twilio');
const emailService = require('../services/email');
const notificationService = require('../services/notifications');
const discordService = require('../services/discord');
const discordOAuth = require('../services/discord-oauth');
const telegramService = require('../services/telegram');

const CHANNEL_TYPE_MAP = {
  email: { dbType: 'email', displayName: 'email' },
  twilio: { dbType: 'sms', displayName: 'Twilio' },
  discord: { dbType: 'discord', displayName: 'Discord' },
  telegram: { dbType: 'telegram', displayName: 'Telegram' }
};

async function verifyChannel(req, res, channelType) {
  const config = CHANNEL_TYPE_MAP[channelType];
  if (!config) {
    return res.status(400).json({ error: 'Invalid channel type' });
  }

  try {
    const { code, channel_id } = req.body;

    if (!code || !channel_id) {
      return res.status(400).json({ error: 'code and channel_id are required' });
    }

    const channel = await NotificationChannel.findById(channel_id);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.channel_type !== config.dbType) {
      return res.status(400).json({ error: `Invalid channel type for ${config.displayName} verification` });
    }

    if (channel.is_verified) {
      return res.json({ success: true, message: 'Already verified' });
    }

    const now = Math.floor(Date.now() / 1000);
    if (!channel.verification_code || channel.verification_expires < now) {
      return res.status(400).json({ error: 'Verification code expired' });
    }

    if (channel.verification_code !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    await NotificationChannel.verify(channel._id);

    res.json({ success: true, message: 'Verification successful' });
  } catch (error) {
    console.error(`${config.displayName} verify error:`, error);
    res.status(500).json({ error: error.message });
  }
}

function getBasePageStyles() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 500px;
      width: 100%;
    }
    .icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      color: white;
    }
    h1 {
      color: #1f2937;
      font-size: 24px;
      margin-bottom: 12px;
      font-weight: 600;
    }
    p {
      color: #6b7280;
      font-size: 16px;
      line-height: 1.6;
    }`;
}

function renderOAuthPage({ type, title, message }) {
  const isSuccess = type === 'success';
  const gradient = isSuccess 
    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
  const iconBg = isSuccess ? '#4ade80' : '#ef4444';
  const iconChar = isSuccess ? '✓' : '✕';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        ${getBasePageStyles()}
        body { background: ${gradient}; }
        .icon { background: ${iconBg}; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">${iconChar}</div>
        <h1>${title}</h1>
        <p>${message}</p>
      </div>
    </body>
    </html>
  `;
}

router.post('/subscribe', async (req, res) => {
  try {
    let { bond_address, validator_url, threshold, check_frequency, notification_channels } = req.body;

    if (validator_url && !bond_address) {
      const validatorAddress = solanaService.extractValidatorFromUrl(validator_url);
      if (!validatorAddress) {
        return res.status(400).json({ error: 'Invalid validator URL. Expected format: https://app.jpool.one/validators/VALIDATOR_ADDRESS' });
      }
      
      try {
        bond_address = solanaService.getBondAddressFromValidator(validatorAddress);
      } catch (error) {
        return res.status(400).json({ error: `Failed to derive bond address: ${error.message}` });
      }
    }

    if (!bond_address) {
      return res.status(400).json({ error: 'bond_address or validator_url is required' });
    }

    if (!solanaService.isValidAddress(bond_address)) {
      return res.status(400).json({ error: 'Invalid Solana address' });
    }

    if (threshold === undefined || threshold <= 0) {
      return res.status(400).json({ error: 'threshold must be a positive number' });
    }

    let subscription = await Subscription.findByAddress(bond_address);
    
    if (subscription) {
      subscription = await Subscription.findByIdAndUpdate(
        subscription._id,
        {
          threshold,
          check_frequency: check_frequency || 900
        },
        { new: true }
      );
    } else {
      subscription = await Subscription.create({
        bond_address,
        threshold,
        check_frequency: check_frequency || 900
      });
    }

    const channelResults = [];
    if (notification_channels && Array.isArray(notification_channels)) {
      for (const channel of notification_channels) {
        const { type, value } = channel;

        if (!['sms', 'email', 'discord', 'telegram'].includes(type)) {
          continue;
        }

        if (type !== 'discord' && type !== 'telegram' && !value) {
          continue;
        }

        if (type === 'sms' && !twilioService.isValidPhoneNumber(value)) {
          channelResults.push({ type, value, error: 'Invalid phone number format' });
          continue;
        }

        if (type === 'email' && !emailService.isValidEmail(value)) {
          channelResults.push({ type, value, error: 'Invalid email format' });
          continue;
        }

        let verificationCode;
        let channelValue = value;
        
        if (type === 'sms') {
          verificationCode = twilioService.generateOTP();
        } else if (type === 'email') {
          verificationCode = emailService.generateOTP();
        } else if (type === 'discord') {
          const state = discordOAuth.generateState();
          const subscriptionIdStr = subscription._id.toString();
          discordOAuth.storeState(state, { subscription_id: subscriptionIdStr });
          
          const existing = await NotificationChannel.findOne({
            subscription_id: subscription._id,
            channel_type: 'discord'
          });
          
          let channel;
          if (existing) {
            channel = await NotificationChannel.findByIdAndUpdate(
              existing._id,
              {
                verification_code: state,
                verification_expires: Math.floor(Date.now() / 1000) + 600,
                is_verified: false,
                channel_value: null
              },
              { new: true }
            );
          } else {
            channel = await NotificationChannel.create({
              subscription_id: subscription._id,
              channel_type: 'discord',
              channel_value: null,
              verification_code: state,
              verification_expires: Math.floor(Date.now() / 1000) + 600,
              is_verified: false
            });
          }
          
          const oauthUrl = discordOAuth.getAuthorizationUrl(state);
          channelResults.push({
            type,
            value: null,
            success: true,
            is_verified: false,
            channel_id: channel._id.toString(),
            oauth_url: oauthUrl,
            message: 'Please authorize with Discord'
          });
          continue;
        } else if (type === 'telegram') {
          const verificationCode = telegramService.generateOTP();
          const subscriptionIdStr = subscription._id.toString();
          
          telegramService.storeSubscriptionForVerification(verificationCode, subscriptionIdStr);
          
          const existing = await NotificationChannel.findOne({
            subscription_id: subscription._id,
            channel_type: 'telegram'
          });
          
          let channel;
          if (existing) {
            channel = await NotificationChannel.findByIdAndUpdate(
              existing._id,
              {
                verification_code: verificationCode,
                verification_expires: Math.floor(Date.now() / 1000) + 600,
                is_verified: false,
                channel_value: null
              },
              { new: true }
            );
          } else {
            channel = await NotificationChannel.create({
              subscription_id: subscription._id,
              channel_type: 'telegram',
              channel_value: null,
              verification_code: verificationCode,
              verification_expires: Math.floor(Date.now() / 1000) + 600,
              is_verified: false
            });
          }
          
          const botUsername = await telegramService.getBotUsername();
          channelResults.push({
            type,
            value: null,
            success: true,
            is_verified: false,
            channel_id: channel._id.toString(),
            bot_username: botUsername,
            verification_code: verificationCode,
            bot_url: `https://t.me/${botUsername}`,
            message: 'Please start the bot and use /verify command'
          });
          continue;
        }

        try {
          const existing = await NotificationChannel.findOne({
            subscription_id: subscription._id,
            channel_type: type,
            channel_value: value
          });

          if (existing) {
            const message = existing.is_verified 
              ? `${type} is already verified for this subscription`
              : `${type} is already added for this subscription. Please verify the existing channel.`;
            channelResults.push({ 
              type, 
              value, 
              error: message,
              isDuplicate: true,
              isVerified: existing.is_verified,
              channel_id: existing._id.toString()
            });
            continue;
          }

          const channel = await NotificationChannel.create({
            subscription_id: subscription._id,
            channel_type: type,
            channel_value: value,
            verification_code: verificationCode,
            verification_expires: Math.floor(Date.now() / 1000) + 600
          });

          try {
            await notificationService.sendVerificationCode(type, value, verificationCode);
          } catch (sendError) {
            console.error(`Failed to send verification code via ${type}:`, sendError);
            throw sendError;
          }

          channelResults.push({ 
            type, 
            value, 
            success: true, 
            channel_id: channel._id.toString(),
            is_verified: false,
            message: 'Verification code sent'
          });
        } catch (error) {
          console.error(`Error setting up ${type} channel:`, error);
          channelResults.push({ type, value, error: error.message });
        }
      }
    }

    res.json({
      success: true,
      subscription: {
        id: subscription._id.toString(),
        bond_address: subscription.bond_address,
        threshold: subscription.threshold,
        check_frequency: subscription.check_frequency
      },
      channels: channelResults
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/verify/email', (req, res) => verifyChannel(req, res, 'email'));
router.post('/verify/twilio', (req, res) => verifyChannel(req, res, 'twilio'));
router.post('/verify/discord', (req, res) => verifyChannel(req, res, 'discord'));
router.post('/verify/telegram', (req, res) => verifyChannel(req, res, 'telegram'));

router.get('/subscription/:subscriptionId/channels', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    
    const channels = await NotificationChannel.find({ 
      subscription_id: subscriptionId 
    });
    
    res.json({
      channels: channels.map(c => ({
        id: c._id.toString(),
        type: c.channel_type,
        value: c.channel_value,
        is_verified: c.is_verified
      }))
    });
  } catch (error) {
    console.error('Get subscription channels error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/subscription/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const subscription = await Subscription.findByAddress(address);
    
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const channels = await NotificationChannel.find({ 
      subscription_id: subscription._id 
    });
    
    res.json({
      subscription: {
        id: subscription._id.toString(),
        bond_address: subscription.bond_address,
        threshold: subscription.threshold,
        check_frequency: subscription.check_frequency,
        last_balance: subscription.last_balance,
        last_checked: subscription.last_checked,
        is_active: subscription.is_active
      },
      channels: channels.map(c => ({
        id: c._id.toString(),
        type: c.channel_type,
        value: c.channel_value,
        is_verified: c.is_verified
      }))
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/check-duplicate/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { type, value } = req.query;
    
    if (!type || !value) {
      return res.status(400).json({ error: 'type and value query parameters are required' });
    }
    
    if (!['email', 'sms'].includes(type)) {
      return res.status(400).json({ error: 'type must be email or sms' });
    }
    
    const subscription = await Subscription.findByAddress(address);
    
    if (!subscription) {
      return res.json({ isDuplicate: false });
    }
    
    const existingChannel = await NotificationChannel.findOne({
      subscription_id: subscription._id,
      channel_type: type,
      channel_value: value
    });
    
    res.json({ 
      isDuplicate: !!existingChannel,
      isVerified: existingChannel ? existingChannel.is_verified : false
    });
  } catch (error) {
    console.error('Check duplicate error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/auth/discord/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    console.log('Discord OAuth callback received:', { code: !!code, state: !!state, query: req.query });

    if (!code || !state) {
      console.error('Missing code or state in Discord callback');
      return res.send(renderOAuthPage({
        type: 'error',
        title: 'Verification Failed',
        message: 'Invalid request. Please try again from the widget.'
      }));
    }

    const stateData = discordOAuth.getState(state);
    if (!stateData) {
      console.error('Invalid or expired state in Discord callback');
      return res.send(renderOAuthPage({
        type: 'error',
        title: 'Verification Failed',
        message: 'Invalid or expired verification request. Please try again from the widget.'
      }));
    }

    const userInfo = await discordOAuth.exchangeCode(code);
    
    const subscriptionId = stateData.subscription_id;
    let channel = await NotificationChannel.findOne({
      subscription_id: subscriptionId,
      channel_type: 'discord'
    });

    if (!channel) {
      channel = await NotificationChannel.create({
        subscription_id: subscriptionId,
        channel_type: 'discord',
        channel_value: userInfo.id,
        is_verified: true
      });
    } else {
      channel = await NotificationChannel.findByIdAndUpdate(
        channel._id,
        { 
          channel_value: userInfo.id,
          is_verified: true,
          verification_code: null,
          verification_expires: null
        },
        { new: true }
      );
    }

    res.send(renderOAuthPage({
      type: 'success',
      title: 'Discord Verification Completed',
      message: 'You can close this page now.'
    }));
  } catch (error) {
    console.error('Discord OAuth callback error:', error);
    res.send(renderOAuthPage({
      type: 'error',
      title: 'Verification Failed',
      message: 'There was an error verifying your Discord account. Please try again.'
    }));
  }
});

router.get('/auth/discord/bot-callback', async (req, res) => {
  const widgetDomain = process.env.WIDGET_DOMAIN || 'https://widgets-api.novaconsortium.org';
  res.redirect(`${widgetDomain}/widget?discord_bot_added=true`);
});

router.post('/auth/discord/url', async (req, res) => {
  try {
    const { subscription_id } = req.body;
    
    if (!subscription_id) {
      return res.status(400).json({ error: 'subscription_id is required' });
    }

    const state = discordOAuth.generateState();
    discordOAuth.storeState(state, { subscription_id });
    
    const authUrl = discordOAuth.getAuthorizationUrl(state);
    
    res.json({ success: true, auth_url: authUrl });
  } catch (error) {
    console.error('Discord OAuth URL error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/auth/telegram/link', async (req, res) => {
  try {
    const { subscription_id } = req.body;
    
    if (!subscription_id) {
      return res.status(400).json({ error: 'subscription_id is required' });
    }

    const botUsername = await telegramService.getBotUsername();
    if (!botUsername) {
      return res.status(500).json({ error: 'Telegram bot not configured' });
    }

    const verificationCode = telegramService.generateOTP();
    
    telegramService.storeSubscriptionForVerification(verificationCode, subscription_id);

    res.json({
      success: true,
      bot_username: botUsername,
      bot_url: `https://t.me/${botUsername}`,
      verification_code: verificationCode,
      instructions: `1. Click the link to start the bot\n2. Send /start to the bot\n3. Use /verify ${verificationCode} to verify`
    });
  } catch (error) {
    console.error('Telegram link error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
