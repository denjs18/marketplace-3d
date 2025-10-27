const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  role: {
    type: String,
    enum: ['client', 'printer'],
    required: [true, 'Role is required']
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    postalCode: String,
    country: String
  },
  // Printer specific fields
  companyName: {
    type: String,
    trim: true
  },
  printerCapabilities: {
    materials: [String], // PLA, ABS, PETG, Resin, etc.
    maxPrintSize: {
      x: Number,
      y: Number,
      z: Number
    },
    technologies: [String], // FDM, SLA, SLS, etc.
    colors: [String]
  },
  // Profil imprimeur étendu
  printerProfile: {
    bio: {
      type: String,
      maxlength: 500
    },
    specialties: [String],
    maxDifficulty: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    },
    availabilityStatus: {
      type: String,
      enum: ['available', 'busy', 'unavailable'],
      default: 'available'
    },
    averageResponseTime: {
      type: Number,
      default: 0
    },
    responseRate: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    completionRate: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    cancellationRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    reliabilityScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    activeProjects: {
      type: Number,
      default: 0
    },
    favoriteClients: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    badges: [String]
  },
  hourlyRate: {
    type: Number,
    min: 0
  },
  stripeAccountId: {
    type: String
  },
  stripeAccountStatus: {
    type: String,
    enum: ['pending', 'active', 'restricted'],
    default: 'pending'
  },
  // Client specific fields
  favoritesPrinters: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Profil client
  clientProfile: {
    refusalRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    cancellationRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    reliabilityScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    }
  },
  // Common fields
  profileImage: {
    type: String,
    default: '/images/default-avatar.png'
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  totalProjects: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  refreshToken: {
    type: String
  },
  // Business status and legal compliance fields
  businessStatus: {
    type: String,
    enum: ['particulier', 'micro-entrepreneur', 'professionnel'],
    default: 'particulier'
  },
  siret: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        // SIRET must be 14 digits if provided
        if (!v) return true;
        return /^\d{14}$/.test(v);
      },
      message: 'SIRET must be 14 digits'
    }
  },
  tva: {
    type: String,
    trim: true
  },
  yearlyRevenue: {
    type: Number,
    default: 0,
    min: 0
  },
  yearlyTransactionCount: {
    type: Number,
    default: 0,
    min: 0
  },
  revenueYear: {
    type: Number
  },
  accountBlocked: {
    type: Boolean,
    default: false
  },
  blockReason: {
    type: String
  },
  cguAccepted: {
    type: Boolean,
    default: false
  },
  cguAcceptedDate: {
    type: Date
  },
  // DAC7 compliance fields
  birthDate: {
    type: Date
  },
  birthPlace: {
    city: String,
    country: String
  },
  iban: {
    type: String,
    trim: true
  },
  // Alertes et sanctions
  warningFlags: [String],
  suspendedUntil: Date,
  suspensionReason: String
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile
userSchema.methods.getPublicProfile = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.stripeAccountId;
  return obj;
};

// Update rating
userSchema.methods.updateRating = function(newRating) {
  const totalRating = (this.rating.average * this.rating.count) + newRating;
  this.rating.count += 1;
  this.rating.average = totalRating / this.rating.count;
};

module.exports = mongoose.model('User', userSchema);
