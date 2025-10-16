/**
 * Dashboard utilities
 */

// Load user stats
async function loadUserStats() {
  try {
    const user = getUser();

    if (user.role === 'client') {
      await loadClientStats();
    } else {
      await loadPrinterStats();
    }
  } catch (error) {
    console.error('Error loading stats:', error);
    showToast('Erreur de chargement des statistiques', 'error');
  }
}

// Load client statistics
async function loadClientStats() {
  const response = await apiRequest('/projects?limit=100');
  const data = await response.json();

  const stats = {
    total: data.projects.length,
    open: data.projects.filter(p => p.status === 'open' || p.status === 'quoted').length,
    inProgress: data.projects.filter(p => p.status === 'in_progress').length,
    completed: data.projects.filter(p => p.status === 'completed').length
  };

  // Update DOM
  updateStatCard('total-projects', stats.total);
  updateStatCard('open-projects', stats.open);
  updateStatCard('in-progress-projects', stats.inProgress);
  updateStatCard('completed-projects', stats.completed);
}

// Load printer statistics
async function loadPrinterStats() {
  try {
    // Load quotes
    const quotesResponse = await apiRequest('/quotes/my-quotes?limit=100');
    const quotesData = await quotesResponse.json();

    // Load earnings
    const earningsResponse = await apiRequest('/payments/earnings');
    const earningsData = await earningsResponse.json();

    const stats = {
      totalQuotes: quotesData.quotes.length,
      acceptedQuotes: quotesData.quotes.filter(q => q.status === 'accepted').length,
      pendingQuotes: quotesData.quotes.filter(q => q.status === 'pending').length,
      totalEarnings: earningsData.earnings.totalEarnings || 0
    };

    // Update DOM
    updateStatCard('total-quotes', stats.totalQuotes);
    updateStatCard('accepted-quotes', stats.acceptedQuotes);
    updateStatCard('pending-quotes', stats.pendingQuotes);
    updateStatCard('total-earnings', formatCurrency(stats.totalEarnings));
  } catch (error) {
    console.error('Error loading printer stats:', error);
  }
}

// Update stat card value
function updateStatCard(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

// Load recent projects
async function loadRecentProjects(limit = 10) {
  try {
    const response = await apiRequest(`/projects?limit=${limit}&sort=-createdAt`);
    const data = await response.json();

    const container = document.getElementById('projects-list');
    if (!container) return;

    if (data.projects.length === 0) {
      container.innerHTML = '<p class="text-center text-secondary">Aucun projet pour le moment</p>';
      return;
    }

    container.innerHTML = data.projects.map(project => `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${project.title}</h3>
          ${getStatusBadge(project.status)}
        </div>
        <div class="card-body">
          <p>${project.description.substring(0, 150)}${project.description.length > 150 ? '...' : ''}</p>
          <div class="flex-between mt-2">
            <span class="text-secondary">
              <strong>Matériau:</strong> ${project.specifications.material}
            </span>
            <span class="text-secondary">
              <strong>Quantité:</strong> ${project.specifications.quantity}
            </span>
          </div>
          <div class="mt-2">
            <a href="/project-details.html?id=${project._id}" class="btn btn-primary">Voir détails</a>
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading projects:', error);
    showToast('Erreur de chargement des projets', 'error');
  }
}

// Load recent quotes (for printers)
async function loadRecentQuotes(limit = 10) {
  try {
    const response = await apiRequest(`/quotes/my-quotes?limit=${limit}`);
    const data = await response.json();

    const container = document.getElementById('quotes-list');
    if (!container) return;

    if (data.quotes.length === 0) {
      container.innerHTML = '<p class="text-center text-secondary">Aucun devis pour le moment</p>';
      return;
    }

    container.innerHTML = data.quotes.map(quote => `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${quote.project.title}</h3>
          ${getStatusBadge(quote.status)}
        </div>
        <div class="card-body">
          <div class="flex-between">
            <span><strong>Prix:</strong> ${formatCurrency(quote.price)}</span>
            <span><strong>Délai:</strong> ${quote.estimatedDuration.value} ${quote.estimatedDuration.unit}</span>
          </div>
          <p class="mt-2 text-secondary">Livraison: ${formatDate(quote.deliveryDate)}</p>
          <div class="mt-2">
            <a href="/project-details.html?id=${quote.project._id}" class="btn btn-primary">Voir projet</a>
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading quotes:', error);
    showToast('Erreur de chargement des devis', 'error');
  }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  if (typeof requireAuth !== 'undefined') {
    requireAuth();
    loadUserStats();

    const user = getUser();
    if (user.role === 'client') {
      loadRecentProjects();
    } else {
      loadRecentQuotes();
    }
  }
});
