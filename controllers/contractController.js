const Contract = require('../models/Contract');
const Quote = require('../models/Quote');
const Project = require('../models/Project');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { createPaymentIntent } = require('../config/stripe');
const { calculateCommission } = require('../utils/calculateCommission');

/**
 * Créer un contrat après l'acceptation d'un devis
 */
exports.createContract = async (req, res) => {
  try {
    const { quoteId } = req.body;

    const quote = await Quote.findById(quoteId)
      .populate('printer')
      .populate('project');

    if (!quote) {
      return res.status(404).json({
        error: 'Quote not found'
      });
    }

    if (quote.status !== 'accepted') {
      return res.status(400).json({
        error: 'Quote must be accepted before creating contract'
      });
    }

    const project = await Project.findById(quote.project);

    if (!project) {
      return res.status(404).json({
        error: 'Project not found'
      });
    }

    // Vérifier que c'est bien le client du projet
    if (project.client.toString() !== req.userId.toString()) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Vérifier si un contrat existe déjà
    const existingContract = await Contract.findOne({
      quote: quoteId,
      status: { $ne: 'cancelled' }
    });

    if (existingContract) {
      return res.status(400).json({
        error: 'Contract already exists for this quote',
        contractId: existingContract._id
      });
    }

    // Créer le contrat
    const contract = new Contract({
      project: project._id,
      quote: quote._id,
      client: req.userId,
      printer: quote.printer._id,
      agreedPrice: quote.price,
      platformCommission: quote.price * 0.10,
      totalPaid: quote.price * 1.10,
      printerEarnings: quote.price,
      status: 'pending_signature'
    });

    await contract.save();

    res.json({
      message: 'Contract created successfully',
      contract,
      nextStep: 'sign_and_pay'
    });
  } catch (error) {
    console.error('Create contract error:', error);
    res.status(500).json({
      error: 'Failed to create contract',
      details: error.message
    });
  }
};

/**
 * Signer le contrat et effectuer le paiement
 */
exports.signContract = async (req, res) => {
  try {
    const { contractId, useBalance } = req.body;
    const useBalanceAmount = parseFloat(useBalance) || 0;

    const contract = await Contract.findById(contractId)
      .populate('printer')
      .populate('client');

    if (!contract) {
      return res.status(404).json({
        error: 'Contract not found'
      });
    }

    // Vérifier que c'est bien le client
    if (contract.client._id.toString() !== req.userId.toString()) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    if (contract.status !== 'pending_signature') {
      return res.status(400).json({
        error: 'Contract already signed or cannot be signed'
      });
    }

    const client = await User.findById(req.userId);
    const totalAmount = contract.totalPaid;

    let balanceUsed = 0;
    let stripeAmount = totalAmount;
    let paymentMethod = 'card';

    // Gérer l'utilisation du solde
    if (useBalanceAmount > 0) {
      if (!client.balance || client.balance.available < useBalanceAmount) {
        return res.status(400).json({
          error: 'Insufficient balance',
          available: client.balance?.available || 0,
          requested: useBalanceAmount
        });
      }

      balanceUsed = Math.min(useBalanceAmount, totalAmount);
      stripeAmount = totalAmount - balanceUsed;

      if (balanceUsed === totalAmount) {
        paymentMethod = 'balance';
      } else if (balanceUsed > 0) {
        paymentMethod = 'mixed';
      }
    }

    let paymentIntent = null;
    let stripePaymentIntentId = null;

    // Créer un payment intent seulement si nécessaire
    if (stripeAmount > 0) {
      paymentIntent = await createPaymentIntent(
        stripeAmount,
        'eur',
        {
          contractId: contract._id.toString(),
          projectId: contract.project.toString(),
          quoteId: contract.quote.toString(),
          clientId: req.userId.toString(),
          printerId: contract.printer._id.toString()
        }
      );
      stripePaymentIntentId = paymentIntent.id;
    }

    // Créer la transaction
    const transaction = new Transaction({
      project: contract.project,
      quote: contract.quote,
      client: req.userId,
      printer: contract.printer._id,
      amount: contract.agreedPrice,
      commission: contract.platformCommission,
      printerPayout: contract.printerEarnings,
      paymentMethod,
      balanceUsed,
      stripeAmount,
      stripePaymentIntentId,
      status: stripeAmount > 0 ? 'pending' : 'processing'
    });

    await transaction.save();

    // Si paiement 100% par balance
    if (paymentMethod === 'balance') {
      // Déduire immédiatement
      client.deductFromAvailable(balanceUsed);
      await client.save();

      // Marquer la transaction comme processing
      transaction.status = 'processing';
      transaction.processedAt = new Date();
      await transaction.save();

      // Signer le contrat
      contract.sign(transaction._id);
      await contract.save();

      // Ajouter le montant en pending pour l'imprimeur
      const printer = await User.findById(contract.printer._id);
      printer.addPendingBalance(contract.printerEarnings);
      await printer.save();

      return res.json({
        message: 'Contract signed successfully with balance',
        contract,
        transaction,
        paymentMethod: 'balance'
      });
    }

    // Si paiement avec Stripe (partiel ou total)
    res.json({
      message: 'Payment intent created',
      contract,
      transaction,
      clientSecret: paymentIntent.client_secret,
      stripeAmount,
      balanceUsed,
      paymentMethod
    });
  } catch (error) {
    console.error('Sign contract error:', error);
    res.status(500).json({
      error: 'Failed to sign contract',
      details: error.message
    });
  }
};

/**
 * Confirmer le paiement Stripe (webhook ou manuel)
 */
exports.confirmPayment = async (req, res) => {
  try {
    const { transactionId } = req.body;

    const transaction = await Transaction.findById(transactionId)
      .populate('client')
      .populate('printer');

    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction not found'
      });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({
        error: 'Transaction already processed'
      });
    }

    // Si balance utilisée, la déduire maintenant
    if (transaction.balanceUsed > 0) {
      const client = await User.findById(transaction.client._id);
      client.deductFromAvailable(transaction.balanceUsed);
      await client.save();
    }

    // Marquer la transaction comme processing
    transaction.status = 'processing';
    transaction.processedAt = new Date();
    await transaction.save();

    // Trouver le contrat et le signer
    const contract = await Contract.findOne({ quote: transaction.quote });
    if (contract && contract.status === 'pending_signature') {
      contract.sign(transaction._id);
      await contract.save();
    }

    // Ajouter le montant en pending pour l'imprimeur
    const printer = await User.findById(transaction.printer._id);
    printer.addPendingBalance(transaction.amount);
    await printer.save();

    res.json({
      message: 'Payment confirmed successfully',
      transaction,
      contract
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      error: 'Failed to confirm payment',
      details: error.message
    });
  }
};

/**
 * Marquer l'impression comme lancée
 */
exports.startPrinting = async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await Contract.findById(contractId);

    if (!contract) {
      return res.status(404).json({
        error: 'Contract not found'
      });
    }

    // Vérifier que c'est bien l'imprimeur
    if (contract.printer.toString() !== req.userId.toString()) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    contract.startPrinting();
    await contract.save();

    res.json({
      message: 'Printing started successfully',
      contract
    });
  } catch (error) {
    console.error('Start printing error:', error);
    res.status(500).json({
      error: 'Failed to start printing',
      details: error.message
    });
  }
};

/**
 * Marquer l'impression comme terminée
 */
exports.completePrinting = async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await Contract.findById(contractId);

    if (!contract) {
      return res.status(404).json({
        error: 'Contract not found'
      });
    }

    // Vérifier que c'est bien l'imprimeur
    if (contract.printer.toString() !== req.userId.toString()) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    contract.completePrinting();
    await contract.save();

    res.json({
      message: 'Printing completed successfully',
      contract
    });
  } catch (error) {
    console.error('Complete printing error:', error);
    res.status(500).json({
      error: 'Failed to complete printing',
      details: error.message
    });
  }
};

/**
 * Envoyer les photos de l'impression
 */
exports.sendPhotos = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { photos } = req.body;

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({
        error: 'At least one photo is required'
      });
    }

    const contract = await Contract.findById(contractId);

    if (!contract) {
      return res.status(404).json({
        error: 'Contract not found'
      });
    }

    // Vérifier que c'est bien l'imprimeur
    if (contract.printer.toString() !== req.userId.toString()) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    contract.sendPhotos(photos);
    await contract.save();

    res.json({
      message: 'Photos sent successfully',
      contract
    });
  } catch (error) {
    console.error('Send photos error:', error);
    res.status(500).json({
      error: 'Failed to send photos',
      details: error.message
    });
  }
};

/**
 * Marquer comme expédié
 */
exports.markAsShipped = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { trackingNumber, carrier } = req.body;

    const contract = await Contract.findById(contractId);

    if (!contract) {
      return res.status(404).json({
        error: 'Contract not found'
      });
    }

    // Vérifier que c'est bien l'imprimeur
    if (contract.printer.toString() !== req.userId.toString()) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    contract.markAsShipped(trackingNumber, carrier);
    await contract.save();

    res.json({
      message: 'Order marked as shipped successfully',
      contract
    });
  } catch (error) {
    console.error('Mark as shipped error:', error);
    res.status(500).json({
      error: 'Failed to mark as shipped',
      details: error.message
    });
  }
};

/**
 * Confirmer la réception (par le client)
 */
exports.confirmDelivery = async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await Contract.findById(contractId)
      .populate('printer');

    if (!contract) {
      return res.status(404).json({
        error: 'Contract not found'
      });
    }

    // Vérifier que c'est bien le client
    if (contract.client.toString() !== req.userId.toString()) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    if (!contract.canConfirmDelivery()) {
      return res.status(400).json({
        error: 'Order must be shipped before confirming delivery'
      });
    }

    // Confirmer la livraison
    contract.confirmDelivery();
    await contract.save();

    // Transférer le solde pending vers available pour l'imprimeur
    const printer = await User.findById(contract.printer._id);
    printer.convertPendingToAvailable(contract.printerEarnings);
    await printer.save();

    res.json({
      message: 'Delivery confirmed successfully. Printer earnings are now available.',
      contract
    });
  } catch (error) {
    console.error('Confirm delivery error:', error);
    res.status(500).json({
      error: 'Failed to confirm delivery',
      details: error.message
    });
  }
};

/**
 * Obtenir les détails d'un contrat
 */
exports.getContract = async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await Contract.findById(contractId)
      .populate('project', 'title description stlFile')
      .populate('quote', 'price estimatedDuration deliveryDate')
      .populate('client', 'firstName lastName email')
      .populate('printer', 'firstName lastName email companyName')
      .populate('transaction');

    if (!contract) {
      return res.status(404).json({
        error: 'Contract not found'
      });
    }

    // Vérifier les permissions
    if (
      contract.client._id.toString() !== req.userId.toString() &&
      contract.printer._id.toString() !== req.userId.toString()
    ) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    res.json({ contract });
  } catch (error) {
    console.error('Get contract error:', error);
    res.status(500).json({
      error: 'Failed to get contract',
      details: error.message
    });
  }
};

/**
 * Obtenir la liste des contrats
 */
exports.getContracts = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = {};

    // Filtrer par rôle
    if (req.userRole === 'client') {
      query.client = req.userId;
    } else if (req.userRole === 'printer') {
      query.printer = req.userId;
    }

    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const contracts = await Contract.find(query)
      .populate('project', 'title status')
      .populate('client', 'firstName lastName')
      .populate('printer', 'firstName lastName companyName')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Contract.countDocuments(query);

    res.json({
      contracts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get contracts error:', error);
    res.status(500).json({
      error: 'Failed to get contracts',
      details: error.message
    });
  }
};
