// project-details-printer.js - Vue détaillée projet côté IMPRIMEUR

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : '/api';

let currentProject = null;
let existingConversation = null;
let currentUser = null;

// Obtenir l'ID du projet depuis l'URL
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('id');

if (!projectId) {
  alert('ID de projet manquant');
  window.location.href = '/available-projects.html';
}

// Vérifier l'authentification au démarrage
async function checkAuth() {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    alert('Vous devez être connecté');
    window.location.href = '/login.html';
    return false;
  }

  try {
    currentUser = JSON.parse(userStr);

    if (currentUser.role !== 'printer') {
      alert('Cette page est réservée aux imprimeurs');
      window.location.href = '/';
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error parsing user:', error);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login.html';
    return false;
  }
}

// Charger le projet
async function loadProject() {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  try {
    const response = await fetch(`${API_URL}/projects/${projectId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erreur lors du chargement du projet');
    }

    const data = await response.json();
    currentProject = data.project;

    displayProject();
    await checkExistingConversation();

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('projectContent').classList.remove('hidden');
  } catch (error) {
    console.error('Error loading project:', error);
    alert('Erreur lors du chargement du projet: ' + error.message);
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
  const qtyInput = document.getElementById('quantity');
  if (qtyInput) {
    qtyInput.value = specs.quantity || 1;
    calculateTotal(); // Recalculer au chargement
  }

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

    const stlPath = project.stlFile.path || project.stlFile.url;
    document.getElementById('downloadBtn').href = stlPath;
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

    if (!response.ok) {
      console.log('Pas de conversations existantes ou erreur');
      return;
    }

    const data = await response.json();
    existingConversation = data.conversations.find(c => {
      const convProjectId = c.project && (c.project._id || c.project);
      return convProjectId === projectId;
    });

    if (existingConversation) {
      console.log('Conversation existante trouvée:', existingConversation._id);

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
    } else {
      console.log('Aucune conversation existante - affichage du formulaire');
    }
  } catch (error) {
    console.error('Error checking conversation:', error);
  }
}

// Calculer le prix total automatiquement
function calculateTotal() {
  const pricePerUnit = parseFloat(document.getElementById('pricePerUnit')?.value) || 0;
  const quantity = parseInt(document.getElementById('quantity')?.value) || 0;
  const shippingCost = parseFloat(document.getElementById('shippingCost')?.value) || 0;

  const total = (pricePerUnit * quantity) + shippingCost;
  const totalInput = document.getElementById('totalPrice');
  if (totalInput) {
    totalInput.value = total.toFixed(2);
  }
}

// Attacher les event listeners pour le calcul automatique
function setupCalculationListeners() {
  const priceInput = document.getElementById('pricePerUnit');
  const qtyInput = document.getElementById('quantity');
  const shippingInput = document.getElementById('shippingCost');

  if (priceInput) priceInput.addEventListener('input', calculateTotal);
  if (qtyInput) qtyInput.addEventListener('input', calculateTotal);
  if (shippingInput) shippingInput.addEventListener('input', calculateTotal);
}

// Soumettre le devis
async function submitQuote(e) {
  e.preventDefault();

  console.log('Début soumission du devis...');

  // Vérifier l'authentification
  if (!currentUser) {
    alert('Erreur : utilisateur non connecté');
    window.location.href = '/login.html';
    return;
  }

  // Récupérer les données du formulaire
  const pricePerUnit = parseFloat(document.getElementById('pricePerUnit').value);
  const quantity = parseInt(document.getElementById('quantity').value);
  const totalPrice = parseFloat(document.getElementById('totalPrice').value);
  const deliveryDays = parseInt(document.getElementById('deliveryDays').value);
  const shippingCost = parseFloat(document.getElementById('shippingCost').value) || 0;
  const materialsRaw = document.getElementById('materials').value;
  const options = document.getElementById('options').value;

  // Validation
  if (!pricePerUnit || pricePerUnit <= 0) {
    alert('Veuillez entrer un prix unitaire valide');
    return;
  }

  if (!quantity || quantity <= 0) {
    alert('Veuillez entrer une quantité valide');
    return;
  }

  if (!deliveryDays || deliveryDays <= 0) {
    alert('Veuillez entrer un délai de livraison valide');
    return;
  }

  if (!options || options.trim().length < 10) {
    alert('Veuillez décrire les options et détails (minimum 10 caractères)');
    return;
  }

  const quoteData = {
    pricePerUnit: pricePerUnit,
    quantity: quantity,
    totalPrice: totalPrice,
    deliveryDays: deliveryDays,
    shippingCost: shippingCost,
    materials: materialsRaw.split(',').map(m => m.trim()).filter(m => m.length > 0),
    options: options
  };

  console.log('Données du devis:', quoteData);

  // Désactiver le bouton pendant l'envoi
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '⏳ Envoi en cours...';

  try {
    // 1. Créer ou récupérer la conversation
    let conversationId;

    if (existingConversation) {
      console.log('Utilisation de la conversation existante');
      conversationId = existingConversation._id;
    } else {
      console.log('Création d\'une nouvelle conversation...');

      const startResponse = await fetch(`${API_URL}/conversations/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId: projectId,
          printerId: currentUser._id,
          initiatedBy: 'printer'
        })
      });

      if (!startResponse.ok) {
        const errorData = await startResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erreur lors de la création de la conversation');
      }

      const startData = await startResponse.json();
      conversationId = startData.conversation._id;
      console.log('Conversation créée:', conversationId);
    }

    // 2. Envoyer le devis
    console.log('Envoi du devis à la conversation:', conversationId);

    const quoteResponse = await fetch(`${API_URL}/conversations/${conversationId}/send-quote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(quoteData)
    });

    if (!quoteResponse.ok) {
      const errorData = await quoteResponse.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erreur lors de l\'envoi du devis');
    }

    const quoteResult = await quoteResponse.json();
    console.log('Devis envoyé avec succès:', quoteResult);

    alert('✅ Devis envoyé avec succès ! Vous pouvez maintenant discuter avec le client.');
    window.location.href = `/conversation.html?id=${conversationId}`;

  } catch (error) {
    console.error('Error submitting quote:', error);
    alert('❌ Erreur lors de l\'envoi du devis : ' + error.message);

    // Réactiver le bouton
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

// Attacher le gestionnaire de soumission du formulaire
function setupFormSubmission() {
  const form = document.getElementById('quoteForm');
  if (form) {
    form.addEventListener('submit', submitQuote);
    console.log('Gestionnaire de soumission attaché au formulaire');
  } else {
    console.error('Formulaire de devis non trouvé!');
  }
}

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

// Initialisation au chargement de la page
async function init() {
  console.log('Initialisation de la page imprimeur...');
  await loadProject();
  setupCalculationListeners();
  setupFormSubmission();
  console.log('Initialisation terminée');
}

// Charger au démarrage
init();
