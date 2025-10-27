# Guide d'implémentation du système de messagerie sécurisée

## ⚠️ STATUT: Implémentation partielle réalisée

Les fichiers suivants ont été créés:
- ✅ `models/Conversation.js` - Modèle complet avec 14 statuts et workflow
- ✅ `models/Message.js` - Modèle avec filtrage et types de messages
- ✅ `middleware/contentFilter.js` - Filtrage anti-coordonnées

## 📝 MODIFICATIONS REQUISES DES MODÈLES EXISTANTS

### 1. Modifications de `models/Project.js`

Ajouter ces champs au schéma existant:

```javascript
// Statut granulaire du projet
projectStatus: {
  type: String,
  enum: ['draft', 'published', 'in_negotiation', 'quote_received', 'quote_accepted',
         'contracted', 'in_production', 'completed', 'cancelled', 'paused'],
  default: 'draft'
},

// Multi-devis
selectedPrinterId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User'
},
selectedConversationId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Conversation'
},
maxPrintersInvited: {
  type: Number,
  default: 5,
  max: 5
},
invitedPrinters: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User'
}],
refusedPrinters: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User'
}],
refusalCount: {
  type: Number,
  default: 0
},

// Complexité
difficulty: {
  type: Number,
  min: 1,
  max: 5,
  default: 3
},
requiresSample: {
  type: Boolean,
  default: false
},

// Gestion
pausedAt: Date,
archivedAt: Date
```

### 2. Modifications de `models/User.js`

Ajouter ces champs au schéma existant:

```javascript
// Profil imprimeur étendu (dans printerCapabilities ou nouveau sous-document)
printerProfile: {
  bio: {
    type: String,
    maxlength: 500
  },
  specialties: [String], // ['prototypage', 'pièces techniques', 'figurines'...]
  maxDifficulty: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  availabilityStatus: {
    type: String,
    enum: ['available', 'busy', 'unavailable'],
    default: 'available'
  },
  averageResponseTime: {
    type: Number, // en minutes
    default: 0
  },
  responseRate: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  completionRate: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  cancellationRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  reliabilityScore: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  totalProjects: {
    type: Number,
    default: 0
  },
  activeProjects: {
    type: Number,
    default: 0
  },
  favoriteClients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  badges: [String] // ['top_imprimeur', 'reactif', 'fiable'...]
},

// Profil client
clientProfile: {
  refusalRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  cancellationRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  reliabilityScore: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  favoritePrinters: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
},

// Alertes et sanctions
warningFlags: [String], // ['cancellations_frequentes', 'non_reponse'...]
suspendedUntil: Date,
suspensionReason: String
```

## 🛣️ ROUTES À CRÉER

### Fichier `routes/conversations.js` (COMPLET - 900+ lignes)

Créer ce fichier avec toutes les routes suivantes:
- POST /api/conversations/start
- GET /api/conversations/my-conversations
- GET /api/conversations/:id
- GET /api/conversations/:id/messages
- POST /api/conversations/:id/messages
- POST /api/conversations/:id/send-quote
- POST /api/conversations/:id/counter-quote
- POST /api/conversations/:id/accept-quote
- POST /api/conversations/:id/sign
- POST /api/conversations/:id/cancel
- POST /api/conversations/:id/refuse
- POST /api/conversations/:id/withdraw
- POST /api/conversations/:id/pause
- POST /api/conversations/:id/resume
- POST /api/conversations/:id/update-status
- POST /api/conversations/:id/request-mediation
- POST /api/conversations/:id/report
- POST /api/conversations/:id/favorite
- DELETE /api/conversations/:id/favorite

### Ajouts à `routes/projects.js`

```javascript
// Invitation multi-imprimeurs
router.post('/:id/invite-printers', authenticate, isClient, async (req, res) => {
  const { printerIds } = req.body; // Array de max 5 IDs
  // Créer une conversation pour chaque imprimeur invité
  // Limiter à 5 invitations simultanées
});

// Récupérer tous les devis
router.get('/:id/quotes', authenticate, async (req, res) => {
  // Récupérer toutes les conversations avec devis pour ce projet
});

// Comparer les devis
router.get('/:id/compare-quotes', authenticate, isClient, async (req, res) => {
  // Générer tableau comparatif avec analyse
});

// Dupliquer un projet
router.post('/:id/duplicate', authenticate, isClient, async (req, res) => {
  // Créer nouveau projet avec même specs
});
```

## 📧 SYSTÈME DE NOTIFICATIONS

Créer `utils/emailNotifications.js`:

```javascript
const nodemailer = require('nodemailer');

// Configuration SMTP (utiliser variables d'environnement)
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendNewMessageNotification(user, conversation) {
  // Email: Nouveau message reçu
}

async function sendQuoteNotification(user, conversation, quote) {
  // Email: Nouveau devis reçu
}

async function sendQuoteAcceptedNotification(user, conversation) {
  // Email: Votre devis a été accepté
}

async function sendContractSignedNotification(user, conversation) {
  // Email: Contrat signé par les deux parties
}

async function sendCancellationNotification(user, conversation, reason) {
  // Email: Conversation annulée
}

async function sendInactivityReminder(user, conversation) {
  // Email: Relance après 48h d'inactivité
}

async function sendMediationRequest(admins, conversation, reason) {
  // Email aux admins: Demande de médiation
}

module.exports = {
  sendNewMessageNotification,
  sendQuoteNotification,
  sendQuoteAcceptedNotification,
  sendContractSignedNotification,
  sendCancellationNotification,
  sendInactivityReminder,
  sendMediationRequest
};
```

## ⏰ TÂCHES CRON

Créer `cron/conversationTasks.js`:

```javascript
const cron = require('node-cron');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

// Quotidien à 2h: Archivage et relances
cron.schedule('0 2 * * *', async () => {
  // Archiver conversations en pause expirées
  // Envoyer relances pour conversations inactives (>48h)
});

// Hebdomadaire dimanche 3h: Calcul scores et badges
cron.schedule('0 3 * * 0', async () => {
  // Calculer reliabilityScore pour tous les utilisateurs
  // Attribuer/retirer badges automatiques
  // Envoyer avertissements si scores faibles
});

// Formules de calcul
function calculateReliabilityScore(user) {
  const completionWeight = 0.5;
  const responseWeight = 0.3;
  const cancellationWeight = 0.2;

  return (
    user.completionRate * completionWeight +
    user.responseRate * responseWeight +
    (100 - user.cancellationRate) * cancellationWeight
  );
}
```

## 🎨 FRONTEND (STRUCTURE)

### Page `public/conversation.html`

Structure HTML avec 3 zones:
- Sidebar gauche: Détails projet + timeline
- Zone centrale: Messages + input
- Panneau droit: Devis en cours

Bannière anti-fraude en haut:
```html
<div class="anti-fraud-banner" style="background: #dc3545; color: white; padding: 10px;">
  ⚠️ RAPPEL SÉCURITÉ: Ne partagez JAMAIS vos coordonnées personnelles (téléphone, email, adresse).
  Toute transaction hors plateforme vous fait perdre la protection de la garantie.
</div>
```

### Script `public/js/conversation.js`

```javascript
// Polling toutes les 5 secondes
let lastMessageId = null;
setInterval(async () => {
  const newMessages = await fetch(`/api/conversations/${conversationId}/messages?since=${lastMessageId}`);
  // Afficher nouveaux messages
}, 5000);

// Upload fichier vers Vercel Blob
async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  return response.json();
}
```

### Page `public/compare-quotes.html`

Tableau comparatif avec badges:
- 🏆 Meilleur prix
- ⚡ Plus rapide
- ⭐ Mieux noté
- ✅ Plus fiable

## 🔧 CONFIGURATION NÉCESSAIRE

### Variables d'environnement

Ajouter à `.env`:
```
VERCEL_BLOB_READ_WRITE_TOKEN=your_token_here
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email@domain.com
SMTP_PASS=your_app_password
```

### Package dependencies

Installer:
```bash
npm install @vercel/blob node-cron nodemailer
```

### Configuration Vercel

Pour les CRON jobs, utiliser:
- Vercel Cron (fichier `vercel.json`)
- OU service externe comme cron-job.org

## 📊 TESTS À EFFECTUER

1. ✅ Créer conversation client → imprimeur
2. ✅ Envoyer message avec téléphone → vérifier masquage
3. ✅ Envoyer devis → négocier → accepter
4. ✅ Signer contrat (les 2 parties)
5. ✅ Annuler avant signature
6. ✅ Mettre en pause → vérifier expiration
7. ✅ Upload fichier → vérifier stockage
8. ✅ Polling: ouvrir 2 navigateurs, vérifier réception temps réel
9. ✅ Inviter 3 imprimeurs → comparer devis
10. ✅ Demander médiation

## 🚀 DÉPLOIEMENT

Le code actuel inclut:
- ✅ Modèle Conversation complet
- ✅ Modèle Message complet
- ✅ Middleware contentFilter

Restent à implémenter:
- ⏳ Routes complètes (conversatio ns.js, ~900 lignes)
- ⏳ Modifications modèles existants
- ⏳ Système notifications email
- ⏳ Tâches CRON
- ⏳ Pages frontend
- ⏳ Intégration Vercel Blob

**Estimation temps restant:** 4-6 heures de développement

## 📞 SUPPORT

Pour questions ou assistance:
- Consulter documentation Vercel Blob: https://vercel.com/docs/storage/vercel-blob
- Documentation node-cron: https://www.npmjs.com/package/node-cron
- Documentation nodemailer: https://nodemailer.com/

---
**Note:** Ce système est conçu pour être 100% conforme DAC7 avec conservation des messages pendant 10 ans minimum.
