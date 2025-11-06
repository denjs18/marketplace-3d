/**
 * project-details-router.js
 * Redirige automatiquement vers la bonne page selon le rôle de l'utilisateur
 */

// Récupérer l'utilisateur connecté
const user = JSON.parse(localStorage.getItem('user'));

if (!user) {
  window.location.href = '/login.html';
} else {
  // Récupérer l'ID du projet depuis l'URL
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');

  if (!projectId) {
    alert('ID de projet manquant');
    window.location.href = user.role === 'client' ? '/my-projects.html' : '/available-projects.html';
  } else {
    // Rediriger vers la bonne page selon le rôle
    if (user.role === 'client') {
      window.location.href = `/project-details-client.html?id=${projectId}`;
    } else if (user.role === 'printer') {
      window.location.href = `/project-details-printer.html?id=${projectId}`;
    } else {
      alert('Rôle utilisateur non reconnu');
      window.location.href = '/';
    }
  }
}
