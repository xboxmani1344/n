'use strict';

const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');
const { hashPassword, verifyPassword, SESSION_COOKIE } = require('../services/auth');
const { transaction } = require('../db');

const router = express.Router();
router.use(requireAuth);

const VALID_THEMES = new Set(['system', 'light', 'dark']);
const VALID_LANGUAGES = new Set(['en', 'fa']);

function usageSummary(userId) {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId);
  return {
    plan: sub ? sub.plan : 'free',
    status: sub ? sub.status : 'active',
  };
}

function settingsOut(user) {
  return {
    displayName: user.display_name,
    email: user.email,
    theme: user.theme,
    language: user.language,
    hasPassword: Boolean(user.password_hash),
  };
}

router.get('/', (req, res) => {
  res.json({
    settings: settingsOut(req.user),
    subscription: usageSummary(req.user.id),
  });
});

router.patch('/', (req, res) => {
  const { displayName, theme, language } = req.body || {};

  if (theme !== undefined && !VALID_THEMES.has(theme)) {
    return res.status(400).json({ error: `Invalid theme: ${theme}` });
  }
  if (language !== undefined && !VALID_LANGUAGES.has(language)) {
    return res.status(400).json({ error: `Invalid language: ${language}` });
  }

  db.prepare(
    `UPDATE users SET
       display_name = CASE WHEN ? THEN ? ELSE display_name END,
       theme = COALESCE(?, theme),
       language = COALESCE(?, language)
     WHERE id = ?`
  ).run(
    displayName !== undefined ? 1 : 0,
    displayName ?? null,
    theme ?? null,
    language ?? null,
    req.user.id
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ settings: settingsOut(updated) });
});

router.patch(
  '/password',
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const user = req.user;

    if (user.password_hash) {
      const ok = typeof currentPassword === 'string' && (await verifyPassword(currentPassword, user.password_hash));
      if (!ok) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
    }

    const newHash = await hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);

    res.json({ ok: true });
  })
);

// Deleting an account, for real: every row belonging to this person goes.
//
// Re-authenticated rather than taken on the session cookie alone. The cookie is
// SameSite=Lax, so a cross-site POST cannot reach here, but a shared or
// unattended browser can - and this is the one action in the app with nothing
// behind it.
router.delete(
  '/account',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const { password, email } = req.body || {};

    if (user.password_hash) {
      const ok = typeof password === 'string' && (await verifyPassword(password, user.password_hash));
      if (!ok) return res.status(401).json({ error: 'That password is not correct.' });
    } else {
      // Signed up through Google, so there is no password to ask for. Typing
      // the address is the confirmation instead - deliberately something to
      // type rather than a button to click.
      const typed = typeof email === 'string' && email.trim().toLowerCase();
      if (typed !== user.email) {
        return res.status(401).json({ error: 'Type your email address exactly to confirm.' });
      }
    }

    // Every per-user table hangs off users(id) with ON DELETE CASCADE, so one
    // delete empties the lot: sessions, the Google link, the subscription,
    // chats and their messages, planner tasks, video views, usage counters, a
    // stored API key, discount codes.
    //
    // payments is the deliberate exception. Migration 011 made it ON DELETE SET
    // NULL: the record that money moved stays, with the person detached from
    // it, because the operator needs it for accounting and ZarinPal keeps its
    // side regardless. The privacy policy says so in as many words.
    transaction(() => {
      db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    });

    res.clearCookie(SESSION_COOKIE);
    res.json({ ok: true });
  })
);

module.exports = router;
