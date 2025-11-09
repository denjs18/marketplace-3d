const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { uploadMultipleImages, uploadSTL, uploadAttachment, uploadProfileImage, handleUploadError } = require('../middleware/upload');
const Conversation = require('../models/Conversation');

/**
 * @route   POST /api/uploads/profile-image
 * @desc    Upload profile image
 * @access  Private
 */
router.post('/profile-image', authenticate, uploadProfileImage, handleUploadError, (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No image provided'
      });
    }

    res.json({
      message: 'Profile image uploaded successfully',
      profileImage: req.file.url
    });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(500).json({
      error: 'Failed to upload profile image',
      details: error.message
    });
  }
});

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

    const imageUrls = req.files.map(file => file.url);

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

/**
 * @route   POST /api/uploads/stl
 * @desc    Upload STL file for project
 * @access  Private
 */
router.post('/stl', authenticate, uploadSTL, handleUploadError, (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No STL file provided'
      });
    }

    res.json({
      message: 'STL file uploaded successfully',
      stlFile: req.file.url
    });
  } catch (error) {
    console.error('Error uploading STL:', error);
    res.status(500).json({
      error: 'Failed to upload STL file',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/uploads/conversation-attachment
 * @desc    Upload attachment for conversation message (images, PDF, STL)
 * @access  Private
 * @limits  Max 10MB per file
 */
router.post('/conversation-attachment', authenticate, uploadAttachment, handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided'
      });
    }

    const { conversationId } = req.body;

    // Vérifier que la conversation existe et que l'utilisateur y a accès
    if (conversationId) {
      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation non trouvée' });
      }

      const userId = req.userId.toString();
      if (conversation.client.toString() !== userId &&
          conversation.printer.toString() !== userId) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      // Vérifier que la conversation peut encore recevoir des messages
      if (!conversation.canBeModified()) {
        return res.status(400).json({ error: 'Cette conversation ne peut plus être modifiée' });
      }
    }

    // Retourner les informations du fichier uploadé
    res.json({
      message: 'File uploaded successfully',
      file: {
        url: req.file.url,
        pathname: req.file.pathname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('Error uploading conversation attachment:', error);
    res.status(500).json({
      error: 'Failed to upload attachment',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/uploads/production-photos
 * @desc    Upload photos des impressions terminées
 * @access  Private (Printer only)
 */
router.post('/production-photos', authenticate, uploadMultipleImages, handleUploadError, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: 'Aucune photo fournie'
      });
    }

    const { conversationId } = req.body;

    // Vérifier que la conversation existe et que c'est bien l'imprimeur
    if (conversationId) {
      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation non trouvée' });
      }

      const userId = req.userId.toString();
      if (conversation.printer.toString() !== userId) {
        return res.status(403).json({ error: 'Seul l\'imprimeur peut uploader des photos de production' });
      }
    }

    const photoUrls = req.files.map(file => file.url);

    res.json({
      message: 'Photos uploadées avec succès',
      photos: photoUrls
    });
  } catch (error) {
    console.error('Error uploading production photos:', error);
    res.status(500).json({
      error: 'Échec de l\'upload des photos',
      details: error.message
    });
  }
});

module.exports = router;
