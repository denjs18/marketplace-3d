// project-details-printer.js - Vue détaillée projet côté IMPRIMEUR
console.log('🚀 Script project-details-printer.js chargé');

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : '/api';

let currentProject = null;
let existingConversation = null;
let currentUser = null;

// Obtenir l'ID du projet depuis l'URL
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('id');

console.log('📋 Project ID:', projectId);

if (!projectId) {
  console.error('❌ ID de projet manquant');
  alert('ID de projet manquant');
  window.location.href = '/available-projects.html';
}

// Vérifier l'authentification au démarrage
function checkAuth() {
  console.log('🔐 Vérification de l\'authentification...');

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    console.error('❌ Token ou user manquant');
    alert('Vous devez être connecté');
    window.location.href = '/login.html';
    return false;
  }

  try {
    currentUser = JSON.parse(userStr);
    console.log('✅ Utilisateur:', currentUser.firstName, currentUser.lastName, '- Rôle:', currentUser.role);
    console.log('🔍 User ID:', currentUser._id || currentUser.id, '(Type:', typeof (currentUser._id || currentUser.id) + ')');

    if (currentUser.role !== 'printer') {
      console.error('❌ Mauvais rôle:', currentUser.role);
      alert('Cette page est réservée aux imprimeurs');
      window.location.href = '/';
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error parsing user:', error);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login.html';
    return false;
  }
}

// Charger le projet
async function loadProject() {
  console.log('📥 Chargement du projet...');

  const isAuthenticated = checkAuth();
  if (!isAuthenticated) {
    console.error('❌ Non authentifié');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/projects/${projectId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    console.log('📡 Réponse API:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erreur lors du chargement du projet');
    }

    const data = await response.json();
    currentProject = data.project;
    console.log('✅ Projet chargé:', currentProject.title);

    displayProject();
    await checkExistingConversation();

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('projectContent').classList.remove('hidden');

    console.log('✅ Interface affichée');
  } catch (error) {
    console.error('❌ Error loading project:', error);
    alert('Erreur lors du chargement du projet: ' + error.message);
    window.location.href = '/available-projects.html';
  }
}

// Afficher le projet
function displayProject() {
  console.log('🖼️ Affichage du projet...');
  const project = currentProject;

  // Titre et statut
  document.getElementById('projectTitle').textContent = project.title;

  const statusBadge = document.getElementById('projectStatus');
  const statusText = getStatusText(project.projectStatus || project.status);
  statusBadge.className = `status-badge badge-${project.projectStatus || project.status}`;
  statusBadge.textContent = statusText;

  // Afficher l'info si imprimeur trouvé
  if (project.printerFound) {
    const printerFoundInfo = document.getElementById('printerFoundInfo');
    if (printerFoundInfo) {
      printerFoundInfo.classList.remove('hidden');
    }
  }

  // Info client
  if (project.client) {
    document.getElementById('clientName').textContent =
      `${project.client.firstName} ${project.client.lastName}`;

    // Utiliser le système de fallback avatar
    const clientAvatarImg = document.getElementById('clientAvatar');
    setAvatar(clientAvatarImg, project.client, 80);

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
  if (qtyInput && specs.quantity) {
    qtyInput.value = specs.quantity;
    console.log('✅ Quantité pré-remplie:', specs.quantity);
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

  // Nombre de devis
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

  console.log('✅ Projet affiché');
}

// Vérifier si une conversation existe déjà
async function checkExistingConversation() {
  console.log('🔍 Vérification conversation existante...');

  try {
    const response = await fetch(`${API_URL}/conversations/my-conversations`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      console.log('⚠️ Pas de conversations ou erreur');
      return;
    }

    const data = await response.json();
    existingConversation = data.conversations.find(c => {
      const convProjectId = c.project && (c.project._id || c.project);
      // Ignorer les conversations annulées
      const isCancelled = c.status && (
        c.status.includes('cancelled') ||
        c.status === 'cancelled_by_client' ||
        c.status === 'cancelled_by_printer' ||
        c.status === 'cancelled_mutual' ||
        c.status === 'cancelled_mediation'
      );
      return convProjectId === projectId && !isCancelled;
    });

    if (existingConversation) {
      console.log('✅ Conversation existante trouvée:', existingConversation._id);

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
      console.log('ℹ️ Aucune conversation existante');
    }
  } catch (error) {
    console.error('❌ Error checking conversation:', error);
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

// Soumettre le devis
async function handleQuoteSubmit(e) {
  e.preventDefault();
  console.log('📤 DÉBUT SOUMISSION DU DEVIS - handleQuoteSubmit');

  // Vérifier l'authentification
  if (!currentUser) {
    console.error('❌ Utilisateur non connecté');
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

  console.log('📋 Données du formulaire:', {
    pricePerUnit,
    quantity,
    totalPrice,
    deliveryDays,
    shippingCost,
    materialsRaw,
    options: options.substring(0, 50) + '...'
  });

  // Validation
  if (!pricePerUnit || pricePerUnit <= 0) {
    alert('⚠️ Veuillez entrer un prix unitaire valide');
    return;
  }

  if (!quantity || quantity <= 0) {
    alert('⚠️ Veuillez entrer une quantité valide');
    return;
  }

  if (!deliveryDays || deliveryDays <= 0) {
    alert('⚠️ Veuillez entrer un délai de livraison valide');
    return;
  }

  if (!options || options.trim().length < 10) {
    alert('⚠️ Veuillez décrire les options et détails (minimum 10 caractères)');
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

  console.log('✅ Données validées:', quoteData);

  // Désactiver le bouton pendant l'envoi
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (!submitBtn) {
    console.error('❌ Bouton submit non trouvé');
    return;
  }

  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '⏳ Envoi en cours...';
  console.log('🔒 Bouton désactivé');

  try {
    // 1. Créer ou récupérer la conversation
    let conversationId;

    if (existingConversation) {
      console.log('♻️ Utilisation conversation existante:', existingConversation._id);
      conversationId = existingConversation._id;
    } else {
      console.log('🆕 Création nouvelle conversation...');

      // Utiliser _id ou id selon ce qui est disponible
      const userId = currentUser._id || currentUser.id;
      console.log('👤 Printer ID utilisé:', userId);

      if (!userId) {
        throw new Error('ID utilisateur introuvable. Veuillez vous reconnecter.');
      }

      const startResponse = await fetch(`${API_URL}/conversations/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId: projectId,
          printerId: userId,
          initiatedBy: 'printer'
        })
      });

      console.log('📡 Réponse création conversation:', startResponse.status);

      if (!startResponse.ok) {
        const errorData = await startResponse.json().catch(() => ({}));
        console.error('❌ Erreur création conversation:', errorData);
        throw new Error(errorData.error || 'Erreur lors de la création de la conversation');
      }

      const startData = await startResponse.json();
      conversationId = startData.conversation._id;
      console.log('✅ Conversation créée:', conversationId);
    }

    // 2. Envoyer le devis
    console.log('💰 Envoi du devis...');

    const quoteResponse = await fetch(`${API_URL}/conversations/${conversationId}/send-quote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(quoteData)
    });

    console.log('📡 Réponse envoi devis:', quoteResponse.status);

    if (!quoteResponse.ok) {
      const errorData = await quoteResponse.json().catch(() => ({}));
      console.error('❌ Erreur envoi devis:', errorData);
      throw new Error(errorData.error || 'Erreur lors de l\'envoi du devis');
    }

    const quoteResult = await quoteResponse.json();
    console.log('✅ DEVIS ENVOYÉ AVEC SUCCÈS:', quoteResult);

    alert('✅ Devis envoyé avec succès ! Vous pouvez maintenant discuter avec le client.');
    console.log('🔀 Redirection vers conversation...');
    window.location.href = `/conversation.html?id=${conversationId}`;

  } catch (error) {
    console.error('❌ ERREUR:', error);
    alert('❌ Erreur lors de l\'envoi du devis : ' + error.message);

    // Réactiver le bouton
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
    console.log('🔓 Bouton réactivé');
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

// Annuler le devis et permettre d'en soumettre un nouveau
async function handleCancelQuote() {
  console.log('🗑️ Annulation du devis demandée');

  if (!existingConversation) {
    alert('Aucune conversation à annuler');
    return;
  }

  if (!confirm('Êtes-vous sûr de vouloir annuler votre devis ? Vous pourrez en soumettre un nouveau après.')) {
    return;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    alert('Vous devez être connecté');
    window.location.href = '/login.html';
    return;
  }

  try {
    const response = await fetch(`/api/conversations/${existingConversation._id}/withdraw`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reason: 'L\'imprimeur souhaite soumettre un nouveau devis'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de l\'annulation');
    }

    console.log('✅ Devis annulé avec succès');
    alert('Votre devis a été annulé. Vous pouvez maintenant en soumettre un nouveau.');

    // Réinitialiser l'état
    existingConversation = null;

    // Masquer l'alerte
    document.getElementById('existingConversationAlert').classList.add('hidden');
    document.getElementById('conversationStatusCard').classList.add('hidden');

    // Afficher le formulaire de devis
    document.getElementById('quoteFormCard').classList.remove('hidden');

    // Recharger la page pour avoir un état propre
    window.location.reload();
  } catch (error) {
    console.error('❌ Error cancelling quote:', error);
    alert('Erreur lors de l\'annulation : ' + error.message);
  }
}

// Attacher les event listeners
function setupEventListeners() {
  console.log('🔗 Attachement des event listeners...');

  // Calcul automatique du total
  const priceInput = document.getElementById('pricePerUnit');
  const qtyInput = document.getElementById('quantity');
  const shippingInput = document.getElementById('shippingCost');

  if (priceInput) {
    priceInput.addEventListener('input', calculateTotal);
    console.log('✅ Listener prix attaché');
  }
  if (qtyInput) {
    qtyInput.addEventListener('input', calculateTotal);
    console.log('✅ Listener quantité attaché');
  }
  if (shippingInput) {
    shippingInput.addEventListener('input', calculateTotal);
    console.log('✅ Listener frais livraison attaché');
  }

  // Soumission du formulaire
  const form = document.getElementById('quoteForm');
  if (form) {
    form.addEventListener('submit', handleQuoteSubmit);
    console.log('✅ Listener formulaire attaché sur handleQuoteSubmit');
  } else {
    console.error('❌ FORMULAIRE NON TROUVÉ !');
  }

  // Bouton d'annulation du devis
  const cancelQuoteBtn = document.getElementById('cancelQuoteBtn');
  if (cancelQuoteBtn) {
    cancelQuoteBtn.addEventListener('click', handleCancelQuote);
    console.log('✅ Listener bouton annulation devis attaché');
  }

  // Calcul initial
  calculateTotal();
}

// Initialisation
async function init() {
  console.log('🚀 ========== INITIALISATION ==========');
  console.log('📍 Page: project-details-printer.html');
  console.log('🆔 Project ID:', projectId);

  try {
    await loadProject();
    setupEventListeners();
    console.log('✅ ========== INITIALISATION RÉUSSIE ==========');
  } catch (error) {
    console.error('❌ ========== ERREUR INITIALISATION ==========');
    console.error(error);
  }
}

// Démarrage quand le DOM est prêt
if (document.readyState === 'loading') {
  console.log('⏳ DOM en cours de chargement...');
  document.addEventListener('DOMContentLoaded', init);
} else {
  console.log('✅ DOM déjà chargé');
  init();
}
