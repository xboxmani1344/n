'use strict';

const { db } = require('../db');
const ai = require('./ai');

// Resolution order matters. A user's own key always wins; the server's key
// (AI_API_KEY) is what everyone else spends.
//
// Configuring a key ON THE SERVER is taken as meaning it should be used. This
// used to be the other way round - a deployment ignored its own key unless
// SHARED_API_KEY=1 was also set - and that default was wrong. Setting a server
// key and then having the site still demand one from every visitor is not a
// thing anyone wants; forgetting the second flag just made the site quietly
// behave the opposite of how it was configured.
//
// SHARED_API_KEY=0 turns it back off, for a public deployment where each user
// really is meant to bring their own. That case now has to be asked for, which
// is the right way round: it is the unusual one.
const SHARED_KEY_ALLOWED = process.env.SHARED_API_KEY !== '0';

function getUserKey(userId) {
  const row = db.prepare('SELECT api_key FROM user_api_keys WHERE user_id = ?').get(userId);
  return row ? row.api_key : null;
}

function serverKey() {
  return SHARED_KEY_ALLOWED ? ai.serverApiKey() : null;
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
