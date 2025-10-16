const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Stripe configuration and helper functions
 */

const COMMISSION_RATE = 0.10; // 10% commission

/**
 * Create a payment intent
 */
const createPaymentIntent = async (amount, currency = 'eur', metadata = {}) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    return paymentIntent;
  } catch (error) {
    console.error('Stripe payment intent error:', error);
    throw error;
  }
};

/**
 * Create a transfer to printer's connected account
 */
const createTransfer = async (amount, destination, metadata = {}) => {
  try {
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency: 'eur',
      destination,
      metadata,
    });
    return transfer;
  } catch (error) {
    console.error('Stripe transfer error:', error);
    throw error;
  }
};

/**
 * Create connected account for printer
 */
const createConnectedAccount = async (email, country = 'FR') => {
  try {
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      country,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    return account;
  } catch (error) {
    console.error('Stripe account creation error:', error);
    throw error;
  }
};

/**
 * Create account link for onboarding
 */
const createAccountLink = async (accountId, refreshUrl, returnUrl) => {
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
    return accountLink;
  } catch (error) {
    console.error('Stripe account link error:', error);
    throw error;
  }
};

/**
 * Calculate commission amount
 */
const calculateCommission = (totalAmount) => {
  return totalAmount * COMMISSION_RATE;
};

/**
 * Calculate printer payout (total - commission)
 */
const calculatePrinterPayout = (totalAmount) => {
  return totalAmount * (1 - COMMISSION_RATE);
};

module.exports = {
  stripe,
  COMMISSION_RATE,
  createPaymentIntent,
  createTransfer,
  createConnectedAccount,
  createAccountLink,
  calculateCommission,
  calculatePrinterPayout
};
