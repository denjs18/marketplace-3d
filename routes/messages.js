const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');
const { validateMessage, validateObjectId } = require('../middleware/validation');

/**
 * @route   POST /api/messages
 * @desc    Send a message
 * @access  Private
 */
router.post('/', authenticate, validateMessage, messageController.sendMessage);

/**
 * @route   GET /api/messages/conversations
 * @desc    Get list of all conversations
 * @access  Private
 */
router.get('/conversations', authenticate, messageController.getConversationsList);

/**
 * @route   GET /api/messages/conversation/:userId
 * @desc    Get conversation with specific user
 * @access  Private
 */
router.get('/conversation/:userId', authenticate, validateObjectId('userId'), messageController.getConversation);

/**
 * @route   GET /api/messages/unread-count
 * @desc    Get unread message count
 * @access  Private
 */
router.get('/unread-count', authenticate, messageController.getUnreadCount);

/**
 * @route   POST /api/messages/:messageId/read
 * @desc    Mark message as read
 * @access  Private
 */
router.post('/:messageId/read', authenticate, validateObjectId('messageId'), messageController.markAsRead);

/**
 * @route   GET /api/messages/project/:projectId
 * @desc    Get messages for a project
 * @access  Private
 */
router.get('/project/:projectId', authenticate, validateObjectId('projectId'), messageController.getProjectMessages);

module.exports = router;
