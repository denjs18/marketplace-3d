/**
 * Avatar Utilities - Gestion des avatars avec fallback première lettre
 */

/**
 * Génère une couleur de fond basée sur le nom d'utilisateur
 * @param {string} name - Nom de l'utilisateur
 * @returns {string} Code couleur hexadécimal
 */
function getAvatarColor(name) {
  const colors = [
    '#40826D', // Vert principal
    '#0984e3', // Bleu
    '#6c5ce7', // Violet
    '#e84393', // Rose
    '#00b894', // Turquoise
    '#fd79a8', // Rose clair
    '#fdcb6e', // Jaune
    '#e17055', // Orange
    '#0070c7', // Bleu foncé
    '#2f6152'  // Vert foncé
  ];

  // Générer un index basé sur le nom
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

/**
 * Obtient la première lettre du nom d'utilisateur
 * @param {string} firstName - Prénom
 * @param {string} lastName - Nom
 * @param {string} email - Email (fallback)
 * @returns {string} Première lettre en majuscule
 */
function getInitial(firstName, lastName, email) {
  if (firstName && firstName.length > 0) {
    return firstName.charAt(0).toUpperCase();
  }
  if (lastName && lastName.length > 0) {
    return lastName.charAt(0).toUpperCase();
  }
  if (email && email.length > 0) {
    return email.charAt(0).toUpperCase();
  }
  return '?';
}

/**
 * Crée un SVG d'avatar avec la première lettre
 * @param {string} initial - Lettre à afficher
 * @param {string} color - Couleur de fond
 * @param {number} size - Taille en pixels (default: 150)
 * @returns {string} Data URL SVG
 */
function createAvatarSVG(initial, color, size = 150) {
  const fontSize = size * 0.45; // 45% de la taille

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${color}"/>
      <text
        x="50%"
        y="50%"
        font-family="Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="600"
        fill="white"
        text-anchor="middle"
        dominant-baseline="central"
      >${initial}</text>
    </svg>
  `.trim();

  return 'data:image/svg+xml;base64,' + btoa(svg);
}

/**
 * Obtient l'URL de l'avatar (image ou SVG fallback)
 * @param {object} user - Objet utilisateur
 * @param {number} size - Taille de l'avatar (default: 150)
 * @returns {string} URL de l'image ou data URL SVG
 */
function getAvatarUrl(user, size = 150) {
  // Si l'utilisateur a une image de profil, l'utiliser
  if (user && user.profileImage) {
    return user.profileImage;
  }

  // Sinon, créer un avatar avec la première lettre
  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  const email = user?.email || '';
  const fullName = `${firstName} ${lastName}`.trim() || email;

  const initial = getInitial(firstName, lastName, email);
  const color = getAvatarColor(fullName);

  return createAvatarSVG(initial, color, size);
}

/**
 * Définit l'avatar d'un élément img
 * @param {HTMLImageElement} imgElement - Élément <img>
 * @param {object} user - Objet utilisateur
 * @param {number} size - Taille de l'avatar (default: 150)
 */
function setAvatar(imgElement, user, size = 150) {
  if (!imgElement) return;

  const avatarUrl = getAvatarUrl(user, size);
  imgElement.src = avatarUrl;

  // Ajouter un alt text approprié
  const userName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.email || 'Utilisateur';
  imgElement.alt = userName;
}

/**
 * Crée un élément avatar complet (avec fallback automatique)
 * @param {object} user - Objet utilisateur
 * @param {string} className - Classes CSS à appliquer
 * @param {number} size - Taille de l'avatar (default: 150)
 * @returns {HTMLImageElement} Élément img configuré
 */
function createAvatarElement(user, className = 'avatar', size = 150) {
  const img = document.createElement('img');
  img.className = className;
  setAvatar(img, user, size);
  return img;
}
