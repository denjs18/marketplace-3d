# Système de Paiement et Balance Virtuelle - Documentation

## Vue d'ensemble

Le système de paiement a été complètement refactorisé pour inclure :

1. **Paiement lors de la signature du contrat** avec commission de 10%
2. **Balance virtuelle** pour les imprimeurs
3. **Confirmation de réception** par le client
4. **Système de payout** vers compte bancaire
5. **Utilisation du solde** pour passer des commandes

## Flux Complet

### 1. Acceptation du Devis et Création du Contrat

**Endpoint:** `POST /api/contracts`

```json
{
  "quoteId": "quote_id_here"
}
```

**Réponse:**
```json
{
  "message": "Contract created successfully",
  "contract": {
    "_id": "contract_id",
    "agreedPrice": 100,
    "platformCommission": 10,
    "totalPaid": 110,
    "printerEarnings": 100,
    "status": "pending_signature"
  },
  "nextStep": "sign_and_pay"
}
```

### 2. Signature du Contrat et Paiement

**Endpoint:** `POST /api/contracts/sign`

```json
{
  "contractId": "contract_id",
  "useBalance": 50  // Montant optionnel à utiliser du solde
}
```

**Cas 1 - Paiement 100% avec Stripe:**
```json
{
  "message": "Payment intent created",
  "clientSecret": "pi_xxx",
  "stripeAmount": 110,
  "balanceUsed": 0,
  "paymentMethod": "card"
}
```

**Cas 2 - Paiement mixte (Balance + Stripe):**
```json
{
  "message": "Payment intent created",
  "clientSecret": "pi_xxx",
  "stripeAmount": 60,
  "balanceUsed": 50,
  "paymentMethod": "mixed"
}
```

**Cas 3 - Paiement 100% avec Balance:**
```json
{
  "message": "Contract signed successfully with balance",
  "contract": {...},
  "transaction": {...},
  "paymentMethod": "balance"
}
```

### 3. Confirmation du Paiement Stripe

**Endpoint:** `POST /api/contracts/confirm-payment`

```json
{
  "transactionId": "transaction_id"
}
```

Ce endpoint est appelé après que Stripe confirme le paiement. Il :
- Déduit le solde utilisé du compte client
- Ajoute le montant en `pending` sur le compte de l'imprimeur
- Change le statut du contrat à `signed`

### 4. Workflow de l'Imprimeur

#### a) Lancer l'impression
**Endpoint:** `POST /api/contracts/:contractId/start-printing`

```json
{
  "message": "Printing started successfully",
  "contract": {
    "status": "printing_started",
    "printingStartedAt": "2025-01-13T..."
  }
}
```

#### b) Terminer l'impression
**Endpoint:** `POST /api/contracts/:contractId/complete-printing`

#### c) Envoyer les photos
**Endpoint:** `POST /api/contracts/:contractId/send-photos`

```json
{
  "photos": [
    "https://example.com/photo1.jpg",
    "https://example.com/photo2.jpg"
  ]
}
```

#### d) Expédier la commande
**Endpoint:** `POST /api/contracts/:contractId/ship`

```json
{
  "trackingNumber": "TRACK123456",
  "carrier": "Colissimo"
}
```

### 5. Confirmation de Réception par le Client

**Endpoint:** `POST /api/contracts/:contractId/confirm-delivery`

```json
{
  "message": "Delivery confirmed successfully. Printer earnings are now available.",
  "contract": {
    "status": "delivered_confirmed",
    "deliveredConfirmedAt": "2025-01-13T..."
  }
}
```

**Important:** À ce moment, l'argent passe de `pending` à `available` pour l'imprimeur.

### 6. Gestion de la Balance (Imprimeur)

#### Consulter la balance
**Endpoint:** `GET /api/payouts/balance`

```json
{
  "balance": {
    "available": 500,    // Peut être retiré
    "pending": 300,      // En attente de confirmation client
    "total": 800
  },
  "pendingContracts": 3,
  "canWithdraw": true,
  "hasBankDetails": true
}
```

### 7. Coordonnées Bancaires

#### Ajouter/Mettre à jour
**Endpoint:** `POST /api/payouts/bank-details`

```json
{
  "accountHolderName": "Jean Dupont",
  "iban": "FR76 1234 5678 9012 3456 7890 123",
  "bic": "BNPAFRPP",
  "bankName": "BNP Paribas"
}
```

#### Consulter
**Endpoint:** `GET /api/payouts/bank-details`

### 8. Demander un Virement

**Endpoint:** `POST /api/payouts/request`

```json
{
  "amount": 500
}
```

**Réponse:**
```json
{
  "message": "Payout request created successfully",
  "payout": {
    "_id": "payout_id",
    "amount": 500,
    "status": "pending",
    "bankDetails": {...}
  },
  "info": "Your payout will be processed within 2-5 business days"
}
```

**Important:** Le montant est immédiatement déduit de `available` pour éviter les doubles demandes.

### 9. Traiter un Payout (Admin/Automatique)

**Endpoint:** `POST /api/payouts/:payoutId/process`

Ce endpoint :
1. Crée un transfert Stripe vers l'IBAN
2. Marque le payout comme `completed`
3. Marque tous les contrats associés comme `completed` et `printerPaid`

### 10. Annuler un Payout

**Endpoint:** `DELETE /api/payouts/:payoutId`

Recrédite automatiquement le montant sur le solde `available`.

## Modèles de Données

### Contract

```javascript
{
  project: ObjectId,
  quote: ObjectId,
  client: ObjectId,
  printer: ObjectId,
  agreedPrice: 100,           // Prix convenu
  platformCommission: 10,      // 10% commission
  totalPaid: 110,             // Prix + commission
  printerEarnings: 100,       // Ce que l'imprimeur reçoit
  status: 'pending_signature' | 'signed' | 'printing_started' |
          'printing_completed' | 'photos_sent' | 'shipped' |
          'delivered_confirmed' | 'completed' | 'cancelled',

  // Dates
  signedAt: Date,
  printingStartedAt: Date,
  printingCompletedAt: Date,
  photosSentAt: Date,
  shippedAt: Date,
  deliveredConfirmedAt: Date,
  completedAt: Date,

  // Détails
  printPhotos: [{ url: String, uploadedAt: Date }],
  trackingNumber: String,
  shippingCarrier: String,

  // Paiement imprimeur
  printerPaid: Boolean,
  printerPaidAt: Date,
  payoutId: ObjectId
}
```

### User (ajouts)

```javascript
{
  // Balance virtuelle
  balance: {
    available: 500,  // Disponible pour retrait
    pending: 300,    // En attente de confirmation
    total: 800       // Total
  },

  // Coordonnées bancaires
  bankDetails: {
    accountHolderName: String,
    iban: String,
    bic: String,
    bankName: String,
    verified: Boolean,
    verifiedAt: Date
  }
}
```

### Payout

```javascript
{
  printer: ObjectId,
  amount: Number,
  currency: 'EUR',
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled',

  bankDetails: {
    accountHolderName: String,
    iban: String,
    bic: String,
    bankName: String
  },

  contracts: [ObjectId],
  stripePayoutId: String,

  requestedAt: Date,
  processedAt: Date,
  completedAt: Date,

  errorMessage: String,
  errorCode: String
}
```

### Transaction (modifications)

```javascript
{
  // Nouveaux champs
  paymentMethod: 'card' | 'balance' | 'mixed' | 'bank_transfer' | 'other',
  balanceUsed: 50,      // Montant payé avec le solde
  stripeAmount: 60      // Montant payé avec Stripe
}
```

## Méthodes Utilitaires sur User

```javascript
// Ajouter au solde pending
user.addPendingBalance(100);

// Convertir pending en available (après confirmation client)
user.convertPendingToAvailable(100);

// Déduire du solde available
user.deductFromAvailable(50);

// Vérifier si retrait possible
user.canWithdraw(100); // true/false

// Vérifier si coordonnées bancaires renseignées
user.hasBankDetails(); // true/false
```

## Routes API Complètes

### Contrats
- `POST /api/contracts` - Créer un contrat
- `POST /api/contracts/sign` - Signer et payer
- `POST /api/contracts/confirm-payment` - Confirmer le paiement
- `GET /api/contracts` - Liste des contrats
- `GET /api/contracts/:id` - Détails d'un contrat
- `POST /api/contracts/:id/start-printing` - Lancer l'impression
- `POST /api/contracts/:id/complete-printing` - Terminer l'impression
- `POST /api/contracts/:id/send-photos` - Envoyer photos
- `POST /api/contracts/:id/ship` - Expédier
- `POST /api/contracts/:id/confirm-delivery` - Confirmer réception

### Payouts
- `GET /api/payouts/balance` - Consulter la balance
- `GET /api/payouts/bank-details` - Obtenir coordonnées bancaires
- `POST /api/payouts/bank-details` - Mettre à jour coordonnées
- `POST /api/payouts/request` - Demander un virement
- `GET /api/payouts` - Liste des payouts
- `GET /api/payouts/:id` - Détails d'un payout
- `POST /api/payouts/:id/process` - Traiter un payout
- `DELETE /api/payouts/:id` - Annuler un payout

## Sécurité et Permissions

### Client peut :
- Créer un contrat
- Signer et payer un contrat
- Confirmer la réception
- Utiliser son solde pour payer

### Imprimeur peut :
- Voir ses contrats
- Mettre à jour le statut (impression, photos, expédition)
- Gérer ses coordonnées bancaires
- Consulter sa balance
- Demander un payout
- Annuler un payout en attente
- Utiliser son solde pour passer des commandes

## Stripe Integration

### Configuration requise

Dans `.env` :
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Pour les payouts réels

En production, vous devez :
1. Activer Stripe Connect
2. Configurer les virements SEPA
3. Mettre à jour `payoutController.processPayout()` avec le vrai code Stripe

Exemple :
```javascript
const transfer = await stripe.transfers.create({
  amount: Math.round(payout.amount * 100),
  currency: 'eur',
  destination: printer.stripeAccountId
});
```

## Workflow Visuel

```
Client accepte devis
       ↓
Création Contract (status: pending_signature)
       ↓
Client signe et paye (prix + 10%)
       ↓
Contract signé (status: signed)
Imprimeur: balance.pending += prix convenu
       ↓
Imprimeur lance impression (status: printing_started)
       ↓
Imprimeur termine (status: printing_completed)
       ↓
Imprimeur envoie photos (status: photos_sent)
       ↓
Imprimeur expédie (status: shipped)
       ↓
Client confirme réception (status: delivered_confirmed)
Imprimeur: pending → available
       ↓
Imprimeur demande payout
Balance.available -= montant
       ↓
Payout traité (virement bancaire)
       ↓
Contract terminé (status: completed, printerPaid: true)
```

## Commission de la Plateforme

- **Taux:** 10% sur chaque transaction
- **Visible pour le client:** Au moment du paiement uniquement
- **Calcul:** Prix contrat × 1.10 = Montant total payé par le client
- **Distribution:**
  - Client paie: Prix × 1.10
  - Imprimeur reçoit: Prix
  - Plateforme garde: Prix × 0.10

## Notes Importantes

1. **Balance pending:** L'argent reste "pending" jusqu'à confirmation de réception par le client
2. **Balance available:** Peut être utilisé pour passer commande OU retiré
3. **Retrait minimum:** Aucun (configurable si besoin)
4. **Délai de payout:** 2-5 jours ouvrés (à configurer selon Stripe)
5. **Protection:** Le montant d'un payout en cours est immédiatement déduit pour éviter les doubles demandes

## Tests

Pour tester le système :

1. Créer un compte client et un compte imprimeur
2. Client crée un projet
3. Imprimeur soumet un devis de 100€
4. Client accepte le devis
5. Créer un contrat via `/api/contracts`
6. Signer et payer 110€ via `/api/contracts/sign`
7. Imprimeur voit 100€ en pending
8. Imprimeur suit le workflow complet
9. Client confirme la réception
10. Imprimeur voit 100€ en available
11. Imprimeur ajoute coordonnées bancaires
12. Imprimeur demande payout de 100€
13. Admin traite le payout

## Migration depuis l'ancien système

Si vous avez des données existantes :

1. Tous les utilisateurs ont maintenant `balance: { available: 0, pending: 0, total: 0 }`
2. Les anciennes transactions restent inchangées
3. Créer des contrats pour les quotes acceptées existantes si nécessaire
4. Migrer les projets "in_progress" vers le nouveau système de contrats

## Frontend à Implémenter

Vous devrez créer :

1. **Page de signature de contrat** avec récapitulatif et paiement
2. **Dashboard imprimeur** avec balance et liste des contrats
3. **Page de gestion des coordonnées bancaires**
4. **Page de demande de payout**
5. **Page de suivi de contrat** pour client et imprimeur
6. **Bouton de confirmation de réception** pour le client
7. **Interface d'upload de photos** pour l'imprimeur
8. **Formulaire de tracking** pour l'expédition

Tous les endpoints API sont prêts et documentés ci-dessus.
