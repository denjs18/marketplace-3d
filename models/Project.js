const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Project description is required']
  },
  stlFile: {
    filename: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    originalName: String,
    // Calculated metadata
    dimensions: {
      x: Number,
      y: Number,
      z: Number,
      unit: { type: String, default: 'mm' }
    },
    volume: {
      value: Number,
      unit: { type: String, default: 'cm³' }
    },
    estimatedPrintTime: Number, // in hours
    estimatedMaterialWeight: Number // in grams
  },
  specifications: {
    material: {
      type: String,
      enum: ['PLA', 'ABS', 'PETG', 'Resin', 'Nylon', 'TPU', 'Other'],
      required: true
    },
    color: {
      type: String,
      default: 'Natural'
    },
    infill: {
      type: Number,
      min: 0,
      max: 100,
      default: 20
    },
    layerHeight: {
      type: Number,
      default: 0.2
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    postProcessing: {
      type: String,
      enum: ['None', 'Sanding', 'Painting', 'Assembly', 'Other'],
      default: 'None'
    }
  },
  deadline: {
    type: Date
  },
  budget: {
    min: {
      type: Number,
      min: 0
    },
    max: {
      type: Number,
      min: 0
    }
  },
  status: {
    type: String,
    enum: ['draft', 'open', 'quoted', 'in_progress', 'completed', 'cancelled'],
    default: 'draft'
  },
  // Statut granulaire pour workflow de conversation
  projectStatus: {
    type: String,
    enum: ['draft', 'published', 'in_negotiation', 'quote_received', 'quote_accepted',
           'contracted', 'in_production', 'completed', 'cancelled', 'paused'],
    default: 'draft'
  },
  estimatedPrice: {
    type: Number,
    min: 0
  },
  selectedQuote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote'
  },
  assignedPrinter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Multi-devis system
  selectedPrinterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  selectedConversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation'
  },
  maxPrintersInvited: {
    type: Number,
    default: 5,
    max: 5
  },
  invitedPrinters: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  refusedPrinters: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  refusalCount: {
    type: Number,
    default: 0
  },
  // Complexité du projet
  difficulty: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  requiresSample: {
    type: Boolean,
    default: false
  },
  // Gestion
  pausedAt: Date,
  archivedAt: Date,
  images: [{
    type: String
  }],
  tags: [{
    type: String,
    trim: true
  }],
  quotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote'
  }],
  completedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  cancelReason: {
    type: String
  }
}, {
  timestamps: true
});

// Index for searching
projectSchema.index({ title: 'text', description: 'text', tags: 'text' });
projectSchema.index({ status: 1, createdAt: -1 });
projectSchema.index({ client: 1, createdAt: -1 });

// Virtual for quote count
projectSchema.virtual('quoteCount').get(function() {
  return this.quotes ? this.quotes.length : 0;
});

// Method to check if project is available for quotes
projectSchema.methods.canReceiveQuotes = function() {
  return this.status === 'open' || this.status === 'quoted';
};

// Method to assign printer
projectSchema.methods.assignToPrinter = function(printerId, quoteId) {
  this.assignedPrinter = printerId;
  this.selectedQuote = quoteId;
  this.status = 'in_progress';
};

module.exports = mongoose.model('Project', projectSchema);
