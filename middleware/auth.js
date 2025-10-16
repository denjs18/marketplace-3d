const { verifyToken, extractToken } = require('../config/auth');
const User = require('../models/User');

/**
 * Middleware to verify JWT token and authenticate user
 */
const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        error: 'Access denied. No token provided.'
      });
    }

    const decoded = verifyToken(token);

    // Get user from database
    const user = await User.findById(decoded.id).select('-password -refreshToken');

    if (!user) {
      return res.status(401).json({
        error: 'User not found. Invalid token.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'Account is deactivated.'
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;
    req.userRole = user.role;

    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid or expired token.',
      details: error.message
    });
  }
};

/**
 * Middleware to check if user has specific role
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required.'
      });
    }

    if (!roles.includes(req.userRole)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }

    next();
  };
};

/**
 * Middleware to check if user is a client
 */
const isClient = authorize('client');

/**
 * Middleware to check if user is a printer
 */
const isPrinter = authorize('printer');

/**
 * Middleware to check if user is either client or printer (any authenticated user)
 */
const isAuthenticated = authenticate;

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (token) {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.id).select('-password -refreshToken');

      if (user && user.isActive) {
        req.user = user;
        req.userId = user._id;
        req.userRole = user.role;
      }
    }

    next();
  } catch (error) {
    // Token is invalid but we don't block the request
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  isClient,
  isPrinter,
  isAuthenticated,
  optionalAuth
};
