/**
 * Notification Service for Legal Threshold Warnings
 * Handles email notifications for sellers approaching or exceeding thresholds
 */

/**
 * Send threshold warning email when seller reaches 80% of legal limits
 * @param {Object} seller - The seller user object
 * @param {Object} stats - Current statistics (yearlyRevenue, yearlyTransactionCount, etc.)
 */
async function sendThresholdWarning(seller, stats) {
  try {
    const { yearlyRevenue, yearlyTransactionCount, revenueUsage, transactionUsage } = stats;

    // In production, this would use a real email service (SendGrid, AWS SES, etc.)
    // For now, we'll log the notification
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║              THRESHOLD WARNING EMAIL                           ║
╠════════════════════════════════════════════════════════════════╣
║ To: ${seller.email}
║ Subject: ⚠️ Vous approchez du seuil légal de vente
║
║ Bonjour ${seller.firstName} ${seller.lastName},
║
║ Vous avez réalisé ${yearlyRevenue.toFixed(2)} € de CA et
║ ${yearlyTransactionCount} transactions cette année.
║
║ SEUILS LÉGAUX : 3 000 € OU 20 transactions/an
║
║ Utilisation actuelle :
║ - Chiffre d'affaires : ${revenueUsage.toFixed(1)}%
║ - Transactions : ${transactionUsage.toFixed(1)}%
║
║ Au-delà de ces seuils, vous devez créer une micro-entreprise.
║
║ Consultez notre guide : ${process.env.APP_URL || 'http://localhost:3000'}/guide-microentreprise.html
║
║ Cordialement,
║ L'équipe Marketplace 3D
╚════════════════════════════════════════════════════════════════╝
    `);

    // TODO: Implement actual email sending
    // Example with nodemailer or SendGrid:
    /*
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@marketplace3d.com',
      to: seller.email,
      subject: '⚠️ Vous approchez du seuil légal de vente',
      html: `
        <h2>Attention : Seuils légaux</h2>
        <p>Bonjour ${seller.firstName} ${seller.lastName},</p>
        <p>Vous avez réalisé <strong>${yearlyRevenue.toFixed(2)} €</strong> de CA et
        <strong>${yearlyTransactionCount}</strong> transactions cette année.</p>
        <p><strong>Seuils légaux :</strong> 3 000 € OU 20 transactions/an</p>
        <p>Utilisation actuelle :</p>
        <ul>
          <li>Chiffre d'affaires : ${revenueUsage.toFixed(1)}%</li>
          <li>Transactions : ${transactionUsage.toFixed(1)}%</li>
        </ul>
        <p>Au-delà de ces seuils, vous devez créer une micro-entreprise.</p>
        <p><a href="${process.env.APP_URL || 'http://localhost:3000'}/guide-microentreprise.html">
          Consultez notre guide de création de micro-entreprise
        </a></p>
        <p>Cordialement,<br>L'équipe Marketplace 3D</p>
      `
    };

    await transporter.sendMail(mailOptions);
    */

    return {
      success: true,
      message: 'Threshold warning email logged (not sent in dev mode)'
    };

  } catch (error) {
    console.error('Error sending threshold warning:', error);
    throw error;
  }
}

/**
 * Send account blocked notification when seller exceeds legal limits
 * @param {Object} seller - The seller user object
 */
async function sendAccountBlockedEmail(seller) {
  try {
    // In production, this would use a real email service
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║              ACCOUNT BLOCKED EMAIL                             ║
╠════════════════════════════════════════════════════════════════╣
║ To: ${seller.email}
║ Subject: 🚫 Votre compte vendeur a été bloqué
║
║ Bonjour ${seller.firstName} ${seller.lastName},
║
║ Votre compte a été bloqué car vous avez dépassé les seuils
║ légaux de vente pour un particulier.
║
║ SEUILS DÉPASSÉS : 3 000 € ou 20 transactions par an
║
║ Pour débloquer votre compte et continuer à vendre, vous devez :
║ 1. Créer une micro-entreprise
║ 2. Obtenir votre numéro SIRET
║ 3. Renseigner ces informations dans votre profil
║
║ Guide de création : ${process.env.APP_URL || 'http://localhost:3000'}/guide-microentreprise.html
║
║ Une fois votre SIRET renseigné, votre compte sera
║ automatiquement débloqué.
║
║ Cordialement,
║ L'équipe Marketplace 3D
╚════════════════════════════════════════════════════════════════╝
    `);

    // TODO: Implement actual email sending
    /*
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@marketplace3d.com',
      to: seller.email,
      subject: '🚫 Votre compte vendeur a été bloqué',
      html: `
        <h2 style="color: #d32f2f;">Compte bloqué</h2>
        <p>Bonjour ${seller.firstName} ${seller.lastName},</p>
        <p>Votre compte a été bloqué car vous avez dépassé les seuils légaux
        de vente pour un particulier.</p>
        <p><strong>Seuils dépassés :</strong> 3 000 € ou 20 transactions par an</p>
        <p>Pour débloquer votre compte et continuer à vendre, vous devez :</p>
        <ol>
          <li>Créer une micro-entreprise</li>
          <li>Obtenir votre numéro SIRET</li>
          <li>Renseigner ces informations dans votre profil</li>
        </ol>
        <p><a href="${process.env.APP_URL || 'http://localhost:3000'}/guide-microentreprise.html"
           style="background-color: #1976d2; color: white; padding: 10px 20px;
                  text-decoration: none; border-radius: 5px; display: inline-block;">
          Consulter le guide de création
        </a></p>
        <p>Une fois votre SIRET renseigné, votre compte sera automatiquement débloqué.</p>
        <p>Cordialement,<br>L'équipe Marketplace 3D</p>
      `
    };

    await transporter.sendMail(mailOptions);
    */

    return {
      success: true,
      message: 'Account blocked email logged (not sent in dev mode)'
    };

  } catch (error) {
    console.error('Error sending account blocked email:', error);
    throw error;
  }
}

/**
 * Send annual DAC7 report to seller
 * @param {Object} seller - The seller user object
 * @param {Object} annualData - Annual sales data
 */
async function sendDAC7AnnualReport(seller, annualData) {
  try {
    const { year, totalRevenue, totalTransactions } = annualData;

    console.log(`
╔════════════════════════════════════════════════════════════════╗
║              DAC7 ANNUAL REPORT EMAIL                          ║
╠════════════════════════════════════════════════════════════════╣
║ To: ${seller.email}
║ Subject: Récapitulatif annuel ${year} - Déclaration DAC7
║
║ Bonjour ${seller.firstName} ${seller.lastName},
║
║ Voici votre récapitulatif de ventes pour l'année ${year} :
║
║ Chiffre d'affaires total : ${totalRevenue.toFixed(2)} €
║ Nombre de transactions : ${totalTransactions}
║
║ Conformément à la directive DAC7, ces informations seront
║ transmises aux autorités fiscales françaises.
║
║ Vous êtes responsable de déclarer ces revenus dans votre
║ déclaration d'impôts.
║
║ Pour toute question, n'hésitez pas à nous contacter.
║
║ Cordialement,
║ L'équipe Marketplace 3D
╚════════════════════════════════════════════════════════════════╝
    `);

    return {
      success: true,
      message: 'DAC7 report email logged (not sent in dev mode)'
    };

  } catch (error) {
    console.error('Error sending DAC7 report:', error);
    throw error;
  }
}

module.exports = {
  sendThresholdWarning,
  sendAccountBlockedEmail,
  sendDAC7AnnualReport
};
