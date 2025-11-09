const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  // Relations
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  printer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Workflow status - 14 états possibles
  status: {
    type: String,
    enum: [
      'pending',              // En attente de réponse
      'active',               // Discussion active
      'quote_sent',           // Devis envoyé par imprimeur
      'negotiating',          // Négociation en cours
      'quote_accepted',       // Devis accepté par client
      'signed',               // Contrat signé par les deux parties
      'in_production',        // En cours d'impression
      'ready',                // Prêt pour récupération/livraison
      'completed',            // Terminé avec succès
      'cancelled_by_client',  // Annulé par le client
      'cancelled_by_printer', // Annulé par l'imprimeur
      'cancelled_mutual',     // Annulation d'accord mutuel
      'cancelled_mediation',  // Annulé après médiation
      'paused'                // Mis en pause temporairement
    ],
    default: 'pending',
    index: true
  },

  // Gestion des devis
  currentQuote: {
    pricePerUnit: {
      type: Number,
      min: 0
    },
    quantity: {
      type: Number,
      min: 1
    },
    totalPrice: {
      type: Number,
      min: 0
    },
    materials: [{
      type: String
    }],
    deliveryDays: {
      type: Number,
      min: 1
    },
    shippingCost: {
      type: Number,
      min: 0,
      default: 0
    },
    options: {
      type: String // Description des options (finition, couleur, etc.)
    },
    sentAt: Date,
    sentBy: {
      type: String,
      enum: ['client', 'printer']
    },
    version: {
      type: Number,
      default: 1
    }
  },

  // Historique des négociations
  quoteHistory: [{
    pricePerUnit: Number,
    quantity: Number,
    totalPrice: Number,
    materials: [String],
    deliveryDays: Number,
    shippingCost: Number,
    options: String,
    sentAt: Date,
    sentBy: String,
    version: Number
  }],

  // Compteur de contre-propositions (max 3)
  counterOfferCount: {
    type: Number,
    default: 0,
    max: 3
  },

  // Signature du contrat
  clientSignedAt: Date,
  printerSignedAt: Date,
  signedAt: Date, // Date où les deux ont signé

  // Étapes de production (après signature)
  productionSteps: {
    printingStarted: {
      completed: { type: Boolean, default: false },
      completedAt: Date
    },
    printingCompleted: {
      completed: { type: Boolean, default: false },
      completedAt: Date,
      photos: [{
        url: String,
        uploadedAt: { type: Date, default: Date.now }
      }]
    },
    photosShared: {
      completed: { type: Boolean, default: false },
      completedAt: Date
    },
    orderShipped: {
      completed: { type: Boolean, default: false },
      completedAt: Date,
      trackingNumber: String,
      shippingMethod: String
    }
  },

  // Métadonnées
  initiatedBy: {
    type: String,
    enum: ['client', 'printer'],
    required: true
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  unreadCountClient: {
    type: Number,
    default: 0
  },
  unreadCountPrinter: {
    type: Number,
    default: 0
  },

  // Gestion des annulations
  cancellationReason: String,
  cancelledBy: {
    type: String,
    enum: ['client', 'printer', 'mutual', 'admin']
  },
  cancelledAt: Date,

  // Médiation
  mediationRequested: {
    type: Boolean,
    default: false
  },
  mediationRequestedBy: {
    type: String,
    enum: ['client', 'printer']
  },
  mediationRequestedAt: Date,
  mediationReason: String,

  // Gestion des pauses
  pausedAt: Date,
  pauseExpiresAt: Date, // Max 30 jours après pausedAt
  pausedBy: {
    type: String,
    enum: ['client', 'printer', 'mutual']
  },

  // Favoris
  isFavoriteForClient: {
    type: Boolean,
    default: false
  },
  isFavoriteForPrinter: {
    type: Boolean,
    default: false
  },

  // Signalement et modération
  reportedByClient: {
    type: Boolean,
    default: false
  },
  reportedByPrinter: {
    type: Boolean,
    default: false
  },
  reportReason: String,
  reportedAt: Date,

  // Archivage
  archivedAt: Date,
  isArchived: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true
});

// Index composés pour optimisation
conversationSchema.index({ client: 1, status: 1 });
conversationSchema.index({ printer: 1, status: 1 });
conversationSchema.index({ project: 1, status: 1 });
conversationSchema.index({ lastMessageAt: -1 });

// Méthode pour vérifier si les deux parties ont signé
conversationSchema.methods.isBothSigned = function() {
  return !!(this.clientSignedAt && this.printerSignedAt);
};

// Méthode pour calculer si la pause a expiré
conversationSchema.methods.isPauseExpired = function() {
  if (!this.pauseExpiresAt) return false;
  return new Date() > this.pauseExpiresAt;
};

// Méthode pour vérifier si la conversation est modifiable
conversationSchema.methods.canBeModified = function() {
  const immutableStatuses = ['completed', 'cancelled_by_client', 'cancelled_by_printer', 'cancelled_mutual', 'cancelled_mediation'];
  return !immutableStatuses.includes(this.status);
};

// Méthode pour envoyer un devis
conversationSchema.methods.sendQuote = function(quoteData, sentBy) {
  // Sauvegarder l'ancien devis dans l'historique
  if (this.currentQuote && this.currentQuote.sentAt) {
    this.quoteHistory.push(this.currentQuote);
  }

  // Créer le nouveau devis
  this.currentQuote = {
    ...quoteData,
    sentAt: new Date(),
    sentBy: sentBy,
    version: this.quoteHistory.length + 1
  };

  this.status = 'quote_sent';
  return this.save();
};

// Méthode pour contre-proposer
conversationSchema.methods.counterQuote = function(quoteData, sentBy) {
  if (this.counterOfferCount >= 3) {
    throw new Error('Maximum de 3 contre-propositions atteint');
  }

  // Sauvegarder l'ancien devis dans l'historique
  if (this.currentQuote && this.currentQuote.sentAt) {
    this.quoteHistory.push(this.currentQuote);
  }

  // Créer la contre-proposition
  this.currentQuote = {
    ...quoteData,
    sentAt: new Date(),
    sentBy: sentBy,
    version: this.quoteHistory.length + 1
  };

  this.counterOfferCount += 1;
  this.status = 'negotiating';
  return this.save();
};

// Méthode pour accepter un devis
conversationSchema.methods.acceptQuote = function() {
  this.status = 'quote_accepted';
  return this.save();
};

// Méthode pour signer le contrat
conversationSchema.methods.sign = function(signedBy) {
  const now = new Date();

  if (signedBy === 'client') {
    this.clientSignedAt = now;
  } else if (signedBy === 'printer') {
    this.printerSignedAt = now;
  }

  // Si les deux ont signé, marquer comme signé
  if (this.clientSignedAt && this.printerSignedAt) {
    this.signedAt = now;
    this.status = 'signed';
  }

  return this.save();
};

// Méthode pour annuler
conversationSchema.methods.cancel = function(cancelledBy, reason) {
  this.cancelledBy = cancelledBy;
  this.cancellationReason = reason;
  this.cancelledAt = new Date();

  if (cancelledBy === 'client') {
    this.status = 'cancelled_by_client';
  } else if (cancelledBy === 'printer') {
    this.status = 'cancelled_by_printer';
  } else if (cancelledBy === 'mutual') {
    this.status = 'cancelled_mutual';
  }

  return this.save();
};

// Méthode pour mettre en pause (30 jours max)
conversationSchema.methods.pause = function(pausedBy) {
  const now = new Date();
  this.pausedAt = now;
  this.pauseExpiresAt = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 jours
  this.pausedBy = pausedBy;
  this.status = 'paused';
  return this.save();
};

// Méthode pour réactiver
conversationSchema.methods.resume = function() {
  this.status = 'active';
  this.pausedAt = null;
  this.pauseExpiresAt = null;
  this.pausedBy = null;
  return this.save();
};

// Méthode pour demander médiation
conversationSchema.methods.requestMediation = function(requestedBy, reason) {
  this.mediationRequested = true;
  this.mediationRequestedBy = requestedBy;
  this.mediationRequestedAt = new Date();
  this.mediationReason = reason;
  return this.save();
};

module.exports = mongoose.model('Conversation', conversationSchema);
