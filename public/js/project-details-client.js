// project-details-client.js - Vue détaillée projet côté CLIENT

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : '/api';

let currentProject = null;
let conversations = [];
let quotes = [];

// Obtenir l'ID du projet depuis l'URL
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('id');

if (!projectId) {
  alert('ID de projet manquant');
  window.location.href = '/my-projects.html';
}

// Charger le projet
async function loadProject() {
  try {
    const response = await fetch(`${API_URL}/projects/${projectId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors du chargement du projet');
    }

    const data = await response.json();
    currentProject = data.project;

    displayProject();
    await loadConversations();

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('projectContent').classList.remove('hidden');
  } catch (error) {
    console.error('Error loading project:', error);
    alert('Erreur lors du chargement du projet');
    window.location.href = '/my-projects.html';
  }
}

// Afficher le projet
function displayProject() {
  const project = currentProject;

  // Titre et statut
  document.getElementById('projectTitle').textContent = project.title;

  const statusBadge = document.getElementById('projectStatus');
  const statusText = getStatusText(project.projectStatus || project.status);
  statusBadge.className = `status-badge badge-${project.projectStatus || project.status}`;
  statusBadge.textContent = statusText;

  // Description
  document.getElementById('projectDescription').textContent = project.description;

  // Spécifications
  const specs = project.specifications || {};
  document.getElementById('specMaterial').textContent = specs.material || '-';
  document.getElementById('specColor').textContent = specs.color || '-';
  document.getElementById('specQuantity').textContent = specs.quantity || '-';
  document.getElementById('specInfill').textContent = specs.infill ? `${specs.infill}%` : '-';
  document.getElementById('specFinish').textContent = specs.postProcessing || '-';
  document.getElementById('specLayerHeight').textContent = specs.layerHeight ? `${specs.layerHeight}mm` : '-';

  // Budget et délai
  if (project.budget && project.budget.max) {
    document.getElementById('specBudget').textContent = `${project.budget.max}€`;
  } else {
    document.getElementById('specBudget').textContent = 'Non spécifié';
  }

  if (project.deadline) {
    const deadline = new Date(project.deadline);
    document.getElementById('specDeadline').textContent = deadline.toLocaleDateString('fr-FR');
  } else {
    document.getElementById('specDeadline').textContent = 'Flexible';
  }

  // Fichier STL
  if (project.stlFile) {
    document.getElementById('stlDownload').classList.remove('hidden');
    document.getElementById('stlFileName').textContent = project.stlFile.filename || project.stlFile.originalName;
    document.getElementById('stlFileSize').textContent = formatFileSize(project.stlFile.size);
    document.getElementById('downloadBtn').href = project.stlFile.path || project.stlFile.url;
    document.getElementById('downloadBtn').download = project.stlFile.filename || 'model.stl';
  }

  // Boutons d'action selon le statut
  if (project.projectStatus === 'draft' || project.status === 'draft') {
    document.getElementById('publishBtn').classList.remove('hidden');
    document.getElementById('editBtn').classList.remove('hidden');
  }

  if (project.projectStatus === 'published' || project.projectStatus === 'quote_received') {
    document.getElementById('inviteBtn').classList.remove('hidden');
    document.getElementById('cancelBtn').classList.remove('hidden');
  }

  // Mettre à jour la progression
  updateProgressTracker(project.projectStatus || project.status);
}

// Mettre à jour le tracker de progression
function updateProgressTracker(status) {
  const steps = ['published', 'quote_received', 'quote_accepted', 'in_production', 'completed'];
  const currentStepIndex = steps.indexOf(status);

  if (currentStepIndex === -1) return;

  // Calculer le pourcentage
  const progress = ((currentStepIndex + 1) / steps.length) * 100;
  document.getElementById('progressFill').style.width = `${progress}%`;

  // Marquer les étapes
  document.querySelectorAll('.progress-step').forEach((stepEl, index) => {
    stepEl.classList.remove('active', 'completed');

    if (index < currentStepIndex) {
      stepEl.classList.add('completed');
    } else if (index === currentStepIndex) {
      stepEl.classList.add('active');
    }
  });
}

// Charger les conversations
async function loadConversations() {
  try {
    const response = await fetch(`${API_URL}/conversations/my-conversations`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) throw new Error('Erreur');

    const data = await response.json();
    conversations = data.conversations.filter(c => c.project._id === projectId);

    displayConversations();
    await loadQuotesFromConversations();
  } catch (error) {
    console.error('Error loading conversations:', error);
  }
}

// Afficher les conversations
function displayConversations() {
  const list = document.getElementById('conversationsList');
  const empty = document.getElementById('conversationsEmpty');

  if (conversations.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = conversations.map(conv => {
    const printer = conv.printer;
    const unread = conv.unreadCountClient || 0;
    const statusText = getConversationStatusText(conv.status);

    return `
      <a href="/conversation.html?id=${conv._id}" class="conversation-item">
        <img src="${printer.profileImage || '/images/default-avatar.png'}"
             alt="${printer.firstName}"
             class="conversation-avatar">
        <div class="conversation-info">
          <div class="conversation-name">
            ${printer.firstName} ${printer.lastName}
            ${printer.companyName ? `(${printer.companyName})` : ''}
          </div>
          <div class="conversation-status">${statusText}</div>
        </div>
        ${unread > 0 ? `<div class="unread-badge">${unread}</div>` : ''}
      </a>
    `;
  }).join('');
}

// Charger les devis depuis les conversations
async function loadQuotesFromConversations() {
  quotes = conversations
    .filter(conv => conv.currentQuote && conv.currentQuote.totalPrice)
    .map(conv => ({
      ...conv.currentQuote,
      conversation: conv,
      printer: conv.printer,
      status: conv.status
    }));

  displayQuotes();
}

// Afficher les devis
function displayQuotes() {
  const list = document.getElementById('quotesList');
  const empty = document.getElementById('quotesEmpty');
  const count = document.getElementById('quotesCount');

  count.textContent = quotes.length;

  if (quotes.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = quotes.map(quote => {
    const printer = quote.printer;
    const conv = quote.conversation;
    const isAccepted = conv.status === 'quote_accepted' || conv.status === 'signed' || conv.status === 'in_production';

    return `
      <div class="quote-card ${isAccepted ? 'selected' : ''}" data-quote-id="${conv._id}">
        <div class="quote-header">
          <div class="printer-info">
            <img src="${printer.profileImage || '/images/default-avatar.png'}"
                 alt="${printer.firstName}"
                 class="printer-avatar">
            <div>
              <div class="printer-name">
                ${printer.firstName} ${printer.lastName}
                ${printer.companyName ? `<br><small>${printer.companyName}</small>` : ''}
              </div>
              <div class="printer-rating">
                ⭐ ${printer.rating ? printer.rating.toFixed(1) : 'N/A'}
                ${printer.printerProfile && printer.printerProfile.completedProjects
                  ? `(${printer.printerProfile.completedProjects} projets)`
                  : ''}
              </div>
            </div>
          </div>
          <div class="quote-price">${quote.totalPrice}€</div>
        </div>

        <div class="quote-details">
          <div class="quote-detail-item">
            <div class="quote-detail-label">Prix unitaire</div>
            <div class="quote-detail-value">${quote.pricePerUnit || '-'}€</div>
          </div>
          <div class="quote-detail-item">
            <div class="quote-detail-label">Quantité</div>
            <div class="quote-detail-value">${quote.quantity || '-'}</div>
          </div>
          <div class="quote-detail-item">
            <div class="quote-detail-label">Délai</div>
            <div class="quote-detail-value">${quote.deliveryDays || '-'} jours</div>
          </div>
        </div>

        ${quote.options ? `
          <div class="quote-message">
            <strong>Options :</strong> ${quote.options}
          </div>
        ` : ''}

        ${isAccepted ? `
          <div class="quote-actions">
            <span class="status-badge badge-quote_accepted">✓ Devis accepté</span>
            <a href="/conversation.html?id=${conv._id}" class="btn btn-primary">💬 Discuter</a>
          </div>
        ` : `
          <div class="quote-actions">
            <button class="btn btn-success" onclick="acceptQuote('${conv._id}')">
              ✓ Accepter ce devis
            </button>
            <a href="/conversation.html?id=${conv._id}" class="btn btn-secondary">
              💬 Discuter
            </a>
            <button class="btn btn-danger" onclick="refuseQuote('${conv._id}')">
              ✗ Refuser
            </button>
          </div>
        `}
      </div>
    `;
  }).join('');
}

// Accepter un devis
async function acceptQuote(conversationId) {
  if (!confirm('Voulez-vous accepter ce devis ? Les autres devis seront automatiquement refusés.')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/conversations/${conversationId}/accept-quote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Erreur');

    alert('Devis accepté ! Vous pouvez maintenant signer le contrat dans la conversation.');
    location.reload();
  } catch (error) {
    console.error('Error accepting quote:', error);
    alert('Erreur lors de l\'acceptation du devis');
  }
}

// Refuser un devis
async function refuseQuote(conversationId) {
  const reason = prompt('Raison du refus (optionnel) :');
  if (reason === null) return;

  try {
    const response = await fetch(`${API_URL}/conversations/${conversationId}/refuse`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: reason || 'Aucune raison spécifiée' })
    });

    if (!response.ok) throw new Error('Erreur');

    alert('Imprimeur refusé');
    location.reload();
  } catch (error) {
    console.error('Error refusing quote:', error);
    alert('Erreur lors du refus');
  }
}

// Publier le projet
document.getElementById('publishBtn')?.addEventListener('click', async () => {
  if (!confirm('Publier le projet pour que les imprimeurs puissent le voir ?')) return;

  try {
    const response = await fetch(`${API_URL}/projects/${projectId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ projectStatus: 'published' })
    });

    if (!response.ok) throw new Error('Erreur');

    alert('Projet publié !');
    location.reload();
  } catch (error) {
    console.error('Error publishing:', error);
    alert('Erreur lors de la publication');
  }
});

// Annuler le projet
document.getElementById('cancelBtn')?.addEventListener('click', async () => {
  const reason = prompt('Raison de l\'annulation :');
  if (!reason) return;

  try {
    const response = await fetch(`${API_URL}/projects/${projectId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    });

    if (!response.ok) throw new Error('Erreur');

    alert('Projet annulé');
    window.location.href = '/my-projects.html';
  } catch (error) {
    console.error('Error cancelling:', error);
    alert('Erreur lors de l\'annulation');
  }
});

// Helpers
function getStatusText(status) {
  const statusMap = {
    'draft': 'Brouillon',
    'published': 'Publié',
    'in_negotiation': 'En négociation',
    'quote_received': 'Devis reçus',
    'quote_accepted': 'Devis accepté',
    'contracted': 'Contrat signé',
    'in_production': 'En production',
    'completed': 'Terminé',
    'cancelled': 'Annulé',
    'paused': 'En pause'
  };
  return statusMap[status] || status;
}

function getConversationStatusText(status) {
  const statusMap = {
    'pending': 'En attente',
    'active': 'Active',
    'quote_sent': 'Devis envoyé',
    'negotiating': 'Négociation',
    'quote_accepted': 'Devis accepté',
    'signed': 'Contrat signé',
    'in_production': 'En production',
    'ready': 'Prêt',
    'completed': 'Terminé'
  };
  return statusMap[status] || status;
}

function formatFileSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Charger au démarrage
loadProject();
