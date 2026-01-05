const axios = require('axios');

class DiscordOAuthService {
  constructor() {
    this.clientId = process.env.DISCORD_CLIENT_ID;
    this.clientSecret = process.env.DISCORD_CLIENT_SECRET;
    
    if (process.env.DISCORD_REDIRECT_URI) {
      this.redirectUri = process.env.DISCORD_REDIRECT_URI;
    } else {
      const isLocal = process.env.NODE_ENV !== 'production' || process.env.PORT === '3001' || !process.env.PORT;
      if (isLocal) {
        const port = process.env.PORT || '3001';
        this.redirectUri = `http://localhost:${port}/api/auth/discord/callback`;
      } else {
        const widgetDomain = process.env.WIDGET_DOMAIN || 'https://widgets-api.novaconsortium.org';
        this.redirectUri = `${widgetDomain}/api/auth/discord/callback`;
      }
    }
    
    console.log('Discord OAuth redirect URI:', this.redirectUri);
    this.oauthStates = new Map();
  }

  getAuthorizationUrl(state) {
    if (!this.clientId) {
      throw new Error('Discord client ID not configured');
    }

    const scopes = ['identify', 'guilds'];
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state: state
    });

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCode(code) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Discord OAuth credentials not configured');
    }

    try {
      const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const { access_token } = tokenResponse.data;

      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });

      return {
        id: userResponse.data.id,
        username: userResponse.data.username,
        discriminator: userResponse.data.discriminator,
        avatar: userResponse.data.avatar
      };
    } catch (error) {
      throw new Error(`Discord OAuth error: ${error.response?.data?.error_description || error.message}`);
    }
  }

  storeState(state, data) {
    this.oauthStates.set(state, {
      ...data,
      expiresAt: Date.now() + 10 * 60 * 1000
    });
  }

  getState(state) {
    const stored = this.oauthStates.get(state);
    if (!stored) {
      return null;
    }
    if (stored.expiresAt < Date.now()) {
      this.oauthStates.delete(state);
      return null;
    }
    this.oauthStates.delete(state);
    return stored;
  }

  generateState() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  getBotInviteUrl() {
    if (!this.clientId) {
      throw new Error('Discord client ID not configured');
    }

    return `https://discord.com/oauth2/authorize?client_id=${this.clientId}`;
  }
}

module.exports = new DiscordOAuthService();

