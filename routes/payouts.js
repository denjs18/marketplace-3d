const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');
const { authenticate, isPrinter } = require('../middleware/auth');

// Obtenir la balance
router.get('/balance', authenticate, isPrinter, payoutController.getBalance);

// Gérer les coordonnées bancaires
router.get('/bank-details', authenticate, isPrinter, payoutController.getBankDetails);
router.post('/bank-details', authenticate, isPrinter, payoutController.updateBankDetails);

// Demander un virement
router.post('/request', authenticate, isPrinter, payoutController.requestPayout);

// Obtenir la liste des payouts
router.get('/', authenticate, isPrinter, payoutController.getPayouts);

// Obtenir un payout spécifique
router.get('/:payoutId', authenticate, isPrinter, payoutController.getPayout);

// Traiter un payout (pour l'instant accessible, en production devrait être admin ou webhook)
router.post('/:payoutId/process', authenticate, payoutController.processPayout);

// Annuler un payout
router.delete('/:payoutId', authenticate, isPrinter, payoutController.cancelPayout);

module.exports = router;
