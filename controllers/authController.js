const User = require('../models/User');
const { generateToken, generateRefreshToken } = require('../config/auth');
const { sendWelcomeEmail } = require('../utils/email');

/**
 * Register new user
 */
exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, phone, companyName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        error: 'Email already registered'
      });
    }

    // Create new user
    const userData = {
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      role,
      phone
    };

    // Add printer-specific fields
    if (role === 'printer' && companyName) {
      userData.companyName = companyName;
    }

    const user = new User(userData);
    await user.save();

    // Generate tokens
    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // Send welcome email (async, don't wait)
    sendWelcomeEmail(user).catch(err => console.error('Failed to send welcome email:', err));

    res.status(201).json({
      message: 'User registered successfully',
      user: user.getPublicProfile(),
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      details: error.message
    });
  }
};

/**
 * Login user
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        error: 'Account is deactivated. Please contact support.'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Generate tokens
    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Update last login and refresh token
    user.lastLogin = new Date();
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      message: 'Login successful',
      user: user.getPublicProfile(),
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      details: error.message
    });
  }
};

/**
 * Get current user profile
 */
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password -refreshToken');

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Failed to get profile',
      details: error.message
    });
  }
};

/**
 * Logout user
 */
exports.logout = async (req, res) => {
  try {
    // Clear refresh token
    await User.findByIdAndUpdate(req.userId, {
      refreshToken: null
    });

    res.json({
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      details: error.message
    });
  }
};

/**
 * Refresh access token
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required'
      });
    }

    // Verify refresh token
    const { verifyToken } = require('../config/auth');
    const decoded = verifyToken(refreshToken);

    // Find user with this refresh token
    const user = await User.findOne({
      _id: decoded.id,
      refreshToken: refreshToken
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const newToken = generateToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    // Update refresh token
    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      error: 'Invalid or expired refresh token',
      details: error.message
    });
  }
};
