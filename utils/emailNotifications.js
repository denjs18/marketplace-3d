/**
 * Système de notifications email pour le système de messagerie
 * 7 types d'emails automatiques
 */

// Note: Configuration nodemailer à faire selon votre service SMTP
// Pour l'instant, ce module log les emails en console

async function sendNewMessageNotification(user, conversation, message) {
  console.log(`
📧 EMAIL: Nouveau message reçu
To: ${user.email}
Subject: Nouveau message sur votre projet

Bonjour ${user.firstName},

Vous avez reçu un nouveau message concernant le projet "${conversation.project.title}".

Message: "${message.contentFiltered.substring(0, 100)}..."

Répondez dès maintenant: ${process.env.APP_URL}/conversation/${conversation._id}

Cordialement,
L'équipe Marketplace 3D
  `);

  // TODO: Implémenter envoi réel avec nodemailer
  return { sent: true };
}

async function sendQuoteNotification(user, conversation, quote) {
  console.log(`
📧 EMAIL: Nouveau devis reçu
To: ${user.email}
Subject: Nouveau devis pour votre projet

Bonjour ${user.firstName},

Vous avez reçu un devis pour votre projet "${conversation.project.title}".

Prix total: ${quote.totalPrice}€
Délai: ${quote.deliveryDays} jours
Matériaux: ${quote.materials.join(', ')}

Consultez le devis: ${process.env.APP_URL}/conversation/${conversation._id}

Cordialement,
L'équipe Marketplace 3D
  `);

  return { sent: true };
}

async function sendQuoteAcceptedNotification(printer, conversation) {
  console.log(`
📧 EMAIL: Votre devis a été accepté
To: ${printer.email}
Subject: Votre devis a été accepté !

Bonjour ${printer.firstName},

Bonne nouvelle ! Le client a accepté votre devis pour le projet "${conversation.project.title}".

Prix: ${conversation.currentQuote.totalPrice}€
Délai: ${conversation.currentQuote.deliveryDays} jours

Prochaine étape: Signature du contrat
Accéder à la conversation: ${process.env.APP_URL}/conversation/${conversation._id}

Cordialement,
L'équipe Marketplace 3D
  `);

  return { sent: true };
}

async function sendContractSignedNotification(user, conversation, otherParty) {
  console.log(`
📧 EMAIL: Contrat signé
To: ${user.email}
Subject: Contrat signé - Projet "${conversation.project.title}"

Bonjour ${user.firstName},

Le contrat a été signé par les deux parties !

Projet: ${conversation.project.title}
Prix: ${conversation.currentQuote.totalPrice}€
Délai: ${conversation.currentQuote.deliveryDays} jours

Le projet peut maintenant démarrer.

Accéder à la conversation: ${process.env.APP_URL}/conversation/${conversation._id}

Cordialement,
L'équipe Marketplace 3D
  `);

  return { sent: true };
}

async function sendCancellationNotification(user, conversation, reason, cancelledBy) {
  console.log(`
📧 EMAIL: Conversation annulée
To: ${user.email}
Subject: Annulation - Projet "${conversation.project.title}"

Bonjour ${user.firstName},

La conversation concernant le projet "${conversation.project.title}" a été annulée.

Annulé par: ${cancelledBy === 'client' ? 'le client' : 'l\'imprimeur'}
Raison: ${reason}

Vous pouvez consulter d'autres ${user.role === 'client' ? 'imprimeurs' : 'projets'} disponibles sur la plateforme.

Cordialement,
L'équipe Marketplace 3D
  `);

  return { sent: true };
}

async function sendInactivityReminder(user, conversation) {
  console.log(`
📧 EMAIL: Relance d'inactivité
To: ${user.email}
Subject: Relance - Projet "${conversation.project.title}"

Bonjour ${user.firstName},

Nous avons remarqué que vous n'avez pas répondu depuis 48 heures sur le projet "${conversation.project.title}".

L'autre partie attend votre réponse. N'oubliez pas de consulter la conversation pour faire avancer le projet.

Accéder à la conversation: ${process.env.APP_URL}/conversation/${conversation._id}

Cordialement,
L'équipe Marketplace 3D
  `);

  return { sent: true };
}

async function sendMediationRequest(admins, conversation, reason, requestedBy) {
  console.log(`
📧 EMAIL: Demande de médiation (ADMIN)
To: admins@marketplace3d.com
Subject: [URGENT] Demande de médiation

Une demande de médiation a été soumise.

Conversation ID: ${conversation._id}
Projet: ${conversation.project.title}
Demandé par: ${requestedBy === 'client' ? 'Client' : 'Imprimeur'}
Raison: ${reason}

Accéder à la modération: ${process.env.APP_URL}/admin/conversations/${conversation._id}

⚠️ Action requise rapidement.
  `);

  return { sent: true };
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
