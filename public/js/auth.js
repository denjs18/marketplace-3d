/**
 * Système d'authentification global
 * Gère la vérification du token, les redirections et la barre supérieure
 */

// Vérifier si l'utilisateur est connecté
function isAuthenticated() {
  const token = localStorage.getItem('token');
  return !!token;
}

// Obtenir le token
function getToken() {
  return localStorage.getItem('token');
}

// Obtenir l'utilisateur stocké
function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (e) {
      return null;
    }
  }
  return null;
}

// Sauvegarder l'utilisateur
function saveUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

// Vérifier et charger le profil utilisateur depuis l'API
async function verifyAndLoadUser() {
  const token = getToken();
  if (!token) {
    return null;
  }

  try {
    const response = await fetch('/api/auth/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      // Token invalide ou expiré
      console.error('Token invalide ou expiré, déconnexion...');
      logout();
      return null;
    }

    const data = await response.json();
    // L'API retourne { user: {...} }
    const userData = data.user || data;
    saveUser(userData);
    return userData;
  } catch (error) {
    console.error('Erreur lors de la vérification du token:', error);
    logout();
    return null;
  }
}

// Déconnexion
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('refreshToken');
  window.location.href = '/index.html';
}

// Déconnexion avec confirmation
function logoutWithConfirmation() {
  if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
    logout();
  }
}

// Redirection pour pages nécessitant authentification
async function requireAuth(requiredRole = null) {
  if (!isAuthenticated()) {
    window.location.href = '/index.html';
    return false;
  }

  const user = await verifyAndLoadUser();
  if (!user) {
    return false;
  }

  // Check role if specified
  if (requiredRole && user.role !== requiredRole) {
    showToast('Accès non autorisé', 'error');
    if (user.role === 'client') {
      window.location.href = '/dashboard-client.html';
    } else if (user.role === 'printer') {
      window.location.href = '/dashboard-printer.html';
    }
    return false;
  }

  return user;
}

// Redirection pour page d'accueil (si déjà connecté)
async function redirectIfAuthenticated() {
  if (isAuthenticated()) {
    const user = await verifyAndLoadUser();
    if (user) {
      // Rediriger selon le rôle
      if (user.role === 'client') {
        window.location.href = '/dashboard-client.html';
      } else if (user.role === 'printer') {
        window.location.href = '/dashboard-printer.html';
      } else if (user.role === 'admin') {
        window.location.href = '/admin/dashboard.html';
      }
    }
  }
}

// Refresh token if needed
async function refreshToken() {
  const refreshToken = localStorage.getItem('refreshToken');

  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken })
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Refresh token error:', error);
    return false;
  }
}

// Créer la barre supérieure personnalisée pour utilisateurs connectés
function createAuthNavbar(user) {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  // Remplacer le contenu de la navbar
  const navContainer = navbar.querySelector('.nav-container');
  if (!navContainer) return;

  navContainer.innerHTML = `
    <a href="/${user.role === 'client' ? 'dashboard-client' : 'dashboard-printer'}.html" class="nav-logo">
      Strivex
    </a>
    <div class="nav-menu">
      <a href="/${user.role === 'client' ? 'dashboard-client' : 'dashboard-printer'}.html" class="nav-link">
        Tableau de bord
      </a>
      <a href="/messages.html" class="nav-link">
        Messages
      </a>
      <div class="nav-user-menu">
        <div class="nav-user-info" id="navUserInfo">
          <img src="${user.profileImage || '/images/avatar-default.png'}"
               alt="${user.firstName} ${user.lastName}"
               class="nav-user-avatar">
          <span class="nav-user-name">${user.firstName} ${user.lastName}</span>
          <span class="nav-user-dropdown">▼</span>
        </div>
        <div class="nav-user-dropdown-menu" id="navUserDropdown">
          <a href="/profile.html" class="nav-dropdown-item">
            <span>👤</span> Mon profil
          </a>
          <a href="/settings.html" class="nav-dropdown-item">
            <span>⚙️</span> Paramètres
          </a>
          <hr class="nav-dropdown-divider">
          <a href="#" class="nav-dropdown-item" id="logoutBtn">
            <span>🚪</span> Déconnexion
          </a>
        </div>
      </div>
    </div>
  `;

  // Ajouter les styles pour le dropdown
  addNavbarStyles();

  // Gérer le dropdown
  const userInfo = document.getElementById('navUserInfo');
  const dropdown = document.getElementById('navUserDropdown');
  const logoutBtn = document.getElementById('logoutBtn');

  userInfo.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('show');
  });

  // Fermer le dropdown si on clique ailleurs
  document.addEventListener('click', () => {
    dropdown.classList.remove('show');
  });

  // Gérer la déconnexion
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    logoutWithConfirmation();
  });
}

// Ajouter les styles CSS pour la navbar authentifiée
function addNavbarStyles() {
  if (document.getElementById('auth-navbar-styles')) return;

  const style = document.createElement('style');
  style.id = 'auth-navbar-styles';
  style.textContent = `
    .nav-user-menu {
      position: relative;
    }

    .nav-user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 16px;
      background: #f8f9fa;
      border-radius: 25px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .nav-user-info:hover {
      background: #e9ecef;
    }

    .nav-user-avatar {
      width: 35px;
      height: 35px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #0984e3;
    }

    .nav-user-name {
      font-weight: 600;
      color: #2d3436;
      font-size: 14px;
    }

    .nav-user-dropdown {
      font-size: 10px;
      color: #636e72;
      transition: transform 0.2s;
    }

    .nav-user-info:hover .nav-user-dropdown {
      transform: translateY(2px);
    }

    .nav-user-dropdown-menu {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 8px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      min-width: 200px;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-10px);
      transition: all 0.2s;
      z-index: 1000;
    }

    .nav-user-dropdown-menu.show {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }

    .nav-dropdown-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 20px;
      color: #2d3436;
      text-decoration: none;
      transition: background 0.2s;
      font-size: 14px;
    }

    .nav-dropdown-item:hover {
      background: #f8f9fa;
    }

    .nav-dropdown-item:first-child {
      border-radius: 8px 8px 0 0;
    }

    .nav-dropdown-item:last-child {
      border-radius: 0 0 8px 8px;
      color: #d63031;
    }

    .nav-dropdown-item:last-child:hover {
      background: #ffe5e5;
    }

    .nav-dropdown-divider {
      margin: 0;
      border: none;
      border-top: 1px solid #eee;
    }

    @media (max-width: 768px) {
      .nav-user-name {
        display: none;
      }

      .nav-user-info {
        padding: 8px 12px;
      }
    }
  `;

  document.head.appendChild(style);
}

// Afficher un toast de notification
function showToast(message, type = 'info') {
  // Créer le container de toasts s'il n'existe pas
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(toastContainer);
  }

  // Créer le toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const colors = {
    success: '#00b894',
    error: '#d63031',
    warning: '#fdcb6e',
    info: '#0984e3'
  };

  const icons = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ'
  };

  toast.style.cssText = `
    background: ${colors[type] || colors.info};
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 300px;
    animation: slideIn 0.3s ease;
    font-weight: 500;
  `;

  toast.innerHTML = `
    <span style="font-size: 20px;">${icons[type] || icons.info}</span>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

  // Supprimer après 4 secondes
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// Ajouter les animations CSS pour les toasts
const toastStyles = document.createElement('style');
toastStyles.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(toastStyles);

// Formater une date
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'À l\'instant';
  if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `Aujourd'hui à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  if (diff < 172800000) return `Hier à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Formater un prix
function formatPrice(price) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(price);
}
