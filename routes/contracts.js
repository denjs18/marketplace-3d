const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const { authenticate, isClient, isPrinter } = require('../middleware/auth');

// Créer un contrat (client seulement)
router.post('/', authenticate, isClient, contractController.createContract);

// Signer un contrat et payer (client seulement)
router.post('/sign', authenticate, isClient, contractController.signContract);

// Confirmer le paiement
router.post('/confirm-payment', authenticate, contractController.confirmPayment);

// Obtenir la liste des contrats
router.get('/', authenticate, contractController.getContracts);

// Obtenir un contrat spécifique
router.get('/:contractId', authenticate, contractController.getContract);

// Marquer l'impression comme lancée (imprimeur seulement)
router.post('/:contractId/start-printing', authenticate, isPrinter, contractController.startPrinting);

// Marquer l'impression comme terminée (imprimeur seulement)
router.post('/:contractId/complete-printing', authenticate, isPrinter, contractController.completePrinting);

// Envoyer les photos (imprimeur seulement)
router.post('/:contractId/send-photos', authenticate, isPrinter, contractController.sendPhotos);

// Marquer comme expédié (imprimeur seulement)
router.post('/:contractId/ship', authenticate, isPrinter, contractController.markAsShipped);

// Confirmer la réception (client seulement)
router.post('/:contractId/confirm-delivery', authenticate, isClient, contractController.confirmDelivery);

module.exports = router;
