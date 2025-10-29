/**
 * Page Soumettre un devis
 */

let currentUser = null;
let currentProject = null;
let projectId = null;

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth('printer');
  if (!currentUser) return;

  createAuthNavbar(currentUser);

  // Récupérer l'ID du projet depuis l'URL
  const urlParams = new URLSearchParams(window.location.search);
  projectId = urlParams.get('projectId');

  if (!projectId) {
    showToast('ID de projet manquant', 'error');
    setTimeout(() => {
      window.location.href = '/dashboard-printer.html';
    }, 2000);
    return;
  }

  await loadProject();

  // Set minimum delivery date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('delivery-date').min = tomorrow.toISOString().split('T')[0];

  // Calculate price breakdown
  const priceInput = document.getElementById('price');
  priceInput.addEventListener('input', updatePriceBreakdown);

  // Form submission
  document.getElementById('quote-form').addEventListener('submit', submitQuote);
});

// Charger les données du projet
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

    displayProjectInfo(currentProject);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').classList.remove('hidden');

  } catch (error) {
    console.error('Erreur:', error);
    showToast('Erreur lors du chargement du projet', 'error');
    setTimeout(() => {
      window.location.href = '/dashboard-printer.html';
    }, 2000);
  }
}

// Afficher les informations du projet
function displayProjectInfo(project) {
  document.getElementById('project-title').textContent = project.title;
  document.getElementById('project-description').textContent = project.description;

  // Spécifications
  const specs = project.specifications || {};
  document.getElementById('project-material').textContent = specs.material || project.material || 'Non spécifié';
  document.getElementById('project-quantity').textContent = specs.quantity || project.quantity || 1;

  // Budget
  const budget = project.budget?.max || project.estimatedBudget || 0;
  document.getElementById('project-budget').textContent = budget ? formatPrice(budget) : 'Non spécifié';

  // Délai
  if (project.deadline) {
    const deadline = new Date(project.deadline);
    const now = new Date();
    const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    document.getElementById('project-deadline').textContent = daysLeft > 0 ? `${daysLeft} jours` : formatDate(project.deadline);
  } else {
    document.getElementById('project-deadline').textContent = 'Non spécifié';
  }

  // Couleur et finition (si disponibles)
  const color = specs.color || project.color;
  const finish = specs.postProcessing || project.finish;

  if (color) {
    const colorDiv = document.createElement('div');
    colorDiv.innerHTML = `<strong>Couleur:</strong> <span>${color}</span>`;
    document.querySelector('.grid.grid-2').appendChild(colorDiv);
  }

  if (finish) {
    const finishDiv = document.createElement('div');
    finishDiv.innerHTML = `<strong>Finition:</strong> <span>${finish}</span>`;
    document.querySelector('.grid.grid-2').appendChild(finishDiv);
  }
}

// Mettre à jour la répartition des prix
function updatePriceBreakdown() {
  const priceInput = document.getElementById('price');
  const price = parseFloat(priceInput.value) || 0;

  if (price > 0) {
    const commission = price * 0.10;
    const yourPayment = price * 0.90;

    document.getElementById('client-price').textContent = price.toFixed(2);
    document.getElementById('commission').textContent = commission.toFixed(2);
    document.getElementById('your-payment').textContent = yourPayment.toFixed(2);
    document.getElementById('price-breakdown').classList.remove('hidden');
  } else {
    document.getElementById('price-breakdown').classList.add('hidden');
  }
}

// Soumettre le devis
async function submitQuote(e) {
  e.preventDefault();

  const price = parseFloat(document.getElementById('price').value);
  const estimatedDuration = parseInt(document.getElementById('estimated-duration').value);
  const deliveryDate = document.getElementById('delivery-date').value;
  const message = document.getElementById('message').value;

  // Validation
  if (!price || price <= 0) {
    showToast('Veuillez entrer un prix valide', 'error');
    return;
  }

  if (!estimatedDuration || estimatedDuration <= 0) {
    showToast('Veuillez entrer une durée valide', 'error');
    return;
  }

  if (!deliveryDate) {
    showToast('Veuillez sélectionner une date de livraison', 'error');
    return;
  }

  if (message.length < 10) {
    showToast('Le message doit contenir au moins 10 caractères', 'error');
    return;
  }

  if (message.length > 1000) {
    showToast('Le message ne peut pas dépasser 1000 caractères', 'error');
    return;
  }

  const submitBtn = document.querySelector('button[type="submit"]');
  const submitText = document.getElementById('submit-text');
  const submitLoading = document.getElementById('submit-loading');

  submitBtn.disabled = true;
  submitText.classList.add('hidden');
  submitLoading.classList.remove('hidden');

  const token = getToken();

  try {
    const response = await fetch('/api/quotes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectId: projectId,
        price: price,
        estimatedDuration: estimatedDuration,
        deliveryDate: deliveryDate,
        message: message,
        breakdown: {
          clientPrice: price,
          commission: price * 0.10,
          printerPayment: price * 0.90
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erreur lors de la soumission du devis');
    }

    showToast('Devis envoyé avec succès ! Le client sera notifié.', 'success');

    setTimeout(() => {
      window.location.href = '/dashboard-printer.html';
    }, 1500);

  } catch (error) {
    console.error('Erreur:', error);
    showToast(error.message || 'Erreur lors de la soumission du devis', 'error');

    submitBtn.disabled = false;
    submitText.classList.remove('hidden');
    submitLoading.classList.add('hidden');
  }
}
