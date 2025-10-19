# Marketplace 3D

Plateforme marketplace complète pour l'impression 3D, connectant clients et imprimeurs 3D. Les clients peuvent télécharger leurs fichiers STL et recevoir des devis d'imprimeurs qualifiés, tandis que les imprimeurs peuvent proposer leurs services et gérer leurs projets.

## Fonctionnalités

### Pour les Clients
- Inscription et connexion sécurisée
- Upload de fichiers STL avec spécifications détaillées
- Réception de devis multiples d'imprimeurs qualifiés
- Messagerie en temps réel avec les imprimeurs
- Paiement sécurisé via Stripe
- Suivi des projets en temps réel
- Historique des commandes

### Pour les Imprimeurs
- Création de profil avec capacités d'impression
- Navigation des projets disponibles
- Soumission de devis personnalisés
- Messagerie avec les clients
- Gestion des projets acceptés
- Réception automatique des paiements (après commission de 10%)
- Dashboard de revenus et statistiques

### Fonctionnalités Techniques
- Authentification JWT sécurisée
- Upload et visualisation de fichiers STL
- Messagerie temps réel avec Socket.IO
- Paiements via Stripe avec système de commission
- Notifications par email
- API RESTful complète
- Design responsive

## Technologies Utilisées

### Backend
- **Node.js** avec **Express.js**
- **MongoDB** avec Mongoose
- **JWT** pour l'authentification
- **Stripe** pour les paiements
- **Socket.IO** pour la messagerie temps réel
- **Multer** pour l'upload de fichiers
- **Vercel Blob** pour le stockage cloud des fichiers
- **Nodemailer** pour les emails
- **Bcrypt** pour le hashing de mots de passe

### Frontend
- HTML5, CSS3, JavaScript (Vanilla)
- **Three.js** pour la visualisation STL
- **Socket.IO Client** pour la messagerie temps réel
- Design moderne et responsive

## Installation

### Prérequis
- Node.js (v16 ou supérieur)
- MongoDB (v5 ou supérieur)
- Compte Stripe (pour les paiements)
- Compte SMTP (Gmail recommandé pour les emails)

### Étapes d'Installation

1. **Cloner le projet**
```bash
git clone <repository-url>
cd marketplace-3d
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configuration de l'environnement**

Copier le fichier `.env.example` vers `.env`:
```bash
cp .env.example .env
```

Modifier le fichier `.env` avec vos informations:
```env
# Server
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/marketplace-3d

# JWT
JWT_SECRET=votre-cle-secrete-tres-longue-et-complexe
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d

# Stripe
STRIPE_SECRET_KEY=sk_test_votre_cle_stripe
STRIPE_PUBLISHABLE_KEY=pk_test_votre_cle_stripe

# Email (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-application
APP_NAME=Marketplace 3D
```

4. **Démarrer MongoDB**
```bash
# Sur Windows
net start MongoDB

# Sur macOS avec Homebrew
brew services start mongodb-community

# Sur Linux
sudo systemctl start mongod
```

5. **Configuration du stockage de fichiers**

**Pour le développement local (optionnel):**
Les fichiers sont maintenant stockés sur Vercel Blob. Pour le développement local, vous pouvez:
- Utiliser Vercel Blob en local en configurant `BLOB_READ_WRITE_TOKEN`
- Ou ignorer cette étape si vous n'avez pas besoin de tester l'upload de fichiers

**Pour le déploiement sur Vercel:**
Le stockage Vercel Blob est configuré automatiquement. Voir la section Déploiement ci-dessous.

6. **Démarrer le serveur**

Mode développement (avec nodemon):
```bash
npm run dev
```

Mode production:
```bash
npm start
```

Le serveur sera accessible sur `http://localhost:3000`

## Configuration Stripe

1. Créer un compte sur [Stripe](https://stripe.com)
2. Récupérer les clés API (mode test pour le développement)
3. Configurer les webhooks Stripe pour les événements de paiement
4. URL webhook: `http://votre-domaine.com/api/payments/webhook`

## Configuration Email (Gmail)

1. Activer l'authentification à deux facteurs sur votre compte Gmail
2. Générer un mot de passe d'application:
   - Aller dans Paramètres Google > Sécurité
   - Mots de passe d'application
   - Sélectionner "Autre" et nommer "Marketplace 3D"
3. Utiliser ce mot de passe dans `.env` comme `SMTP_PASS`

## Structure du Projet

```
marketplace-3d/
├── config/                 # Configuration (database, auth, stripe)
│   ├── auth.js
│   ├── database.js
│   └── stripe.js
├── controllers/            # Logique métier
│   ├── authController.js
│   ├── projectController.js
│   ├── quoteController.js
│   ├── messageController.js
│   └── paymentController.js
├── middleware/             # Middlewares Express
│   ├── auth.js
│   ├── upload.js
│   └── validation.js
├── models/                 # Modèles Mongoose
│   ├── User.js
│   ├── Project.js
│   ├── Quote.js
│   ├── Message.js
│   └── Transaction.js
├── routes/                 # Routes API
│   ├── auth.js
│   ├── users.js
│   ├── projects.js
│   ├── quotes.js
│   ├── messages.js
│   ├── payments.js
│   └── uploads.js
├── utils/                  # Utilitaires
│   ├── email.js
│   └── calculateCommission.js
├── public/                 # Frontend statique
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── app.js
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── stl-viewer.js
│   │   └── messages.js
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── dashboard-client.html
│   ├── dashboard-printer.html
│   ├── project-details.html
│   ├── messages.html
│   └── profile.html
├── server.js               # Point d'entrée
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/profile` - Profil utilisateur
- `POST /api/auth/logout` - Déconnexion
- `POST /api/auth/refresh` - Rafraîchir le token

### Projets
- `POST /api/projects` - Créer un projet (Client)
- `GET /api/projects` - Liste des projets
- `GET /api/projects/:id` - Détails d'un projet
- `PUT /api/projects/:id` - Modifier un projet
- `DELETE /api/projects/:id` - Supprimer un projet
- `POST /api/projects/:id/complete` - Marquer comme terminé
- `POST /api/projects/:id/cancel` - Annuler un projet

### Devis
- `POST /api/quotes` - Créer un devis (Imprimeur)
- `GET /api/quotes/project/:projectId` - Devis d'un projet
- `GET /api/quotes/my-quotes` - Mes devis (Imprimeur)
- `POST /api/quotes/:quoteId/accept` - Accepter un devis (Client)
- `POST /api/quotes/:quoteId/reject` - Refuser un devis (Client)

### Messages
- `POST /api/messages` - Envoyer un message
- `GET /api/messages/conversations` - Liste des conversations
- `GET /api/messages/conversation/:userId` - Conversation avec un utilisateur
- `GET /api/messages/unread-count` - Nombre de messages non lus
- `POST /api/messages/:messageId/read` - Marquer comme lu

### Paiements
- `POST /api/payments/create-intent` - Créer intention de paiement
- `POST /api/payments/confirm` - Confirmer le paiement
- `POST /api/payments/payout` - Traiter le paiement imprimeur
- `GET /api/payments/transactions` - Historique des transactions
- `GET /api/payments/earnings` - Résumé des gains (Imprimeur)

### Utilisateurs
- `GET /api/users/:id` - Profil utilisateur
- `PUT /api/users/profile` - Mettre à jour le profil
- `POST /api/users/profile-image` - Upload photo de profil
- `GET /api/users/printers/search` - Rechercher des imprimeurs

## Utilisation

### Inscription

1. Aller sur `http://localhost:3000/register.html`
2. Choisir le type de compte (Client ou Imprimeur)
3. Remplir le formulaire d'inscription
4. Recevoir un email de bienvenue

### Workflow Client

1. **Connexion** sur `/login.html`
2. **Créer un projet** sur `/dashboard-client.html`
   - Upload fichier STL
   - Spécifier matériau, quantité, délai
   - Définir budget (optionnel)
3. **Recevoir des devis** d'imprimeurs
4. **Comparer et accepter** un devis
5. **Effectuer le paiement** via Stripe
6. **Suivre le projet** et communiquer avec l'imprimeur
7. **Confirmer la réception** une fois terminé

### Workflow Imprimeur

1. **Connexion** sur `/login.html`
2. **Compléter le profil** avec capacités d'impression
3. **Parcourir les projets** disponibles sur `/dashboard-printer.html`
4. **Soumettre des devis** personnalisés
5. **Attendre l'acceptation** du client
6. **Recevoir le paiement** et commencer le travail
7. **Communiquer** avec le client via la messagerie
8. **Marquer comme terminé** une fois livré
9. **Recevoir le paiement** (90% du montant total)

## Système de Commission

- Commission plateforme: **10%** de chaque transaction
- L'imprimeur reçoit: **90%** du montant payé par le client
- Exemple: Client paie 100€ → Imprimeur reçoit 90€, Plateforme garde 10€

## Sécurité

- Authentification JWT avec tokens d'accès et de rafraîchissement
- Hashing des mots de passe avec bcrypt
- Validation des données côté serveur
- Protection contre les injections
- CORS configuré
- Helmet.js pour la sécurité HTTP
- Upload de fichiers sécurisé avec validation
- Paiements sécurisés via Stripe

## Développement

### Scripts Disponibles

```bash
npm start      # Démarrer en production
npm run dev    # Démarrer en développement (nodemon)
```

### Variables d'Environnement Importantes

- `NODE_ENV`: Mode d'exécution (development/production)
- `PORT`: Port du serveur (défaut: 3000)
- `MONGODB_URI`: URI de connexion MongoDB
- `JWT_SECRET`: Clé secrète JWT (IMPORTANT: Changer en production!)
- `STRIPE_SECRET_KEY`: Clé secrète Stripe

## Déploiement

### Déploiement sur Vercel (Recommandé)

Pour un guide complet et détaillé du déploiement sur Vercel, consultez **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

Ce guide inclut:
- Configuration de MongoDB Atlas (gratuit)
- Configuration de Stripe (mode test et live)
- Configuration SMTP (Gmail, SendGrid, etc.)
- Déploiement pas à pas sur Vercel
- Configuration des variables d'environnement
- Vérification post-déploiement
- Dépannage des problèmes courants

#### Configuration de Vercel Blob Storage

L'application utilise Vercel Blob pour le stockage des fichiers uploadés (STL, images). Configuration:

1. **Créer un Blob Store sur Vercel:**
   - Aller sur votre [Dashboard Vercel](https://vercel.com/dashboard)
   - Sélectionner votre projet
   - Aller dans **Storage** > **Create Database** > **Blob**
   - Nommer votre store (ex: "marketplace-3d-files")
   - Cliquer sur **Create**

2. **Configuration automatique:**
   - Vercel configure automatiquement la variable `BLOB_READ_WRITE_TOKEN`
   - Cette variable est injectée dans votre environnement de production

3. **Pour le développement local:**
   - Copier le token depuis votre dashboard Vercel
   - Ajouter `BLOB_READ_WRITE_TOKEN=votre_token` dans votre fichier `.env`

**Note:** Les fichiers uploadés sont maintenant stockés dans le cloud Vercel Blob au lieu du système de fichiers local, ce qui permet une meilleure scalabilité et compatibilité avec les serverless functions.

### Déploiement sur d'autres plateformes

#### Prérequis Production

1. MongoDB Atlas ou serveur MongoDB
2. Serveur Node.js (Heroku, DigitalOcean, AWS, etc.)
3. Compte Stripe en mode live
4. Nom de domaine et certificat SSL

#### Étapes Générales

1. Configurer les variables d'environnement de production
2. Utiliser une base MongoDB sécurisée (MongoDB Atlas recommandé)
3. Configurer Stripe en mode live
4. Activer HTTPS
5. Configurer les webhooks Stripe avec l'URL de production
6. Déployer le code

```bash
# Exemple pour Heroku
heroku create marketplace-3d
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=<votre-uri-mongodb>
# ... autres variables
git push heroku main
```

## Dépannage

### Problème de connexion MongoDB
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution**: Vérifier que MongoDB est démarré

### Erreur d'upload de fichier
```
Error: File size too large
```
**Solution**: Vérifier les limites dans `middleware/upload.js`

### Erreur Vercel Blob
```
Error: Failed to upload file to storage
```
**Solution**:
- Vérifier que `BLOB_READ_WRITE_TOKEN` est défini dans les variables d'environnement
- Vérifier que le Blob store est créé sur Vercel
- S'assurer que le token a les permissions de lecture/écriture

### Erreur Stripe
```
Error: No API key provided
```
**Solution**: Vérifier que `STRIPE_SECRET_KEY` est défini dans `.env`

### Erreur d'envoi d'email
```
Error: Invalid login
```
**Solution**: Utiliser un mot de passe d'application Gmail

## Support

Pour toute question ou problème:
- Ouvrir une issue sur GitHub
- Consulter la documentation des dépendances
- Vérifier les logs du serveur

## Licence

ISC

## Auteur

Marketplace 3D Development Team

---

**Note**: Cette application est un projet de démonstration. Pour une utilisation en production, assurez-vous de:
- Utiliser des clés secrètes fortes et uniques
- Configurer correctement la sécurité
- Effectuer des tests approfondis
- Respecter les réglementations (RGPD, etc.)
- Mettre en place une sauvegarde régulière des données
