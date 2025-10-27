const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Relations
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderType: {
    type: String,
    enum: ['client', 'printer', 'system', 'admin'],
    required: true
  },

  // Type de message
  messageType: {
    type: String,
    enum: [
      'text',            // Message texte simple
      'file',            // Fichier partagé
      'quote',           // Envoi d'un devis
      'quote_counter',   // Contre-proposition
      'quote_accepted',  // Acceptation du devis
      'signature',       // Signature du contrat
      'system',          // Message système automatique
      'status_update'    // Mise à jour de statut
    ],
    default: 'text',
    required: true
  },

  // Contenu du message
  content: {
    type: String,
    maxlength: 5000
  },

  // Contenu filtré (avec coordonnées masquées)
  contentFiltered: {
    type: String,
    maxlength: 5000
  },

  // Indicateur si contenu bloqué
  contentBlocked: {
    type: Boolean,
    default: false
  },

  // Détails des éléments bloqués
  blockedElements: [{
    type: {
      type: String,
      enum: ['phone', 'email', 'url', 'social', 'address', 'keyword']
    },
    value: String
  }],

  // Fichiers (stockés sur Vercel Blob)
  fileUrl: String,
  fileName: String,
  fileType: String, // image/png, application/pdf, model/stl, etc.
  fileSize: Number, // en octets
  fileThumbnail: String, // URL miniature si image

  // Données structurées pour devis
  quoteData: {
    pricePerUnit: Number,
    quantity: Number,
    totalPrice: Number,
    materials: [String],
    deliveryDays: Number,
    shippingCost: Number,
    options: String,
    version: Number
  },

  // Lecture du message
  readByClient: {
    type: Boolean,
    default: false
  },
  readByPrinter: {
    type: Boolean,
    default: false
  },
  readAt: Date,

  // Modération
  flaggedForModeration: {
    type: Boolean,
    default: false
  },
  moderationReason: String,
  moderatedAt: Date,
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Métadonnées
  isUrgent: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  deletedAt: Date,
  isDeleted: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true
});

// Index composés pour optimisation
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, messageType: 1 });

// Méthode pour marquer comme lu
messageSchema.methods.markAsRead = function(readerType) {
  const now = new Date();

  if (readerType === 'client') {
    this.readByClient = true;
  } else if (readerType === 'printer') {
    this.readByPrinter = true;
  }

  // Si les deux ont lu, définir readAt
  if (this.readByClient && this.readByPrinter) {
    this.readAt = now;
  }

  return this.save();
};

// Méthode pour signaler pour modération
messageSchema.methods.flag = function(reason, reportedBy) {
  this.flaggedForModeration = true;
  this.moderationReason = reason;
  this.moderatedAt = new Date();
  this.moderatedBy = reportedBy;
  return this.save();
};

// Méthode pour vérifier si le message contient des coordonnées
messageSchema.methods.hasBlockedContent = function() {
  return this.contentBlocked || (this.blockedElements && this.blockedElements.length > 0);
};

// Méthode statique pour créer un message système
messageSchema.statics.createSystemMessage = function(conversationId, content) {
  return this.create({
    conversation: conversationId,
    sender: null,
    senderType: 'system',
    messageType: 'system',
    content: content,
    contentFiltered: content,
    readByClient: false,
    readByPrinter: false
  });
};

// Méthode statique pour créer un message de devis
messageSchema.statics.createQuoteMessage = function(conversationId, senderId, senderType, quoteData, messageType = 'quote') {
  const content = `Devis proposé : ${quoteData.totalPrice}€ pour ${quoteData.quantity} pièce(s) - Délai : ${quoteData.deliveryDays} jour(s)`;

  return this.create({
    conversation: conversationId,
    sender: senderId,
    senderType: senderType,
    messageType: messageType,
    content: content,
    contentFiltered: content,
    quoteData: quoteData,
    readByClient: false,
    readByPrinter: false
  });
};

// Méthode statique pour créer un message de fichier
messageSchema.statics.createFileMessage = function(conversationId, senderId, senderType, fileData) {
  return this.create({
    conversation: conversationId,
    sender: senderId,
    senderType: senderType,
    messageType: 'file',
    content: `Fichier partagé : ${fileData.fileName}`,
    contentFiltered: `Fichier partagé : ${fileData.fileName}`,
    fileUrl: fileData.fileUrl,
    fileName: fileData.fileName,
    fileType: fileData.fileType,
    fileSize: fileData.fileSize,
    fileThumbnail: fileData.fileThumbnail,
    readByClient: false,
    readByPrinter: false
  });
};

// Hook pre-save pour détecter l'urgence
messageSchema.pre('save', function(next) {
  if (this.content && this.messageType === 'text') {
    const urgentKeywords = ['urgent', 'rapide', 'vite', 'asap', 'rapidement', 'immédiatement', 'pressé'];
    const lowerContent = this.content.toLowerCase();
    this.isUrgent = urgentKeywords.some(keyword => lowerContent.includes(keyword));
  }
  next();
});

module.exports = mongoose.model('Message', messageSchema);
