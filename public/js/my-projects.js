/**
 * Page Mes Projets - Gestion complète avec pagination et filtres
 */

let currentUser = null;
let allProjects = [];
let filteredProjects = [];
let currentPage = 1;
const projectsPerPage = 12;

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth('client');
  if (!currentUser) {
    return;
  }

  createAuthNavbar(currentUser);
  await loadProjects();

  // Event listeners pour les filtres
  document.getElementById('searchInput').addEventListener('input', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  document.getElementById('sortFilter').addEventListener('change', applyFilters);
});

// Charger tous les projets
async function loadProjects() {
  const token = getToken();

  try {
    const response = await fetch('/api/projects', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Erreur lors du chargement des projets');
    }

    const data = await response.json();
    allProjects = data.projects || [];
    filteredProjects = [...allProjects];

    applyFilters();

    document.getElementById('loading').style.display = 'none';

  } catch (error) {
    console.error('Erreur:', error);
    document.getElementById('loading').innerHTML = '<p style="color: #d63031;">Erreur lors du chargement des projets</p>';
    showToast('Erreur lors du chargement des projets', 'error');
  }
}

// Appliquer les filtres
function applyFilters() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;
  const sortFilter = document.getElementById('sortFilter').value;

  // Filtrer
  filteredProjects = allProjects.filter(project => {
    const matchesSearch = !searchTerm ||
                         project.title.toLowerCase().includes(searchTerm) ||
                         project.description.toLowerCase().includes(searchTerm);

    const matchesStatus = !statusFilter || project.projectStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Trier
  filteredProjects.sort((a, b) => {
    const isDescending = sortFilter.startsWith('-');
    const field = isDescending ? sortFilter.substring(1) : sortFilter;

    let aValue = a[field];
    let bValue = b[field];

    // Gestion des dates
    if (field === 'createdAt' || field === 'updatedAt') {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    }

    // Gestion des chaînes
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (aValue < bValue) return isDescending ? 1 : -1;
    if (aValue > bValue) return isDescending ? -1 : 1;
    return 0;
  });

  currentPage = 1;
  renderProjects();
}

// Afficher les projets
function renderProjects() {
  const grid = document.getElementById('projectsGrid');
  const emptyState = document.getElementById('emptyState');
  const pagination = document.getElementById('pagination');

  if (filteredProjects.length === 0) {
    grid.style.display = 'none';
    pagination.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  grid.style.display = 'grid';

  // Calculer la pagination
  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage);
  const startIndex = (currentPage - 1) * projectsPerPage;
  const endIndex = startIndex + projectsPerPage;
  const projectsToShow = filteredProjects.slice(startIndex, endIndex);

  // Render les projets
  grid.innerHTML = projectsToShow.map(project => renderProjectCard(project)).join('');

  // Render la pagination
  if (totalPages > 1) {
    pagination.style.display = 'flex';
    pagination.innerHTML = renderPagination(totalPages);
  } else {
    pagination.style.display = 'none';
  }
}

// Render une carte projet
function renderProjectCard(project) {
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
    <div class="project-card">
      <img src="${imageUrl}" alt="${project.title}" class="project-image">
      <div class="project-content">
        <div class="project-header">
          <h3 class="project-title">${project.title}</h3>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <span class="badge badge-${project.projectStatus}">
              ${statusLabels[project.projectStatus] || project.projectStatus}
            </span>
            ${project.printerFound ? '<span class="badge" style="background: #00b894; color: white;">✅ Imprimeur trouvé</span>' : ''}
          </div>
        </div>
        <p class="project-description">
          ${project.description.substring(0, 100)}${project.description.length > 100 ? '...' : ''}
        </p>
        <div class="project-meta">
          <div class="meta-item">
            <span class="meta-label">Matériau</span>
            <span class="meta-value">${project.specifications?.material || project.material || 'Non spécifié'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Quantité</span>
            <span class="meta-value">${project.specifications?.quantity || project.quantity || '-'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Imprimeurs</span>
            <span class="meta-value">${invitedCount}/${maxInvited}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Budget estimé</span>
            <span class="meta-value">${formatPrice(project.budget?.max || project.estimatedBudget || 0)}</span>
          </div>
        </div>
        <div class="project-actions">
          <button class="btn btn-primary" onclick="viewProject('${project._id}')">
            👁️ Voir
          </button>
          ${project.projectStatus === 'draft' ? `
            <button class="btn btn-secondary" onclick="editProject('${project._id}')">
              ✏️ Modifier
            </button>
            <button class="btn btn-success" onclick="publishProject('${project._id}')">
              📤 Publier
            </button>
          ` : ''}
          ${project.projectStatus === 'published' && invitedCount < maxInvited ? `
            <button class="btn btn-info" onclick="invitePrinters('${project._id}')">
              📧 Inviter
            </button>
          ` : ''}
          ${['published', 'in_negotiation', 'quote_received'].includes(project.projectStatus) ? `
            <button class="btn btn-info" onclick="compareQuotes('${project._id}')">
              💰 Comparer devis
            </button>
          ` : ''}
          ${['published', 'quote_received'].includes(project.projectStatus) && !project.printerFound ? `
            <button class="btn btn-success" onclick="markPrinterFound('${project._id}')">
              ✅ J'ai trouvé un imprimeur
            </button>
          ` : ''}
          ${project.projectStatus === 'draft' ? `
            <button class="btn btn-danger" onclick="deleteProject('${project._id}')">
              🗑️ Supprimer
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

// Render la pagination
function renderPagination(totalPages) {
  let html = '';

  // Bouton précédent
  html += `<button class="page-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
    ← Précédent
  </button>`;

  // Numéros de page
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">
        ${i}
      </button>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<span class="page-btn" disabled>...</span>`;
    }
  }

  // Bouton suivant
  html += `<button class="page-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
    Suivant →
  </button>`;

  return html;
}

// Changer de page
function changePage(page) {
  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage);
  if (page < 1 || page > totalPages) return;

  currentPage = page;
  renderProjects();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Réinitialiser les filtres
function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('statusFilter').value = '';
  document.getElementById('sortFilter').value = '-createdAt';
  applyFilters();
}

// Actions sur les projets
function viewProject(projectId) {
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
      await loadProjects();
    } else {
      showToast('Erreur lors de la publication', 'error');
    }
  } catch (error) {
    console.error('Erreur:', error);
    showToast('Erreur de connexion', 'error');
  }
}

function invitePrinters(projectId) {
  window.location.href = `/compare-quotes.html?projectId=${projectId}`;
}

function compareQuotes(projectId) {
  window.location.href = `/compare-quotes.html?projectId=${projectId}`;
}

async function markPrinterFound(projectId) {
  if (!confirm('Voulez-vous marquer ce projet comme "imprimeur trouvé" ?\n\nLes autres imprimeurs ne pourront plus soumettre de nouveaux devis, mais le projet restera visible.')) {
    return;
  }

  try {
    const token = getToken();
    const response = await fetch(`/api/projects/${projectId}/printer-found`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      showToast('Projet marqué comme "imprimeur trouvé"', 'success');
      await loadProjects();
    } else {
      const data = await response.json();
      showToast(data.error || 'Erreur lors de la mise à jour', 'error');
    }
  } catch (error) {
    console.error('Erreur:', error);
    showToast('Erreur de connexion', 'error');
  }
}

async function deleteProject(projectId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ? Cette action est irréversible.')) {
    return;
  }

  try {
    const token = getToken();
    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      showToast('Projet supprimé', 'success');
      await loadProjects();
    } else {
      showToast('Erreur lors de la suppression', 'error');
    }
  } catch (error) {
    console.error('Erreur:', error);
    showToast('Erreur de connexion', 'error');
  }
}
