const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { uploadMultipleImages, handleUploadError } = require('../middleware/upload');

/**
 * @route   POST /api/uploads/images
 * @desc    Upload multiple images
 * @access  Private
 */
router.post('/images', authenticate, uploadMultipleImages, handleUploadError, (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: 'No images provided'
      });
    }

    const imageUrls = req.files.map(file => `/uploads/images/${file.filename}`);

    res.json({
      message: 'Images uploaded successfully',
      images: imageUrls
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to upload images',
      details: error.message
    });
  }
});

module.exports = router;
