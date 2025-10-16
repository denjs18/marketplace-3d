const nodemailer = require('nodemailer');

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('Email transporter error:', error);
  } else {
    console.log('✓ Email service ready');
  }
});

/**
 * Send welcome email to new user
 */
const sendWelcomeEmail = async (user) => {
  const mailOptions = {
    from: `"${process.env.APP_NAME || 'Marketplace 3D'}" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: 'Bienvenue sur Marketplace 3D!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Bienvenue ${user.firstName}!</h2>
        <p>Merci de vous être inscrit sur Marketplace 3D.</p>
        ${user.role === 'client' ? `
          <p>Vous pouvez maintenant:</p>
          <ul>
            <li>Télécharger vos fichiers STL</li>
            <li>Recevoir des devis d'imprimeurs qualifiés</li>
            <li>Suivre vos projets en temps réel</li>
          </ul>
        ` : `
          <p>Vous pouvez maintenant:</p>
          <ul>
            <li>Consulter les projets disponibles</li>
            <li>Envoyer des devis aux clients</li>
            <li>Gérer vos impressions</li>
            <li>Recevoir vos paiements</li>
          </ul>
        `}
        <p style="margin-top: 30px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login"
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Se connecter
          </a>
        </p>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Si vous n'avez pas créé ce compte, veuillez ignorer cet email.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Welcome email sent to:', user.email);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
};

/**
 * Send new quote notification to client
 */
const sendNewQuoteEmail = async (client, project, quote, printer) => {
  const mailOptions = {
    from: `"${process.env.APP_NAME || 'Marketplace 3D'}" <${process.env.SMTP_USER}>`,
    to: client.email,
    subject: `Nouveau devis pour votre projet: ${project.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Nouveau devis reçu!</h2>
        <p>Bonjour ${client.firstName},</p>
        <p>Vous avez reçu un nouveau devis de <strong>${printer.firstName} ${printer.lastName}</strong> pour votre projet:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${project.title}</h3>
          <p><strong>Prix:</strong> ${quote.price}€</p>
          <p><strong>Délai:</strong> ${quote.estimatedDuration.value} ${quote.estimatedDuration.unit}</p>
          <p><strong>Date de livraison:</strong> ${new Date(quote.deliveryDate).toLocaleDateString('fr-FR')}</p>
        </div>
        <p style="margin-top: 30px;">
          <a href="${process.env.FRONTEND_URL}/project-details.html?id=${project._id}"
             style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Voir le devis
          </a>
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('New quote email sent to:', client.email);
    return true;
  } catch (error) {
    console.error('Error sending new quote email:', error);
    return false;
  }
};

/**
 * Send quote accepted notification to printer
 */
const sendQuoteAcceptedEmail = async (printer, project, quote) => {
  const mailOptions = {
    from: `"${process.env.APP_NAME || 'Marketplace 3D'}" <${process.env.SMTP_USER}>`,
    to: printer.email,
    subject: `Votre devis a été accepté: ${project.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Félicitations! Votre devis a été accepté!</h2>
        <p>Bonjour ${printer.firstName},</p>
        <p>Votre devis pour le projet <strong>${project.title}</strong> a été accepté.</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Montant:</strong> ${quote.price}€</p>
          <p><strong>Date de livraison:</strong> ${new Date(quote.deliveryDate).toLocaleDateString('fr-FR')}</p>
          <p><strong>Votre gain:</strong> ${(quote.price * 0.9).toFixed(2)}€ (après commission de 10%)</p>
        </div>
        <p>Vous pouvez maintenant commencer le travail et communiquer avec le client.</p>
        <p style="margin-top: 30px;">
          <a href="${process.env.FRONTEND_URL}/dashboard-printer.html"
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Voir mon tableau de bord
          </a>
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Quote accepted email sent to:', printer.email);
    return true;
  } catch (error) {
    console.error('Error sending quote accepted email:', error);
    return false;
  }
};

/**
 * Send project completed notification
 */
const sendProjectCompletedEmail = async (client, project, printer) => {
  const mailOptions = {
    from: `"${process.env.APP_NAME || 'Marketplace 3D'}" <${process.env.SMTP_USER}>`,
    to: client.email,
    subject: `Projet terminé: ${project.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Votre projet est terminé!</h2>
        <p>Bonjour ${client.firstName},</p>
        <p><strong>${printer.firstName} ${printer.lastName}</strong> a marqué votre projet comme terminé:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${project.title}</h3>
        </div>
        <p>N'oubliez pas de laisser une évaluation pour aider la communauté!</p>
        <p style="margin-top: 30px;">
          <a href="${process.env.FRONTEND_URL}/project-details.html?id=${project._id}"
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Voir le projet
          </a>
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Project completed email sent to:', client.email);
    return true;
  } catch (error) {
    console.error('Error sending project completed email:', error);
    return false;
  }
};

/**
 * Send payment confirmation email
 */
const sendPaymentConfirmationEmail = async (client, project, transaction) => {
  const mailOptions = {
    from: `"${process.env.APP_NAME || 'Marketplace 3D'}" <${process.env.SMTP_USER}>`,
    to: client.email,
    subject: `Confirmation de paiement - ${project.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Paiement confirmé</h2>
        <p>Bonjour ${client.firstName},</p>
        <p>Votre paiement a été reçu avec succès.</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Projet:</strong> ${project.title}</p>
          <p><strong>Montant:</strong> ${transaction.amount}€</p>
          <p><strong>Date:</strong> ${new Date(transaction.createdAt).toLocaleDateString('fr-FR')}</p>
          <p><strong>Référence:</strong> ${transaction._id}</p>
        </div>
        <p>Le travail peut maintenant commencer. Vous recevrez des notifications sur l'avancement.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Payment confirmation email sent to:', client.email);
    return true;
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
    return false;
  }
};

/**
 * Send new message notification
 */
const sendNewMessageEmail = async (recipient, sender, message) => {
  const mailOptions = {
    from: `"${process.env.APP_NAME || 'Marketplace 3D'}" <${process.env.SMTP_USER}>`,
    to: recipient.email,
    subject: `Nouveau message de ${sender.firstName} ${sender.lastName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Nouveau message</h2>
        <p>Bonjour ${recipient.firstName},</p>
        <p>Vous avez reçu un nouveau message de <strong>${sender.firstName} ${sender.lastName}</strong>:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p>${message.content}</p>
        </div>
        <p style="margin-top: 30px;">
          <a href="${process.env.FRONTEND_URL}/messages.html"
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Répondre
          </a>
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending new message email:', error);
    return false;
  }
};

module.exports = {
  sendWelcomeEmail,
  sendNewQuoteEmail,
  sendQuoteAcceptedEmail,
  sendProjectCompletedEmail,
  sendPaymentConfirmationEmail,
  sendNewMessageEmail
};
