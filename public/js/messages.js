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

// Appliquer les filtres
function applyFilters() {
  const statusFilter = document.getElementById('statusFilter').value;
  const sortFilter = document.getElementById('sortFilter').value;

  // Filtrer
  filteredConversations = allConversations.filter(conv => {
    const matchesStatus = !statusFilter || conv.status === statusFilter;
    return matchesStatus;
  });

  // Trier
  filteredConversations.sort((a, b) => {
    const isDescending = sortFilter.startsWith('-');
    const field = isDescending ? sortFilter.substring(1) : sortFilter;

    let aValue = a[field];
    let bValue = b[field];

    if (field === 'lastMessageAt' || field === 'createdAt') {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    }

    if (aValue < bValue) return isDescending ? 1 : -1;
    if (aValue > bValue) return isDescending ? -1 : 1;
    return 0;
  });

  currentPage = 1;
  renderConversations();
}

// Afficher les conversations
function renderConversations() {
  const list = document.getElementById('conversationsList');
  const emptyState = document.getElementById('emptyState');
  const pagination = document.getElementById('pagination');

  if (filteredConversations.length === 0) {
    list.style.display = 'none';
    pagination.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  list.style.display = 'block';

  // Calculer la pagination
  const totalPages = Math.ceil(filteredConversations.length / conversationsPerPage);
  const startIndex = (currentPage - 1) * conversationsPerPage;
  const endIndex = startIndex + conversationsPerPage;
  const conversationsToShow = filteredConversations.slice(startIndex, endIndex);

  // Render les conversations
  list.innerHTML = conversationsToShow.map(conv => renderConversationItem(conv)).join('');

  // Render la pagination
  if (totalPages > 1) {
    pagination.style.display = 'flex';
    pagination.innerHTML = renderPagination(totalPages);
  } else {
    pagination.style.display = 'none';
  }
}

// Render un item de conversation
function renderConversationItem(conv) {
  const otherUser = currentUser.role === 'client' ? conv.printer : conv.client;
  const project = conv.project;

  const avatarUrl = otherUser.profileImage || '/images/avatar-default.png';
  const userName = `${otherUser.firstName} ${otherUser.lastName}`;
  const companyName = otherUser.companyName ? `<br><span style="font-size: 12px; color: #999;">${otherUser.companyName}</span>` : '';

  const statusLabels = {
    'pending': 'En attente',
    'active': 'Active',
    'quote_sent': 'Devis envoyé',
    'negotiating': 'Négociation',
    'quote_accepted': 'Devis accepté',
    'signed': 'Signé',
    'in_production': 'En production',
    'ready': 'Prêt',
    'completed': 'Terminé',
    'cancelled_by_client': 'Annulé',
    'cancelled_by_printer': 'Annulé',
    'cancelled_mutual': 'Annulé',
    'cancelled_mediation': 'Annulé',
    'paused': 'En pause'
  };

  const unreadCount = currentUser.role === 'client' ? conv.unreadCountClient : conv.unreadCountPrinter;

  // Déterminer le dernier message (à améliorer avec vraies données)
  const lastMessageText = conv.lastMessageAt
    ? `Dernière activité: ${formatDate(conv.lastMessageAt)}`
    : 'Aucun message';

  return `
    <div class="conversation-item" onclick="openConversation('${conv._id}')">
      <img src="${avatarUrl}" alt="${userName}" class="conversation-avatar">
      <div class="conversation-content">
        <div class="conversation-header">
          <div>
            <div class="conversation-name">${userName}${companyName}</div>
            <div class="conversation-project">📦 ${project.title}</div>
          </div>
          <div class="conversation-time">${formatDate(conv.lastMessageAt || conv.createdAt)}</div>
        </div>
        <div class="conversation-last-message">${lastMessageText}</div>
        <div class="conversation-meta">
          <span class="status-badge badge-${conv.status}">${statusLabels[conv.status] || conv.status}</span>
          ${conv.currentQuote ? `<span class="status-badge badge-quote_sent">💰 ${formatPrice(conv.currentQuote.totalPrice)}</span>` : ''}
          ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount} nouveau${unreadCount > 1 ? 'x' : ''}</span>` : ''}
          ${conv.isFavoriteForClient && currentUser.role === 'client' ? '<span style="font-size: 18px;">⭐</span>' : ''}
        </div>
      </div>
    </div>
  `;
}

// Render la pagination
function renderPagination(totalPages) {
  let html = '';

  html += `<button class="page-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
    ← Précédent
  </button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">
        ${i}
      </button>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<span class="page-btn" disabled>...</span>`;
    }
  }

  html += `<button class="page-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
    Suivant →
  </button>`;

  return html;
}

// Changer de page
function changePage(page) {
  const totalPages = Math.ceil(filteredConversations.length / conversationsPerPage);
  if (page < 1 || page > totalPages) return;

  currentPage = page;
  renderConversations();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Réinitialiser les filtres
function resetFilters() {
  document.getElementById('statusFilter').value = '';
  document.getElementById('sortFilter').value = '-lastMessageAt';
  applyFilters();
}

// Ouvrir une conversation
function openConversation(conversationId) {
  window.location.href = `/conversation.html?id=${conversationId}`;
}
