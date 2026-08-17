'use strict';

const { db } = require('../db');

// Resolution order matters. A user's own key always wins; the server's
// GEMINI_API_KEY is only a fallback so a single-person local install keeps
// working exactly as before without anyone entering a key twice.
//
// On a public deployment you normally leave GEMINI_API_KEY unset, which makes
// every user supply their own. Set SHARED_API_KEY=1 to deliberately let
// everyone spend the server's key instead — only sane if you're paying for it
// and understand every user's prompts are attributed to you.
const SHARED_KEY_ALLOWED = process.env.SHARED_API_KEY === '1' || !isPublicDeployment();

function isPublicDeployment() {
  return process.env.NODE_ENV === 'production';
}

function getUserKey(userId) {
  const row = db.prepare('SELECT api_key FROM user_api_keys WHERE user_id = ?').get(userId);
  return row ? row.api_key : null;
}

function serverKey() {
  return SHARED_KEY_ALLOWED ? process.env.GEMINI_API_KEY || null : null;
}

// What an actual request should use.
function resolveKey(userId) {
  return getUserKey(userId) || serverKey();
}

function hasKey(userId) {
  return Boolean(resolveKey(userId));
}

// True when this user is relying on the server's key rather than their own —
// the UI uses it to decide whether to nudge them to add one.
function usingServerKey(userId) {
  return !getUserKey(userId) && Boolean(serverKey());
}

function setUserKey(userId, apiKey) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO user_api_keys (user_id, provider, api_key, created_at, updated_at)
     VALUES (?, 'gemini', ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET api_key = excluded.api_key, updated_at = excluded.updated_at`
  ).run(userId, apiKey, now, now);
}

function clearUserKey(userId) {
  db.prepare('DELETE FROM user_api_keys WHERE user_id = ?').run(userId);
}

module.exports = {
  getUserKey,
  serverKey,
  resolveKey,
  hasKey,
  usingServerKey,
  setUserKey,
  clearUserKey,
};
