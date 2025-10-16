/**
 * Real-time messaging with Socket.IO
 */

let socket;
let currentConversation = null;

// Initialize Socket.IO connection
function initSocket() {
  const token = getToken();
  if (!token) return;

  socket = io({
    auth: {
      token: token
    }
  });

  const user = getUser();

  socket.on('connect', () => {
    console.log('Socket connected');
    socket.emit('join-room', user._id);
  });

  socket.on('receive-message', (data) => {
    handleNewMessage(data.message);
    updateUnreadCount();
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });
}

// Load conversations list
async function loadConversations() {
  try {
    const response = await apiRequest('/messages/conversations');
    const data = await response.json();

    const container = document.getElementById('conversations-list');
    if (!container) return;

    if (data.conversations.length === 0) {
      container.innerHTML = '<p class="text-center text-secondary">Aucune conversation</p>';
      return;
    }

    container.innerHTML = data.conversations.map(conv => `
      <div class="card conversation-item" data-user-id="${conv.user._id}" style="cursor: pointer;">
        <div class="flex gap-2">
          <img src="${conv.user.profileImage}" alt="${conv.user.firstName}" class="message-avatar">
          <div style="flex: 1;">
            <div class="flex-between">
              <strong>${conv.user.firstName} ${conv.user.lastName}</strong>
              ${conv.unreadCount > 0 ? `<span class="badge badge-error">${conv.unreadCount}</span>` : ''}
            </div>
            <p class="text-secondary" style="font-size: 0.875rem;">
              ${conv.lastMessage.content.substring(0, 50)}${conv.lastMessage.content.length > 50 ? '...' : ''}
            </p>
          </div>
        </div>
      </div>
    `).join('');

    // Add click handlers
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', () => {
        const userId = item.dataset.userId;
        loadConversation(userId);
      });
    });
  } catch (error) {
    console.error('Error loading conversations:', error);
  }
}

// Load specific conversation
async function loadConversation(userId) {
  try {
    currentConversation = userId;

    const response = await apiRequest(`/messages/conversation/${userId}`);
    const data = await response.json();

    const container = document.getElementById('messages-container');
    if (!container) return;

    const currentUser = getUser();

    container.innerHTML = data.messages.reverse().map(msg => {
      const isSent = msg.sender._id === currentUser._id;
      return `
        <div class="message ${isSent ? 'sent' : ''}">
          <img src="${msg.sender.profileImage}" alt="${msg.sender.firstName}" class="message-avatar">
          <div class="message-content">
            <div class="message-header">
              <span class="message-sender">${msg.sender.firstName} ${msg.sender.lastName}</span>
              <span class="message-time">${formatDate(msg.createdAt)}</span>
            </div>
            <p>${msg.content}</p>
          </div>
        </div>
      `;
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;

    // Mark as read
    await apiRequest(`/messages/conversation/${userId}/read`, {
      method: 'POST'
    });

    updateUnreadCount();
  } catch (error) {
    console.error('Error loading conversation:', error);
  }
}

// Send message
async function sendMessage(recipientId, content) {
  try {
    const response = await apiRequest('/messages', {
      method: 'POST',
      body: JSON.stringify({
        recipient: recipientId,
        content: content
      })
    });

    if (response.ok) {
      const data = await response.json();

      // Emit socket event
      if (socket) {
        socket.emit('send-message', {
          recipientId: recipientId,
          message: data.data
        });
      }

      // Add to current conversation
      if (currentConversation === recipientId) {
        appendMessage(data.data, true);
      }

      return true;
    }

    return false;
  } catch (error) {
    console.error('Error sending message:', error);
    return false;
  }
}

// Append message to conversation
function appendMessage(message, isSent) {
  const container = document.getElementById('messages-container');
  if (!container) return;

  const messageHtml = `
    <div class="message ${isSent ? 'sent' : ''}">
      <img src="${message.sender.profileImage}" alt="${message.sender.firstName}" class="message-avatar">
      <div class="message-content">
        <div class="message-header">
          <span class="message-sender">${message.sender.firstName} ${message.sender.lastName}</span>
          <span class="message-time">${formatDate(message.createdAt)}</span>
        </div>
        <p>${message.content}</p>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', messageHtml);
  container.scrollTop = container.scrollHeight;
}

// Handle new incoming message
function handleNewMessage(message) {
  if (currentConversation === message.sender._id) {
    appendMessage(message, false);

    // Mark as read
    apiRequest(`/messages/${message._id}/read`, {
      method: 'POST'
    }).catch(err => console.error('Error marking message as read:', err));
  } else {
    // Show notification
    showToast(`Nouveau message de ${message.sender.firstName}`, 'info');
    loadConversations(); // Reload conversations list
  }
}

// Update unread count
async function updateUnreadCount() {
  try {
    const response = await apiRequest('/messages/unread-count');
    const data = await response.json();

    const badge = document.getElementById('unread-badge');
    if (badge) {
      if (data.unreadCount > 0) {
        badge.textContent = data.unreadCount;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  } catch (error) {
    console.error('Error updating unread count:', error);
  }
}

// Initialize messaging
if (typeof io !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (isAuthenticated()) {
      initSocket();
      updateUnreadCount();
    }
  });
}
