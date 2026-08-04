'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db } = require('../db');

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_COOKIE = 'sb_session';
const BCRYPT_ROUNDS = 12;

function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function verifyPassword(password, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(password, hash);
}

function createSession(userId, userAgent) {
  const id = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  db.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, userId, now.toISOString(), expiresAt.toISOString(), now.toISOString(), userAgent || null);

  return { id, expiresAt };
}

function getSessionUser(token) {
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT users.* FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ? AND sessions.expires_at > ?`
    )
    .get(token, new Date().toISOString());

  if (row) {
    db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(new Date().toISOString(), token);
  }

  return row || null;
}

function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  getSessionUser,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL_MS,
};
