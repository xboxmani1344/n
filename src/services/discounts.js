'use strict';

const crypto = require('node:crypto');
const { db } = require('./../db');

// Every new account gets its own code, emailed to them. One per account, so a
// code that leaks is worth one discount rather than unlimited ones.

const DEFAULT_PERCENT = 10;
const VALID_FOR_DAYS = 30;

// No 0/O or 1/I/L: these get read off a screen and typed by hand, and the pairs
// that look alike are the ones people get wrong.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function newCode() {
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `SB-${out.slice(0, 4)}-${out.slice(4, 8)}`;
}

function signupPercent() {
  const raw = Number(process.env.SIGNUP_DISCOUNT_PERCENT);
  return Number.isFinite(raw) && raw > 0 && raw < 100 ? Math.round(raw) : DEFAULT_PERCENT;
}

// Called on sign-up. Never throws: a failure here must not stop someone
// creating an account.
function issueForUser(userId) {
  try {
    const existing = db.prepare('SELECT * FROM discount_codes WHERE user_id = ?').get(userId);
    if (existing) return existing;

    const now = new Date();
    const expires = new Date(now.getTime() + VALID_FOR_DAYS * 86400000);

    // crypto.randomBytes makes a collision vanishingly unlikely, but the column
    // is UNIQUE and a throw here would break sign-up, so retry rather than trust it.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        db.prepare(
          `INSERT INTO discount_codes (code, percent, user_id, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?)`
        ).run(newCode(), signupPercent(), userId, now.toISOString(), expires.toISOString());
        return db.prepare('SELECT * FROM discount_codes WHERE user_id = ?').get(userId);
      } catch (err) {
        if (!String(err.message).includes('UNIQUE')) throw err;
      }
    }
    return null;
  } catch (err) {
    console.error('Could not issue a discount code:', err.message);
    return null;
  }
}

function forUser(userId) {
  return db.prepare('SELECT * FROM discount_codes WHERE user_id = ?').get(userId) || null;
}

// Returns { ok, percent, reason }. Only the owner may use their own code, so a
// code posted publicly is worth nothing to anyone else.
function validate(code, userId) {
  if (!code) return { ok: true, percent: 0 };

  const row = db.prepare('SELECT * FROM discount_codes WHERE code = ?').get(String(code).trim().toUpperCase());
  if (!row) return { ok: false, reason: 'unknown' };
  if (row.user_id && row.user_id !== userId) return { ok: false, reason: 'not_yours' };
  if (row.used_at) return { ok: false, reason: 'used' };
  if (row.expires_at && new Date(row.expires_at) < new Date()) return { ok: false, reason: 'expired' };

  return { ok: true, percent: row.percent, row };
}

// Only after the money actually arrives - marking it at checkout would burn the
// code of anyone who changed their mind at the gateway.
function markUsed(code) {
  if (!code) return;
  db.prepare('UPDATE discount_codes SET used_at = ? WHERE code = ? AND used_at IS NULL')
    .run(new Date().toISOString(), code);
}

function markEmailed(code) {
  db.prepare('UPDATE discount_codes SET emailed_at = ? WHERE code = ?').run(new Date().toISOString(), code);
}

// Rounded to whole Toman, and never below zero however the percentage is set.
function applyTo(amountToman, percent) {
  if (!percent) return amountToman;
  return Math.max(0, Math.round(amountToman * (100 - percent) / 100));
}

module.exports = {
  issueForUser,
  forUser,
  validate,
  markUsed,
  markEmailed,
  applyTo,
  signupPercent,
};
