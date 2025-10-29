/**
 * Dashboard Client - Logique complète
 */

let currentUser = null;

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  // Vérifier l'authentification et charger l'utilisateur
  currentUser = await requireAuth('client');
  if (!currentUser) {
    return; // requireAuth va rediriger
  }

  // Créer la navbar personnalisée
  createAuthNavbar(currentUser);

  // Charger le dashboard
  await loadDashboard();

  // Event listeners
  setupEventListeners();
});

// Configuration des event listeners
function setupEventListeners() {
  // Sidebar navigation
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      handleSidebarClick(link);
    });
  });

  // Boutons d'action rapide
  const newProjectBtn = document.getElementById('newProjectBtn');
  if (newProjectBtn) {
    newProjectBtn.addEventListener('click', () => {
      window.location.href = '/create-project.html';
    });
  }

  const messagesBtn = document.getElementById('messagesBtn');
  if (messagesBtn) {
    messagesBtn.addEventListener('click', showMessagesModal);
  }
}

// Gérer les clics sur la sidebar
function handleSidebarClick(link) {
  // Retirer la classe active de tous les liens
  document.querySelectorAll('.sidebar-nav a').forEach(l => l.classList.remove('active'));
  // Ajouter la classe active au lien cliqué
  link.classList.add('active');

  const text = link.textContent.trim();

  if (text.includes('Tableau de bord')) {
    window.location.reload();
  } else if (text.includes('Mes projets')) {
    showAllProjectsModal();
  } else if (text.includes('Messages')) {
    showMessagesModal();
  } else if (text.includes('Mon profil')) {
    window.location.href = '/profile.html';
  }
}

// Charger tout le dashboard
async function loadDashboard() {
  try {
    await Promise.all([
      loadStatistics(),
      loadRecentProjects(),
      loadRecentQuotes()
    ]);
  } catch (error) {
    console.error('Erreur lors du chargement du dashboard:', error);
    showToast('Erreur lors du chargement du dashboard', 'error');
  }
}

// Charger les statistiques
async function loadStatistics() {
  const token = getToken();

  try {
    // Charger les projets pour les stats
    const projectsResponse = await fetch('/api/projects', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    let activeCount = 0, conversationsCount = 0, pendingQuotesCount = 0, totalBudget = 0;

    if (projectsResponse.ok) {
      const projectsData = await projectsResponse.json();
      const projects = projectsData.projects || [];

      // Compter les projets actifs (en négociation, en production)
      activeCount = projects.filter(p =>
        ['published', 'in_negotiation', 'quote_received', 'quote_accepted', 'contracted', 'in_production'].includes(p.projectStatus)
      ).length;

      // Calculer le budget total
      totalBudget = projects.reduce((sum, p) => sum + (p.estimatedBudget || 0), 0);
    }

    // Charger les conversations pour compter les messages non lus
    const conversationsResponse = await fetch('/api/conversations/my-conversations', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (conversationsResponse.ok) {
      const conversationsData = await conversationsResponse.json();
      const conversations = conversationsData.conversations || [];

      // Compter les conversations actives
      conversationsCount = conversations.filter(c =>
        ['active', 'negotiating', 'quote_sent', 'quote_accepted', 'signed'].includes(c.status)
      ).length;

      // Compter les devis en attente
      pendingQuotesCount = conversations.filter(c =>
        c.status === 'quote_sent' && c.currentQuote
      ).length;
    }

    // Afficher les statistiques
    document.getElementById('stat-active-count').textContent = activeCount;
    document.getElementById('stat-conversations-count').textContent = conversationsCount;
    document.getElementById('stat-pending-quotes-count').textContent = pendingQuotesCount;
    document.getElementById('stat-budget-total').textContent = formatPrice(totalBudget);

    // Masquer le loader, afficher les stats
    document.getElementById('loading-stats').classList.add('hidden');
    document.getElementById('stats-grid').classList.remove('hidden');

  } catch (error) {
    console.error('Erreur lors du chargement des statistiques:', error);
    document.getElementById('loading-stats').innerHTML = '<p class="text-danger">Erreur de chargement</p>';
  }
}

// Charger les projets récents
async function loadRecentProjects() {
  const token = getToken();

  try {
    const response = await fetch('/api/projects?limit=5&sort=-createdAt', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Erreur lors du chargement des projets');
    }

    const data = await response.json();
    const projects = data.projects || [];

    document.getElementById('loading-projects').classList.add('hidden');

    if (projects.length === 0) {
      document.getElementById('no-projects').classList.remove('hidden');
    } else {
      const grid = document.getElementById('projects-grid');
      grid.innerHTML = projects.map(project => renderProjectCard(project)).join('');
      grid.classList.remove('hidden');
    }

  } catch (error) {
    console.error('Erreur lors du chargement des projets:', error);
    document.getElementById('loading-projects').innerHTML = '<p class="text-danger">Erreur de chargement</p>';
  }
}

// Render une carte projet
function renderProjectCard(project) {
  const statusBadges = {
    'draft': 'badge-secondary',
    'published': 'badge-info',
    'in_negotiation': 'badge-warning',
    'quote_received': 'badge-primary',
    'quote_accepted': 'badge-success',
    'contracted': 'badge-success',
    'in_production': 'badge-warning',
    'completed': 'badge-success',
    'cancelled': 'badge-danger',
    'paused': 'badge-secondary'
  };

  const statusLabels = {
    'draft': 'Brouillon',
    'published': 'Publié',
    'in_negotiation': 'En négociation',
    'quote_received': 'Devis reçu',
    'quote_accepted': 'Devis accepté',
    'contracted': 'Contrat signé',
    'in_production': 'En production',
    'completed': 'Terminé',
    'cancelled': 'Annulé',
    'paused': 'En pause'
  };

  const imageUrl = project.images && project.images.length > 0
    ? project.images[0]
    : '/images/placeholder-project.png';

  const invitedCount = project.invitedPrinters ? project.invitedPrinters.length : 0;
  const maxInvited = project.maxPrintersInvited || 5;

  return `
    <div class="card">
      <img src="${imageUrl}" alt="${project.title}" class="project-card-image">
      <div class="card-header">
        <h3 class="card-title">${project.title}</h3>
        <span class="badge ${statusBadges[project.projectStatus] || 'badge-info'}">
          ${statusLabels[project.projectStatus] || project.projectStatus}
        </span>
      </div>
      <div class="card-body">
        <p class="text-secondary mb-2">${project.description.substring(0, 80)}${project.description.length > 80 ? '...' : ''}</p>
        <div class="project-info-grid">
          <div class="info-item">
            <span class="info-label">Matériau</span>
            <span class="info-value">${project.specifications?.material || project.material || 'Non spécifié'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Quantité</span>
            <span class="info-value">${project.specifications?.quantity || project.quantity || '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Imprimeurs</span>
            <span class="info-value">${invitedCount}/${maxInvited}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Budget</span>
            <span class="info-value">${formatPrice(project.budget?.max || project.estimatedBudget || 0)}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn btn-primary btn-sm" onclick="viewProjectDetails('${project._id}')">
            Voir détails
          </button>
          ${project.projectStatus === 'draft' ? `
            <button class="btn btn-secondary btn-sm" onclick="editProject('${project._id}')">
              Modifier
            </button>
            <button class="btn btn-success btn-sm" onclick="publishProject('${project._id}')">
              Publier
            </button>
          ` : ''}
          ${project.projectStatus === 'published' && invitedCount < maxInvited ? `
            <button class="btn btn-info btn-sm" onclick="invitePrinters('${project._id}')">
              Inviter imprimeurs
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

// Charger les devis récents
async function loadRecentQuotes() {
  const token = getToken();

  try {
    const response = await fetch('/api/conversations/my-conversations?status=quote_sent,negotiating', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Erreur lors du chargement des devis');
    }

    const data = await response.json();
    const conversations = data.conversations || [];

    // Filtrer celles qui ont un devis
    const conversationsWithQuotes = conversations.filter(c => c.currentQuote).slice(0, 5);

    document.getElementById('loading-quotes').classList.add('hidden');

    if (conversationsWithQuotes.length === 0) {
      document.getElementById('no-quotes').classList.remove('hidden');
    } else {
      const tbody = document.getElementById('quotes-body');
      tbody.innerHTML = conversationsWithQuotes.map(conv => renderQuoteRow(conv)).join('');
      document.getElementById('quotes-table').classList.remove('hidden');
    }

  } catch (error) {
    console.error('Erreur lors du chargement des devis:', error);
    document.getElementById('loading-quotes').innerHTML = '<p class="text-danger">Erreur de chargement</p>';
  }
}

// Render une ligne de devis
function renderQuoteRow(conversation) {
  const quote = conversation.currentQuote;
  const printer = conversation.printer;
  const project = conversation.project;

  const printerAvatar = printer.profileImage || '/images/avatar-default.png';
  const printerName = `${printer.firstName} ${printer.lastName}`;
  const rating = printer.rating?.average || 0;
  const ratingCount = printer.rating?.count || 0;

  return `
    <tr>
      <td>
        <div class="printer-info">
          <img src="${printerAvatar}" alt="${printerName}" class="printer-avatar-small">
          <div>
            <div class="printer-name">${printerName}</div>
            <div class="printer-rating">⭐ ${rating.toFixed(1)} (${ratingCount} avis)</div>
          </div>
        </div>
      </td>
      <td>${project.title}</td>
      <td class="quote-price">${formatPrice(quote.totalPrice)}</td>
      <td>${quote.deliveryDays} jour${quote.deliveryDays > 1 ? 's' : ''}</td>
      <td>${quote.materials.join(', ')}</td>
      <td class="quote-status">
        <span class="badge ${conversation.status === 'quote_sent' ? 'badge-warning' : 'badge-info'}">
          ${conversation.status === 'quote_sent' ? 'En attente' : 'Négociation'}
        </span>
      </td>
      <td class="quote-actions">
        <button class="btn btn-primary btn-sm" onclick="viewConversation('${conversation._id}')">
          Voir
        </button>
        ${conversation.status === 'quote_sent' ? `
          <button class="btn btn-success btn-sm" onclick="acceptQuote('${conversation._id}')">
            Accepter
          </button>
          <button class="btn btn-secondary btn-sm" onclick="negotiateQuote('${conversation._id}')">
            Négocier
          </button>
          <button class="btn btn-danger btn-sm" onclick="refuseQuote('${conversation._id}')">
            Refuser
          </button>
        ` : ''}
      </td>
    </tr>
  `;
}

// Actions sur les projets
function viewProjectDetails(projectId) {
  // Rediriger vers une page de détails du projet
  window.location.href = `/project-details.html?id=${projectId}`;
}

function editProject(projectId) {
  window.location.href = `/create-project.html?id=${projectId}`;
}

async function publishProject(projectId) {
  if (!confirm('Publier ce projet ? Il sera visible par tous les imprimeurs.')) {
    return;
  }

  try {
    const token = getToken();
    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ projectStatus: 'published' })
    });

    if (response.ok) {
      showToast('Projet publié avec succès !', 'success');
      await loadRecentProjects();
    } else {
      showToast('Erreur lors de la publication', 'error');
    }
  } catch (error) {
    console.error('Erreur:', error);
    showToast('Erreur de connexion', 'error');
  }
}

function invitePrinters(projectId) {
  // Ouvrir le modal d'invitation
  showInvitePrintersModal(projectId);
}

// Actions sur les devis
function viewConversation(conversationId) {
  window.location.href = `/conversation.html?id=${conversationId}`;
}

async function acceptQuote(conversationId) {
  if (!confirm('Accepter ce devis ? Vous devrez ensuite signer le contrat.')) {
    return;
  }

  try {
    const token = getToken();
    const response = await fetch(`/api/conversations/${conversationId}/accept-quote`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      showToast('Devis accepté ! Rendez-vous dans la conversation pour signer.', 'success');
      setTimeout(() => {
        window.location.href = `/conversation.html?id=${conversationId}`;
      }, 1500);
    } else {
      showToast('Erreur lors de l\'acceptation', 'error');
    }
  } catch (error) {
    console.error('Erreur:', error);
    showToast('Erreur de connexion', 'error');
  }
}

function negotiateQuote(conversationId) {
  showNegotiateModal(conversationId);
}

async function refuseQuote(conversationId) {
  showRefuseModal(conversationId);
}

// Modals
function showAllProjectsModal() {
  // Pour l'instant, rediriger vers une page dédiée
  window.location.href = '/my-projects.html';
}

function showMessagesModal() {
  window.location.href = '/messages.html';
}

// Modal 1: Inviter des imprimeurs
async function showInvitePrintersModal(projectId) {
  const token = getToken();

  try {
    // Charger le projet
    const projectResponse = await fetch(`/api/projects/${projectId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!projectResponse.ok) {
      throw new Error('Erreur lors du chargement du projet');
    }

    const projectData = await projectResponse.json();
    const project = projectData.project;

    // Charger les imprimeurs
    const printersResponse = await fetch('/api/printers', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!printersResponse.ok) {
      throw new Error('Erreur lors du chargement des imprimeurs');
    }

    const printersData = await printersResponse.json();
    const allPrinters = printersData.printers || [];

    // Filtrer les imprimeurs déjà invités
    const invitedIds = project.invitedPrinters || [];
    const availablePrinters = allPrinters.filter(p => !invitedIds.includes(p._id));

    const maxInvited = project.maxPrintersInvited || 5;
    const remainingSlots = maxInvited - invitedIds.length;

    if (remainingSlots <= 0) {
      showToast('Vous avez déjà invité le nombre maximum d\'imprimeurs', 'warning');
      return;
    }

    // Créer le modal
    const modalHTML = `
      <div id="invitePrintersModal" class="modal-overlay" onclick="closeModal('invitePrintersModal')">
        <div class="modal-content" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h2>📧 Inviter des imprimeurs</h2>
            <button class="modal-close" onclick="closeModal('invitePrintersModal')">✕</button>
          </div>
          <div class="modal-body">
            <p class="modal-subtitle">Projet: <strong>${project.title}</strong></p>
            <p class="modal-subtitle">Places disponibles: <strong>${remainingSlots}</strong></p>

            <div class="search-bar">
              <input type="text" id="printerSearch" placeholder="🔍 Rechercher un imprimeur..." class="search-input">
            </div>

            <div id="printersList" class="printers-list">
              ${availablePrinters.map(printer => `
                <div class="printer-item" data-printer-id="${printer._id}">
                  <input type="checkbox" id="printer-${printer._id}" class="printer-checkbox"
                         ${remainingSlots <= 0 ? 'disabled' : ''}>
                  <label for="printer-${printer._id}" class="printer-label">
                    <img src="${printer.profileImage || '/images/avatar-default.png'}" class="printer-avatar">
                    <div class="printer-info">
                      <div class="printer-name">${printer.firstName} ${printer.lastName}</div>
                      ${printer.companyName ? `<div class="printer-company">${printer.companyName}</div>` : ''}
                      <div class="printer-meta">
                        <span>⭐ ${(printer.rating?.average || 0).toFixed(1)} (${printer.rating?.count || 0})</span>
                        ${printer.badges && printer.badges.length > 0 ? printer.badges.map(b => `<span class="badge-mini">${b}</span>`).join('') : ''}
                      </div>
                    </div>
                  </label>
                </div>
              `).join('')}
            </div>

            ${availablePrinters.length === 0 ? '<p class="text-center text-secondary">Aucun imprimeur disponible</p>' : ''}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal('invitePrintersModal')">Annuler</button>
            <button class="btn btn-primary" onclick="sendInvitations('${projectId}')">
              Envoyer les invitations
            </button>
          </div>
        </div>
      </div>
    `;

    // Injecter le modal dans le DOM
    const existingModal = document.getElementById('invitePrintersModal');
    if (existingModal) {
      existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Event listener pour la recherche
    document.getElementById('printerSearch').addEventListener('input', (e) => {
      filterPrinters(e.target.value);
    });

    // Event listener pour limiter la sélection
    const checkboxes = document.querySelectorAll('.printer-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const checkedCount = document.querySelectorAll('.printer-checkbox:checked').length;
        if (checkedCount >= remainingSlots) {
          checkboxes.forEach(cb => {
            if (!cb.checked) cb.disabled = true;
          });
        } else {
          checkboxes.forEach(cb => cb.disabled = false);
        }
      });
    });

  } catch (error) {
    console.error('Erreur:', error);
    showToast('Erreur lors du chargement des imprimeurs', 'error');
  }
}

// Filtrer les imprimeurs dans le modal
function filterPrinters(searchTerm) {
  const term = searchTerm.toLowerCase();
  const printerItems = document.querySelectorAll('.printer-item');

  printerItems.forEach(item => {
    const name = item.querySelector('.printer-name').textContent.toLowerCase();
    const company = item.querySelector('.printer-company')?.textContent.toLowerCase() || '';

    if (name.includes(term) || company.includes(term)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

// Envoyer les invitations
async function sendInvitations(projectId) {
  const selectedPrinters = Array.from(document.querySelectorAll('.printer-checkbox:checked'))
    .map(checkbox => checkbox.id.replace('printer-', ''));

  if (selectedPrinters.length === 0) {
    showToast('Veuillez sélectionner au moins un imprimeur', 'warning');
    return;
  }

  const token = getToken();

  try {
    const response = await fetch(`/api/projects/${projectId}/invite-printers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ printerIds: selectedPrinters })
    });

    if (!response.ok) {
      throw new Error('Erreur lors de l\'envoi des invitations');
    }

    showToast(`${selectedPrinters.length} imprimeur${selectedPrinters.length > 1 ? 's' : ''} invité${selectedPrinters.length > 1 ? 's' : ''} avec succès !`, 'success');
    closeModal('invitePrintersModal');
    await loadRecentProjects();

  } catch (error) {
    console.error('Erreur:', error);
    showToast('Erreur lors de l\'envoi des invitations', 'error');
  }
}

// Modal 2: Négocier un devis
async function showNegotiateModal(conversationId) {
  const token = getToken();

  try {
    // Charger la conversation
    const response = await fetch(`/api/conversations/${conversationId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Erreur lors du chargement de la conversation');
    }

    const data = await response.json();
    const conversation = data.conversation;
    const currentQuote = conversation.currentQuote;

    if (!currentQuote) {
      showToast('Aucun devis disponible', 'error');
      return;
    }

    // Compter les contre-offres
    const counterOffers = conversation.quoteHistory?.filter(q => q.type === 'counter_offer') || [];
    const remainingOffers = 3 - counterOffers.length;

    if (remainingOffers <= 0) {
      showToast('Vous avez atteint le nombre maximum de contre-propositions (3)', 'warning');
      return;
    }

    // Créer le modal
    const modalHTML = `
      <div id="negotiateModal" class="modal-overlay" onclick="closeModal('negotiateModal')">
        <div class="modal-content" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h2>💬 Négocier le devis</h2>
            <button class="modal-close" onclick="closeModal('negotiateModal')">✕</button>
          </div>
          <div class="modal-body">
            <div class="quote-summary">
              <h3>Devis actuel</h3>
              <div class="quote-details">
                <div class="quote-detail-item">
                  <span class="label">Prix total:</span>
                  <span class="value">${formatPrice(currentQuote.totalPrice)}</span>
                </div>
                <div class="quote-detail-item">
                  <span class="label">Délai de livraison:</span>
                  <span class="value">${currentQuote.deliveryDays} jour${currentQuote.deliveryDays > 1 ? 's' : ''}</span>
                </div>
                <div class="quote-detail-item">
                  <span class="label">Matériaux:</span>
                  <span class="value">${currentQuote.materials.join(', ')}</span>
                </div>
              </div>
            </div>

            <div class="negotiation-info">
              <p>⚠️ Contre-propositions restantes: <strong>${remainingOffers}/3</strong></p>
            </div>

            <form id="negotiateForm">
              <div class="form-group">
                <label class="form-label">Prix proposé (€) *</label>
                <input type="number" id="counterPrice" class="form-input"
                       value="${currentQuote.totalPrice}"
                       min="1" step="0.01" required>
                <small class="form-help">Prix actuel: ${formatPrice(currentQuote.totalPrice)}</small>
              </div>

              <div class="form-group">
                <label class="form-label">Délai de livraison souhaité (jours) *</label>
                <input type="number" id="counterDelivery" class="form-input"
                       value="${currentQuote.deliveryDays}"
                       min="1" required>
                <small class="form-help">Délai actuel: ${currentQuote.deliveryDays} jour${currentQuote.deliveryDays > 1 ? 's' : ''}</small>
              </div>

              <div class="form-group">
                <label class="form-label">Message à l'imprimeur</label>
                <textarea id="counterMessage" class="form-textarea"
                          placeholder="Expliquez votre contre-proposition..." rows="4"></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal('negotiateModal')">Annuler</button>
            <button class="btn btn-primary" onclick="submitNegotiation('${conversationId}')">
              Envoyer la contre-proposition
            </button>
          </div>
        </div>
      </div>
    `;

    // Injecter le modal dans le DOM
    const existingModal = document.getElementById('negotiateModal');
    if (existingModal) {
      existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHTML);

  } catch (error) {
    console.error('Erreur:', error);
    showToast('Erreur lors du chargement du devis', 'error');
  }
}

// Envoyer la négociation
async function submitNegotiation(conversationId) {
  const counterPrice = parseFloat(document.getElementById('counterPrice').value);
  const counterDelivery = parseInt(document.getElementById('counterDelivery').value);
  const counterMessage = document.getElementById('counterMessage').value;

  if (!counterPrice || counterPrice <= 0) {
    showToast('Veuillez entrer un prix valide', 'error');
    return;
  }

  if (!counterDelivery || counterDelivery <= 0) {
    showToast('Veuillez entrer un délai valide', 'error');
    return;
  }

  const token = getToken();

  try {
    const response = await fetch(`/api/conversations/${conversationId}/counter-offer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        price: counterPrice,
        deliveryDays: counterDelivery,
        message: counterMessage || 'Nouvelle proposition'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erreur lors de l\'envoi de la contre-proposition');
    }

    showToast('Contre-proposition envoyée avec succès !', 'success');
    closeModal('negotiateModal');
    await loadRecentQuotes();

  } catch (error) {
    console.error('Erreur:', error);
    showToast(error.message || 'Erreur lors de l\'envoi', 'error');
  }
}

// Modal 3: Refuser un devis
async function showRefuseModal(conversationId) {
  const token = getToken();

  try {
    // Charger la conversation
    const response = await fetch(`/api/conversations/${conversationId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Erreur lors du chargement de la conversation');
    }

    const data = await response.json();
    const conversation = data.conversation;
    const currentQuote = conversation.currentQuote;

    if (!currentQuote) {
      showToast('Aucun devis disponible', 'error');
      return;
    }

    // Créer le modal
    const modalHTML = `
      <div id="refuseModal" class="modal-overlay" onclick="closeModal('refuseModal')">
        <div class="modal-content" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h2>❌ Refuser le devis</h2>
            <button class="modal-close" onclick="closeModal('refuseModal')">✕</button>
          </div>
          <div class="modal-body">
            <div class="quote-summary">
              <h3>Devis à refuser</h3>
              <div class="quote-details">
                <div class="quote-detail-item">
                  <span class="label">Imprimeur:</span>
                  <span class="value">${conversation.printer.firstName} ${conversation.printer.lastName}</span>
                </div>
                <div class="quote-detail-item">
                  <span class="label">Prix total:</span>
                  <span class="value">${formatPrice(currentQuote.totalPrice)}</span>
                </div>
                <div class="quote-detail-item">
                  <span class="label">Délai:</span>
                  <span class="value">${currentQuote.deliveryDays} jour${currentQuote.deliveryDays > 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>

            <div class="warning-box">
              <p>⚠️ Cette action est irréversible. L'imprimeur sera notifié du refus.</p>
            </div>

            <form id="refuseForm">
              <div class="form-group">
                <label class="form-label">Raison du refus (optionnel)</label>
                <textarea id="refuseReason" class="form-textarea"
                          placeholder="Expliquez pourquoi vous refusez ce devis..." rows="4"></textarea>
                <small class="form-help">Ce message sera envoyé à l'imprimeur</small>
              </div>

              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" id="confirmRefuse" required>
                  Je confirme vouloir refuser ce devis
                </label>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal('refuseModal')">Annuler</button>
            <button class="btn btn-danger" onclick="submitRefusal('${conversationId}')">
              Refuser définitivement
            </button>
          </div>
        </div>
      </div>
    `;

    // Injecter le modal dans le DOM
    const existingModal = document.getElementById('refuseModal');
    if (existingModal) {
      existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHTML);

  } catch (error) {
    console.error('Erreur:', error);
    showToast('Erreur lors du chargement du devis', 'error');
  }
}

// Envoyer le refus
async function submitRefusal(conversationId) {
  const confirmCheckbox = document.getElementById('confirmRefuse');
  if (!confirmCheckbox.checked) {
    showToast('Veuillez confirmer le refus', 'warning');
    return;
  }

  const reason = document.getElementById('refuseReason').value;

  const token = getToken();

  try {
    const response = await fetch(`/api/conversations/${conversationId}/refuse`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: reason || 'Aucune raison fournie' })
    });

    if (!response.ok) {
      throw new Error('Erreur lors du refus du devis');
    }

    showToast('Devis refusé', 'success');
    closeModal('refuseModal');
    await loadRecentQuotes();

  } catch (error) {
    console.error('Erreur:', error);
    showToast('Erreur lors du refus', 'error');
  }
}

// Fermer un modal
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.remove();
  }
}
