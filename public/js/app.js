/**
 * Global app utilities and helpers
 */

// API Base URL
const API_URL = '/api';

// Get stored auth token
function getToken() {
  return localStorage.getItem('token');
}

// Get stored user
function getUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

// Check if user is authenticated
function isAuthenticated() {
  return !!getToken();
}

// Logout user
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

// Make authenticated API request
async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  });

  // Handle 401 Unauthorized
  if (response.status === 401) {
    logout();
    throw new Error('Session expired');
  }

  return response;
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

// Show toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `alert alert-${type}`;
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.top = '20px';
  toast.style.right = '20px';
  toast.style.zIndex = '9999';
  toast.style.minWidth = '300px';

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Get status badge HTML
function getStatusBadge(status) {
  const badges = {
    open: '<span class="badge badge-info">Ouvert</span>',
    quoted: '<span class="badge badge-warning">Devisé</span>',
    in_progress: '<span class="badge badge-warning">En cours</span>',
    completed: '<span class="badge badge-success">Terminé</span>',
    cancelled: '<span class="badge badge-error">Annulé</span>',
    pending: '<span class="badge badge-warning">En attente</span>',
    accepted: '<span class="badge badge-success">Accepté</span>',
    rejected: '<span class="badge badge-error">Refusé</span>',
    expired: '<span class="badge badge-error">Expiré</span>'
  };

  return badges[status] || `<span class="badge">${status}</span>`;
}

// File size formatter
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  // Add logout button handler if exists
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }

  // Display user info if logged in
  const userInfo = document.getElementById('user-info');
  if (userInfo && isAuthenticated()) {
    const user = getUser();
    userInfo.textContent = `${user.firstName} ${user.lastName}`;
  }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    API_URL,
    getToken,
    getUser,
    isAuthenticated,
    logout,
    apiRequest,
    formatDate,
    formatCurrency,
    showToast,
    getStatusBadge,
    formatFileSize,
    debounce
  };
}
