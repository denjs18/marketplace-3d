// project-details-printer.js - Vue détaillée projet côté IMPRIMEUR

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : '/api';

let currentProject = null;
let existingConversation = null;

// Obtenir l'ID du projet depuis l'URL
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('id');

if (!projectId) {
  alert('ID de projet manquant');
  window.location.href = '/available-projects.html';
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
    await checkExistingConversation();

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('projectContent').classList.remove('hidden');
  } catch (error) {
    console.error('Error loading project:', error);
    alert('Erreur lors du chargement du projet');
    window.location.href = '/available-projects.html';
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

  // Info client
  if (project.client) {
    document.getElementById('clientName').textContent =
      `${project.client.firstName} ${project.client.lastName}`;
    document.getElementById('clientAvatar').src =
      project.client.profileImage || '/images/default-avatar.png';

    if (project.client.clientProfile && project.client.clientProfile.completedProjects) {
      document.getElementById('clientProjects').textContent =
        `Projets complétés : ${project.client.clientProfile.completedProjects}`;
    }
  }

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

  // Préremplir la quantité dans le formulaire
  document.getElementById('quantity').value = specs.quantity || 1;

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

  // Date de publication
  if (project.createdAt) {
    const created = new Date(project.createdAt);
    document.getElementById('publishedDate').textContent = created.toLocaleDateString('fr-FR');
  }

  // Nombre de devis (approximation via conversations)
  document.getElementById('quotesCount').textContent = project.quotes ? project.quotes.length : '0';

  // Fichier STL
  if (project.stlFile) {
    document.getElementById('stlDownload').classList.remove('hidden');
    document.getElementById('stlFileName').textContent = project.stlFile.filename || project.stlFile.originalName;
    document.getElementById('stlFileSize').textContent = formatFileSize(project.stlFile.size);
    document.getElementById('downloadBtn').href = project.stlFile.path || project.stlFile.url;
    document.getElementById('downloadBtn').download = project.stlFile.filename || 'model.stl';
  }
}

// Vérifier si une conversation existe déjà
async function checkExistingConversation() {
  try {
    const response = await fetch(`${API_URL}/conversations/my-conversations`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) return;

    const data = await response.json();
    existingConversation = data.conversations.find(c =>
      c.project._id === projectId || c.project === projectId
    );

    if (existingConversation) {
      // Masquer le formulaire de devis
      document.getElementById('quoteFormCard').classList.add('hidden');

      // Afficher l'alerte et le statut
      document.getElementById('existingConversationAlert').classList.remove('hidden');
      document.getElementById('conversationStatusCard').classList.remove('hidden');

      const convLink = `/conversation.html?id=${existingConversation._id}`;
      document.getElementById('viewConversationLink').href = convLink;
      document.getElementById('goToConversationBtn').href = convLink;

      // Afficher le statut
      const statusText = getConversationStatusText(existingConversation.status);
      document.getElementById('conversationStatusText').textContent = statusText;
    }
  } catch (error) {
    console.error('Error checking conversation:', error);
  }
}

// Calculer le prix total automatiquement
document.getElementById('pricePerUnit')?.addEventListener('input', calculateTotal);
document.getElementById('quantity')?.addEventListener('input', calculateTotal);
document.getElementById('shippingCost')?.addEventListener('input', calculateTotal);

function calculateTotal() {
  const pricePerUnit = parseFloat(document.getElementById('pricePerUnit').value) || 0;
  const quantity = parseInt(document.getElementById('quantity').value) || 0;
  const shippingCost = parseFloat(document.getElementById('shippingCost').value) || 0;

  const total = (pricePerUnit * quantity) + shippingCost;
  document.getElementById('totalPrice').value = total.toFixed(2);
}

// Soumettre le devis
document.getElementById('quoteForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const quoteData = {
    pricePerUnit: parseFloat(document.getElementById('pricePerUnit').value),
    quantity: parseInt(document.getElementById('quantity').value),
    totalPrice: parseFloat(document.getElementById('totalPrice').value),
    deliveryDays: parseInt(document.getElementById('deliveryDays').value),
    shippingCost: parseFloat(document.getElementById('shippingCost').value) || 0,
    materials: document.getElementById('materials').value.split(',').map(m => m.trim()).filter(m => m),
    options: document.getElementById('options').value
  };

  try {
    // 1. Créer ou récupérer la conversation
    let conversationId;

    if (existingConversation) {
      conversationId = existingConversation._id;
    } else {
      const startResponse = await fetch(`${API_URL}/conversations/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId: projectId,
          printerId: JSON.parse(localStorage.getItem('user'))._id,
          initiatedBy: 'printer'
        })
      });

      if (!startResponse.ok) throw new Error('Erreur lors de la création de la conversation');

      const startData = await startResponse.json();
      conversationId = startData.conversation._id;
    }

    // 2. Envoyer le devis
    const quoteResponse = await fetch(`${API_URL}/conversations/${conversationId}/send-quote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(quoteData)
    });

    if (!quoteResponse.ok) throw new Error('Erreur lors de l\'envoi du devis');

    alert('Devis envoyé avec succès ! Vous pouvez maintenant discuter avec le client.');
    window.location.href = `/conversation.html?id=${conversationId}`;
  } catch (error) {
    console.error('Error submitting quote:', error);
    alert('Erreur lors de l\'envoi du devis : ' + error.message);
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
    'cancelled': 'Annulé'
  };
  return statusMap[status] || status;
}

function getConversationStatusText(status) {
  const statusMap = {
    'pending': '⏳ En attente de votre devis',
    'active': '💬 Discussion active',
    'quote_sent': '✅ Devis envoyé - En attente de réponse du client',
    'negotiating': '🔄 Négociation en cours',
    'quote_accepted': '🎉 Devis accepté ! En attente de signature',
    'signed': '📝 Contrat signé - Vous pouvez commencer la production',
    'in_production': '🔧 Production en cours',
    'ready': '✅ Prêt pour livraison',
    'completed': '✓ Projet terminé'
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
