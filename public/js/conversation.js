/**
 * Conversation messaging interface with polling
 */

let conversationId = null;
let currentUser = null;
let conversation = null;
let lastMessageId = null;
let pollingInterval = null;
let uploadedFile = null;

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  // Récupérer l'ID de conversation depuis l'URL
  const urlParams = new URLSearchParams(window.location.search);
  conversationId = urlParams.get('id');

  if (!conversationId) {
    alert('ID de conversation manquant');
    window.location.href = '/dashboard-client.html';
    return;
  }

  // Charger le token
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // Charger l'utilisateur actuel
  await loadCurrentUser();

  // Charger la conversation
  await loadConversation();

  // Charger les messages
  await loadMessages();

  // Démarrer le polling (toutes les 5 secondes)
  pollingInterval = setInterval(pollMessages, 5000);

  // Event listeners
  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById('fileUploadBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });

  document.getElementById('fileInput').addEventListener('change', handleFileSelect);

  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('pauseBtn').addEventListener('click', pauseConversation);

  // Modals
  document.getElementById('cancelQuoteBtn').addEventListener('click', () => {
    document.getElementById('quoteModal').classList.remove('active');
  });

  document.getElementById('closeCancelModal').addEventListener('click', () => {
    document.getElementById('cancelModal').classList.remove('active');
  });

  document.getElementById('submitQuoteBtn').addEventListener('click', submitQuote);
  document.getElementById('confirmCancelBtn').addEventListener('click', confirmCancel);
});

// Charger l'utilisateur actuel
async function loadCurrentUser() {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/users/profile', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (response.ok) {
    currentUser = await response.json();
  }
}

// Charger la conversation
async function loadConversation() {
  const token = localStorage.getItem('token');
  const response = await fetch(`/api/conversations/${conversationId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    alert('Erreur lors du chargement de la conversation');
    return;
  }

  const data = await response.json();
  conversation = data.conversation;

  // Afficher les infos du projet
  displayProjectInfo();

  // Afficher le devis si présent
  displayQuote();

  // Afficher les actions disponibles
  displayActions();
}

// Afficher les infos du projet
function displayProjectInfo() {
  const project = conversation.project;

  document.getElementById('projectTitle').textContent = project.title;
  document.getElementById('conversationStatus').textContent = conversation.status;
  document.getElementById('conversationStatus').className = `status-badge status-${conversation.status}`;
  document.getElementById('projectQuantity').textContent = project.specifications?.quantity || project.quantity || '-';
  document.getElementById('projectMaterial').textContent = project.specifications?.material || project.material || '-';
  document.getElementById('projectColor').textContent = project.specifications?.color || project.color || '-';
  document.getElementById('projectFinish').textContent = project.specifications?.postProcessing || project.finish || '-';

  if (project.images && project.images.length > 0) {
    document.getElementById('projectImage').src = project.images[0];
  }

  // Afficher l'autre utilisateur
  const otherUser = currentUser.role === 'client' ? conversation.printer : conversation.client;
  document.getElementById('otherUserName').textContent = `${otherUser.firstName} ${otherUser.lastName}`;
  document.getElementById('otherUserRole').textContent = otherUser.role === 'printer' ? 'Imprimeur' : 'Client';

  if (otherUser.profileImage) {
    document.getElementById('otherUserAvatar').src = otherUser.profileImage;
  }
}

// Afficher le devis
function displayQuote() {
  const quoteContainer = document.getElementById('quoteContainer');

  if (!conversation.currentQuote) {
    quoteContainer.innerHTML = '<p style="color: #999; font-size: 14px;">Aucun devis pour le moment</p>';
    return;
  }

  const quote = conversation.currentQuote;

  quoteContainer.innerHTML = `
    <div class="quote-card">
      <div class="quote-price">${quote.totalPrice}€</div>
      <div class="quote-detail"><strong>Prix unitaire:</strong> ${quote.pricePerUnit}€</div>
      <div class="quote-detail"><strong>Quantité:</strong> ${quote.quantity}</div>
      <div class="quote-detail"><strong>Délai:</strong> ${quote.deliveryDays} jours</div>
      <div class="quote-detail"><strong>Matériaux:</strong> ${quote.materials.join(', ')}</div>
      ${quote.shippingCost ? `<div class="quote-detail"><strong>Port:</strong> ${quote.shippingCost}€</div>` : ''}
      <div class="quote-detail" style="font-size: 12px; margin-top: 10px; color: #999;">
        Version ${quote.version} • ${quote.sentBy === 'client' ? 'Client' : 'Imprimeur'}
      </div>
    </div>
  `;
}

// Afficher les actions disponibles
function displayActions() {
  const actionsContainer = document.getElementById('actionsContainer');
  actionsContainer.innerHTML = '';

  const status = conversation.status;
  const role = currentUser.role;

  // Imprimeur peut envoyer un devis
  if (role === 'printer' && ['pending', 'active', 'negotiating'].includes(status)) {
    const btn = document.createElement('button');
    btn.className = 'action-btn btn-accept';
    btn.textContent = '📋 Envoyer un devis';
    btn.onclick = () => document.getElementById('quoteModal').classList.add('active');
    actionsContainer.appendChild(btn);
  }

  // Client peut accepter le devis
  if (role === 'client' && status === 'quote_sent') {
    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'action-btn btn-accept';
    acceptBtn.textContent = '✅ Accepter le devis';
    acceptBtn.onclick = acceptQuote;
    actionsContainer.appendChild(acceptBtn);

    const counterBtn = document.createElement('button');
    counterBtn.className = 'action-btn btn-counter';
    counterBtn.textContent = '💬 Contre-proposer';
    counterBtn.onclick = () => document.getElementById('quoteModal').classList.add('active');
    actionsContainer.appendChild(counterBtn);
  }

  // Les deux peuvent contre-proposer
  if (status === 'negotiating' && conversation.currentQuote.counterOfferCount < 3) {
    const counterBtn = document.createElement('button');
    counterBtn.className = 'action-btn btn-counter';
    counterBtn.textContent = `💬 Contre-proposer (${3 - conversation.currentQuote.counterOfferCount} restantes)`;
    counterBtn.onclick = () => document.getElementById('quoteModal').classList.add('active');
    actionsContainer.appendChild(counterBtn);
  }

  // Signer le contrat
  if (status === 'quote_accepted') {
    const signBtn = document.createElement('button');
    signBtn.className = 'action-btn btn-sign';
    const alreadySigned = role === 'client' ? conversation.clientSignedAt : conversation.printerSignedAt;
    signBtn.textContent = alreadySigned ? '✅ Déjà signé' : '✍️ Signer le contrat';
    signBtn.disabled = alreadySigned;
    signBtn.onclick = signContract;
    actionsContainer.appendChild(signBtn);
  }

  // Annuler
  if (!conversation.signedAt && !['completed', 'cancelled_by_client', 'cancelled_by_printer', 'cancelled_mutual'].includes(status)) {
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'action-btn btn-cancel';
    cancelBtn.textContent = '❌ Annuler';
    cancelBtn.onclick = () => document.getElementById('cancelModal').classList.add('active');
    actionsContainer.appendChild(cancelBtn);
  }

  // Favoris
  const isFavorite = role === 'client' ? conversation.isFavoriteForClient : conversation.isFavoriteForPrinter;
  const favBtn = document.createElement('button');
  favBtn.className = 'action-btn';
  favBtn.style.background = isFavorite ? '#fdcb6e' : '#dfe6e9';
  favBtn.textContent = isFavorite ? '⭐ Retirer des favoris' : '☆ Ajouter aux favoris';
  favBtn.onclick = toggleFavorite;
  actionsContainer.appendChild(favBtn);
}

// Charger les messages
async function loadMessages() {
  const token = localStorage.getItem('token');
  const response = await fetch(`/api/conversations/${conversationId}/messages`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    console.error('Erreur lors du chargement des messages');
    return;
  }

  const data = await response.json();
  displayMessages(data.messages);

  // Sauvegarder l'ID du dernier message pour le polling
  if (data.messages.length > 0) {
    lastMessageId = data.messages[data.messages.length - 1]._id;
  }
}

// Polling pour nouveaux messages
async function pollMessages() {
  if (!lastMessageId) return;

  const token = localStorage.getItem('token');
  const response = await fetch(`/api/conversations/${conversationId}/messages?since=${lastMessageId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (response.ok) {
    const data = await response.json();
    if (data.messages.length > 0) {
      appendMessages(data.messages);
      lastMessageId = data.messages[data.messages.length - 1]._id;
    }
  }
}

// Afficher les messages
function displayMessages(messages) {
  const messagesList = document.getElementById('messagesList');
  messagesList.innerHTML = '';

  messages.forEach(msg => {
    const msgEl = createMessageElement(msg);
    messagesList.appendChild(msgEl);
  });

  scrollToBottom();
}

// Ajouter de nouveaux messages
function appendMessages(messages) {
  const messagesList = document.getElementById('messagesList');

  messages.forEach(msg => {
    const msgEl = createMessageElement(msg);
    messagesList.appendChild(msgEl);
  });

  scrollToBottom();
}

// Créer un élément message
function createMessageElement(msg) {
  const div = document.createElement('div');

  if (msg.messageType === 'system') {
    div.className = 'message message-system';
    div.textContent = msg.content;
  } else if (msg.messageType === 'quote' || msg.messageType === 'quote_counter') {
    div.className = 'message message-quote';
    div.innerHTML = `
      <div><strong>${msg.messageType === 'quote' ? '📋 Devis' : '💬 Contre-proposition'}</strong></div>
      <div>${msg.content}</div>
      <div class="message-timestamp">${formatDate(msg.createdAt)}</div>
    `;
  } else if (msg.messageType === 'file') {
    const isSent = msg.sender._id === currentUser._id;
    div.className = `message ${isSent ? 'message-sent' : 'message-received'}`;
    div.innerHTML = `
      <div class="message-file">
        <span>📎</span>
        <a href="${msg.fileUrl}" target="_blank" style="color: inherit; text-decoration: underline;">
          ${msg.fileName || 'Fichier joint'}
        </a>
      </div>
      <div class="message-timestamp">${formatDate(msg.createdAt)}</div>
    `;
  } else {
    const isSent = msg.sender._id === currentUser._id;
    div.className = `message ${isSent ? 'message-sent' : 'message-received'}`;
    div.innerHTML = `
      <div>${msg.contentFiltered}</div>
      <div class="message-timestamp">${formatDate(msg.createdAt)}</div>
      ${msg.contentBlocked ? '<div class="message-blocked-warning">⚠️ Certains éléments ont été masqués (coordonnées personnelles)</div>' : ''}
    `;
  }

  return div;
}

// Envoyer un message
async function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();

  if (!content && !uploadedFile) {
    return;
  }

  const token = localStorage.getItem('token');

  // Si fichier joint, l'envoyer d'abord
  if (uploadedFile) {
    await sendFileMessage();
    return;
  }

  // Envoyer le message texte
  const response = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content, messageType: 'text' })
  });

  if (response.ok) {
    input.value = '';
    await loadMessages(); // Recharger immédiatement
  } else {
    alert('Erreur lors de l\'envoi du message');
  }
}

// Envoyer un fichier
async function sendFileMessage() {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('attachment', uploadedFile);
  formData.append('conversationId', conversationId);

  // Upload du fichier
  const uploadResponse = await fetch('/api/uploads/conversation-attachment', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  if (!uploadResponse.ok) {
    alert('Erreur lors de l\'upload du fichier');
    return;
  }

  const uploadData = await uploadResponse.json();

  // Envoyer le message avec le fichier
  const messageResponse = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: uploadData.file.originalname,
      messageType: 'file',
      fileUrl: uploadData.file.url,
      fileName: uploadData.file.originalname
    })
  });

  if (messageResponse.ok) {
    uploadedFile = null;
    document.getElementById('filePreviewContainer').innerHTML = '';
    document.getElementById('messageInput').value = '';
    await loadMessages();
  } else {
    alert('Erreur lors de l\'envoi du message');
  }
}

// Gérer la sélection de fichier
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Vérifier la taille (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    alert('Le fichier est trop volumineux (max 10MB)');
    return;
  }

  uploadedFile = file;

  // Afficher l'aperçu
  const previewContainer = document.getElementById('filePreviewContainer');
  previewContainer.innerHTML = `
    <div class="file-preview">
      <span>📎 ${file.name} (${(file.size / 1024).toFixed(1)} KB)</span>
      <button class="file-preview-remove" onclick="removeFile()">✕</button>
    </div>
  `;
}

// Retirer le fichier
function removeFile() {
  uploadedFile = null;
  document.getElementById('filePreviewContainer').innerHTML = '';
  document.getElementById('fileInput').value = '';
}

// Soumettre un devis
async function submitQuote() {
  const token = localStorage.getItem('token');

  const quoteData = {
    pricePerUnit: parseFloat(document.getElementById('quotePricePerUnit').value),
    quantity: parseInt(document.getElementById('quoteQuantity').value),
    totalPrice: parseFloat(document.getElementById('quoteTotalPrice').value),
    deliveryDays: parseInt(document.getElementById('quoteDeliveryDays').value),
    materials: document.getElementById('quoteMaterials').value.split(',').map(m => m.trim()),
    shippingCost: parseFloat(document.getElementById('quoteShipping').value) || 0
  };

  // Déterminer si c'est un nouveau devis ou une contre-proposition
  const endpoint = conversation.currentQuote ? 'counter-quote' : 'send-quote';

  const response = await fetch(`/api/conversations/${conversationId}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(quoteData)
  });

  if (response.ok) {
    document.getElementById('quoteModal').classList.remove('active');
    await loadConversation();
    await loadMessages();
  } else {
    alert('Erreur lors de l\'envoi du devis');
  }
}

// Accepter le devis
async function acceptQuote() {
  const token = localStorage.getItem('token');

  const response = await fetch(`/api/conversations/${conversationId}/accept-quote`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (response.ok) {
    await loadConversation();
    await loadMessages();
  } else {
    alert('Erreur lors de l\'acceptation du devis');
  }
}

// Signer le contrat
async function signContract() {
  if (!confirm('Êtes-vous sûr de vouloir signer ce contrat ?')) {
    return;
  }

  const token = localStorage.getItem('token');

  const response = await fetch(`/api/conversations/${conversationId}/sign`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (response.ok) {
    alert('Contrat signé avec succès !');
    await loadConversation();
    await loadMessages();
  } else {
    alert('Erreur lors de la signature');
  }
}

// Confirmer l'annulation
async function confirmCancel() {
  const reason = document.getElementById('cancelReason').value.trim();

  if (!reason) {
    alert('Veuillez indiquer une raison');
    return;
  }

  const token = localStorage.getItem('token');

  const response = await fetch(`/api/conversations/${conversationId}/cancel`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reason })
  });

  if (response.ok) {
    alert('Conversation annulée');
    document.getElementById('cancelModal').classList.remove('active');
    await loadConversation();
    await loadMessages();
  } else {
    alert('Erreur lors de l\'annulation');
  }
}

// Mettre en pause
async function pauseConversation() {
  if (!confirm('Mettre en pause pour 30 jours maximum ?')) {
    return;
  }

  const token = localStorage.getItem('token');

  const response = await fetch(`/api/conversations/${conversationId}/pause`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (response.ok) {
    alert('Conversation mise en pause');
    await loadConversation();
  } else {
    alert('Erreur lors de la mise en pause');
  }
}

// Toggle favoris
async function toggleFavorite() {
  const token = localStorage.getItem('token');
  const isFavorite = currentUser.role === 'client' ? conversation.isFavoriteForClient : conversation.isFavoriteForPrinter;

  const response = await fetch(`/api/conversations/${conversationId}/favorite`, {
    method: isFavorite ? 'DELETE' : 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (response.ok) {
    await loadConversation();
  }
}

// Déconnexion
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

// Scroll vers le bas
function scrollToBottom() {
  const messagesList = document.getElementById('messagesList');
  messagesList.scrollTop = messagesList.scrollHeight;
}

// Formater la date
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'À l\'instant';
  if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `Aujourd'hui à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Nettoyer le polling à la fermeture
window.addEventListener('beforeunload', () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
});
