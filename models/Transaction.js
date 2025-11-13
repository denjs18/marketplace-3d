const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
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
  amount: {
    type: Number,
    required: [true, 'Transaction amount is required'],
    min: 0
  },
  commission: {
    type: Number,
    required: true,
    default: function() {
      return this.amount * 0.10; // 10% commission
    }
  },
  printerPayout: {
    type: Number,
    required: true,
    default: function() {
      return this.amount * 0.90; // 90% to printer
    }
  },
  currency: {
    type: String,
    default: 'EUR',
    uppercase: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'bank_transfer', 'paypal', 'balance', 'mixed', 'other'],
    default: 'card'
  },
  // Montant payé avec le solde disponible
  balanceUsed: {
    type: Number,
    default: 0,
    min: 0
  },
  // Montant payé avec Stripe
  stripeAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  stripePaymentIntentId: {
    type: String
  },
  stripeTransferId: {
    type: String
  },
  stripeRefundId: {
    type: String
  },
  paymentDetails: {
    last4: String,
    brand: String,
    country: String
  },
  errorMessage: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  processedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  refundedAt: {
    type: Date
  },
  refundReason: {
    type: String
  },
  refundAmount: {
    type: Number,
    min: 0
  }
}, {
  timestamps: true
});

// Indexes
transactionSchema.index({ client: 1, createdAt: -1 });
transactionSchema.index({ printer: 1, createdAt: -1 });
transactionSchema.index({ project: 1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ stripePaymentIntentId: 1 });

// Virtual for net amount (after commission)
transactionSchema.virtual('netAmount').get(function() {
  return this.amount - this.commission;
});

// Method to mark as completed
transactionSchema.methods.complete = function(transferId) {
  this.status = 'completed';
  this.completedAt = new Date();
  if (transferId) {
    this.stripeTransferId = transferId;
  }
};

// Method to mark as failed
transactionSchema.methods.fail = function(errorMessage) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
};

// Method to process refund
transactionSchema.methods.refund = function(reason, amount) {
  this.status = 'refunded';
  this.refundedAt = new Date();
  this.refundReason = reason;
  this.refundAmount = amount || this.amount;
};

// Static method to calculate total earnings for printer
transactionSchema.statics.getPrinterEarnings = async function(printerId, startDate, endDate) {
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
        totalEarnings: { $sum: '$printerPayout' },
        totalTransactions: { $sum: 1 },
        averageTransaction: { $avg: '$printerPayout' }
      }
    }
  ]);

  return result[0] || {
    totalEarnings: 0,
    totalTransactions: 0,
    averageTransaction: 0
  };
};

// Static method to calculate platform revenue
transactionSchema.statics.getPlatformRevenue = async function(startDate, endDate) {
  const match = {
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
        totalRevenue: { $sum: '$commission' },
        totalVolume: { $sum: '$amount' },
        totalTransactions: { $sum: 1 }
      }
    }
  ]);

  return result[0] || {
    totalRevenue: 0,
    totalVolume: 0,
    totalTransactions: 0
  };
};

module.exports = mongoose.model('Transaction', transactionSchema);
