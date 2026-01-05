const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  bond_address: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  threshold: {
    type: Number,
    required: true
  },
  check_frequency: {
    type: Number,
    required: true,
    default: 900
  },
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },
  last_balance: {
    type: Number,
    default: null
  },
  last_checked: {
    type: Number,
    default: null
  },
  brand: {
    type: String,
    enum: ['jpool'],
    default: 'jpool',
    index: true
  }
}, {
  timestamps: true
});

const notificationChannelSchema = new mongoose.Schema({
  subscription_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true,
    index: true
  },
  channel_type: {
    type: String,
    required: true,
    enum: ['sms', 'email', 'discord', 'telegram']
  },
  channel_value: {
    type: String,
    required: false,
    default: null
  },
  is_verified: {
    type: Boolean,
    default: false,
    index: true
  },
  verification_code: {
    type: String,
    default: null
  },
  verification_expires: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

notificationChannelSchema.index(
  { subscription_id: 1, channel_type: 1 },
  { unique: true }
);

const Subscription = mongoose.model('Subscription', subscriptionSchema);
const NotificationChannel = mongoose.model('NotificationChannel', notificationChannelSchema);

Subscription.findByAddress = async function(address) {
  return await this.findOne({ bond_address: address });
};

Subscription.findAllActive = async function() {
  return await this.find({ is_active: true });
};

NotificationChannel.findBySubscription = async function(subscriptionId) {
  const id = typeof subscriptionId === 'string' 
    ? new mongoose.Types.ObjectId(subscriptionId)
    : subscriptionId;
  
  return await this.find({ 
    subscription_id: id, 
    is_verified: true 
  });
};

NotificationChannel.findByVerificationCode = async function(code, channelType) {
  return await this.findOne({ 
    verification_code: code, 
    channel_type: channelType, 
    is_verified: false 
  });
};

NotificationChannel.verify = async function(id) {
  return await this.findByIdAndUpdate(
    id,
    { 
      is_verified: true, 
      verification_code: null, 
      verification_expires: null 
    },
    { new: true }
  );
};

module.exports = { Subscription, NotificationChannel };
