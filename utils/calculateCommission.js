/**
 * Commission calculation utilities
 * Platform takes 10% commission on all transactions
 */

const COMMISSION_RATE = 0.10; // 10%

/**
 * Calculate platform commission
 * @param {Number} amount - Total transaction amount
 * @returns {Number} Commission amount
 */
const calculateCommission = (amount) => {
  if (typeof amount !== 'number' || amount < 0) {
    throw new Error('Amount must be a positive number');
  }
  return Number((amount * COMMISSION_RATE).toFixed(2));
};

/**
 * Calculate printer payout (amount after commission)
 * @param {Number} amount - Total transaction amount
 * @returns {Number} Printer payout amount
 */
const calculatePrinterPayout = (amount) => {
  if (typeof amount !== 'number' || amount < 0) {
    throw new Error('Amount must be a positive number');
  }
  return Number((amount * (1 - COMMISSION_RATE)).toFixed(2));
};

/**
 * Calculate breakdown of a transaction
 * @param {Number} amount - Total transaction amount
 * @returns {Object} Breakdown with commission and payout
 */
const calculateTransactionBreakdown = (amount) => {
  if (typeof amount !== 'number' || amount < 0) {
    throw new Error('Amount must be a positive number');
  }

  const commission = calculateCommission(amount);
  const printerPayout = calculatePrinterPayout(amount);

  return {
    total: Number(amount.toFixed(2)),
    commission,
    printerPayout,
    commissionRate: COMMISSION_RATE,
    commissionPercentage: `${COMMISSION_RATE * 100}%`
  };
};

/**
 * Calculate suggested price for printer to achieve desired payout
 * @param {Number} desiredPayout - Amount printer wants to receive
 * @returns {Number} Total price to charge
 */
const calculatePriceForDesiredPayout = (desiredPayout) => {
  if (typeof desiredPayout !== 'number' || desiredPayout < 0) {
    throw new Error('Desired payout must be a positive number');
  }
  return Number((desiredPayout / (1 - COMMISSION_RATE)).toFixed(2));
};

/**
 * Validate transaction amount meets minimum threshold
 * @param {Number} amount - Transaction amount
 * @param {Number} minimumAmount - Minimum allowed amount (default 5€)
 * @returns {Boolean} Is valid
 */
const isValidTransactionAmount = (amount, minimumAmount = 5) => {
  return typeof amount === 'number' && amount >= minimumAmount;
};

/**
 * Calculate total earnings for multiple transactions
 * @param {Array} transactions - Array of transaction amounts
 * @returns {Object} Total breakdown
 */
const calculateTotalEarnings = (transactions) => {
  if (!Array.isArray(transactions)) {
    throw new Error('Transactions must be an array');
  }

  const total = transactions.reduce((sum, amount) => sum + (amount || 0), 0);

  return {
    totalRevenue: Number(total.toFixed(2)),
    totalCommission: calculateCommission(total),
    totalPrinterPayout: calculatePrinterPayout(total),
    transactionCount: transactions.length,
    averageTransaction: transactions.length > 0 ? Number((total / transactions.length).toFixed(2)) : 0
  };
};

/**
 * Format amount as currency
 * @param {Number} amount - Amount to format
 * @param {String} currency - Currency code (default EUR)
 * @returns {String} Formatted currency string
 */
const formatCurrency = (amount, currency = 'EUR') => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

/**
 * Get commission rate
 * @returns {Number} Current commission rate
 */
const getCommissionRate = () => {
  return COMMISSION_RATE;
};

/**
 * Get commission percentage as string
 * @returns {String} Commission percentage
 */
const getCommissionPercentage = () => {
  return `${COMMISSION_RATE * 100}%`;
};

module.exports = {
  COMMISSION_RATE,
  calculateCommission,
  calculatePrinterPayout,
  calculateTransactionBreakdown,
  calculatePriceForDesiredPayout,
  isValidTransactionAmount,
  calculateTotalEarnings,
  formatCurrency,
  getCommissionRate,
  getCommissionPercentage
};
