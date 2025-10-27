const cron = require('node-cron');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { sendInactivityReminder } = require('../utils/emailNotifications');

/**
 * Tâches CRON pour le système de messagerie
 */

// Quotidien à 2h: Archivage et relances
const dailyTasks = cron.schedule('0 2 * * *', async () => {
  console.log('🕐 Running daily conversation tasks...');

  try {
    // 1. Archiver les conversations en pause expirées
    const now = new Date();
    const expiredPauses = await Conversation.find({
      status: 'paused',
      pauseExpiresAt: { $lt: now }
    });

    for (const conv of expiredPauses) {
      conv.status = 'cancelled_mutual';
      conv.cancelReason = 'Pause expirée après 30 jours';
      conv.archivedAt = now;
      conv.isArchived = true;
      await conv.save();
    }

    console.log(`✅ Archived ${expiredPauses.length} expired paused conversations`);

    // 2. Envoyer relances pour conversations inactives (>48h)
    const twoDaysAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));
    const inactiveConversations = await Conversation.find({
      status: { $in: ['active', 'negotiating', 'quote_sent'] },
      lastMessageAt: { $lt: twoDaysAgo }
    }).populate('client printer project');

    for (const conv of inactiveConversations) {
      // Déterminer qui n'a pas répondu
      const lastMessage = await require('../models/Message')
        .findOne({ conversation: conv._id })
        .sort('-createdAt')
        .populate('sender');

      if (lastMessage) {
        // Envoyer relance à l'autre partie
        const inactiveUser = lastMessage.sender._id.toString() === conv.client._id.toString()
          ? conv.printer
          : conv.client;

        await sendInactivityReminder(inactiveUser, conv);
      }
    }

    console.log(`✅ Sent ${inactiveConversations.length} inactivity reminders`);

  } catch (error) {
    console.error('❌ Error in daily tasks:', error);
  }
}, {
  scheduled: false // Ne démarre pas automatiquement
});

// Hebdomadaire dimanche 3h: Calcul scores et badges
const weeklyTasks = cron.schedule('0 3 * * 0', async () => {
  console.log('🕐 Running weekly scoring tasks...');

  try {
    // 1. Calculer les scores de fiabilité pour tous les imprimeurs
    const printers = await User.find({ role: 'printer' });

    for (const printer of printers) {
      const reliabilityScore = calculateReliabilityScore(printer);

      if (!printer.printerProfile) {
        printer.printerProfile = {};
      }

      printer.printerProfile.reliabilityScore = reliabilityScore;

      // 2. Attribuer/retirer badges automatiques
      const badges = calculateBadges(printer);
      printer.printerProfile.badges = badges;

      await printer.save();
    }

    console.log(`✅ Updated reliability scores for ${printers.length} printers`);

    // 3. Calculer les scores pour les clients
    const clients = await User.find({ role: 'client' });

    for (const client of clients) {
      if (!client.clientProfile) {
        client.clientProfile = {};
      }

      // Simple score pour clients basé sur annulations
      const cancellationRate = client.clientProfile.cancellationRate || 0;
      client.clientProfile.reliabilityScore = Math.max(0, 100 - cancellationRate);

      await client.save();
    }

    console.log(`✅ Updated reliability scores for ${clients.length} clients`);

    // 4. Envoyer avertissements si scores faibles
    const lowScorePrinters = printers.filter(p =>
      p.printerProfile && p.printerProfile.reliabilityScore < 50
    );

    for (const printer of lowScorePrinters) {
      console.log(`⚠️ Warning sent to ${printer.email} - Low reliability score`);
      // TODO: Envoyer email d'avertissement
    }

  } catch (error) {
    console.error('❌ Error in weekly tasks:', error);
  }
}, {
  scheduled: false
});

/**
 * Calcule le score de fiabilité d'un imprimeur
 * Formule: (completionRate × 0.5) + (responseRate × 0.3) + ((100 - cancellationRate) × 0.2)
 */
function calculateReliabilityScore(user) {
  if (!user.printerProfile) return 100;

  const completionRate = user.printerProfile.completionRate || 100;
  const responseRate = user.printerProfile.responseRate || 100;
  const cancellationRate = user.printerProfile.cancellationRate || 0;

  const score = (
    completionRate * 0.5 +
    responseRate * 0.3 +
    (100 - cancellationRate) * 0.2
  );

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Calcule les badges automatiques d'un imprimeur
 */
function calculateBadges(user) {
  const badges = [];
  const profile = user.printerProfile || {};
  const reliabilityScore = profile.reliabilityScore || 100;
  const totalProjects = user.totalProjects || 0;
  const averageRating = user.rating?.average || 0;
  const responseTime = profile.averageResponseTime || 0;
  const cancellationRate = profile.cancellationRate || 0;

  // Badge: Imprimeur de confiance
  if (reliabilityScore > 95 && totalProjects > 20) {
    badges.push('imprimeur_confiance');
  }

  // Badge: Top imprimeur
  if (reliabilityScore > 98 && totalProjects > 50 && averageRating > 4.8) {
    badges.push('top_imprimeur');
  }

  // Badge: Imprimeur réactif
  if (responseTime < 120 && responseTime > 0) { // < 2 heures
    badges.push('reactif');
  }

  // Badge d'alerte: Annulations fréquentes
  if (cancellationRate > 20) {
    badges.push('alert_annulations');
  }

  // Badge d'alerte: Ne répond pas
  if (profile.responseRate < 50) {
    badges.push('alert_non_reponse');
  }

  return badges;
}

/**
 * Démarre toutes les tâches CRON
 */
function startAllCronTasks() {
  console.log('🚀 Starting CRON tasks for conversation management...');
  dailyTasks.start();
  weeklyTasks.start();
  console.log('✅ CRON tasks started successfully');
}

/**
 * Arrête toutes les tâches CRON
 */
function stopAllCronTasks() {
  dailyTasks.stop();
  weeklyTasks.stop();
  console.log('🛑 CRON tasks stopped');
}

module.exports = {
  startAllCronTasks,
  stopAllCronTasks,
  calculateReliabilityScore,
  calculateBadges
};
