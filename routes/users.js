const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { validateProfileUpdate, validateObjectId } = require('../middleware/validation');
const { uploadImage, handleUploadError } = require('../middleware/upload');

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get('/:id', authenticate, validateObjectId('id'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -refreshToken -stripeAccountId');

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({ user: user.getPublicProfile() });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get user',
      details: error.message
    });
  }
});

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticate, validateProfileUpdate, async (req, res) => {
  try {
    const updates = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Update allowed fields
    const allowedFields = ['firstName', 'lastName', 'phone', 'address', 'companyName', 'printerCapabilities', 'hourlyRate'];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        user[field] = updates[field];
      }
    });

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update profile',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/users/profile-image
 * @desc    Upload profile image
 * @access  Private
 */
router.post('/profile-image', authenticate, uploadImage, handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No image file provided'
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    user.profileImage = req.file.url;
    await user.save();

    res.json({
      message: 'Profile image updated successfully',
      profileImage: user.profileImage
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to upload profile image',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/users/printers/search
 * @desc    Search for printers
 * @access  Private
 */
router.get('/printers/search', authenticate, async (req, res) => {
  try {
    const { material, minRating, page = 1, limit = 10 } = req.query;

    const query = { role: 'printer', isActive: true };

    if (material) {
      query['printerCapabilities.materials'] = material;
    }

    if (minRating) {
      query['rating.average'] = { $gte: parseFloat(minRating) };
    }

    const skip = (page - 1) * limit;

    const printers = await User.find(query)
      .select('-password -refreshToken -stripeAccountId')
      .sort('-rating.average -totalProjects')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      printers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to search printers',
      details: error.message
    });
  }
});

module.exports = router;
