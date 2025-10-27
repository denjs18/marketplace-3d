/**
 * Middleware de filtrage anti-contournement
 * Détecte et masque automatiquement les coordonnées personnelles dans les messages
 */

// Patterns de détection
const PATTERNS = {
  // Numéros de téléphone français et internationaux
  phone: [
    /(\+33|0033|0)\s?[1-9](\s?\d{2}){4}/g, // Format français
    /(\+\d{1,3}\s?)?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g, // International
    /\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}/g // 06 12 34 56 78
  ],

  // Adresses email
  email: [
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi
  ],

  // URLs et liens web
  url: [
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
    /www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/gi,
    /[a-zA-Z0-9-]+\.(com|fr|net|org|io|co|eu|be|ch|ca|uk)/gi
  ],

  // Réseaux sociaux et messageries
  social: [
    /whatsapp/gi,
    /telegram/gi,
    /instagram/gi,
    /facebook/gi,
    /messenger/gi,
    /snapchat/gi,
    /tiktok/gi,
    /discord/gi,
    /skype/gi,
    /@[a-zA-Z0-9_]{3,}/g // Mentions type @username
  ],

  // Adresses postales
  address: [
    /\d{5}\s+[a-zA-Z\s-]+/g, // Code postal + ville
    /(rue|avenue|av\.|boulevard|bd|impasse|place|chemin|allée)\s+[a-zA-Z0-9\s]+/gi
  ],

  // Expressions de contournement
  keyword: [
    /envoie[-\s]?moi\s+(ton|votre)\s+(num[ée]ro|t[ée]l[ée]phone|mail|email)/gi,
    /contacte[-\s]?moi\s+(ailleurs|en\s+priv[ée]|hors\s+plateforme)/gi,
    /appelle[-\s]?moi/gi,
    /(mon|mon)\s+(num[ée]ro|t[ée]l[ée]phone|mail|email)\s+(est|c'est)/gi,
    /discussion\s+en\s+dehors/gi,
    /hors\s+de\s+la\s+plateforme/gi
  ]
};

/**
 * Filtre le contenu d'un message
 * @param {String} content - Le contenu original du message
 * @returns {Object} { contentFiltered, contentBlocked, blockedElements }
 */
function filterContent(content) {
  if (!content) {
    return {
      contentFiltered: content,
      contentBlocked: false,
      blockedElements: []
    };
  }

  let filtered = content;
  const blockedElements = [];

  // Parcourir tous les patterns
  for (const [type, patterns] of Object.entries(PATTERNS)) {
    patterns.forEach(pattern => {
      const matches = content.match(pattern);

      if (matches && matches.length > 0) {
        matches.forEach(match => {
          // Enregistrer l'élément bloqué
          blockedElements.push({
            type: type,
            value: match
          });

          // Remplacer dans le contenu filtré
          filtered = filtered.replace(match, '[⚠️ CONTENU MASQUÉ]');
        });
      }
    });
  }

  return {
    contentFiltered: filtered,
    contentBlocked: blockedElements.length > 0,
    blockedElements: blockedElements
  };
}

/**
 * Middleware Express pour filtrer les messages
 * Applique le filtrage sur req.body.content
 */
const contentFilterMiddleware = (req, res, next) => {
  if (req.body && req.body.content) {
    const { contentFiltered, contentBlocked, blockedElements } = filterContent(req.body.content);

    // Ajouter les données filtrées au body
    req.body.contentFiltered = contentFiltered;
    req.body.contentBlocked = contentBlocked;
    req.body.blockedElements = blockedElements;

    // Avertir l'utilisateur si du contenu a été bloqué
    if (contentBlocked) {
      req.contentWarning = {
        message: 'Certaines informations personnelles ont été masquées pour votre sécurité',
        blockedCount: blockedElements.length
      };
    }
  }

  next();
};

/**
 * Détecte si un message contient des tentatives de contournement
 * @param {String} content - Le contenu à analyser
 * @returns {Boolean}
 */
function detectBypassAttempt(content) {
  if (!content) return false;

  const { contentBlocked } = filterContent(content);
  return contentBlocked;
}

/**
 * Analyse le niveau de risque d'un message
 * @param {String} content - Le contenu à analyser
 * @returns {Object} { risk: 'low'|'medium'|'high', reasons: [] }
 */
function analyzeRiskLevel(content) {
  if (!content) {
    return { risk: 'low', reasons: [] };
  }

  const { blockedElements } = filterContent(content);
  const reasons = [];

  // Compter par type
  const typeCount = {};
  blockedElements.forEach(el => {
    typeCount[el.type] = (typeCount[el.type] || 0) + 1;
  });

  // Déterminer le niveau de risque
  let risk = 'low';

  if (typeCount.phone || typeCount.email) {
    risk = 'high';
    reasons.push('Coordonnées personnelles détectées');
  }

  if (typeCount.social) {
    risk = 'high';
    reasons.push('Mention de réseaux sociaux');
  }

  if (typeCount.keyword) {
    risk = 'high';
    reasons.push('Tentative de contournement explicite');
  }

  if (typeCount.url) {
    risk = risk === 'high' ? 'high' : 'medium';
    reasons.push('Liens externes détectés');
  }

  if (typeCount.address) {
    risk = risk === 'high' ? 'high' : 'medium';
    reasons.push('Adresse postale détectée');
  }

  return { risk, reasons };
}

/**
 * Génère un message d'avertissement personnalisé selon les éléments bloqués
 * @param {Array} blockedElements - Liste des éléments bloqués
 * @returns {String}
 */
function generateWarningMessage(blockedElements) {
  if (!blockedElements || blockedElements.length === 0) {
    return null;
  }

  const types = [...new Set(blockedElements.map(el => el.type))];
  const warnings = [];

  if (types.includes('phone')) {
    warnings.push('numéros de téléphone');
  }
  if (types.includes('email')) {
    warnings.push('adresses email');
  }
  if (types.includes('social')) {
    warnings.push('réseaux sociaux');
  }
  if (types.includes('url')) {
    warnings.push('liens web');
  }
  if (types.includes('address')) {
    warnings.push('adresses postales');
  }
  if (types.includes('keyword')) {
    warnings.push('tentatives de contact hors plateforme');
  }

  return `Pour votre sécurité et la conformité de la plateforme, les éléments suivants ont été masqués : ${warnings.join(', ')}. Tous les échanges doivent se faire via la messagerie sécurisée.`;
}

module.exports = {
  filterContent,
  contentFilterMiddleware,
  detectBypassAttempt,
  analyzeRiskLevel,
  generateWarningMessage,
  PATTERNS
};
