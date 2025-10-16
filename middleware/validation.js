/**
 * Validation middleware for request data
 */

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  return password && password.length >= 6;
};

const validatePhone = (phone) => {
  if (!phone) return true; // Phone is optional
  const phoneRegex = /^[\d\s+()-]+$/;
  return phoneRegex.test(phone);
};

/**
 * Validate registration data
 */
const validateRegistration = (req, res, next) => {
  const { firstName, lastName, email, password, role } = req.body;

  const errors = [];

  if (!firstName || firstName.trim().length < 2) {
    errors.push('First name must be at least 2 characters');
  }

  if (!lastName || lastName.trim().length < 2) {
    errors.push('Last name must be at least 2 characters');
  }

  if (!email || !validateEmail(email)) {
    errors.push('Valid email is required');
  }

  if (!password || !validatePassword(password)) {
    errors.push('Password must be at least 6 characters');
  }

  if (!role || !['client', 'printer'].includes(role)) {
    errors.push('Role must be either "client" or "printer"');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

/**
 * Validate login data
 */
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  const errors = [];

  if (!email || !validateEmail(email)) {
    errors.push('Valid email is required');
  }

  if (!password) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

/**
 * Validate project creation
 */
const validateProject = (req, res, next) => {
  const { title, description, specifications } = req.body;

  const errors = [];

  if (!title || title.trim().length < 3) {
    errors.push('Title must be at least 3 characters');
  }

  if (!description || description.trim().length < 10) {
    errors.push('Description must be at least 10 characters');
  }

  if (!specifications || !specifications.material) {
    errors.push('Material specification is required');
  }

  if (specifications && specifications.quantity && specifications.quantity < 1) {
    errors.push('Quantity must be at least 1');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

/**
 * Validate quote creation
 */
const validateQuote = (req, res, next) => {
  const { price, estimatedDuration, deliveryDate, message } = req.body;

  const errors = [];

  if (!price || price < 0) {
    errors.push('Valid price is required');
  }

  if (!estimatedDuration || !estimatedDuration.value || estimatedDuration.value < 0) {
    errors.push('Valid estimated duration is required');
  }

  if (!deliveryDate) {
    errors.push('Delivery date is required');
  } else {
    const delivery = new Date(deliveryDate);
    if (delivery < new Date()) {
      errors.push('Delivery date must be in the future');
    }
  }

  if (!message || message.trim().length < 10) {
    errors.push('Quote message must be at least 10 characters');
  }

  if (message && message.length > 1000) {
    errors.push('Quote message cannot exceed 1000 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

/**
 * Validate message
 */
const validateMessage = (req, res, next) => {
  const { recipient, content } = req.body;

  const errors = [];

  if (!recipient) {
    errors.push('Recipient is required');
  }

  if (!content || content.trim().length < 1) {
    errors.push('Message content is required');
  }

  if (content && content.length > 2000) {
    errors.push('Message cannot exceed 2000 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

/**
 * Validate user profile update
 */
const validateProfileUpdate = (req, res, next) => {
  const { firstName, lastName, email, phone } = req.body;

  const errors = [];

  if (firstName && firstName.trim().length < 2) {
    errors.push('First name must be at least 2 characters');
  }

  if (lastName && lastName.trim().length < 2) {
    errors.push('Last name must be at least 2 characters');
  }

  if (email && !validateEmail(email)) {
    errors.push('Valid email is required');
  }

  if (phone && !validatePhone(phone)) {
    errors.push('Invalid phone number format');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

/**
 * Validate pagination parameters
 */
const validatePagination = (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (page < 1) {
    return res.status(400).json({
      error: 'Page must be greater than 0'
    });
  }

  if (limit < 1 || limit > 100) {
    return res.status(400).json({
      error: 'Limit must be between 1 and 100'
    });
  }

  req.pagination = {
    page,
    limit,
    skip: (page - 1) * limit
  };

  next();
};

/**
 * Validate MongoDB ObjectId
 */
const validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;

    if (!objectIdRegex.test(id)) {
      return res.status(400).json({
        error: `Invalid ${paramName} format`
      });
    }

    next();
  };
};

module.exports = {
  validateRegistration,
  validateLogin,
  validateProject,
  validateQuote,
  validateMessage,
  validateProfileUpdate,
  validatePagination,
  validateObjectId
};
