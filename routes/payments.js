const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, isClient, isPrinter } = require('../middleware/auth');

/**
 * @route   POST /api/payments/create-intent
 * @desc    Create payment intent
 * @access  Private (Client only)
 */
router.post('/create-intent', authenticate, isClient, paymentController.createPaymentIntent);

/**
 * @route   POST /api/payments/confirm
 * @desc    Confirm payment
 * @access  Private
 */
router.post('/confirm', authenticate, paymentController.confirmPayment);

/**
 * @route   POST /api/payments/payout
 * @desc    Process payout to printer
 * @access  Private
 */
router.post('/payout', authenticate, paymentController.processPayout);

/**
 * @route   GET /api/payments/transactions
 * @desc    Get transaction history
 * @access  Private
 */
router.get('/transactions', authenticate, paymentController.getTransactions);

/**
 * @route   GET /api/payments/earnings
 * @desc    Get earnings summary
 * @access  Private (Printer only)
 */
router.get('/earnings', authenticate, isPrinter, paymentController.getEarningsSummary);

module.exports = router;
