# Guide de déploiement sur Vercel

Ce guide vous accompagne pas à pas pour déployer votre marketplace 3D sur Vercel.

## 📋 Prérequis

Avant de commencer le déploiement, vous devez configurer les services externes suivants :

- [ ] Compte MongoDB Atlas (gratuit)
- [ ] Compte Stripe (gratuit en mode test)
- [ ] Service SMTP pour les emails (Gmail gratuit ou SendGrid)
- [ ] Compte Vercel (gratuit)
- [ ] Git installé localement

## 🚀 Étape 1 : Configuration de MongoDB Atlas

MongoDB Atlas est requis pour la base de données en production.

1. **Créer un compte MongoDB Atlas**
   - Accédez à https://www.mongodb.com/cloud/atlas
   - Cliquez sur "Try Free" et créez un compte

2. **Créer un cluster gratuit (M0)**
   - Après connexion, cliquez sur "Create a Cluster"
   - Sélectionnez le plan **M0 Sandbox** (gratuit)
   - Choisissez un provider cloud et une région proche de vous
   - Nom du cluster : `marketplace-3d` (ou autre)
   - Cliquez sur "Create Cluster" (prend 1-3 minutes)

3. **Créer un utilisateur de base de données**
   - Dans le menu de gauche, cliquez sur "Database Access"
   - Cliquez sur "Add New Database User"
   - Méthode : Password
   - Nom d'utilisateur : `marketplace-admin` (notez-le)
   - Générez un mot de passe sécurisé (notez-le)
   - Database User Privileges : "Atlas admin"
   - Cliquez sur "Add User"

4. **Autoriser les connexions Vercel**
   - Dans le menu de gauche, cliquez sur "Network Access"
   - Cliquez sur "Add IP Address"
   - Sélectionnez "Allow Access from Anywhere" (0.0.0.0/0)
   - ⚠️ Obligatoire pour Vercel car les IPs sont dynamiques
   - Cliquez sur "Confirm"

5. **Obtenir la connection string**
   - Retournez à "Database" dans le menu
   - Cliquez sur "Connect" sur votre cluster
   - Sélectionnez "Connect your application"
   - Driver : Node.js, Version : 4.1 or later
   - Copiez la connection string qui ressemble à :
     ```
     mongodb+srv://marketplace-admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```
   - Remplacez `<password>` par le mot de passe créé à l'étape 3
   - Ajoutez le nom de la base après `.net/` :
     ```
     mongodb+srv://marketplace-admin:VotreMotDePasse@cluster0.xxxxx.mongodb.net/marketplace-3d?retryWrites=true&w=majority
     ```
   - **Sauvegardez cette string**, vous en aurez besoin pour Vercel

## 💳 Étape 2 : Configuration de Stripe

Stripe gère les paiements sécurisés de la plateforme.

1. **Créer un compte Stripe**
   - Accédez à https://stripe.com
   - Cliquez sur "Sign up" et créez un compte
   - Vous commencez automatiquement en **mode test**

2. **Récupérer les clés API de test**
   - Après connexion, allez dans "Developers" → "API keys"
   - Vous verrez deux clés :
     - **Publishable key** : `pk_test_...` (clé publique)
     - **Secret key** : `sk_test_...` (clé secrète)
   - Cliquez sur "Reveal test key" pour voir la clé secrète
   - **Copiez les deux clés**, vous en aurez besoin

3. **Activer Stripe Connect (pour les paiements aux imprimeurs)**
   - Dans le dashboard Stripe, allez dans "Connect" dans le menu
   - Cliquez sur "Get started"
   - Type : "Platform or marketplace"
   - Suivez les instructions pour activer Connect

4. **Passer en production (plus tard)**
   - Pour accepter de vrais paiements, vous devrez :
   - Compléter les informations de votre entreprise dans Stripe
   - Activer votre compte (vérification d'identité)
   - Utiliser les clés **live** au lieu des clés **test**

## 📧 Étape 3 : Configuration SMTP (Emails)

L'application envoie des notifications par email (nouveaux devis, paiements, etc.).

### Option A : Gmail (Gratuit, Recommandé pour débuter)

1. **Activer la validation en 2 étapes**
   - Connectez-vous à votre compte Gmail
   - Accédez à https://myaccount.google.com/security
   - Activez "Validation en deux étapes"

2. **Générer un mot de passe d'application**
   - Accédez à https://myaccount.google.com/apppasswords
   - Nom de l'application : "Marketplace 3D"
   - Cliquez sur "Générer"
   - **Copiez le mot de passe à 16 caractères** généré
   - Ce mot de passe sera utilisé dans SMTP_PASS

3. **Informations à retenir**
   - SMTP_HOST : `smtp.gmail.com`
   - SMTP_PORT : `587`
   - SMTP_USER : `votre-email@gmail.com`
   - SMTP_PASS : Le mot de passe d'application à 16 caractères
   - ⚠️ Limite : 500 emails/jour (gratuit)

### Option B : SendGrid (Recommandé pour production)

1. **Créer un compte SendGrid**
   - Accédez à https://sendgrid.com
   - Créez un compte gratuit (100 emails/jour)

2. **Créer une API Key**
   - Allez dans "Settings" → "API Keys"
   - Cliquez sur "Create API Key"
   - Nom : "Marketplace 3D"
   - Permissions : "Full Access"
   - Cliquez sur "Create & View"
   - **Copiez la clé API** (commence par `SG.`)

3. **Informations à retenir**
   - SMTP_HOST : `smtp.sendgrid.net`
   - SMTP_PORT : `587`
   - SMTP_USER : `apikey` (littéralement "apikey")
   - SMTP_PASS : Votre clé API SendGrid

## 🔐 Étape 4 : Générer une clé JWT secrète

La clé JWT sécurise les sessions utilisateur.

1. **Ouvrir un terminal/PowerShell**

2. **Exécuter la commande** (si Node.js est installé) :
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

3. **Ou utiliser un générateur en ligne** :
   - Accédez à https://www.grc.com/passwords.htm
   - Copiez la "63 random hexadecimal characters"

4. **Sauvegardez cette clé**, vous en aurez besoin

## 🌐 Étape 5 : Déploiement sur Vercel

### 5.1 Initialiser le dépôt Git (si pas déjà fait)

```bash
git init
git add .
git commit -m "Initial commit"
```

### 5.2 Pousser sur GitHub

1. **Créer un nouveau repository sur GitHub**
   - Accédez à https://github.com/new
   - Nom : `marketplace-3d`
   - Visibilité : Private (recommandé)
   - Ne pas initialiser avec README/gitignore
   - Cliquez sur "Create repository"

2. **Pousser le code local**
   ```bash
   git remote add origin https://github.com/VOTRE-USERNAME/marketplace-3d.git
   git branch -M main
   git push -u origin main
   ```

### 5.3 Déployer sur Vercel

1. **Créer un compte Vercel**
   - Accédez à https://vercel.com
   - Créez un compte (gratuit, recommandé avec GitHub)

2. **Importer le projet**
   - Cliquez sur "New Project"
   - Sélectionnez "Import Git Repository"
   - Choisissez votre repository `marketplace-3d`
   - Cliquez sur "Import"

3. **Configuration du projet**
   - Framework Preset : **Other** (pas de preset spécifique)
   - Build Command : Laisser vide ou `npm install`
   - Output Directory : Laisser vide
   - Install Command : `npm install`

4. **Configurer les variables d'environnement**

   Cliquez sur "Environment Variables" et ajoutez **TOUTES** les variables suivantes :

   | Nom de la variable | Valeur | Exemple |
   |-------------------|---------|----------|
   | `NODE_ENV` | `production` | `production` |
   | `PORT` | `3000` | `3000` |
   | `FRONTEND_URL` | Votre URL Vercel | `https://votre-app.vercel.app` |
   | `MONGODB_URI` | String MongoDB Atlas (Étape 1) | `mongodb+srv://user:pass@...` |
   | `JWT_SECRET` | Clé JWT générée (Étape 4) | `a3f8e9d2c1b0...` (128 caractères) |
   | `JWT_EXPIRE` | `7d` | `7d` |
   | `JWT_REFRESH_EXPIRE` | `30d` | `30d` |
   | `STRIPE_SECRET_KEY` | Clé secrète Stripe (Étape 2) | `sk_test_...` |
   | `STRIPE_PUBLISHABLE_KEY` | Clé publique Stripe (Étape 2) | `pk_test_...` |
   | `SMTP_HOST` | Hôte SMTP (Étape 3) | `smtp.gmail.com` |
   | `SMTP_PORT` | `587` | `587` |
   | `SMTP_USER` | Email ou username SMTP | `votre-email@gmail.com` |
   | `SMTP_PASS` | Mot de passe SMTP | `abcd efgh ijkl mnop` |
   | `APP_NAME` | `Marketplace 3D` | `Marketplace 3D` |
   | `MAX_STL_SIZE` | `52428800` | `52428800` (50 MB) |
   | `MAX_IMAGE_SIZE` | `5242880` | `5242880` (5 MB) |
   | `COMMISSION_RATE` | `0.10` | `0.10` |

   ⚠️ **Important** : Vérifiez chaque variable, une erreur bloquera l'application

5. **Déployer**
   - Cliquez sur "Deploy"
   - Attendez 2-3 minutes
   - Vercel va build et déployer automatiquement

6. **Vérifier le déploiement**
   - Une fois terminé, cliquez sur "Visit"
   - Vous devriez voir la page d'accueil
   - Testez l'inscription d'un compte

### 5.4 Mettre à jour FRONTEND_URL

⚠️ **Important** : Après le premier déploiement, vous connaissez votre URL Vercel.

1. Retournez dans Vercel → Votre projet → Settings → Environment Variables
2. Modifiez `FRONTEND_URL` avec votre vraie URL : `https://marketplace-3d-xxxxx.vercel.app`
3. Redéployez : Onglet "Deployments" → "..." → "Redeploy"

## ✅ Étape 6 : Vérification post-déploiement

### Tests à effectuer

1. **Page d'accueil** : https://votre-app.vercel.app
   - ✅ La page s'affiche correctement
   - ✅ Les boutons "Connexion" et "S'inscrire" sont visibles

2. **Inscription**
   - ✅ Créer un compte client
   - ✅ Créer un compte imprimeur
   - ✅ Vérifier que vous recevez l'email de bienvenue

3. **Connexion**
   - ✅ Se connecter avec le compte créé
   - ✅ Redirection vers le dashboard approprié

4. **Dashboard Client**
   - ✅ Créer un nouveau projet
   - ✅ Uploader un fichier STL
   - ✅ Voir la prévisualisation 3D

5. **Dashboard Imprimeur**
   - ✅ Voir les projets disponibles
   - ✅ Soumettre un devis
   - ✅ Recevoir une notification email

6. **Paiements (mode test)**
   - ✅ Accepter un devis
   - ✅ Utiliser une carte de test Stripe : `4242 4242 4242 4242`
   - ✅ Date : n'importe quelle date future
   - ✅ CVC : n'importe quel 3 chiffres

### Vérifier les logs

Si quelque chose ne fonctionne pas :

1. Allez dans Vercel → Votre projet → "Functions"
2. Cliquez sur une function récente
3. Consultez les logs pour voir les erreurs

Erreurs communes :
- ❌ `MongoServerError`: Vérifiez MONGODB_URI
- ❌ `Invalid login` (email): Vérifiez SMTP_USER et SMTP_PASS
- ❌ `Invalid API Key` (Stripe): Vérifiez STRIPE_SECRET_KEY
- ❌ `JsonWebTokenError`: Vérifiez JWT_SECRET

## 🔄 Mises à jour futures

Pour déployer des modifications :

```bash
# Faire vos changements dans le code
git add .
git commit -m "Description des changements"
git push origin main
```

Vercel redéploiera automatiquement à chaque push sur `main`.

## 🔒 Passage en production (Stripe live)

Quand vous êtes prêt à accepter de vrais paiements :

1. **Activer votre compte Stripe**
   - Complétez les informations d'entreprise
   - Fournissez les documents requis
   - Attendez la validation (1-2 jours)

2. **Récupérer les clés live**
   - Dashboard Stripe → Developers → API keys
   - Basculez de "Test mode" à "Live mode" (toggle en haut)
   - Copiez les nouvelles clés (`sk_live_...` et `pk_live_...`)

3. **Mettre à jour les variables Vercel**
   - Vercel → Settings → Environment Variables
   - Modifiez `STRIPE_SECRET_KEY` avec `sk_live_...`
   - Modifiez `STRIPE_PUBLISHABLE_KEY` avec `pk_live_...`
   - Redéployez

⚠️ **Attention** : En mode live, les vrais paiements seront traités.

## 📞 Support

En cas de problème :

### Problèmes MongoDB
- Documentation : https://docs.mongodb.com/manual/
- Support Atlas : https://support.mongodb.com/

### Problèmes Stripe
- Documentation : https://stripe.com/docs
- Support : https://support.stripe.com/

### Problèmes Vercel
- Documentation : https://vercel.com/docs
- Support : https://vercel.com/support

### Problèmes SMTP Gmail
- Guide : https://support.google.com/mail/answer/185833
- Vérifiez que la validation en 2 étapes est activée
- Générez un nouveau mot de passe d'application si nécessaire

## 📊 Monitoring

### Surveiller l'application en production

1. **Vercel Analytics** (gratuit)
   - Activez dans Vercel → Votre projet → Analytics
   - Suivez le trafic et les performances

2. **MongoDB Atlas Monitoring**
   - Dashboard → Metrics
   - Surveillez les connexions et les requêtes

3. **Stripe Dashboard**
   - Suivez les paiements et les revenus
   - Configurez les webhooks pour les notifications

## 🎉 Félicitations !

Votre marketplace 3D est maintenant déployée et prête à l'emploi !

Points importants à retenir :
- ✅ Mode test Stripe : utilisez `4242 4242 4242 4242`
- ✅ Sauvegardez vos variables d'environnement en lieu sûr
- ✅ Surveillez les logs Vercel pour détecter les problèmes
- ✅ Testez toutes les fonctionnalités avant d'inviter des utilisateurs
- ✅ Passez en mode live Stripe quand vous êtes prêt

Bon déploiement ! 🚀
