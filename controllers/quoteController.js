const Quote = require('../models/Quote');
const Project = require('../models/Project');
const User = require('../models/User');
const { sendNewQuoteEmail, sendQuoteAcceptedEmail } = require('../utils/email');

/**
 * Create new quote
 */
exports.createQuote = async (req, res) => {
  try {
    const { projectId, price, estimatedDuration, deliveryDate, message, breakdown } = req.body;

    // Check if project exists
    const project = await Project.findById(projectId).populate('client');

    if (!project) {
      return res.status(404).json({
        error: 'Project not found'
      });
    }

    // Check if project can receive quotes
    if (!project.canReceiveQuotes()) {
      return res.status(400).json({
        error: 'Project is not accepting quotes'
      });
    }

    // Check if printer already quoted
    const existingQuote = await Quote.findOne({
      project: projectId,
      printer: req.userId
    });

    if (existingQuote) {
      return res.status(400).json({
        error: 'You have already submitted a quote for this project'
      });
    }

    // Create quote
    const quote = new Quote({
      project: projectId,
      printer: req.userId,
      price,
      estimatedDuration,
      deliveryDate,
      message,
      breakdown
    });

    await quote.save();

    // Add quote to project
    project.quotes.push(quote._id);
    if (project.status === 'open') {
      project.status = 'quoted';
    }
    await project.save();

    // Populate quote data
    await quote.populate('printer', 'firstName lastName profileImage rating companyName');

    // Send notification email to client
    const printer = await User.findById(req.userId);
    if (project.client && printer) {
      sendNewQuoteEmail(project.client, project, quote, printer).catch(err =>
        console.error('Failed to send new quote email:', err)
      );
    }

    res.status(201).json({
      message: 'Quote submitted successfully',
      quote
    });
  } catch (error) {
    console.error('Create quote error:', error);
    res.status(500).json({
      error: 'Failed to create quote',
      details: error.message
    });
  }
};

/**
 * Get quotes for a project
 */
exports.getProjectQuotes = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({
        error: 'Project not found'
      });
    }

    // Check permissions
    const isOwner = project.client.toString() === req.userId.toString();

    if (!isOwner && req.userRole !== 'printer') {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    let query = { project: projectId };

    // If printer, only show their own quote
    if (req.userRole === 'printer' && !isOwner) {
      query.printer = req.userId;
    }

    const quotes = await Quote.find(query)
      .populate('printer', 'firstName lastName profileImage rating companyName printerCapabilities')
      .sort('-createdAt');

    res.json({ quotes });
  } catch (error) {
    console.error('Get quotes error:', error);
    res.status(500).json({
      error: 'Failed to get quotes',
      details: error.message
    });
  }
};

/**
 * Accept quote
 */
exports.acceptQuote = async (req, res) => {
  try {
    const { quoteId } = req.params;

    const quote = await Quote.findById(quoteId).populate('printer');

    if (!quote) {
      return res.status(404).json({
        error: 'Quote not found'
      });
    }

    const project = await Project.findById(quote.project);

    if (!project) {
      return res.status(404).json({
        error: 'Project not found'
      });
    }

    // Only project owner can accept
    if (project.client.toString() !== req.userId.toString()) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Check if quote is still valid
    if (quote.status !== 'pending') {
      return res.status(400).json({
        error: 'Quote is no longer available'
      });
    }

    if (quote.isExpired()) {
      return res.status(400).json({
        error: 'Quote has expired'
      });
    }

    // Accept quote
    quote.accept();
    await quote.save();

    // Update project
    project.assignToPrinter(quote.printer._id, quote._id);
    await project.save();

    // Reject all other quotes
    await Quote.updateMany(
      {
        project: project._id,
        _id: { $ne: quote._id },
        status: 'pending'
      },
      {
        status: 'rejected'
      }
    );

    // Send notification to printer
    if (quote.printer) {
      sendQuoteAcceptedEmail(quote.printer, project, quote).catch(err =>
        console.error('Failed to send quote accepted email:', err)
      );
    }

    res.json({
      message: 'Quote accepted successfully',
      quote,
      project
    });
  } catch (error) {
    console.error('Accept quote error:', error);
    res.status(500).json({
      error: 'Failed to accept quote',
      details: error.message
    });
  }
};

/**
 * Reject quote
 */
exports.rejectQuote = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const { reason } = req.body;

    const quote = await Quote.findById(quoteId);

    if (!quote) {
      return res.status(404).json({
        error: 'Quote not found'
      });
    }

    const project = await Project.findById(quote.project);

    if (!project) {
      return res.status(404).json({
        error: 'Project not found'
      });
    }

    // Only project owner can reject
    if (project.client.toString() !== req.userId.toString()) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    if (quote.status !== 'pending') {
      return res.status(400).json({
        error: 'Quote cannot be rejected'
      });
    }

    quote.reject(reason);
    await quote.save();

    res.json({
      message: 'Quote rejected successfully',
      quote
    });
  } catch (error) {
    console.error('Reject quote error:', error);
    res.status(500).json({
      error: 'Failed to reject quote',
      details: error.message
    });
  }
};

/**
 * Get printer's quotes
 */
exports.getPrinterQuotes = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { printer: req.userId };

    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const quotes = await Quote.find(query)
      .populate('project', 'title description status specifications client')
      .populate({
        path: 'project',
        populate: {
          path: 'client',
          select: 'firstName lastName profileImage'
        }
      })
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Quote.countDocuments(query);

    res.json({
      quotes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get printer quotes error:', error);
    res.status(500).json({
      error: 'Failed to get quotes',
      details: error.message
    });
  }
};
