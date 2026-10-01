'use strict';

const crypto = require('node:crypto');
const { db } = require('./../db');

// Every new account gets its own code, emailed to them. One per account, so a
// code that leaks is worth one discount rather than unlimited ones.

const DEFAULT_PERCENT = 10;

// More than the sign-up discount, because bringing somebody is worth more than
// arriving - and because both sides get it, so it has to be worth telling a
// friend about.
const DEFAULT_REFERRAL_PERCENT = 20;

const VALID_FOR_DAYS = 30;

// No 0/O or 1/I/L: these get read off a screen and typed by hand, and the pairs
// that look alike are the ones people get wrong.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Shared with the invite codes in referrals.js, which get read off a screen
// and typed by hand in exactly the same way.
function randomCode(prefix) {
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}-${out.slice(0, 4)}-${out.slice(4, 8)}`;
}

function newCode() {
  return randomCode('SB');
}

function referralPercent() {
  const raw = Number(process.env.REFERRAL_DISCOUNT_PERCENT);
  return Number.isFinite(raw) && raw > 0 && raw < 100 ? Math.round(raw) : DEFAULT_REFERRAL_PERCENT;
}

function signupPercent() {
  const raw = Number(process.env.SIGNUP_DISCOUNT_PERCENT);
  return Number.isFinite(raw) && raw > 0 && raw < 100 ? Math.round(raw) : DEFAULT_PERCENT;
}

// Called on sign-up. Never throws: a failure here must not stop someone
// creating an account.
function issueForUser(userId) {
  try {
    const existing = db
      .prepare("SELECT * FROM discount_codes WHERE user_id = ? AND kind = 'signup'")
      .get(userId);
    if (existing) return existing;

    const now = new Date();
    const expires = new Date(now.getTime() + VALID_FOR_DAYS * 86400000);

    // crypto.randomBytes makes a collision vanishingly unlikely, but the column
    // is UNIQUE and a throw here would break sign-up, so retry rather than trust it.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        db.prepare(
          `INSERT INTO discount_codes (code, percent, user_id, kind, created_at, expires_at)
           VALUES (?, ?, ?, 'signup', ?, ?)`
        ).run(newCode(), signupPercent(), userId, now.toISOString(), expires.toISOString());
        return db
          .prepare("SELECT * FROM discount_codes WHERE user_id = ? AND kind = 'signup'")
          .get(userId);
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

// The sign-up code specifically - this is what the welcome email quotes, and
// it must keep meaning that now there can be more than one code on an account.
function forUser(userId) {
  return (
    db.prepare("SELECT * FROM discount_codes WHERE user_id = ? AND kind = 'signup'").get(userId) || null
  );
}

// A reward, alongside whatever else the account holds. Never throws, for the
// same reason issueForUser does not: this runs inside somebody else's request
// and must not be able to fail it.
function issueReward(userId, percent = referralPercent()) {
  try {
    const now = new Date();
    const expires = new Date(now.getTime() + VALID_FOR_DAYS * 86400000);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const code = randomCode('BUD');
        db.prepare(
          `INSERT INTO discount_codes (code, percent, user_id, kind, created_at, expires_at)
           VALUES (?, ?, ?, 'referral', ?, ?)`
        ).run(code, percent, userId, now.toISOString(), expires.toISOString());
        return db.prepare('SELECT * FROM discount_codes WHERE code = ?').get(code);
      } catch (err) {
        if (!String(err.message).includes('UNIQUE')) throw err;
      }
    }
    return null;
  } catch (err) {
    console.error('Could not issue a referral reward:', err.message);
    return null;
  }
}

// What to offer at checkout when an account holds several. The most valuable
// usable one - showing the weaker code while a better one sits unused would be
// the app quietly short-changing somebody.
function bestUnusedFor(userId) {
  return (
    db
      .prepare(
        `SELECT * FROM discount_codes
          WHERE user_id = ? AND used_at IS NULL
            AND (expires_at IS NULL OR expires_at > ?)
          ORDER BY percent DESC, id ASC
          LIMIT 1`
      )
      .get(userId, new Date().toISOString()) || null
  );
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
  randomCode,
  issueForUser,
  issueReward,
  bestUnusedFor,
  referralPercent,
  forUser,
  validate,
  markUsed,
  markEmailed,
  applyTo,
  signupPercent,
};
