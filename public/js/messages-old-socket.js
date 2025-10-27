/**
 * Page Messages - Liste complète des conversations
 */

let currentUser = null;
let allConversations = [];
let filteredConversations = [];
let currentPage = 1;
const conversationsPerPage = 20;

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth('client');
  if (!currentUser) {
    return;
  }

  createAuthNavbar(currentUser);
  await loadConversations();

  // Event listeners
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  document.getElementById('sortFilter').addEventListener('change', applyFilters);

  // Polling pour mettre à jour les conversations toutes les 10 secondes
  setInterval(loadConversations, 10000);
});

// Charger toutes les conversations
async function loadConversations() {
  const token = getToken();

  try {
    const response = await fetch('/api/conversations/my-conversations', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Erreur lors du chargement des conversations');
    }

    const data = await response.json();
    allConversations = data.conversations || [];
    filteredConversations = [...allConversations];

    applyFilters();

    document.getElementById('loading').style.display = 'none';

  } catch (error) {
    console.error('Erreur:', error);
    document.getElementById('loading').innerHTML = '<p style="color: #d63031;">Erreur lors du chargement</p>';
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
