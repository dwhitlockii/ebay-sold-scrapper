const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

// Create test account and transporter
async function createTestAccount() {
  // Generate test SMTP service account from ethereal.email
  const testAccount = await nodemailer.createTestAccount();

  // Create a transporter using the test account
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });
}

let transporter;

// Initialize transporter
(async () => {
  transporter = await createTestAccount();
  console.log('Email service initialized with Ethereal Email');
})();

// Email templates
const emailTemplates = {
  verification: (token) => ({
    subject: 'Verify Your Email',
    html: `
      <h1>Welcome to Price Scraper!</h1>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${process.env.APP_URL}/verify-email/${token}">Verify Email</a>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't create an account, please ignore this email.</p>
    `
  }),
  
  passwordReset: (token) => ({
    subject: 'Reset Your Password',
    html: `
      <h1>Password Reset Request</h1>
      <p>You requested to reset your password. Click the link below to proceed:</p>
      <a href="${process.env.APP_URL}/reset-password/${token}">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request a password reset, please ignore this email.</p>
    `
  }),

  priceAlert: (productName, currentPrice, targetPrice) => ({
    subject: 'Price Alert: Target Price Reached!',
    html: `
      <h1>Price Alert</h1>
      <p>Good news! The price for "${productName}" has reached your target:</p>
      <ul>
        <li>Current Price: $${currentPrice}</li>
        <li>Your Target: $${targetPrice}</li>
      </ul>
      <a href="${process.env.APP_URL}">Check it out now!</a>
    `
  })
};

// Send verification email
async function sendVerificationEmail(email, token) {
  const template = emailTemplates.verification(token);
  try {
    if (!transporter) {
      transporter = await createTestAccount();
    }

    const info = await transporter.sendMail({
      from: '"Price Scraper" <test@example.com>',
      to: email,
      subject: template.subject,
      html: template.html
    });

    console.log('Verification email sent. Preview URL: %s', nodemailer.getTestMessageUrl(info));
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
}

// Send password reset email
async function sendPasswordResetEmail(email, token) {
  const template = emailTemplates.passwordReset(token);
  try {
    if (!transporter) {
      transporter = await createTestAccount();
    }

    const info = await transporter.sendMail({
      from: '"Price Scraper" <test@example.com>',
      to: email,
      subject: template.subject,
      html: template.html
    });

    console.log('Password reset email sent. Preview URL: %s', nodemailer.getTestMessageUrl(info));
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
}

// Send price alert email
async function sendPriceAlertEmail(email, productName, currentPrice, targetPrice) {
  const template = emailTemplates.priceAlert(productName, currentPrice, targetPrice);
  try {
    if (!transporter) {
      transporter = await createTestAccount();
    }

    const info = await transporter.sendMail({
      from: '"Price Scraper" <test@example.com>',
      to: email,
      subject: template.subject,
      html: template.html
    });

    console.log('Price alert email sent. Preview URL: %s', nodemailer.getTestMessageUrl(info));
    return true;
  } catch (error) {
    console.error('Error sending price alert email:', error);
    return false;
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPriceAlertEmail
}; 