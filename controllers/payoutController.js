const Payout = require('../models/Payout');
const User = require('../models/User');
const Contract = require('../models/Contract');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Mettre à jour les coordonnées bancaires
 */
exports.updateBankDetails = async (req, res) => {
  try {
    const { accountHolderName, iban, bic, bankName } = req.body;

    if (!accountHolderName || !iban) {
      return res.status(400).json({
        error: 'Account holder name and IBAN are required'
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    if (user.role !== 'printer') {
      return res.status(403).json({
        error: 'Only printers can set bank details'
      });
    }

    user.bankDetails = {
      accountHolderName,
      iban: iban.replace(/\s/g, '').toUpperCase(),
      bic,
      bankName,
      verified: false
    };

    await user.save();

    res.json({
      message: 'Bank details updated successfully',
      bankDetails: user.bankDetails
    });
  } catch (error) {
    console.error('Update bank details error:', error);
    res.status(500).json({
      error: 'Failed to update bank details',
      details: error.message
    });
  }
};

/**
 * Obtenir les coordonnées bancaires
 */
exports.getBankDetails = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      bankDetails: user.bankDetails || null,
      hasBankDetails: user.hasBankDetails()
    });
  } catch (error) {
    console.error('Get bank details error:', error);
    res.status(500).json({
      error: 'Failed to get bank details',
      details: error.message
    });
  }
};

/**
 * Obtenir la balance de l'utilisateur
 */
exports.getBalance = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Compter les contrats en attente de confirmation
    const pendingContracts = await Contract.countDocuments({
      printer: req.userId,
      status: { $in: ['signed', 'printing_started', 'printing_completed', 'photos_sent', 'shipped'] }
    });

    res.json({
      balance: user.balance || { available: 0, pending: 0, total: 0 },
      pendingContracts,
      canWithdraw: user.balance && user.balance.available > 0,
      hasBankDetails: user.hasBankDetails()
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({
      error: 'Failed to get balance',
      details: error.message
    });
  }
};

/**
 * Demander un virement
 */
exports.requestPayout = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount'
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    if (user.role !== 'printer') {
      return res.status(403).json({
        error: 'Only printers can request payouts'
      });
    }

    // Vérifier les coordonnées bancaires
    if (!user.hasBankDetails()) {
      return res.status(400).json({
        error: 'Please add your bank details before requesting a payout',
        needsBankDetails: true
      });
    }

    // Vérifier le solde disponible
    if (!user.canWithdraw(amount)) {
      return res.status(400).json({
        error: 'Insufficient balance',
        available: user.balance?.available || 0,
        requested: amount
      });
    }

    // Vérifier qu'il n'y a pas déjà un payout en attente
    const pendingPayout = await Payout.findOne({
      printer: req.userId,
      status: { $in: ['pending', 'processing'] }
    });

    if (pendingPayout) {
      return res.status(400).json({
        error: 'You already have a payout request pending',
        payoutId: pendingPayout._id
      });
    }

    // Trouver les contrats complétés mais non payés
    const completedContracts = await Contract.find({
      printer: req.userId,
      status: 'delivered_confirmed',
      printerPaid: false
    }).limit(100);

    // Créer la demande de payout
    const payout = new Payout({
      printer: req.userId,
      amount,
      bankDetails: {
        accountHolderName: user.bankDetails.accountHolderName,
        iban: user.bankDetails.iban,
        bic: user.bankDetails.bic,
        bankName: user.bankDetails.bankName
      },
      contracts: completedContracts.map(c => c._id),
      status: 'pending'
    });

    await payout.save();

    // Déduire immédiatement du solde disponible pour éviter les doubles demandes
    user.deductFromAvailable(amount);
    await user.save();

    res.json({
      message: 'Payout request created successfully',
      payout,
      info: 'Your payout will be processed within 2-5 business days'
    });
  } catch (error) {
    console.error('Request payout error:', error);
    res.status(500).json({
      error: 'Failed to request payout',
      details: error.message
    });
  }
};

/**
 * Traiter un payout (admin ou automatique)
 */
exports.processPayout = async (req, res) => {
  try {
    const { payoutId } = req.params;

    const payout = await Payout.findById(payoutId).populate('printer');

    if (!payout) {
      return res.status(404).json({
        error: 'Payout not found'
      });
    }

    if (!payout.canProcess()) {
      return res.status(400).json({
        error: 'Payout cannot be processed',
        currentStatus: payout.status
      });
    }

    payout.startProcessing();
    await payout.save();

    try {
      // Créer un transfert Stripe vers l'IBAN
      // Note: Pour un vrai transfert SEPA, vous devez configurer Stripe Connect
      // Ceci est un exemple simplifié

      // Option 1: Utiliser Stripe Payouts (nécessite un compte Stripe Connect)
      // const transfer = await stripe.payouts.create({
      //   amount: Math.round(payout.amount * 100),
      //   currency: 'eur',
      //   destination: payout.printer.stripeAccountId
      // });

      // Option 2: Simuler le succès pour le développement
      // En production, intégrer avec un vrai service de paiement

      // Marquer comme complété
      payout.complete('simulated_stripe_payout_id');
      await payout.save();

      // Marquer les contrats comme payés
      await Contract.updateMany(
        { _id: { $in: payout.contracts } },
        {
          $set: {
            printerPaid: true,
            printerPaidAt: new Date(),
            payoutId: payout._id,
            status: 'completed',
            completedAt: new Date()
          }
        }
      );

      res.json({
        message: 'Payout processed successfully',
        payout
      });
    } catch (stripeError) {
      console.error('Stripe payout error:', stripeError);

      // Échec du payout
      payout.fail(stripeError.message, stripeError.code);
      await payout.save();

      // Recréditer le montant à l'utilisateur
      const printer = await User.findById(payout.printer._id);
      printer.balance.available = (printer.balance.available || 0) + payout.amount;
      printer.balance.total = (printer.balance.total || 0) + payout.amount;
      await printer.save();

      res.status(500).json({
        error: 'Failed to process payout with payment provider',
        details: stripeError.message
      });
    }
  } catch (error) {
    console.error('Process payout error:', error);
    res.status(500).json({
      error: 'Failed to process payout',
      details: error.message
    });
  }
};

/**
 * Annuler un payout
 */
exports.cancelPayout = async (req, res) => {
  try {
    const { payoutId } = req.params;

    const payout = await Payout.findById(payoutId);

    if (!payout) {
      return res.status(404).json({
        error: 'Payout not found'
      });
    }

    // Vérifier que c'est bien le propriétaire ou un admin
    if (payout.printer.toString() !== req.userId.toString()) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    payout.cancel();
    await payout.save();

    // Recréditer le montant
    const printer = await User.findById(payout.printer);
    printer.balance.available = (printer.balance.available || 0) + payout.amount;
    printer.balance.total = (printer.balance.total || 0) + payout.amount;
    await printer.save();

    res.json({
      message: 'Payout cancelled successfully',
      payout
    });
  } catch (error) {
    console.error('Cancel payout error:', error);
    res.status(500).json({
      error: 'Failed to cancel payout',
      details: error.message
    });
  }
};

/**
 * Obtenir les payouts
 */
exports.getPayouts = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = {
      printer: req.userId
    };

    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const payouts = await Payout.find(query)
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payout.countDocuments(query);

    res.json({
      payouts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get payouts error:', error);
    res.status(500).json({
      error: 'Failed to get payouts',
      details: error.message
    });
  }
};

/**
 * Obtenir un payout
 */
exports.getPayout = async (req, res) => {
  try {
    const { payoutId } = req.params;

    const payout = await Payout.findById(payoutId)
      .populate('printer', 'firstName lastName email companyName')
      .populate('contracts');

    if (!payout) {
      return res.status(404).json({
        error: 'Payout not found'
      });
    }

    // Vérifier les permissions
    if (payout.printer._id.toString() !== req.userId.toString()) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    res.json({ payout });
  } catch (error) {
    console.error('Get payout error:', error);
    res.status(500).json({
      error: 'Failed to get payout',
      details: error.message
    });
  }
};
