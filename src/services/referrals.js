'use strict';

const { db } = require('./../db');
const discounts = require('./discounts');

// Bringing somebody with you.
//
// The whole of this is anti-abuse. The mechanics - a code, a row, two discount
// codes - are twenty lines; the rest is the reason a referral programme is not
// simply free money for whoever owns the most email addresses.

// Enough that nobody real hits it, low enough that a script notices. A cap is
// not a punishment, it is the line past which this stops being word of mouth
// and starts being a job.
const MAX_REWARDED_PER_INVITER = 25;

// Issued the first time somebody looks at their invite card rather than at
// sign-up: most accounts will never open it, and a code nobody has seen is a
// row nobody needed.
function codeFor(userId) {
  const existing = db.prepare('SELECT invite_code FROM users WHERE id = ?').get(userId);
  if (existing && existing.invite_code) return existing.invite_code;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const code = discounts.randomCode('BUDDY');
      db.prepare('UPDATE users SET invite_code = ? WHERE id = ?').run(code, userId);
      return code;
    } catch (err) {
      // The column is UNIQUE and a collision must not surface as a failure to
      // open a settings page.
      if (!String(err.message).includes('UNIQUE')) throw err;
    }
  }
  return null;
}

function inviterFor(code) {
  if (!code || typeof code !== 'string') return null;
  return db.prepare('SELECT id FROM users WHERE invite_code = ?').get(code.trim().toUpperCase()) || null;
}

// Recorded at sign-up, paid much later. Returns whether the claim stuck, but
// nothing upstream should care: a bad invite code is not a reason to refuse
// somebody an account.
function claim(invitedUserId, rawCode) {
  try {
    const inviter = inviterFor(rawCode);
    if (!inviter) return false;

    // Inviting yourself is the first thing anybody tries.
    if (inviter.id === invitedUserId) return false;

    db.prepare(
      'INSERT OR IGNORE INTO referrals (inviter_id, invited_id, created_at) VALUES (?, ?, ?)'
    ).run(inviter.id, invitedUserId, new Date().toISOString());
    return true;
  } catch (err) {
    console.error('Could not record a referral:', err.message);
    return false;
  }
}

// Called once the invited account has actually done something - a reply from
// the coach that they waited for.
//
// Paying at sign-up would price a referral at the cost of a throwaway email
// address, which is roughly zero. Paying at first real use costs the time it
// takes to have a conversation, which is the point at which somebody has
// genuinely brought a user rather than created a row.
function rewardIfEarned(invitedUserId) {
  try {
    const pending = db
      .prepare('SELECT * FROM referrals WHERE invited_id = ? AND rewarded_at IS NULL')
      .get(invitedUserId);
    if (!pending) return false;

    const earned = db
      .prepare('SELECT COUNT(*) AS n FROM referrals WHERE inviter_id = ? AND rewarded_at IS NOT NULL')
      .get(pending.inviter_id).n;

    // Marked either way. Over the cap the referral is settled as unpaid rather
    // than left pending, so it is not reconsidered on every single message for
    // the rest of that account's life.
    db.prepare('UPDATE referrals SET rewarded_at = ? WHERE id = ?').run(new Date().toISOString(), pending.id);
    if (earned >= MAX_REWARDED_PER_INVITER) return false;

    // Both sides. One-sided, there is no reason to type somebody's code in.
    discounts.issueReward(pending.inviter_id);
    discounts.issueReward(invitedUserId);
    return true;
  } catch (err) {
    console.error('Could not reward a referral:', err.message);
    return false;
  }
}

function statsFor(userId) {
  const counts = db
    .prepare(
      `SELECT COUNT(*) AS invited,
              COUNT(rewarded_at) AS rewarded
         FROM referrals WHERE inviter_id = ?`
    )
    .get(userId);

  return {
    code: codeFor(userId),
    percent: discounts.referralPercent(),
    invited: counts.invited,
    rewarded: counts.rewarded,
  };
}

module.exports = { MAX_REWARDED_PER_INVITER, codeFor, claim, rewardIfEarned, statsFor };
