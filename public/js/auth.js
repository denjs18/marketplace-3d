/**
 * Authentication utilities
 */

// Check authentication and redirect if needed
function requireAuth(requiredRole = null) {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    window.location.href = '/login.html';
    return false;
  }

  const user = JSON.parse(userStr);

  // Check role if specified
  if (requiredRole && user.role !== requiredRole) {
    alert('Accès non autorisé');
    if (user.role === 'client') {
      window.location.href = '/dashboard-client.html';
    } else {
      window.location.href = '/dashboard-printer.html';
    }
    return false;
  }

  return true;
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

// Auto-redirect if already logged in
function redirectIfAuthenticated() {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (token && userStr) {
    const user = JSON.parse(userStr);
    if (user.role === 'client') {
      window.location.href = '/dashboard-client.html';
    } else {
      window.location.href = '/dashboard-printer.html';
    }
  }
}
