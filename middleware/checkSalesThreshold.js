const User = require('../models/User');

// Legal thresholds for individual sellers (particuliers) in France
const LEGAL_THRESHOLDS = {
  MAX_REVENUE: 3000, // 3000 EUR annual revenue
  MAX_TRANSACTIONS: 20, // 20 transactions per year
  WARNING_THRESHOLD: 0.8 // 80% of threshold triggers warning
};

/**
 * Middleware to check if a seller has exceeded legal sales thresholds
 * Should be called BEFORE completing a transaction
 */
const checkSalesThreshold = async (req, res, next) => {
  try {
    const sellerId = req.sellerId || req.body.sellerId || req.params.sellerId;

    if (!sellerId) {
      return res.status(400).json({
        error: 'Seller ID is required'
      });
    }

    const seller = await User.findById(sellerId);

    if (!seller) {
      return res.status(404).json({
        error: 'Seller not found'
      });
    }

    // Check if seller is a printer (only printers can sell)
    if (seller.role !== 'printer') {
      return res.status(403).json({
        error: 'Only printers can sell on this platform'
      });
    }

    // Check if account is already blocked
    if (seller.accountBlocked) {
      return res.status(403).json({
        error: 'Your account is blocked',
        reason: seller.blockReason,
        requiresAction: true,
        message: 'Please upgrade to micro-entrepreneur status to continue selling'
      });
    }

    // Reset counters if year has changed
    const currentYear = new Date().getFullYear();
    if (!seller.revenueYear || seller.revenueYear < currentYear) {
      seller.yearlyRevenue = 0;
      seller.yearlyTransactionCount = 0;
      seller.revenueYear = currentYear;
      await seller.save();
    }

    // Only check thresholds for "particulier" status
    if (seller.businessStatus === 'particulier') {
      const transactionAmount = req.body.amount || req.transactionAmount || 0;

      // Calculate potential new totals
      const potentialRevenue = seller.yearlyRevenue + transactionAmount;
      const potentialTransactions = seller.yearlyTransactionCount + 1;

      // Check if this transaction would exceed thresholds
      const wouldExceedRevenue = potentialRevenue > LEGAL_THRESHOLDS.MAX_REVENUE;
      const wouldExceedTransactions = potentialTransactions > LEGAL_THRESHOLDS.MAX_TRANSACTIONS;

      if (wouldExceedRevenue || wouldExceedTransactions) {
        // Block the account
        seller.accountBlocked = true;
        seller.blockReason = 'Seuil légal dépassé - création micro-entreprise obligatoire';
        await seller.save();

        return res.status(403).json({
          error: 'Legal threshold exceeded',
          message: 'Vous avez dépassé les seuils légaux de vente pour un particulier (3 000 € ou 20 transactions par an). Vous devez créer une micro-entreprise pour continuer à vendre.',
          currentRevenue: seller.yearlyRevenue,
          currentTransactions: seller.yearlyTransactionCount,
          thresholds: {
            maxRevenue: LEGAL_THRESHOLDS.MAX_REVENUE,
            maxTransactions: LEGAL_THRESHOLDS.MAX_TRANSACTIONS
          },
          requiresAction: true,
          actionUrl: '/guide-microentreprise.html'
        });
      }

      // Calculate usage percentages
      const revenueUsage = (potentialRevenue / LEGAL_THRESHOLDS.MAX_REVENUE) * 100;
      const transactionUsage = (potentialTransactions / LEGAL_THRESHOLDS.MAX_TRANSACTIONS) * 100;

      // Attach threshold info to request for potential warning
      req.thresholdInfo = {
        revenueUsage,
        transactionUsage,
        shouldWarn: revenueUsage >= 80 || transactionUsage >= 80
      };
    }

    // Attach seller to request for use in next middleware/controller
    req.seller = seller;
    next();

  } catch (error) {
    console.error('Error in checkSalesThreshold middleware:', error);
    res.status(500).json({
      error: 'Error checking sales threshold',
      details: error.message
    });
  }
};

/**
 * Helper function to get current threshold status for a seller
 */
const getThresholdStatus = async (sellerId) => {
  try {
    const seller = await User.findById(sellerId);

    if (!seller) {
      throw new Error('Seller not found');
    }

    // Reset if year changed
    const currentYear = new Date().getFullYear();
    if (!seller.revenueYear || seller.revenueYear < currentYear) {
      return {
        yearlyRevenue: 0,
        yearlyTransactionCount: 0,
        revenueRemaining: LEGAL_THRESHOLDS.MAX_REVENUE,
        transactionsRemaining: LEGAL_THRESHOLDS.MAX_TRANSACTIONS,
        revenueUsagePercent: 0,
        transactionUsagePercent: 0,
        businessStatus: seller.businessStatus,
        accountBlocked: seller.accountBlocked,
        blockReason: seller.blockReason
      };
    }

    const revenueRemaining = Math.max(0, LEGAL_THRESHOLDS.MAX_REVENUE - seller.yearlyRevenue);
    const transactionsRemaining = Math.max(0, LEGAL_THRESHOLDS.MAX_TRANSACTIONS - seller.yearlyTransactionCount);
    const revenueUsagePercent = (seller.yearlyRevenue / LEGAL_THRESHOLDS.MAX_REVENUE) * 100;
    const transactionUsagePercent = (seller.yearlyTransactionCount / LEGAL_THRESHOLDS.MAX_TRANSACTIONS) * 100;

    return {
      yearlyRevenue: seller.yearlyRevenue,
      yearlyTransactionCount: seller.yearlyTransactionCount,
      revenueRemaining,
      transactionsRemaining,
      revenueUsagePercent: Math.min(100, revenueUsagePercent),
      transactionUsagePercent: Math.min(100, transactionUsagePercent),
      businessStatus: seller.businessStatus,
      accountBlocked: seller.accountBlocked,
      blockReason: seller.blockReason,
      thresholds: LEGAL_THRESHOLDS
    };

  } catch (error) {
    throw error;
  }
};

module.exports = {
  checkSalesThreshold,
  getThresholdStatus,
  LEGAL_THRESHOLDS
};
