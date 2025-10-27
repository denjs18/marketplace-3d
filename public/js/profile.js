/**
 * Page Profil - Édition du profil utilisateur
 */

let currentUser = null;
let isEditMode = false;
let originalData = {};

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth();
  if (!currentUser) return;

  createAuthNavbar(currentUser);
  await loadProfile();

  // Event listeners
  document.getElementById('editBtn').addEventListener('click', enableEditMode);
  document.getElementById('cancelBtn').addEventListener('click', cancelEdit);
  document.getElementById('profileForm').addEventListener('submit', saveProfile);
  document.getElementById('passwordForm').addEventListener('submit', changePassword);
  document.getElementById('avatarUpload').addEventListener('change', uploadAvatar);
});

// Charger le profil
async function loadProfile() {
  const token = getToken();

  try {
    const response = await fetch('/api/users/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Erreur lors du chargement du profil');
    }

    const userData = await response.json();
    currentUser = userData;

    // Remplir les données
    fillProfileData(userData);

    // Charger les statistiques
    await loadStatistics();

    document.getElementById('loading').style.display = 'none';
    document.getElementById('profileContent').classList.remove('hidden');

  } catch (error) {
    console.error('Erreur:', error);
    showToast('Erreur lors du chargement du profil', 'error');
    document.getElementById('loading').innerHTML = '<p style="color: #d63031;">Erreur lors du chargement</p>';
  }
}

// Remplir les données du profil
function fillProfileData(user) {
  // Sidebar
  document.getElementById('profileAvatar').src = user.profileImage || '/images/avatar-default.png';
  document.getElementById('profileName').textContent = `${user.firstName} ${user.lastName}`;

  const roleLabels = {
    'client': 'Client',
    'printer': 'Imprimeur 3D',
    'admin': 'Administrateur'
  };
  document.getElementById('profileRole').textContent = roleLabels[user.role] || user.role;

  // Informations personnelles
  document.getElementById('firstName').value = user.firstName || '';
  document.getElementById('lastName').value = user.lastName || '';
  document.getElementById('email').value = user.email || '';
  document.getElementById('phone').value = user.phone || '';
  document.getElementById('companyName').value = user.companyName || '';

  // Adresse
  if (user.address) {
    document.getElementById('addressStreet').value = user.address.street || '';
    document.getElementById('addressCity').value = user.address.city || '';
    document.getElementById('addressPostalCode').value = user.address.postalCode || '';
    document.getElementById('addressCountry').value = user.address.country || '';
  }

  // Bio
  document.getElementById('bio').value = user.bio || '';

  // Sauvegarder les données originales
  originalData = {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    companyName: user.companyName,
    address: user.address ? { ...user.address } : {},
    bio: user.bio
  };
}

// Charger les statistiques
async function loadStatistics() {
  const token = getToken();

  try {
    // Charger les projets
    const projectsResponse = await fetch('/api/projects', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (projectsResponse.ok) {
      const projectsData = await projectsResponse.json();
      const projectsCount = projectsData.projects ? projectsData.projects.length : 0;
      document.getElementById('statProjects').textContent = projectsCount;
    }

    // Charger les conversations
    const conversationsResponse = await fetch('/api/conversations/my-conversations', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (conversationsResponse.ok) {
      const conversationsData = await conversationsResponse.json();
      const conversationsCount = conversationsData.conversations ? conversationsData.conversations.length : 0;
      document.getElementById('statConversations').textContent = conversationsCount;
    }

    // Membre depuis
    if (currentUser.createdAt) {
      const memberSince = new Date(currentUser.createdAt);
      const options = { month: 'short', year: 'numeric' };
      document.getElementById('statMemberSince').textContent = memberSince.toLocaleDateString('fr-FR', options);
    }

  } catch (error) {
    console.error('Erreur lors du chargement des statistiques:', error);
  }
}

// Activer le mode édition
function enableEditMode() {
  isEditMode = true;

  // Activer tous les champs sauf l'email
  const inputs = document.querySelectorAll('#profileForm .form-input, #profileForm .form-textarea');
  inputs.forEach(input => {
    if (input.id !== 'email') {
      input.disabled = false;
    }
  });

  // Afficher/masquer les boutons
  document.getElementById('editBtn').classList.add('hidden');
  document.getElementById('cancelBtn').classList.remove('hidden');
  document.getElementById('saveBtn').classList.remove('hidden');

  showToast('Mode édition activé', 'info');
}

// Annuler l'édition
function cancelEdit() {
  isEditMode = false;

  // Restaurer les données originales
  document.getElementById('firstName').value = originalData.firstName || '';
  document.getElementById('lastName').value = originalData.lastName || '';
  document.getElementById('phone').value = originalData.phone || '';
  document.getElementById('companyName').value = originalData.companyName || '';
  document.getElementById('addressStreet').value = originalData.address?.street || '';
  document.getElementById('addressCity').value = originalData.address?.city || '';
  document.getElementById('addressPostalCode').value = originalData.address?.postalCode || '';
  document.getElementById('addressCountry').value = originalData.address?.country || '';
  document.getElementById('bio').value = originalData.bio || '';

  // Désactiver tous les champs
  const inputs = document.querySelectorAll('#profileForm .form-input, #profileForm .form-textarea');
  inputs.forEach(input => {
    input.disabled = true;
  });

  // Afficher/masquer les boutons
  document.getElementById('editBtn').classList.remove('hidden');
  document.getElementById('cancelBtn').classList.add('hidden');
  document.getElementById('saveBtn').classList.add('hidden');

  showToast('Modifications annulées', 'info');
}

// Sauvegarder le profil
async function saveProfile(e) {
  e.preventDefault();

  if (!isEditMode) return;

  const token = getToken();

  try {
    const updatedData = {
      firstName: document.getElementById('firstName').value,
      lastName: document.getElementById('lastName').value,
      phone: document.getElementById('phone').value || null,
      companyName: document.getElementById('companyName').value || null,
      address: {
        street: document.getElementById('addressStreet').value || null,
        city: document.getElementById('addressCity').value || null,
        postalCode: document.getElementById('addressPostalCode').value || null,
        country: document.getElementById('addressCountry').value || null
      },
      bio: document.getElementById('bio').value || null
    };

    const response = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erreur lors de la sauvegarde');
    }

    const userData = await response.json();
    currentUser = userData;

    // Mettre à jour les données affichées
    fillProfileData(userData);

    // Désactiver le mode édition
    isEditMode = false;
    const inputs = document.querySelectorAll('#profileForm .form-input, #profileForm .form-textarea');
    inputs.forEach(input => {
      input.disabled = true;
    });

    document.getElementById('editBtn').classList.remove('hidden');
    document.getElementById('cancelBtn').classList.add('hidden');
    document.getElementById('saveBtn').classList.add('hidden');

    // Mettre à jour la navbar
    createAuthNavbar(userData);

    showToast('Profil mis à jour avec succès !', 'success');

  } catch (error) {
    console.error('Erreur:', error);
    showToast(error.message || 'Erreur lors de la sauvegarde', 'error');
  }
}

// Uploader une nouvelle photo de profil
async function uploadAvatar(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Vérifier le type de fichier
  if (!file.type.startsWith('image/')) {
    showToast('Veuillez sélectionner une image', 'error');
    return;
  }

  // Vérifier la taille (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showToast('L\'image ne doit pas dépasser 5MB', 'error');
    return;
  }

  const token = getToken();

  try {
    showToast('Upload en cours...', 'info');

    // Upload de l'image
    const formData = new FormData();
    formData.append('profileImage', file);

    const uploadResponse = await fetch('/api/uploads/profile-image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error('Erreur lors de l\'upload de l\'image');
    }

    const uploadData = await uploadResponse.json();
    const imageUrl = uploadData.profileImage;

    // Mettre à jour le profil avec la nouvelle image
    const updateResponse = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ profileImage: imageUrl })
    });

    if (!updateResponse.ok) {
      throw new Error('Erreur lors de la mise à jour du profil');
    }

    const userData = await updateResponse.json();
    currentUser = userData;

    // Mettre à jour l'affichage
    document.getElementById('profileAvatar').src = imageUrl;

    // Mettre à jour la navbar
    createAuthNavbar(userData);

    showToast('Photo de profil mise à jour !', 'success');

  } catch (error) {
    console.error('Erreur:', error);
    showToast(error.message || 'Erreur lors de l\'upload', 'error');
  }

  // Réinitialiser l'input
  e.target.value = '';
}

// Changer le mot de passe
async function changePassword(e) {
  e.preventDefault();

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // Vérifications
  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast('Veuillez remplir tous les champs', 'error');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('Les mots de passe ne correspondent pas', 'error');
    return;
  }

  if (newPassword.length < 6) {
    showToast('Le mot de passe doit contenir au moins 6 caractères', 'error');
    return;
  }

  const token = getToken();

  try {
    const response = await fetch('/api/users/change-password', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erreur lors du changement de mot de passe');
    }

    // Réinitialiser le formulaire
    document.getElementById('passwordForm').reset();

    showToast('Mot de passe changé avec succès !', 'success');

  } catch (error) {
    console.error('Erreur:', error);
    showToast(error.message || 'Erreur lors du changement de mot de passe', 'error');
  }
}
