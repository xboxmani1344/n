'use strict';

// Sends the real welcome email to one address, so the SMTP settings can be
// proved before a single person signs up.
//
//   node scripts/send-test-email.js you@example.com
//   node scripts/send-test-email.js you@example.com fa
//
// Nothing is written to the database and no account is created. If the mail
// server refuses, the reason is printed here rather than swallowed the way the
// signup path deliberately swallows it.

require('dotenv').config();

const email = require('../src/services/email');
const welcome = require('../src/services/welcomeEmail');

const [to, langArg] = process.argv.slice(2);
const lang = langArg === 'fa' ? 'fa' : 'en';

if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
  console.error('Usage: node scripts/send-test-email.js <address> [en|fa]');
  process.exit(1);
}

if (!email.isConfigured()) {
  console.error(
    'SMTP is not configured. Set these and try again:\n' +
      '  SMTP_HOST   your mail server, e.g. smtp.example.com\n' +
      '  SMTP_PORT   587 for STARTTLS, 465 for implicit TLS (default 587)\n' +
      '  SMTP_USER   the mailbox to send as\n' +
      '  SMTP_PASS   its password\n' +
      '  SMTP_FROM   the From address, if it differs from SMTP_USER'
  );
  process.exit(1);
}

// A sample code rather than one from the database: this must not consume a real
// discount, and a test run should not leave an issued code behind.
const { subject, text } = welcome.content(lang, {
  name: lang === 'fa' ? 'دوست' : 'there',
  code: 'SAMPLE-CODE',
  percent: 10,
  url: process.env.APP_URL || 'http://localhost:3000',
});

console.log(`host     ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}`);
console.log(`from     ${process.env.SMTP_FROM || process.env.SMTP_USER}`);
console.log(`to       ${to}`);
console.log(`subject  ${subject}\n`);

email.send({ to, subject, text }).then((result) => {
  if (result.sent) {
    console.log('Sent. If it does not arrive, check the spam folder and the');
    console.log('From address: a mailbox sending as a domain it does not own is');
    console.log('the usual reason a message is accepted and then filed as spam.');
    process.exit(0);
  }
  console.error(`Not sent: ${result.reason}`);
  process.exit(1);
});
