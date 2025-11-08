const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Project = require('../models/Project');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { contentFilterMiddleware } = require('../middleware/contentFilter');

/**
 * @route   POST /api/conversations/start
 * @desc    Démarrer une nouvelle conversation
 * @access  Private
 */
router.post('/start', authenticate, async (req, res) => {
  try {
    const { projectId, printerId, initiatedBy } = req.body;

    // Vérifier que le projet existe
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    // Vérifier que l'imprimeur existe
    const printer = await User.findById(printerId);
    if (!printer || printer.role !== 'printer') {
      return res.status(404).json({ error: 'Imprimeur non trouvé' });
    }

    // Vérifier qu'il n'y a pas déjà une conversation
    const existing = await Conversation.findOne({
      project: projectId,
      printer: printerId
    });

    if (existing) {
      return res.json({ conversation: existing, existing: true });
    }

    // Créer la conversation
    const conversation = new Conversation({
      project: projectId,
      client: project.client,
      printer: printerId,
      initiatedBy: initiatedBy,
      status: 'pending'
    });

    await conversation.save();

    // Message système de bienvenue
    await Message.createSystemMessage(
      conversation._id,
      `Conversation démarrée. ${initiatedBy === 'client' ? 'Le client attend votre devis.' : 'L\'imprimeur a postulé à votre projet.'}`
    );

    // Ajouter l'imprimeur aux invités si initié par le client
    if (initiatedBy === 'client') {
      project.invitedPrinters.push(printerId);
      await project.save();
    }

    res.status(201).json({ conversation });
  } catch (error) {
    console.error('Error starting conversation:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la conversation' });
  }
});

/**
 * @route   GET /api/conversations/my-conversations
 * @desc    Liste toutes les conversations de l'utilisateur
 * @access  Private
 */
router.get('/my-conversations', authenticate, async (req, res) => {
  try {
    const { status, role } = req.query;
    const userId = req.userId;
    const user = await User.findById(userId);

    const query = {};

    // Filtrer selon le rôle
    if (user.role === 'client') {
      query.client = userId;
    } else {
      query.printer = userId;
    }

    // Filtrer par statut si spécifié
    if (status) {
      query.status = status;
    }

    const conversations = await Conversation.find(query)
      .populate('project', 'title status images difficulty')
      .populate('client', 'firstName lastName profileImage')
      .populate('printer', 'firstName lastName companyName profileImage rating printerProfile')
      .sort('-lastMessageAt')
      .limit(50);

    res.json({ conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des conversations' });
  }
});

/**
 * @route   GET /api/conversations/:id
 * @desc    Obtenir les détails d'une conversation
 * @access  Private
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('project')
      .populate('client', '-password -refreshToken')
      .populate('printer', '-password -refreshToken');

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    // Vérifier que l'utilisateur fait partie de la conversation
    const userId = req.userId.toString();
    if (conversation.client._id.toString() !== userId &&
        conversation.printer._id.toString() !== userId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    res.json({ conversation });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la conversation' });
  }
});

/**
 * @route   GET /api/conversations/:id/messages
 * @desc    Obtenir les messages d'une conversation
 * @access  Private
 */
router.get('/:id/messages', authenticate, async (req, res) => {
  try {
    const { since, limit = 50 } = req.query;
    const conversationId = req.params.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    // Vérifier l'accès
    const userId = req.userId.toString();
    const user = await User.findById(userId);
    if (conversation.client.toString() !== userId &&
        conversation.printer.toString() !== userId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Query pour les messages
    const query = {
      conversation: conversationId,
      isDeleted: false
    };

    // Si "since" est fourni, récupérer seulement les nouveaux messages
    if (since) {
      query._id = { $gt: since };
    }

    const messages = await Message.find(query)
      .populate('sender', 'firstName lastName profileImage')
      .sort('createdAt')
      .limit(parseInt(limit));

    // Marquer les messages comme lus
    const readerType = user.role; // 'client' ou 'printer'
    const unreadMessages = messages.filter(msg =>
      readerType === 'client' ? !msg.readByClient : !msg.readByPrinter
    );

    for (const msg of unreadMessages) {
      await msg.markAsRead(readerType);
    }

    // Mettre à jour le compteur de non-lus dans la conversation
    if (readerType === 'client') {
      conversation.unreadCountClient = 0;
    } else {
      conversation.unreadCountPrinter = 0;
    }
    await conversation.save();

    res.json({ messages, hasMore: messages.length === parseInt(limit) });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des messages' });
  }
});

/**
 * @route   POST /api/conversations/:id/messages
 * @desc    Envoyer un message
 * @access  Private
 */
router.post('/:id/messages', authenticate, contentFilterMiddleware, async (req, res) => {
  try {
    const { content, messageType = 'text' } = req.body;
    const conversationId = req.params.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    // Vérifier l'accès
    const userId = req.userId.toString();
    const user = await User.findById(userId);
    if (conversation.client.toString() !== userId &&
        conversation.printer.toString() !== userId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Vérifier que la conversation n'est pas terminée
    if (!conversation.canBeModified()) {
      return res.status(400).json({ error: 'Cette conversation ne peut plus être modifiée' });
    }

    // Créer le message avec le contenu filtré
    const message = new Message({
      conversation: conversationId,
      sender: userId,
      senderType: user.role,
      messageType: messageType,
      content: content,
      contentFiltered: req.body.contentFiltered || content,
      contentBlocked: req.body.contentBlocked || false,
      blockedElements: req.body.blockedElements || []
    });

    await message.save();

    // Mettre à jour la conversation
    conversation.lastMessageAt = new Date();
    conversation.status = conversation.status === 'pending' ? 'active' : conversation.status;

    // Incrémenter le compteur de non-lus pour l'autre partie
    if (user.role === 'client') {
      conversation.unreadCountPrinter += 1;
    } else {
      conversation.unreadCountClient += 1;
    }

    await conversation.save();

    // Envoyer notification (à implémenter)
    // await sendNewMessageNotification(otherUser, conversation);

    res.status(201).json({
      message,
      warning: req.contentWarning || null
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
  }
});

/**
 * @route   POST /api/conversations/:id/send-quote
 * @desc    Envoyer un devis
 * @access  Private (Printer only)
 */
router.post('/:id/send-quote', authenticate, async (req, res) => {
  try {
    const { pricePerUnit, quantity, totalPrice, materials, deliveryDays, shippingCost, options } = req.body;
    const conversationId = req.params.id;

    console.log('Received quote data:', { pricePerUnit, quantity, totalPrice, materials, deliveryDays, shippingCost, options });

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    const user = await User.findById(req.userId);
    if (user.role !== 'printer' || conversation.printer.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Seul l\'imprimeur peut envoyer un devis' });
    }

    // Envoyer le devis
    await conversation.sendQuote({
      pricePerUnit,
      quantity,
      totalPrice,
      materials,
      deliveryDays,
      shippingCost,
      options
    }, 'printer');

    console.log('Quote saved:', conversation.currentQuote);

    // Créer un message de devis
    await Message.createQuoteMessage(
      conversationId,
      req.userId,
      'printer',
      conversation.currentQuote,
      'quote'
    );

    res.json({ conversation, quote: conversation.currentQuote });
  } catch (error) {
    console.error('Error sending quote:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/conversations/:id/counter-quote
 * @desc    Contre-proposer un devis
 * @access  Private
 */
router.post('/:id/counter-quote', authenticate, async (req, res) => {
  try {
    const { pricePerUnit, quantity, totalPrice, materials, deliveryDays, shippingCost, options } = req.body;
    const conversationId = req.params.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    const user = await User.findById(req.userId);
    const userId = req.userId.toString();

    // Vérifier l'accès
    if (conversation.client.toString() !== userId && conversation.printer.toString() !== userId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Contre-proposer
    await conversation.counterQuote({
      pricePerUnit,
      quantity,
      totalPrice,
      materials,
      deliveryDays,
      shippingCost,
      options
    }, user.role);

    // Créer un message
    await Message.createQuoteMessage(
      conversationId,
      userId,
      user.role,
      conversation.currentQuote,
      'quote_counter'
    );

    res.json({ conversation, quote: conversation.currentQuote });
  } catch (error) {
    console.error('Error counter-quoting:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/conversations/:id/accept-quote
 * @desc    Accepter un devis
 * @access  Private (Client only)
 */
router.post('/:id/accept-quote', authenticate, async (req, res) => {
  try {
    const conversationId = req.params.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    const user = await User.findById(req.userId);
    if (user.role !== 'client' || conversation.client.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Seul le client peut accepter un devis' });
    }

    // Accepter le devis
    await conversation.acceptQuote();

    // Message système
    await Message.createSystemMessage(
      conversationId,
      'Devis accepté par le client. En attente de signature du contrat.'
    );

    res.json({ conversation });
  } catch (error) {
    console.error('Error accepting quote:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/conversations/:id/sign
 * @desc    Signer le contrat
 * @access  Private
 */
router.post('/:id/sign', authenticate, async (req, res) => {
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

    // Signer
    await conversation.sign(user.role);

    // Message système
    const otherParty = user.role === 'client' ? 'imprimeur' : 'client';
    if (conversation.isBothSigned()) {
      await Message.createSystemMessage(
        conversationId,
        'Contrat signé par les deux parties. Le projet peut maintenant démarrer.'
      );
    } else {
      await Message.createSystemMessage(
        conversationId,
        `Signature enregistrée. En attente de la signature du ${otherParty}.`
      );
    }

    res.json({ conversation, bothSigned: conversation.isBothSigned() });
  } catch (error) {
    console.error('Error signing:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
