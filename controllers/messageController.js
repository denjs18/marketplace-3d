const Message = require('../models/Message');
const User = require('../models/User');
const { sendNewMessageEmail } = require('../utils/email');

/**
 * Send message
 */
exports.sendMessage = async (req, res) => {
  try {
    const { recipient, content, project, quote } = req.body;

    // Verify recipient exists
    const recipientUser = await User.findById(recipient);

    if (!recipientUser) {
      return res.status(404).json({
        error: 'Recipient not found'
      });
    }

    // Create message
    const message = new Message({
      sender: req.userId,
      recipient,
      content,
      project,
      quote
    });

    await message.save();

    // Populate sender info
    await message.populate('sender', 'firstName lastName profileImage');

    // Emit socket event for real-time messaging
    const io = req.app.get('io');
    if (io) {
      io.to(recipient).emit('receive-message', {
        message,
        recipientId: recipient
      });
    }

    // Send email notification
    const sender = await User.findById(req.userId);
    sendNewMessageEmail(recipientUser, sender, message).catch(err =>
      console.error('Failed to send message email:', err)
    );

    res.status(201).json({
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      error: 'Failed to send message',
      details: error.message
    });
  }
};

/**
 * Get conversation between two users
 */
exports.getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    const messages = await Message.getConversation(req.userId, userId, parseInt(limit));

    // Mark messages as read
    await Message.markConversationAsRead(userId, req.userId);

    res.json({ messages });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      error: 'Failed to get conversation',
      details: error.message
    });
  }
};

/**
 * Get list of all conversations
 */
exports.getConversationsList = async (req, res) => {
  try {
    const conversations = await Message.getConversationsList(req.userId);

    // Populate user details
    const populatedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const user = await User.findById(conv._id).select('firstName lastName profileImage lastLogin');
        return {
          user,
          lastMessage: conv.lastMessage,
          unreadCount: conv.unreadCount
        };
      })
    );

    res.json({ conversations: populatedConversations });
  } catch (error) {
    console.error('Get conversations list error:', error);
    res.status(500).json({
      error: 'Failed to get conversations',
      details: error.message
    });
  }
};

/**
 * Mark message as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        error: 'Message not found'
      });
    }

    // Only recipient can mark as read
    if (message.recipient.toString() !== req.userId.toString()) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    message.markAsRead();
    await message.save();

    res.json({
      message: 'Message marked as read',
      data: message
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      error: 'Failed to mark message as read',
      details: error.message
    });
  }
};

/**
 * Get unread message count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Message.getUnreadCount(req.userId);

    res.json({ unreadCount: count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      error: 'Failed to get unread count',
      details: error.message
    });
  }
};

/**
 * Get messages for a project
 */
exports.getProjectMessages = async (req, res) => {
  try {
    const { projectId } = req.params;

    const messages = await Message.find({ project: projectId })
      .populate('sender', 'firstName lastName profileImage')
      .populate('recipient', 'firstName lastName profileImage')
      .sort('createdAt');

    res.json({ messages });
  } catch (error) {
    console.error('Get project messages error:', error);
    res.status(500).json({
      error: 'Failed to get project messages',
      details: error.message
    });
  }
};
