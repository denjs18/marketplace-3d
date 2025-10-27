const Transaction = require('../models/Transaction');
const Project = require('../models/Project');
const Quote = require('../models/Quote');
const User = require('../models/User');
const { createPaymentIntent, createTransfer, calculatePrinterPayout } = require('../config/stripe');
const { calculateCommission } = require('../utils/calculateCommission');
const { sendPaymentConfirmationEmail } = require('../utils/email');
const { sendThresholdWarning, sendAccountBlockedEmail } = require('../utils/notificationService');

/**
 * Create payment intent for a quote
 */
exports.createPaymentIntent = async (req, res) => {
  try {
    const { quoteId } = req.body;

    const quote = await Quote.findById(quoteId).populate('printer');

    if (!quote) {
      return res.status(404).json({
        error: 'Quote not found'
      });
    }

    const project = await Project.findById(quote.project);

    if (!project) {
      return res.status(404).json({
        error: 'Project not found'
      });
    }

    // Verify client owns the project
    if (project.client.toString() !== req.userId.toString()) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Verify quote is accepted
    if (quote.status !== 'accepted') {
      return res.status(400).json({
        error: 'Quote must be accepted before payment'
      });
    }

    // Check seller threshold compliance
    const printer = await User.findById(quote.printer._id);

    if (printer.accountBlocked) {
      return res.status(403).json({
        error: 'Seller account is blocked',
        reason: printer.blockReason,
        message: 'The seller cannot accept new orders at this time'
      });
    }

    // Check if seller would exceed threshold with this transaction
    if (printer.businessStatus === 'particulier') {
      const currentYear = new Date().getFullYear();

      // Reset if year changed
      if (!printer.revenueYear || printer.revenueYear < currentYear) {
        printer.yearlyRevenue = 0;
        printer.yearlyTransactionCount = 0;
        printer.revenueYear = currentYear;
      }

      const potentialRevenue = (printer.yearlyRevenue || 0) + quote.price;
      const potentialTransactions = (printer.yearlyTransactionCount || 0) + 1;

      if (potentialRevenue > 3000 || potentialTransactions > 20) {
        printer.accountBlocked = true;
        printer.blockReason = 'Seuil légal dépassé - création micro-entreprise obligatoire';
        await printer.save();

        // Send blocked notification
        sendAccountBlockedEmail(printer).catch(err =>
          console.error('Failed to send account blocked email:', err)
        );

        return res.status(403).json({
          error: 'Legal threshold would be exceeded',
          message: 'This transaction would exceed legal thresholds for individual sellers. The seller must upgrade to micro-entrepreneur status.',
          thresholds: {
            currentRevenue: printer.yearlyRevenue,
            currentTransactions: printer.yearlyTransactionCount,
            maxRevenue: 3000,
            maxTransactions: 20
          }
        });
      }
    }

    // Check if transaction already exists
    const existingTransaction = await Transaction.findOne({
      quote: quoteId,
      status: { $in: ['completed', 'processing'] }
    });

    if (existingTransaction) {
      return res.status(400).json({
        error: 'Payment already processed for this quote'
      });
    }

    // Create payment intent
    const paymentIntent = await createPaymentIntent(
      quote.price,
      'eur',
      {
        projectId: project._id.toString(),
        quoteId: quote._id.toString(),
        clientId: req.userId.toString(),
        printerId: quote.printer._id.toString()
      }
    );

    // Create transaction record
    const transaction = new Transaction({
      project: project._id,
      quote: quote._id,
      client: req.userId,
      printer: quote.printer._id,
      amount: quote.price,
      commission: calculateCommission(quote.price),
      printerPayout: calculatePrinterPayout(quote.price),
      stripePaymentIntentId: paymentIntent.id,
      status: 'pending'
    });

    await transaction.save();

    res.json({
      clientSecret: paymentIntent.client_secret,
      transactionId: transaction._id,
      amount: quote.price
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      error: 'Failed to create payment intent',
      details: error.message
    });
  }
};

/**
 * Confirm payment (webhook or manual confirmation)
 */
exports.confirmPayment = async (req, res) => {
  try {
    const { transactionId, paymentIntentId } = req.body;

    const transaction = await Transaction.findById(transactionId)
      .populate('project')
      .populate('printer')
      .populate('client');

    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction not found'
      });
    }

    if (transaction.status === 'completed') {
      return res.status(400).json({
        error: 'Transaction already completed'
      });
    }

    // Update transaction status
    transaction.status = 'processing';
    transaction.processedAt = new Date();
    await transaction.save();

    // Update project status
    const project = await Project.findById(transaction.project);
    if (project && project.status === 'quoted') {
      project.status = 'in_progress';
      await project.save();
    }

    // Send confirmation email
    if (transaction.client && transaction.project) {
      sendPaymentConfirmationEmail(transaction.client, transaction.project, transaction).catch(err =>
        console.error('Failed to send payment confirmation email:', err)
      );
    }

    res.json({
      message: 'Payment confirmed successfully',
      transaction
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      error: 'Failed to confirm payment',
      details: error.message
    });
  }
};

/**
 * Process payout to printer (called when project is completed)
 */
exports.processPayout = async (req, res) => {
  try {
    const { transactionId } = req.body;

    const transaction = await Transaction.findById(transactionId)
      .populate('printer')
      .populate('project');

    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction not found'
      });
    }

    if (transaction.status !== 'processing') {
      return res.status(400).json({
        error: 'Transaction must be in processing state'
      });
    }

    const project = await Project.findById(transaction.project);

    if (!project || project.status !== 'completed') {
      return res.status(400).json({
        error: 'Project must be completed before payout'
      });
    }

    // Check if printer has Stripe account
    if (!transaction.printer.stripeAccountId) {
      return res.status(400).json({
        error: 'Printer has not set up payment account'
      });
    }

    // Create transfer to printer
    const transfer = await createTransfer(
      transaction.printerPayout,
      transaction.printer.stripeAccountId,
      {
        transactionId: transaction._id.toString(),
        projectId: project._id.toString()
      }
    );

    // Update transaction
    transaction.complete(transfer.id);
    await transaction.save();

    // Update printer earnings and sales statistics
    const printer = await User.findById(transaction.printer);
    printer.totalEarnings = (printer.totalEarnings || 0) + transaction.printerPayout;
    printer.totalProjects = (printer.totalProjects || 0) + 1;

    // Update yearly sales statistics for legal threshold tracking
    const currentYear = new Date().getFullYear();

    // Reset counters if year has changed
    if (!printer.revenueYear || printer.revenueYear < currentYear) {
      printer.yearlyRevenue = 0;
      printer.yearlyTransactionCount = 0;
      printer.revenueYear = currentYear;
    }

    // Increment yearly statistics
    printer.yearlyRevenue = (printer.yearlyRevenue || 0) + transaction.amount;
    printer.yearlyTransactionCount = (printer.yearlyTransactionCount || 0) + 1;

    // Check if threshold warning should be sent (at 80%)
    const REVENUE_THRESHOLD = 3000;
    const TRANSACTION_THRESHOLD = 20;

    const revenueUsage = (printer.yearlyRevenue / REVENUE_THRESHOLD) * 100;
    const transactionUsage = (printer.yearlyTransactionCount / TRANSACTION_THRESHOLD) * 100;

    // Send warning if approaching threshold (>= 80%) and status is still 'particulier'
    if (printer.businessStatus === 'particulier' &&
        (revenueUsage >= 80 || transactionUsage >= 80) &&
        !printer.accountBlocked) {
      sendThresholdWarning(printer, {
        yearlyRevenue: printer.yearlyRevenue,
        yearlyTransactionCount: printer.yearlyTransactionCount,
        revenueUsage,
        transactionUsage
      }).catch(err => console.error('Failed to send threshold warning:', err));
    }

    await printer.save();

    res.json({
      message: 'Payout processed successfully',
      transaction
    });
  } catch (error) {
    console.error('Process payout error:', error);

    // Mark transaction as failed
    if (req.body.transactionId) {
      await Transaction.findByIdAndUpdate(req.body.transactionId, {
        status: 'failed',
        errorMessage: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to process payout',
      details: error.message
    });
  }
};

/**
 * Get transaction history
 */
exports.getTransactions = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = {};

    // Filter by role
    if (req.userRole === 'client') {
      query.client = req.userId;
    } else if (req.userRole === 'printer') {
      query.printer = req.userId;
    }

    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const transactions = await Transaction.find(query)
      .populate('project', 'title status')
      .populate('client', 'firstName lastName')
      .populate('printer', 'firstName lastName companyName')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(query);

    res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      error: 'Failed to get transactions',
      details: error.message
    });
  }
};

/**
 * Get earnings summary for printer
 */
exports.getEarningsSummary = async (req, res) => {
  try {
    if (req.userRole !== 'printer') {
      return res.status(403).json({
        error: 'Access denied. Printers only.'
      });
    }

    const { startDate, endDate } = req.query;

    const earnings = await Transaction.getPrinterEarnings(req.userId, startDate, endDate);

    res.json({ earnings });
  } catch (error) {
    console.error('Get earnings summary error:', error);
    res.status(500).json({
      error: 'Failed to get earnings summary',
      details: error.message
    });
  }
};
