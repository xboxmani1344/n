'use strict';

const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');
const { hashPassword, verifyPassword } = require('../services/auth');

const router = express.Router();
router.use(requireAuth);

const VALID_THEMES = new Set(['system', 'light', 'dark']);

function usageSummary(userId) {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId);
  return {
    plan: sub ? sub.plan : 'free',
    status: sub ? sub.status : 'active',
  };
}

router.get('/', (req, res) => {
  const user = req.user;
  res.json({
    settings: {
      displayName: user.display_name,
      email: user.email,
      theme: user.theme,
      hasPassword: Boolean(user.password_hash),
    },
    subscription: usageSummary(user.id),
  });
});

router.patch('/', (req, res) => {
  const { displayName, theme } = req.body || {};

  if (theme !== undefined && !VALID_THEMES.has(theme)) {
    return res.status(400).json({ error: `Invalid theme: ${theme}` });
  }

  db.prepare(
    `UPDATE users SET
       display_name = CASE WHEN ? THEN ? ELSE display_name END,
       theme = COALESCE(?, theme)
     WHERE id = ?`
  ).run(displayName !== undefined ? 1 : 0, displayName ?? null, theme ?? null, req.user.id);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({
    settings: {
      displayName: updated.display_name,
      email: updated.email,
      theme: updated.theme,
      hasPassword: Boolean(updated.password_hash),
    },
  });
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

module.exports = router;
