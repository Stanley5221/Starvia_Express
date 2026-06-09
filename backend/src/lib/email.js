'use strict';

const nodemailer = require('nodemailer');

const FROM_NAME  = process.env.EMAIL_FROM_NAME  || 'Starvia Express';
const FROM_EMAIL = process.env.EMAIL_FROM        || process.env.EMAIL_USER || '';

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST,
    port:   Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true', // true = 465, false = STARTTLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// Base HTML wrapper so every email looks consistent
function wrap(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:30px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
      <tr><td style="background:#FF6B2B;padding:24px 32px;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Starvia Express</h1>
        <p style="margin:4px 0 0;color:#ffe0cc;font-size:13px;">Fast &amp; Reliable Deliveries</p>
      </td></tr>
      <tr><td style="padding:32px;">
        ${bodyHtml}
      </td></tr>
      <tr><td style="background:#f5f5f5;padding:20px 32px;text-align:center;">
        <p style="margin:0;color:#999;font-size:12px;">© ${new Date().getFullYear()} Starvia Express. All rights reserved.</p>
        <p style="margin:4px 0 0;color:#bbb;font-size:11px;">Questions? Email us at <a href="mailto:support@starviaexpress.com" style="color:#FF6B2B;text-decoration:none;">support@starviaexpress.com</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/**
 * Core send function. Returns true on success, false on failure (non-fatal).
 * @param {{ to: string, subject: string, html: string }} opts
 */
async function sendEmail({ to, subject, html }) {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
    // Email not configured — log and skip silently
    console.warn('[Email] Not configured — skipping email to', to, '| Subject:', subject);
    return false;
  }
  try {
    const transport = createTransport();
    await transport.sendMail({ from: `"${FROM_NAME}" <${FROM_EMAIL}>`, to, subject, html });
    console.log(`[Email] Sent "${subject}" → ${to}`);
    return true;
  } catch (err) {
    console.error('[Email] Failed to send to', to, '|', err.message);
    return false;
  }
}

// ─── Transactional emails ─────────────────────────────────────────────────────

async function sendWelcomeEmail({ to, name }) {
  return sendEmail({
    to,
    subject: 'Welcome to Starvia Express!',
    html: wrap('Welcome', `
      <h2 style="color:#1a1a1a;margin:0 0 8px;">Welcome, ${name}!</h2>
      <p style="color:#555;line-height:1.6;">Your Starvia Express account has been created. You can now place delivery orders anytime, anywhere.</p>
      <p style="color:#555;line-height:1.6;">Need help? Just reply to this email and our team will assist you.</p>
    `),
  });
}

async function sendOrderConfirmation({ to, name, orderId, pickupAddress, dropoffAddress, estimatedPrice }) {
  return sendEmail({
    to,
    subject: `Order Confirmation — #${orderId.slice(-8).toUpperCase()}`,
    html: wrap('Order Confirmed', `
      <h2 style="color:#1a1a1a;margin:0 0 16px;">Your order has been placed!</h2>
      <p style="color:#555;">Hi ${name}, we've received your delivery request.</p>
      <table width="100%" style="border-collapse:collapse;margin:20px 0;">
        <tr><td style="padding:10px;background:#f9f9f9;border-radius:4px 4px 0 0;border-bottom:1px solid #eee;">
          <strong style="color:#888;font-size:12px;text-transform:uppercase;">Order ID</strong><br/>
          <span style="color:#1a1a1a;font-weight:700;">#${orderId.slice(-8).toUpperCase()}</span>
        </td></tr>
        <tr><td style="padding:10px;background:#f9f9f9;border-bottom:1px solid #eee;">
          <strong style="color:#888;font-size:12px;text-transform:uppercase;">Pickup</strong><br/>
          <span style="color:#1a1a1a;">${pickupAddress}</span>
        </td></tr>
        <tr><td style="padding:10px;background:#f9f9f9;border-bottom:1px solid #eee;">
          <strong style="color:#888;font-size:12px;text-transform:uppercase;">Dropoff</strong><br/>
          <span style="color:#1a1a1a;">${dropoffAddress}</span>
        </td></tr>
        <tr><td style="padding:10px;background:#f9f9f9;border-radius:0 0 4px 4px;">
          <strong style="color:#888;font-size:12px;text-transform:uppercase;">Estimated Price</strong><br/>
          <span style="color:#FF6B2B;font-weight:700;font-size:18px;">GH₵ ${(estimatedPrice / 100).toFixed(2)}</span>
        </td></tr>
      </table>
      <p style="color:#555;">A rider will be assigned shortly. You can track your delivery in real time on our platform.</p>
    `),
  });
}

async function sendRiderAssignedEmail({ to, name, orderId, riderName, riderPhone, motorPlate }) {
  return sendEmail({
    to,
    subject: `Rider Assigned — #${orderId.slice(-8).toUpperCase()}`,
    html: wrap('Rider on the Way', `
      <h2 style="color:#1a1a1a;margin:0 0 16px;">Your rider is on the way!</h2>
      <p style="color:#555;">Hi ${name}, a rider has accepted your order <strong>#${orderId.slice(-8).toUpperCase()}</strong>.</p>
      <table width="100%" style="border-collapse:collapse;margin:20px 0;">
        <tr><td style="padding:10px;background:#f9f9f9;border-radius:4px 4px 0 0;border-bottom:1px solid #eee;">
          <strong style="color:#888;font-size:12px;text-transform:uppercase;">Rider Name</strong><br/>
          <span style="color:#1a1a1a;font-weight:600;">${riderName}</span>
        </td></tr>
        <tr><td style="padding:10px;background:#f9f9f9;border-bottom:1px solid #eee;">
          <strong style="color:#888;font-size:12px;text-transform:uppercase;">Rider Phone</strong><br/>
          <a href="tel:${riderPhone}" style="color:#FF6B2B;">${riderPhone}</a>
        </td></tr>
        <tr><td style="padding:10px;background:#f9f9f9;border-radius:0 0 4px 4px;">
          <strong style="color:#888;font-size:12px;text-transform:uppercase;">Plate Number</strong><br/>
          <span style="color:#1a1a1a;">${motorPlate}</span>
        </td></tr>
      </table>
      <p style="color:#555;">You can track your delivery in real time on our platform.</p>
    `),
  });
}

async function sendDeliveryCompleteEmail({ to, name, orderId, finalPrice }) {
  const amount = finalPrice ? `GH₵ ${(finalPrice / 100).toFixed(2)}` : 'N/A';
  return sendEmail({
    to,
    subject: `Delivered! — #${orderId.slice(-8).toUpperCase()}`,
    html: wrap('Order Delivered', `
      <h2 style="color:#1a1a1a;margin:0 0 16px;">Your order has been delivered!</h2>
      <p style="color:#555;">Hi ${name}, order <strong>#${orderId.slice(-8).toUpperCase()}</strong> has been successfully delivered.</p>
      <p style="color:#555;">Final amount: <strong style="color:#FF6B2B;">${amount}</strong></p>
      <p style="color:#555;margin-top:20px;">Thank you for choosing Starvia Express. We'd love to hear your feedback!</p>
    `),
  });
}

async function sendOrderCancelledEmail({ to, name, orderId }) {
  return sendEmail({
    to,
    subject: `Order Cancelled — #${orderId.slice(-8).toUpperCase()}`,
    html: wrap('Order Cancelled', `
      <h2 style="color:#1a1a1a;margin:0 0 16px;">Your order has been cancelled</h2>
      <p style="color:#555;">Hi ${name}, order <strong>#${orderId.slice(-8).toUpperCase()}</strong> has been cancelled.</p>
      <p style="color:#555;">If you did not request this cancellation, please contact our support team immediately.</p>
    `),
  });
}

async function sendBusinessApprovedEmail({ to, name, businessName }) {
  return sendEmail({
    to,
    subject: 'Your Business Account is Approved — Starvia Express',
    html: wrap('Business Approved', `
      <h2 style="color:#1a1a1a;margin:0 0 16px;">Congratulations, ${name}!</h2>
      <p style="color:#555;">Your business account for <strong>${businessName}</strong> has been approved.</p>
      <p style="color:#555;">You can now place delivery orders at our preferential business rates. Log in to get started.</p>
    `),
  });
}

async function sendBusinessRejectedEmail({ to, name, businessName, reason }) {
  return sendEmail({
    to,
    subject: 'Business Account Application Update — Starvia Express',
    html: wrap('Application Update', `
      <h2 style="color:#1a1a1a;margin:0 0 16px;">Hi ${name},</h2>
      <p style="color:#555;">We've reviewed your application for <strong>${businessName}</strong> and unfortunately we're unable to approve it at this time.</p>
      ${reason ? `<p style="color:#555;"><strong>Reason:</strong> ${reason}</p>` : ''}
      <p style="color:#555;">If you believe this is a mistake or wish to re-apply with updated documents, please contact our support team.</p>
    `),
  });
}

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  return sendEmail({
    to,
    subject: 'Reset Your Starvia Express Password',
    html: wrap('Password Reset', `
      <h2 style="color:#1a1a1a;margin:0 0 16px;">Hi ${name},</h2>
      <p style="color:#555;">You requested a password reset. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#FF6B2B;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:700;font-size:15px;">Reset Password</a>
      </div>
      <p style="color:#999;font-size:13px;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
      <p style="color:#bbb;font-size:12px;word-break:break-all;">Or copy this link: ${resetUrl}</p>
    `),
  });
}

async function sendRiderTempPasswordEmail({ to, name, tempPassword }) {
  return sendEmail({
    to,
    subject: 'Your Starvia Express Rider Account is Ready',
    html: wrap('Rider Account Created', `
      <h2 style="color:#1a1a1a;margin:0 0 16px;">Welcome to the team, ${name}!</h2>
      <p style="color:#555;">Your rider account has been created. Use the credentials below to log in to the Starvia Express rider app:</p>
      <table width="100%" style="border-collapse:collapse;margin:20px 0;">
        <tr><td style="padding:10px;background:#f9f9f9;border-radius:4px 4px 0 0;border-bottom:1px solid #eee;">
          <strong style="color:#888;font-size:12px;text-transform:uppercase;">Email</strong><br/>
          <span style="color:#1a1a1a;">${to}</span>
        </td></tr>
        <tr><td style="padding:10px;background:#f9f9f9;border-radius:0 0 4px 4px;">
          <strong style="color:#888;font-size:12px;text-transform:uppercase;">Temporary Password</strong><br/>
          <span style="color:#FF6B2B;font-weight:700;font-size:18px;letter-spacing:2px;">${tempPassword}</span>
        </td></tr>
      </table>
      <p style="color:#d00;font-weight:700;">You will be required to change your password on first login.</p>
    `),
  });
}

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendOrderConfirmation,
  sendRiderAssignedEmail,
  sendDeliveryCompleteEmail,
  sendOrderCancelledEmail,
  sendBusinessApprovedEmail,
  sendBusinessRejectedEmail,
  sendPasswordResetEmail,
  sendRiderTempPasswordEmail,
};
