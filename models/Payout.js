const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  printer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'EUR',
    uppercase: true
  },
  status: {
    type: String,
    enum: [
      'pending',        // Demande créée
      'processing',     // En cours de traitement
      'completed',      // Virement effectué
      'failed',         // Échec du virement
      'cancelled'       // Annulé
    ],
    default: 'pending'
  },
  // Informations bancaires (snapshot au moment de la demande)
  bankDetails: {
    accountHolderName: {
      type: String,
      required: true
    },
    iban: {
      type: String,
      required: true
    },
    bic: String,
    bankName: String
  },
  // Stripe
  stripePayoutId: String,
  stripeTransferId: String,

  // Métadonnées
  contracts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract'
  }],

  // Dates
  requestedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: Date,
  completedAt: Date,
  failedAt: Date,
  cancelledAt: Date,

  // Erreur
  errorMessage: String,
  errorCode: String,

  // Notes
  adminNotes: String,
  printerNotes: String,

  // Infos de traitement
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
payoutSchema.index({ printer: 1, status: 1, createdAt: -1 });
payoutSchema.index({ status: 1, createdAt: -1 });
payoutSchema.index({ stripePayoutId: 1 });

// Méthode pour marquer comme en cours de traitement
payoutSchema.methods.startProcessing = function() {
  this.status = 'processing';
  this.processedAt = new Date();
};

// Méthode pour marquer comme complété
payoutSchema.methods.complete = function(stripePayoutId) {
  this.status = 'completed';
  this.completedAt = new Date();
  if (stripePayoutId) {
    this.stripePayoutId = stripePayoutId;
  }
};

// Méthode pour marquer comme échoué
payoutSchema.methods.fail = function(errorMessage, errorCode) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.errorMessage = errorMessage;
  if (errorCode) {
    this.errorCode = errorCode;
  }
};

// Méthode pour annuler
payoutSchema.methods.cancel = function() {
  if (this.status === 'processing' || this.status === 'completed') {
    throw new Error('Cannot cancel a payout that is processing or completed');
  }
  this.status = 'cancelled';
  this.cancelledAt = new Date();
};

// Vérifier si le payout peut être traité
payoutSchema.methods.canProcess = function() {
  return this.status === 'pending';
};

// Statique pour obtenir le total des payouts d'un imprimeur
payoutSchema.statics.getPrinterPayoutStats = async function(printerId, startDate, endDate) {
  const match = {
    printer: mongoose.Types.ObjectId(printerId),
    status: 'completed'
  };

  if (startDate || endDate) {
    match.completedAt = {};
    if (startDate) match.completedAt.$gte = new Date(startDate);
    if (endDate) match.completedAt.$lte = new Date(endDate);
  }

  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalPayouts: { $sum: 1 },
        averagePayout: { $avg: '$amount' }
      }
    }
  ]);

  return result[0] || {
    totalAmount: 0,
    totalPayouts: 0,
    averagePayout: 0
  };
};

module.exports = mongoose.model('Payout', payoutSchema);
