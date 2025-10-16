const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quoteController');
const { authenticate, isPrinter, isClient } = require('../middleware/auth');
const { validateQuote, validateObjectId } = require('../middleware/validation');

/**
 * @route   POST /api/quotes
 * @desc    Create new quote
 * @access  Private (Printer only)
 */
router.post('/', authenticate, isPrinter, validateQuote, quoteController.createQuote);

/**
 * @route   GET /api/quotes/project/:projectId
 * @desc    Get quotes for a project
 * @access  Private
 */
router.get('/project/:projectId', authenticate, validateObjectId('projectId'), quoteController.getProjectQuotes);

/**
 * @route   GET /api/quotes/my-quotes
 * @desc    Get printer's own quotes
 * @access  Private (Printer only)
 */
router.get('/my-quotes', authenticate, isPrinter, quoteController.getPrinterQuotes);

/**
 * @route   POST /api/quotes/:quoteId/accept
 * @desc    Accept a quote
 * @access  Private (Client only)
 */
router.post('/:quoteId/accept', authenticate, isClient, validateObjectId('quoteId'), quoteController.acceptQuote);

/**
 * @route   POST /api/quotes/:quoteId/reject
 * @desc    Reject a quote
 * @access  Private (Client only)
 */
router.post('/:quoteId/reject', authenticate, isClient, validateObjectId('quoteId'), quoteController.rejectQuote);

module.exports = router;
