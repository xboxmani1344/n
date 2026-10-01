'use strict';

const webpush = require('web-push');
const { db } = require('./../db');

// Notifications to a phone.
//
// Read the migration beside this file before relying on any of it: on Android
// Chrome the delivery hop is Google's, and where that is unreachable a push
// does not fail, it simply never arrives. Everything here is written to be
// harmless when that happens - nothing waits on it, nothing reports success it
// cannot verify, and the email digest is untouched.

function publicKey() {
  return (process.env.VAPID_PUBLIC_KEY || '').trim();
}

function isConfigured() {
  return Boolean(publicKey() && (process.env.VAPID_PRIVATE_KEY || '').trim());
}

let ready = false;
function configure() {
  if (ready || !isConfigured()) return isConfigured();
  webpush.setVapidDetails(
    // Required by the spec so a push service has somebody to contact about a
    // misbehaving sender. mailto: is the conventional form.
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    publicKey(),
    process.env.VAPID_PRIVATE_KEY.trim()
  );
  ready = true;
  return true;
}

// Re-subscribing the same browser updates the row. Without that, a browser
// that re-registers after an update collects a second row and the person gets
// the same notification twice.
function subscribe(userId, subscription) {
  const { endpoint, keys } = subscription || {};
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) return false;

  db.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       user_id = excluded.user_id,
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       failed_at = NULL`
  ).run(userId, endpoint, keys.p256dh, keys.auth, new Date().toISOString());
  return true;
}

function unsubscribe(endpoint) {
  if (!endpoint) return false;
  return db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint).changes > 0;
}

function countFor(userId) {
  return db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?').get(userId).n;
}

// Returns how many were accepted by a push service - which is not how many
// were seen by anybody. Accepted means handed over, nothing more.
async function sendTo(userId, payload) {
  if (!configure()) return 0;

  const rows = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
  let accepted = 0;

  for (const row of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify(payload)
      );
      accepted += 1;
      if (row.failed_at) {
        db.prepare('UPDATE push_subscriptions SET failed_at = NULL WHERE id = ?').run(row.id);
      }
    } catch (err) {
      // 404 and 410 are the push service saying this browser is gone for
      // good - cleared its data, uninstalled, permission revoked. Anything
      // else is weather, and must not unsubscribe somebody.
      const gone = err.statusCode === 404 || err.statusCode === 410;
      if (gone) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(row.id);
      } else {
        db.prepare('UPDATE push_subscriptions SET failed_at = ? WHERE id = ?')
          .run(new Date().toISOString(), row.id);
        console.error(`Push to subscription ${row.id} failed:`, err.statusCode || err.message);
      }
    }
  }

  return accepted;
}

module.exports = { isConfigured, publicKey, subscribe, unsubscribe, countFor, sendTo };
