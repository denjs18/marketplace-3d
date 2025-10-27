const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { authenticate } = require('../middleware/auth');

/**
 * Middleware to check if user is admin
 */
const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);

    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied. Admin only.'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      error: 'Authorization check failed',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/admin/dac7-report/:year
 * @desc    Generate DAC7 compliance report for a specific year
 * @access  Private (Admin only)
 */
router.get('/dac7-report/:year', authenticate, isAdmin, async (req, res) => {
  try {
    const year = parseInt(req.params.year);

    if (!year || year < 2020 || year > new Date().getFullYear()) {
      return res.status(400).json({
        error: 'Invalid year. Please provide a valid year between 2020 and current year.'
      });
    }

    // Get all printers (sellers)
    const sellers = await User.find({
      role: 'printer'
    }).select('-password -refreshToken');

    // Get all transactions for the specified year
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const transactions = await Transaction.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'completed'
    }).populate('printer', 'email firstName lastName');

    // Aggregate data by seller
    const sellerData = {};

    transactions.forEach(transaction => {
      const sellerId = transaction.printer._id.toString();

      if (!sellerData[sellerId]) {
        sellerData[sellerId] = {
          totalRevenue: 0,
          transactionCount: 0,
          printer: transaction.printer
        };
      }

      sellerData[sellerId].totalRevenue += transaction.amount || 0;
      sellerData[sellerId].transactionCount += 1;
    });

    // Build CSV report
    const csvHeaders = [
      'Prénom',
      'Nom',
      'Email',
      'Date de naissance',
      'Lieu de naissance',
      'Adresse - Rue',
      'Adresse - Code Postal',
      'Adresse - Ville',
      'Adresse - Pays',
      'Statut',
      'SIRET',
      'TVA',
      'CA Total (EUR)',
      'Nombre de transactions',
      'IBAN'
    ];

    const csvRows = [];

    for (const seller of sellers) {
      const data = sellerData[seller._id.toString()] || { totalRevenue: 0, transactionCount: 0 };

      // Only include sellers who had transactions
      if (data.transactionCount > 0) {
        csvRows.push([
          seller.firstName || '',
          seller.lastName || '',
          seller.email || '',
          seller.birthDate ? new Date(seller.birthDate).toLocaleDateString('fr-FR') : '',
          seller.birthPlace ? `${seller.birthPlace.city || ''}, ${seller.birthPlace.country || ''}` : '',
          seller.address?.street || '',
          seller.address?.postalCode || '',
          seller.address?.city || '',
          seller.address?.country || '',
          seller.businessStatus || 'particulier',
          seller.siret || '',
          seller.tva || '',
          data.totalRevenue.toFixed(2),
          data.transactionCount,
          seller.iban || ''
        ]);
      }
    }

    // Format as CSV
    const csvContent = [
      csvHeaders.join(';'),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=dac7-report-${year}.csv`);
    res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf-8'));

    res.send('\uFEFF' + csvContent); // BOM for UTF-8

  } catch (error) {
    console.error('DAC7 report generation error:', error);
    res.status(500).json({
      error: 'Failed to generate DAC7 report',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/admin/sellers-at-risk
 * @desc    Get list of sellers approaching legal thresholds
 * @access  Private (Admin only)
 */
router.get('/sellers-at-risk', authenticate, isAdmin, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    // Find sellers with businessStatus 'particulier' who are at or above 80% of thresholds
    const sellersAtRisk = await User.find({
      role: 'printer',
      businessStatus: 'particulier',
      revenueYear: currentYear,
      $or: [
        { yearlyRevenue: { $gte: 2400 } }, // 80% of 3000
        { yearlyTransactionCount: { $gte: 16 } } // 80% of 20
      ]
    }).select('firstName lastName email yearlyRevenue yearlyTransactionCount accountBlocked');

    const sellersWithPercentages = sellersAtRisk.map(seller => ({
      _id: seller._id,
      name: `${seller.firstName} ${seller.lastName}`,
      email: seller.email,
      yearlyRevenue: seller.yearlyRevenue || 0,
      yearlyTransactionCount: seller.yearlyTransactionCount || 0,
      revenueUsage: ((seller.yearlyRevenue || 0) / 3000 * 100).toFixed(1),
      transactionUsage: ((seller.yearlyTransactionCount || 0) / 20 * 100).toFixed(1),
      accountBlocked: seller.accountBlocked,
      status: seller.accountBlocked ? 'blocked' : 'warning'
    }));

    res.json({
      count: sellersWithPercentages.length,
      sellers: sellersWithPercentages
    });

  } catch (error) {
    console.error('Sellers at risk query error:', error);
    res.status(500).json({
      error: 'Failed to get sellers at risk',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/admin/statistics
 * @desc    Get platform statistics
 * @access  Private (Admin only)
 */
router.get('/statistics', authenticate, isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalClients = await User.countDocuments({ role: 'client' });
    const totalPrinters = await User.countDocuments({ role: 'printer' });

    const printersByStatus = await User.aggregate([
      { $match: { role: 'printer' } },
      { $group: { _id: '$businessStatus', count: { $sum: 1 } } }
    ]);

    const blockedAccounts = await User.countDocuments({
      role: 'printer',
      accountBlocked: true
    });

    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);

    const yearlyTransactions = await Transaction.countDocuments({
      createdAt: { $gte: startOfYear },
      status: 'completed'
    });

    const yearlyRevenue = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfYear },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          commission: { $sum: '$commission' }
        }
      }
    ]);

    res.json({
      users: {
        total: totalUsers,
        clients: totalClients,
        printers: totalPrinters
      },
      printers: {
        byStatus: printersByStatus,
        blocked: blockedAccounts
      },
      transactions: {
        year: currentYear,
        count: yearlyTransactions,
        revenue: yearlyRevenue[0]?.total || 0,
        commission: yearlyRevenue[0]?.commission || 0
      }
    });

  } catch (error) {
    console.error('Statistics query error:', error);
    res.status(500).json({
      error: 'Failed to get statistics',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/admin/send-threshold-reminder/:userId
 * @desc    Manually send threshold warning to a specific seller
 * @access  Private (Admin only)
 */
router.post('/send-threshold-reminder/:userId', authenticate, isAdmin, async (req, res) => {
  try {
    const seller = await User.findById(req.params.userId);

    if (!seller) {
      return res.status(404).json({
        error: 'Seller not found'
      });
    }

    if (seller.role !== 'printer') {
      return res.status(400).json({
        error: 'User is not a printer/seller'
      });
    }

    const { sendThresholdWarning } = require('../utils/notificationService');

    const revenueUsage = (seller.yearlyRevenue / 3000) * 100;
    const transactionUsage = (seller.yearlyTransactionCount / 20) * 100;

    await sendThresholdWarning(seller, {
      yearlyRevenue: seller.yearlyRevenue || 0,
      yearlyTransactionCount: seller.yearlyTransactionCount || 0,
      revenueUsage,
      transactionUsage
    });

    res.json({
      message: 'Threshold reminder sent successfully',
      seller: {
        email: seller.email,
        name: `${seller.firstName} ${seller.lastName}`
      }
    });

  } catch (error) {
    console.error('Send reminder error:', error);
    res.status(500).json({
      error: 'Failed to send reminder',
      details: error.message
    });
  }
});

module.exports = router;
