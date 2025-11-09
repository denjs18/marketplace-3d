const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

/**
 * @route   POST /api/conversations/:id/cancel
 * @desc    Annuler la conversation avant signature
 * @access  Private
 */
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    const { reason } = req.body;
    const conversationId = req.params.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    const user = await User.findById(req.userId);
    const userId = req.userId.toString();

    if (conversation.client.toString() !== userId && conversation.printer.toString() !== userId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Vérifier qu'on peut annuler (pas après signature)
    if (conversation.signedAt) {
      return res.status(400).json({ error: 'Impossible d\'annuler après signature. Demandez une médiation.' });
    }

    // Annuler
    await conversation.cancel(user.role, reason);

    // Message système
    await Message.createSystemMessage(
      conversationId,
      `Conversation annulée par le ${user.role === 'client' ? 'client' : 'imprimeur'}. Raison: ${reason}`
    );

    // Mettre à jour les stats d'annulation
    if (user.role === 'client') {
      const clientProfile = user.clientProfile || {};
      const totalCancellations = (clientProfile.cancellationRate || 0);
      user.clientProfile = {
        ...clientProfile,
        cancellationRate: totalCancellations + 1
      };
    } else {
      const printerProfile = user.printerProfile || {};
      const totalCancellations = (printerProfile.cancellationRate || 0);
      user.printerProfile = {
        ...printerProfile,
        cancellationRate: totalCancellations + 1
      };
    }
    await user.save();

    res.json({ conversation });
  } catch (error) {
    console.error('Error cancelling conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/conversations/:id/refuse
 * @desc    Client refuse l'imprimeur
 * @access  Private (Client only)
 */
router.post('/:id/refuse', authenticate, async (req, res) => {
  try {
    const { reason } = req.body;
    const conversationId = req.params.id;

    const conversation = await Conversation.findById(conversationId).populate('project');
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    const user = await User.findById(req.userId);
    if (user.role !== 'client' || conversation.client.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Seul le client peut refuser un imprimeur' });
    }

    // Ajouter aux refusés
    const project = conversation.project;
    if (!project.refusedPrinters.includes(conversation.printer)) {
      project.refusedPrinters.push(conversation.printer);
      project.refusalCount += 1;
      await project.save();
    }

    // Annuler la conversation
    await conversation.cancel('client', `Imprimeur refusé: ${reason}`);

    await Message.createSystemMessage(
      conversationId,
      'Le client a choisi un autre imprimeur pour ce projet.'
    );

    res.json({ conversation });
  } catch (error) {
    console.error('Error refusing printer:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/conversations/:id/withdraw
 * @desc    Imprimeur se retire
 * @access  Private (Printer only)
 */
router.post('/:id/withdraw', authenticate, async (req, res) => {
  try {
    const { reason } = req.body;
    const conversationId = req.params.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    const user = await User.findById(req.userId);
    if (user.role !== 'printer' || conversation.printer.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Seul l\'imprimeur peut se retirer' });
    }

    // Vérifier qu'on peut se retirer (pas après signature)
    if (conversation.signedAt) {
      return res.status(400).json({ error: 'Impossible de se retirer après signature' });
    }

    // Supprimer le devis pour permettre une nouvelle soumission
    conversation.currentQuote = undefined;
    conversation.quoteHistory = conversation.quoteHistory || [];
    conversation.counterOfferCount = 0;

    await conversation.cancel('printer', `Retrait de l'imprimeur: ${reason}`);

    await Message.createSystemMessage(
      conversationId,
      'L\'imprimeur s\'est retiré de ce projet.'
    );

    res.json({ conversation });
  } catch (error) {
    console.error('Error withdrawing:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/conversations/:id/pause
 * @desc    Mettre en pause (30 jours max)
 * @access  Private
 */
router.post('/:id/pause', authenticate, async (req, res) => {
  try {
    const conversationId = req.params.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    const user = await User.findById(req.userId);
    const userId = req.userId.toString();

    if (conversation.client.toString() !== userId && conversation.printer.toString() !== userId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Pause
    await conversation.pause(user.role);

    await Message.createSystemMessage(
      conversationId,
      `Projet mis en pause par le ${user.role === 'client' ? 'client' : 'imprimeur'} pour 30 jours maximum.`
    );

    res.json({ conversation });
  } catch (error) {
    console.error('Error pausing:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/conversations/:id/resume
 * @desc    Réactiver après pause
 * @access  Private
 */
router.post('/:id/resume', authenticate, async (req, res) => {
  try {
    const conversationId = req.params.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    const userId = req.userId.toString();
    if (conversation.client.toString() !== userId && conversation.printer.toString() !== userId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    if (conversation.status !== 'paused') {
      return res.status(400).json({ error: 'La conversation n\'est pas en pause' });
    }

    // Réactiver
    await conversation.resume();

    await Message.createSystemMessage(
      conversationId,
      'Projet réactivé. La conversation peut reprendre.'
    );

    res.json({ conversation });
  } catch (error) {
    console.error('Error resuming:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/conversations/:id/update-status
 * @desc    Mettre à jour le statut de production
 * @access  Private (Printer only)
 */
router.post('/:id/update-status', authenticate, async (req, res) => {
  try {
    const { status } = req.body; // 'in_production', 'ready'
    const conversationId = req.params.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    const user = await User.findById(req.userId);
    if (user.role !== 'printer' || conversation.printer.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Seul l\'imprimeur peut mettre à jour le statut' });
    }

    const validStatuses = ['in_production', 'ready'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    conversation.status = status;
    await conversation.save();

    const statusMessages = {
      'in_production': 'L\'impression est en cours.',
      'ready': 'L\'impression est terminée et prête pour livraison/récupération.'
    };

    await Message.createSystemMessage(
      conversationId,
      statusMessages[status]
    );

    res.json({ conversation });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/conversations/:id/request-mediation
 * @desc    Demander une médiation
 * @access  Private
 */
router.post('/:id/request-mediation', authenticate, async (req, res) => {
  try {
    const { reason } = req.body;
    const conversationId = req.params.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    const user = await User.findById(req.userId);
    const userId = req.userId.toString();

    if (conversation.client.toString() !== userId && conversation.printer.toString() !== userId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Demander médiation
    await conversation.requestMediation(user.role, reason);

    await Message.createSystemMessage(
      conversationId,
      `Médiation demandée par le ${user.role === 'client' ? 'client' : 'imprimeur'}. Un modérateur va intervenir.`
    );

    // TODO: Envoyer email aux admins
    // await sendMediationRequest(admins, conversation, reason);

    res.json({ conversation });
  } catch (error) {
    console.error('Error requesting mediation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/conversations/:id/report
 * @desc    Signaler pour modération
 * @access  Private
 */
router.post('/:id/report', authenticate, async (req, res) => {
  try {
    const { reason } = req.body;
    const conversationId = req.params.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    const user = await User.findById(req.userId);
    const userId = req.userId.toString();

    if (conversation.client.toString() !== userId && conversation.printer.toString() !== userId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Marquer comme signalé
    if (user.role === 'client') {
      conversation.reportedByClient = true;
    } else {
      conversation.reportedByPrinter = true;
    }
    conversation.reportReason = reason;
    conversation.reportedAt = new Date();
    await conversation.save();

    res.json({ message: 'Signalement enregistré. Un modérateur va examiner la conversation.' });
  } catch (error) {
    console.error('Error reporting:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/conversations/:id/favorite
 * @desc    Ajouter aux favoris
 * @access  Private
 */
router.post('/:id/favorite', authenticate, async (req, res) => {
  try {
    const conversationId = req.params.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    const user = await User.findById(req.userId);
    const userId = req.userId.toString();

    if (conversation.client.toString() !== userId && conversation.printer.toString() !== userId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Ajouter aux favoris
    if (user.role === 'client') {
      conversation.isFavoriteForClient = true;
      // Ajouter l'imprimeur aux favoris du client
      if (!user.favoritesPrinters.includes(conversation.printer)) {
        user.favoritesPrinters.push(conversation.printer);
      }
    } else {
      conversation.isFavoriteForPrinter = true;
      // Ajouter le client aux favoris de l'imprimeur
      if (user.printerProfile) {
        if (!user.printerProfile.favoriteClients) {
          user.printerProfile.favoriteClients = [];
        }
        if (!user.printerProfile.favoriteClients.includes(conversation.client)) {
          user.printerProfile.favoriteClients.push(conversation.client);
        }
      }
    }

    await conversation.save();
    await user.save();

    res.json({ conversation });
  } catch (error) {
    console.error('Error favoriting:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   DELETE /api/conversations/:id/favorite
 * @desc    Retirer des favoris
 * @access  Private
 */
router.delete('/:id/favorite', authenticate, async (req, res) => {
  try {
    const conversationId = req.params.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    const user = await User.findById(req.userId);
    const userId = req.userId.toString();

    if (conversation.client.toString() !== userId && conversation.printer.toString() !== userId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Retirer des favoris
    if (user.role === 'client') {
      conversation.isFavoriteForClient = false;
      user.favoritesPrinters = user.favoritesPrinters.filter(
        id => id.toString() !== conversation.printer.toString()
      );
    } else {
      conversation.isFavoriteForPrinter = false;
      if (user.printerProfile && user.printerProfile.favoriteClients) {
        user.printerProfile.favoriteClients = user.printerProfile.favoriteClients.filter(
          id => id.toString() !== conversation.client.toString()
        );
      }
    }

    await conversation.save();
    await user.save();

    res.json({ conversation });
  } catch (error) {
    console.error('Error unfavoriting:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
