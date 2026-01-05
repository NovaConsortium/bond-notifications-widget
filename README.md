# Bond Notification Widget

A notification service that monitors Solana bond addresses and alerts users when balances drop below a set threshold. Supports Email, SMS, Discord, and Telegram notifications.

## Quick Start

```bash
npm install
cp example.env .env
# Configure your .env file
npm run dev
```

## Environment Variables

Create a `.env` file based on `example.env`:

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MongoDB connection string |
| `SOLANA_RPC_URL` | Solana RPC endpoint (default: mainnet) |

### Server

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `WIDGET_DOMAIN` | Public URL of your widget server | - |
| `API_BASE` | Base URL for API calls | `https://widgets-api.novaconsortium.org/api` |

### Notification Channels (Optional)

Configure the channels you want to support:

**SMS (Twilio)**
```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

**Email (SMTP)**
```env
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your_email
EMAIL_PASSWORD=your_password
EMAIL_FROM=notifications@example.com
```

**Discord**
```env
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=https://your-domain.com/api/auth/discord/callback
```

**Telegram**
```env
TELEGRAM_BOT_TOKEN=your_bot_token
```

## Adding Widget to Your Website


Add the script and a trigger button to your page:

```html
<script src="https://widgets-api.novaconsortium.org/jpool-widget.js"></script>
<button data-widget>Get Notified</button>
```

The widget automatically extracts the validator address from the page URL (e.g., `/validators/YOUR_VALIDATOR_ADDRESS`).

### Customization Options

#### Button Text
```html
<button data-widget data-button-text="Subscribe to Alerts">Subscribe</button>
```

#### Button Colors
```html
<button 
  data-widget 
  data-button-color="#ffd700"
  data-text-color="#1a1a1a"
>
  Get Notified
</button>
```

#### Full Custom Styling
```html
<button 
  data-widget 
  data-widget-style='{"backgroundColor":"#4CAF50","color":"white","padding":"1rem 2rem","borderRadius":"25px"}'
>
  Custom Button
</button>
```
