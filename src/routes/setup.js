'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');
const ai = require('../services/ai');
const apiKeys = require('../services/apiKeys');

const router = express.Router();

const ENV_PATH = path.join(process.cwd(), '.env');
const isProd = process.env.NODE_ENV === 'production';

// The server-wide setup screen only makes sense for a local single-user install,
// where writing .env configures "the app". On a deployment there is no single
// owner sitting at the console, so it's disabled and each user brings their own
// key instead. Read the socket address rather than req.ip: 'trust proxy' is on,
// which makes req.ip follow a client-supplied X-Forwarded-For header.
function isLocalRequest(req) {
  const addr = req.socket.remoteAddress || '';
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

function serverSetupAvailable(req) {
  return !isProd && isLocalRequest(req) && !ai.isConfigured();
}

// Prove a key works before storing it, so a bad paste fails here with a clear
// message instead of surfacing later as a confusing mid-conversation error.
async function validateKey(key) {
  await ai.complete({
    system: 'Reply with the single word: ok',
    messages: [{ role: 'user', content: 'ok' }],
    maxTokens: 512,
    apiKey: key,
  });
}

function friendlyKeyError(err) {
  const rejected = err.status === 502 && /rejected/i.test(err.message);
  return rejected
    ? "Google didn't accept that key. Check you copied all of it, then try again."
    : err.message;
}

function normalizeKey(raw) {
  return raw.trim().replace(/^["']|["']$/g, '');
}

// ---- Server-level setup (local single-user install only) --------------------

router.get('/status', (req, res) => {
  res.json({ configured: ai.isConfigured(), local: serverSetupAvailable(req) });
});

router.post(
  '/key',
  asyncHandler(async (req, res) => {
    if (ai.isConfigured()) {
      return res.status(409).json({ error: 'An API key is already configured.' });
    }
    if (!serverSetupAvailable(req)) {
      return res.status(403).json({
        error: 'This app is running as a shared deployment. Sign in and add your key in Settings instead.',
      });
    }

    const { key } = req.body || {};
    if (typeof key !== 'string' || !key.trim()) {
      return res.status(400).json({ error: 'Please paste your API key.' });
    }
    const trimmed = normalizeKey(key);

    process.env.GEMINI_API_KEY = trimmed;
    try {
      await validateKey(trimmed);
    } catch (err) {
      delete process.env.GEMINI_API_KEY;
      return res.status(err.status === 429 ? 429 : 400).json({ error: friendlyKeyError(err) });
    }

    try {
      const existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
      const separator = existing && !existing.endsWith('\n') ? '\n' : '';
      fs.appendFileSync(ENV_PATH, `${separator}GEMINI_API_KEY=${trimmed}\n`);
    } catch (err) {
      // The key works and is live in memory, so the app is usable right now —
      // it just won't survive a restart. Say exactly that rather than failing.
      return res.status(200).json({
        ok: true,
        persisted: false,
        error: `Your key works, but saving it to .env failed (${err.code || err.message}). The app will work until you close it, then ask again.`,
      });
    }

    res.json({ ok: true, persisted: true });
  })
);

// ---- Per-user keys ----------------------------------------------------------

router.get('/me/key', requireAuth, (req, res) => {
  res.json({
    hasOwnKey: Boolean(apiKeys.getUserKey(req.user.id)),
    usingServerKey: apiKeys.usingServerKey(req.user.id),
    ready: apiKeys.hasKey(req.user.id),
  });
});

router.put(
  '/me/key',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { key } = req.body || {};
    if (typeof key !== 'string' || !key.trim()) {
      return res.status(400).json({ error: 'Please paste your API key.' });
    }
    const trimmed = normalizeKey(key);

    try {
      await validateKey(trimmed);
    } catch (err) {
      return res.status(err.status === 429 ? 429 : 400).json({ error: friendlyKeyError(err) });
    }

    apiKeys.setUserKey(req.user.id, trimmed);
    res.json({ ok: true });
  })
);

router.delete('/me/key', requireAuth, (req, res) => {
  apiKeys.clearUserKey(req.user.id);
  res.json({ ok: true, usingServerKey: apiKeys.usingServerKey(req.user.id) });
});

module.exports = router;
