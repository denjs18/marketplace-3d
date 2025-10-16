const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  printer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  estimatedDuration: {
    value: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      enum: ['hours', 'days', 'weeks'],
      default: 'days'
    }
  },
  deliveryDate: {
    type: Date,
    required: true
  },
  message: {
    type: String,
    required: [true, 'Quote message is required'],
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  breakdown: {
    materials: {
      type: Number,
      default: 0
    },
    labor: {
      type: Number,
      default: 0
    },
    shipping: {
      type: Number,
      default: 0
    },
    other: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending'
  },
  expiresAt: {
    type: Date,
    required: true,
    default: function() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    }
  },
  acceptedAt: {
    type: Date
  },
  rejectedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  }
}, {
  timestamps: true
});

// Index for queries
quoteSchema.index({ project: 1, printer: 1 }, { unique: true });
quoteSchema.index({ printer: 1, status: 1, createdAt: -1 });
quoteSchema.index({ project: 1, status: 1 });

// Virtual for total price including all breakdown
quoteSchema.virtual('totalBreakdown').get(function() {
  const breakdown = this.breakdown || {};
  return (breakdown.materials || 0) +
         (breakdown.labor || 0) +
         (breakdown.shipping || 0) +
         (breakdown.other || 0);
});

// Method to check if quote is expired
quoteSchema.methods.isExpired = function() {
  return this.expiresAt < new Date() && this.status === 'pending';
};

// Method to accept quote
quoteSchema.methods.accept = function() {
  this.status = 'accepted';
  this.acceptedAt = new Date();
};

// Method to reject quote
quoteSchema.methods.reject = function(reason) {
  this.status = 'rejected';
  this.rejectedAt = new Date();
  if (reason) this.rejectionReason = reason;
};

// Pre-save hook to auto-expire old quotes
quoteSchema.pre('save', function(next) {
  if (this.isExpired()) {
    this.status = 'expired';
  }
  next();
});

module.exports = mongoose.model('Quote', quoteSchema);
