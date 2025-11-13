const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  quote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote',
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  printer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Prix du contrat (prix du devis)
  agreedPrice: {
    type: Number,
    required: true,
    min: 0
  },
  // Commission de la plateforme (10%)
  platformCommission: {
    type: Number,
    required: true,
    default: function() {
      return this.agreedPrice * 0.10;
    }
  },
  // Montant total payé par le client (prix + commission)
  totalPaid: {
    type: Number,
    required: true,
    default: function() {
      return this.agreedPrice * 1.10;
    }
  },
  // Montant que recevra l'imprimeur (prix convenu)
  printerEarnings: {
    type: Number,
    required: true,
    default: function() {
      return this.agreedPrice;
    }
  },
  // Statut du contrat
  status: {
    type: String,
    enum: [
      'pending_signature',      // En attente de signature client
      'signed',                 // Signé et payé
      'printing_started',       // Impression lancée
      'printing_completed',     // Impression terminée
      'photos_sent',           // Photos envoyées
      'shipped',               // Commande expédiée
      'delivered_confirmed',   // Livraison confirmée par client
      'completed',             // Terminé (argent transféré à l'imprimeur)
      'cancelled'              // Annulé
    ],
    default: 'pending_signature'
  },
  // Transaction de paiement associée
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  // Dates importantes
  signedAt: Date,
  printingStartedAt: Date,
  printingCompletedAt: Date,
  photosSentAt: Date,
  shippedAt: Date,
  deliveredConfirmedAt: Date,
  completedAt: Date,
  cancelledAt: Date,

  // Photos de l'impression
  printPhotos: [{
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Informations de livraison
  trackingNumber: String,
  shippingCarrier: String,

  // Notes et raisons
  cancellationReason: String,
  clientNotes: String,
  printerNotes: String,

  // Paiement de l'imprimeur
  printerPaid: {
    type: Boolean,
    default: false
  },
  printerPaidAt: Date,
  payoutId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payout'
  }
}, {
  timestamps: true
});

// Indexes
contractSchema.index({ project: 1 });
contractSchema.index({ client: 1, status: 1, createdAt: -1 });
contractSchema.index({ printer: 1, status: 1, createdAt: -1 });
contractSchema.index({ status: 1 });

// Méthode pour signer le contrat
contractSchema.methods.sign = function(transactionId) {
  this.status = 'signed';
  this.signedAt = new Date();
  this.transaction = transactionId;
};

// Méthode pour marquer l'impression comme lancée
contractSchema.methods.startPrinting = function() {
  if (this.status !== 'signed') {
    throw new Error('Contract must be signed before starting printing');
  }
  this.status = 'printing_started';
  this.printingStartedAt = new Date();
};

// Méthode pour marquer l'impression comme terminée
contractSchema.methods.completePrinting = function() {
  if (this.status !== 'printing_started') {
    throw new Error('Printing must be started before completing');
  }
  this.status = 'printing_completed';
  this.printingCompletedAt = new Date();
};

// Méthode pour envoyer les photos
contractSchema.methods.sendPhotos = function(photos) {
  if (this.status !== 'printing_completed') {
    throw new Error('Printing must be completed before sending photos');
  }
  this.printPhotos = photos.map(url => ({ url }));
  this.photosSentAt = new Date();
  this.status = 'photos_sent';
};

// Méthode pour marquer comme expédié
contractSchema.methods.markAsShipped = function(trackingNumber, carrier) {
  if (this.status !== 'photos_sent') {
    throw new Error('Photos must be sent before shipping');
  }
  this.trackingNumber = trackingNumber;
  this.shippingCarrier = carrier;
  this.shippedAt = new Date();
  this.status = 'shipped';
};

// Méthode pour confirmer la réception (par le client)
contractSchema.methods.confirmDelivery = function() {
  if (this.status !== 'shipped') {
    throw new Error('Order must be shipped before confirming delivery');
  }
  this.deliveredConfirmedAt = new Date();
  this.status = 'delivered_confirmed';
};

// Méthode pour marquer le paiement imprimeur comme effectué
contractSchema.methods.markPrinterPaid = function(payoutId) {
  this.printerPaid = true;
  this.printerPaidAt = new Date();
  this.payoutId = payoutId;
  this.status = 'completed';
  this.completedAt = new Date();
};

// Méthode pour annuler
contractSchema.methods.cancel = function(reason) {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
};

// Vérifier si l'argent peut être crédité sur la balance de l'imprimeur
contractSchema.methods.canCreditPrinter = function() {
  return this.status === 'delivered_confirmed' && !this.printerPaid;
};

// Vérifier si le client peut confirmer la livraison
contractSchema.methods.canConfirmDelivery = function() {
  return this.status === 'shipped';
};

module.exports = mongoose.model('Contract', contractSchema);
