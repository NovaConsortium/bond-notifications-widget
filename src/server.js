require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { connectDB } = require('./config/database');
const apiRoutes = require('./routes/api');
const widgetRoutes = require('./routes/widget');
const balanceChecker = require('./jobs/balanceChecker');
const discordService = require('./services/discord');
const telegramService = require('./services/telegram');
const { NotificationChannel } = require('./models/subscription');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);
app.use('/widget', widgetRoutes);
app.use('/validator', widgetRoutes);

app.get('/iframe-ui/index.html', (req, res) => {
  const indexPath = path.join(__dirname, '../../iframe-ui/dist/index.html');
  
  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf8');
    const voteKey = req.query.vote;
    const injectScript = voteKey ? `<script>window.VOTE_KEY = '${voteKey}';</script>` : '';
    html = html.replace('<div id="root"></div>', `${injectScript}\n    <div id="root"></div>`);
    res.send(html);
  } else {
    res.status(404).send('iframe-ui not built. Run: npm run iframe-ui:build');
  }
});

app.use('/iframe-ui', express.static(path.join(__dirname, '../../iframe-ui/dist')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

discordService.setVerificationCallback(async (userId, username, subscriptionId) => {
  if (!subscriptionId) {
    console.error('Discord verification callback called without subscriptionId');
    return;
  }
  
  const channel = await NotificationChannel.findOne({
    subscription_id: subscriptionId,
    channel_type: 'discord',
    is_verified: false
  }).sort({ createdAt: -1 });
  
  if (channel) {
    await NotificationChannel.findByIdAndUpdate(
      channel._id,
      {
        channel_value: userId,
        is_verified: true,
        verification_code: null,
        verification_expires: null
      }
    );
  } else {
    await NotificationChannel.create({
      subscription_id: subscriptionId,
      channel_type: 'discord',
      channel_value: userId,
      is_verified: true
    });
  }
});

telegramService.setVerificationCallback(async (userId, username, subscriptionId) => {
  if (!subscriptionId) {
    console.error('Telegram verification callback called without subscriptionId');
    return;
  }
  
  const channel = await NotificationChannel.findOne({
    subscription_id: subscriptionId,
    channel_type: 'telegram',
    is_verified: false
  }).sort({ createdAt: -1 });
  
  if (channel) {
    await NotificationChannel.findByIdAndUpdate(
      channel._id,
      {
        channel_value: userId,
        is_verified: true,
        verification_code: null,
        verification_expires: null
      }
    );
  } else {
    await NotificationChannel.create({
      subscription_id: subscriptionId,
      channel_type: 'telegram',
      channel_value: userId,
      is_verified: true
    });
  }
});

connectDB().then(() => {
  balanceChecker.start();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

