'use strict';

const nodemailer = require('nodemailer');

// Plain SMTP, so it works with Liara's mail service or anything else. A server
// in Iran cannot reach most foreign mail APIs, which is the whole reason this
// is SMTP against a configurable host rather than a hosted provider's SDK.

let transport = null;
let warnedMissing = false;

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransport() {
  if (transport) return transport;
  if (!isConfigured()) return null;

  const port = Number(process.env.SMTP_PORT) || 587;
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 and 25 start plain and upgrade with STARTTLS.
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transport;
}

function fromAddress() {
  return process.env.SMTP_FROM || process.env.SMTP_USER;
}

// Never throws and never blocks the caller. Email is a nice-to-have on top of
// signing up; a mail server having a bad afternoon must not cost someone their
// account.
async function send({ to, subject, text, html }) {
  const mailer = getTransport();
  if (!mailer) {
    if (!warnedMissing) {
      console.warn('Note: SMTP_HOST/SMTP_USER/SMTP_PASS not set — no email is sent.');
      warnedMissing = true;
    }
    return { sent: false, reason: 'not_configured' };
  }

  try {
    await mailer.sendMail({ from: fromAddress(), to, subject, text, html });
    return { sent: true };
  } catch (err) {
    console.error(`Could not email ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { send, isConfigured };
