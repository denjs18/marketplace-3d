/**
 * Page Détails du Projet
 */

let currentUser = null;
let currentProject = null;
let projectId = null;

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth('client');
  if (!currentUser) return;

  createAuthNavbar(currentUser);

  // Récupérer l'ID du projet depuis l'URL
  const urlParams = new URLSearchParams(window.location.search);
  projectId = urlParams.get('id');

  if (!projectId) {
    showToast('ID de projet manquant', 'error');
    setTimeout(() => {
      window.location.href = '/my-projects.html';
    }, 2000);
    return;
  }

  await loadProject();

  // Event listeners
  document.getElementById('editBtn').addEventListener('click', editProject);
  document.getElementById('publishBtn').addEventListener('click', publishProject);
  document.getElementById('inviteBtn').addEventListener('click', invitePrinters);
  document.getElementById('invitePrintersBtn').addEventListener('click', invitePrinters);
  document.getElementById('deleteBtn').addEventListener('click', deleteProject);
});

// Charger le projet
async function loadProject() {
  const token = getToken();

  try {
    const response = await fetch(`/api/projects/${projectId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Erreur lors du chargement du projet');
    }

    const data = await response.json();
    currentProject = data.project;

    // Afficher les données
    displayProject(currentProject);

    // Charger les conversations
    await loadConversations();

    document.getElementById('loading').style.display = 'none';
    document.getElementById('projectContent').classList.remove('hidden');

  } catch (error) {
    console.error('Erreur:', error);
    showToast('Erreur lors du chargement du projet', 'error');
    document.getElementById('loading').innerHTML = '<p style="color: #d63031;">Erreur lors du chargement</p>';

    setTimeout(() => {
      window.location.href = '/my-projects.html';
    }, 2000);
  }
}

// Afficher le projet
function displayProject(project) {
  // Titre et date
  document.getElementById('projectTitle').textContent = project.title;
  document.getElementById('projectCreatedAt').textContent =
    `Créé le ${formatDate(project.createdAt)}`;

  // Statut
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

  const statusBadge = document.getElementById('projectStatus');
  statusBadge.className = `status-badge badge-${project.projectStatus}`;
  statusBadge.textContent = statusLabels[project.projectStatus] || project.projectStatus;

  // Boutons d'action selon le statut
  if (project.projectStatus === 'draft') {
    document.getElementById('editBtn').classList.remove('hidden');
    document.getElementById('publishBtn').classList.remove('hidden');
    document.getElementById('deleteBtn').classList.remove('hidden');
  }

  const invitedCount = project.invitedPrinters ? project.invitedPrinters.length : 0;
  const maxInvited = project.maxPrintersInvited || 5;

  if (project.projectStatus === 'published' && invitedCount < maxInvited) {
    document.getElementById('inviteBtn').classList.remove('hidden');
    document.getElementById('invitePrintersBtn').classList.remove('hidden');
  }

  // Images
  if (project.images && project.images.length > 0) {
    const mainImage = document.getElementById('mainImage');
    mainImage.src = project.images[0];
    mainImage.style.display = 'block';

    if (project.images.length > 1) {
      const imagesContainer = document.getElementById('projectImages');
      imagesContainer.innerHTML = project.images.map((img, index) => `
        <img src="${img}" alt="Image ${index + 1}" class="project-image"
             onclick="changeMainImage('${img}')">
      `).join('');
    }
  } else {
    document.getElementById('mainImage').src = '/images/placeholder-project.png';
  }

  // Description
  document.getElementById('projectDescription').textContent = project.description;

  // Fichier STL
  if (project.stlFile) {
    const stlDownload = document.getElementById('stlDownload');
    stlDownload.classList.remove('hidden');

    const fileName = project.stlFile.split('/').pop();
    document.getElementById('stlFileName').textContent = fileName;

    const downloadBtn = document.getElementById('downloadBtn');
    downloadBtn.href = project.stlFile;
    downloadBtn.setAttribute('download', fileName);

    // Note: Pour afficher le STL en 3D, il faudrait utiliser Three.js
    // mais c'est optionnel pour cette version
  }

  // Spécifications
  document.getElementById('specMaterial').textContent = project.material || 'Non spécifié';
  document.getElementById('specColor').textContent = project.color || 'Non spécifié';
  document.getElementById('specQuantity').textContent = project.quantity || 1;
  document.getElementById('specInfill').textContent = project.infill ? `${project.infill}%` : 'Standard';
  document.getElementById('specFinish').textContent = project.finish || 'Standard';
  document.getElementById('specLayerHeight').textContent = project.layerHeight ? `${project.layerHeight}mm` : 'Standard';

  // Budget et délai
  document.getElementById('specBudget').textContent = formatPrice(project.estimatedBudget || 0);
  document.getElementById('specDeadline').textContent = project.deadline
    ? formatDate(project.deadline)
    : 'Non spécifié';

  // Imprimeurs invités
  document.getElementById('specInvited').textContent = `${invitedCount} / ${maxInvited}`;
}

// Charger les conversations
async function loadConversations() {
  const token = getToken();

  try {
    const response = await fetch('/api/conversations/my-conversations', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      console.error('Erreur lors du chargement des conversations');
      return;
    }

    const data = await response.json();
    const allConversations = data.conversations || [];

    // Filtrer les conversations pour ce projet
    const projectConversations = allConversations.filter(conv =>
      conv.project && conv.project._id === projectId
    );

    if (projectConversations.length === 0) {
      document.getElementById('conversationsEmpty').classList.remove('hidden');
      return;
    }

    const conversationsList = document.getElementById('conversationsList');
    conversationsList.innerHTML = projectConversations.map(conv => {
      const otherUser = currentUser.role === 'client' ? conv.printer : conv.client;
      const avatarUrl = otherUser.profileImage || '/images/avatar-default.png';
      const userName = `${otherUser.firstName} ${otherUser.lastName}`;

      const statusLabels = {
        'pending': 'En attente',
        'active': 'Active',
        'quote_sent': 'Devis envoyé',
        'negotiating': 'Négociation',
        'quote_accepted': 'Devis accepté',
        'signed': 'Signé',
        'in_production': 'En production',
        'ready': 'Prêt',
        'completed': 'Terminé'
      };

      const unreadCount = currentUser.role === 'client' ? conv.unreadCountClient : conv.unreadCountPrinter;

      return `
        <div class="conversation-item" onclick="openConversation('${conv._id}')">
          <img src="${avatarUrl}" alt="${userName}" class="conversation-avatar">
          <div class="conversation-content">
            <div class="conversation-name">${userName}</div>
            <div class="conversation-status">
              <span class="status-badge badge-${conv.status}">${statusLabels[conv.status] || conv.status}</span>
              ${conv.currentQuote ? `<span style="margin-left: 8px;">💰 ${formatPrice(conv.currentQuote.totalPrice)}</span>` : ''}
              ${unreadCount > 0 ? `<span class="conversation-badge" style="background: #d63031; color: white; margin-left: 8px;">${unreadCount}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Erreur:', error);
  }
}

// Changer l'image principale
function changeMainImage(imageUrl) {
  document.getElementById('mainImage').src = imageUrl;
}

// Ouvrir une conversation
function openConversation(conversationId) {
  window.location.href = `/conversation.html?id=${conversationId}`;
}

// Modifier le projet
function editProject() {
  window.location.href = `/create-project.html?id=${projectId}`;
}

// Publier le projet
async function publishProject() {
  if (!confirm('Publier ce projet ? Il sera visible par tous les imprimeurs.')) {
    return;
  }

  const token = getToken();

  try {
    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ projectStatus: 'published' })
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la publication');
    }

    showToast('Projet publié avec succès !', 'success');
    await loadProject();

  } catch (error) {
    console.error('Erreur:', error);
    showToast(error.message || 'Erreur lors de la publication', 'error');
  }
}

// Inviter des imprimeurs
function invitePrinters() {
  window.location.href = `/compare-quotes.html?projectId=${projectId}`;
}

// Supprimer le projet
async function deleteProject() {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ? Cette action est irréversible.')) {
    return;
  }

  const token = getToken();

  try {
    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la suppression');
    }

    showToast('Projet supprimé', 'success');

    setTimeout(() => {
      window.location.href = '/my-projects.html';
    }, 1500);

  } catch (error) {
    console.error('Erreur:', error);
    showToast(error.message || 'Erreur lors de la suppression', 'error');
  }
}
