/**
 * Page Projets Disponibles - Pour les imprimeurs
 */

let currentUser = null;
let allProjects = [];
let filteredProjects = [];

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth('printer');
  if (!currentUser) {
    return;
  }

  createAuthNavbar(currentUser);
  await loadAvailableProjects();

  // Event listeners
  document.getElementById('searchInput').addEventListener('input', applyFilters);
  document.getElementById('materialFilter').addEventListener('change', applyFilters);
  document.getElementById('sortFilter').addEventListener('change', applyFilters);
});

// Charger les projets disponibles
async function loadAvailableProjects() {
  const token = getToken();

  try {
    // Charger tous les projets (le backend filtre déjà pour les imprimeurs)
    const response = await fetch('/api/projects', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Erreur lors du chargement des projets');
    }

    const data = await response.json();
    allProjects = data.projects || [];

    // Le backend filtre déjà sur projectStatus pour les imprimeurs
    // Pas besoin de re-filtrer ici

    filteredProjects = [...allProjects];

    applyFilters();

    document.getElementById('loading').style.display = 'none';

  } catch (error) {
    console.error('Erreur:', error);
    document.getElementById('loading').innerHTML = '<p style="color: #d63031;">Erreur lors du chargement</p>';
    showToast('Erreur lors du chargement des projets', 'error');
  }
}

// Appliquer les filtres
function applyFilters() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const materialFilter = document.getElementById('materialFilter').value;
  const sortFilter = document.getElementById('sortFilter').value;

  // Filtrer
  filteredProjects = allProjects.filter(project => {
    const matchesSearch = !searchTerm ||
                         project.title.toLowerCase().includes(searchTerm) ||
                         project.description.toLowerCase().includes(searchTerm);

    const matchesMaterial = !materialFilter ||
                           project.specifications?.material === materialFilter;

    return matchesSearch && matchesMaterial;
  });

  // Trier
  filteredProjects.sort((a, b) => {
    const isDescending = sortFilter.startsWith('-');
    const field = isDescending ? sortFilter.substring(1) : sortFilter;

    let aValue, bValue;

    if (field === 'createdAt') {
      aValue = new Date(a.createdAt);
      bValue = new Date(b.createdAt);
    } else if (field === 'budget') {
      aValue = a.budget?.max || 0;
      bValue = b.budget?.max || 0;
    }

    if (aValue < bValue) return isDescending ? 1 : -1;
    if (aValue > bValue) return isDescending ? -1 : 1;
    return 0;
  });

  renderProjects();
}

// Afficher les projets
function renderProjects() {
  const grid = document.getElementById('projectsGrid');
  const emptyState = document.getElementById('emptyState');

  if (filteredProjects.length === 0) {
    grid.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  grid.classList.remove('hidden');

  grid.innerHTML = filteredProjects.map(project => renderProjectCard(project)).join('');
}

// Render une carte projet
function renderProjectCard(project) {
  const imageUrl = project.images && project.images.length > 0
    ? project.images[0]
    : '/images/placeholder-project.png';

  // Utiliser le système de fallback avatar
  const clientAvatar = getAvatarUrl(project.client, 40);
  const clientName = project.client
    ? `${project.client.firstName} ${project.client.lastName}`
    : 'Client anonyme';
  const clientRating = project.client?.rating?.average || 0;
  const clientRatingCount = project.client?.rating?.count || 0;

  const material = project.specifications?.material || 'Non spécifié';
  const color = project.specifications?.color || 'Natural';
  const quantity = project.specifications?.quantity || 1;
  const budget = project.budget?.max || 0;

  return `
    <div class="project-card">
      <img src="${imageUrl}" alt="${project.title}" class="project-card-image">
      <div class="project-card-content">
        <div class="project-card-header">
          <h3 class="project-card-title">${project.title}</h3>
          ${project.printerFound
            ? '<span class="status-badge" style="background: #fdcb6e; color: #2d3436;">✅ Imprimeur trouvé</span>'
            : '<span class="status-badge badge-published">Publié</span>'
          }
        </div>

        <p class="project-card-description">${project.description}</p>

        <div class="project-client">
          <img src="${clientAvatar}" alt="${clientName}" class="client-avatar">
          <div class="client-info">
            <div class="client-name">${clientName}</div>
            <div class="client-rating">⭐ ${clientRating.toFixed(1)} (${clientRatingCount} avis)</div>
          </div>
        </div>

        <div class="project-specs">
          <div class="spec-item">
            <span class="spec-label">Matériau</span>
            <span class="spec-value">${material}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Couleur</span>
            <span class="spec-value">${color}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Quantité</span>
            <span class="spec-value">${quantity}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Budget max</span>
            <span class="spec-value">${formatPrice(budget)}</span>
          </div>
        </div>

        <div class="project-actions">
          <button class="btn btn-primary" onclick="viewProjectDetails('${project._id}')">
            👁️ Voir détails
          </button>
        </div>
      </div>
    </div>
  `;
}

// Réinitialiser les filtres
function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('materialFilter').value = '';
  document.getElementById('sortFilter').value = '-createdAt';
  applyFilters();
}

// Voir les détails d'un projet
function viewProjectDetails(projectId) {
  window.location.href = `/project-details.html?id=${projectId}`;
}
