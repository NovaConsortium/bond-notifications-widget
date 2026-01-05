const cron = require('node-cron');
const { Subscription } = require('../models/subscription');
const solanaService = require('../services/solana');
const notificationService = require('../services/notifications');

class BalanceChecker {
  constructor() {
    this.isRunning = false;
    this.lastCheck = null;
  }

  async checkBalances() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    const now = Math.floor(Date.now() / 1000);

    try {
      const subscriptions = await Subscription.findAllActive();

      for (const subscription of subscriptions) {
        try {
          const checkFrequency = subscription.check_frequency || 900;
          const lastChecked = subscription.last_checked || 0;
          
          if (now - lastChecked < checkFrequency) {
            continue;
          }

          const currentBalance = await solanaService.getBalance(subscription.bond_address);

          await Subscription.findByIdAndUpdate(
            subscription._id,
            {
              last_balance: currentBalance,
              last_checked: now
            },
            { new: true }
          );

          if (currentBalance < subscription.threshold) {
            const previousBalance = subscription.last_balance;
            
            if (previousBalance === null || previousBalance >= subscription.threshold) {
              const brand = subscription.brand || 'jpool';
              await notificationService.sendLowBalanceNotifications(
                subscription._id.toString(),
                subscription.bond_address,
                currentBalance,
                subscription.threshold,
                brand
              );
            }
          }
        } catch (error) {
          console.error(`Error checking subscription ${subscription._id}:`, error);
        }
      }

      this.lastCheck = new Date();
    } catch (error) {
      console.error('Balance check error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    const cronSchedule = process.env.BALANCE_CHECK_CRON || '*/15 * * * *';
    
    this.checkBalances();
    
    cron.schedule(cronSchedule, () => {
      this.checkBalances();
    });
  }
}

module.exports = new BalanceChecker();
