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
    ? "That key wasn't accepted. Check you copied all of it, then try again."
    : err.message;
}

function normalizeKey(raw) {
  return raw.trim().replace(/^["']|["']$/g, '');
}

// ---- Server-level setup (local single-user install only) --------------------

// A live test of the AI settings, in plain text, for the person running the
// site to open on a phone.
//
// "Couldn't reach the AI service" is all a chat bubble can honestly say - the
// person chatting can fix none of it and should not be shown internal
// addresses. But then nobody could see whether the address was wrong, the key
// was refused, or the host simply is not reachable from here. This makes one
// real request and says which of those it was.
//
// Behind requireAuth, and it never prints the key - only whether one is set and
// how long it is, which is enough to tell an empty variable from a truncated
// paste.
router.get(
  '/ai-check',
  requireAuth,
  asyncHandler(async (req, res) => {
    const key = apiKeys.resolveKey(req.user.id);
    const lines = [];

    lines.push(`AI_BASE_URL  ${ai.BASE_URL}`);
    if (ai.baseUrlLooksWrong()) {
      lines.push('             ^ this is not a usable URL. It should be https://host/path,');
      lines.push('               one scheme only. A doubled "https:https://" is the usual cause.');
    }
    lines.push(`MODEL_ID     ${ai.MODEL_ID}`);
    lines.push(`API key      ${key ? `set, ${key.length} characters` : 'NOT SET'}`);
    lines.push('');

    if (!key) {
      lines.push('No key, so there is nothing to test. Set AI_API_KEY.');
      return res.type('text/plain').send(lines.join('\n'));
    }

    lines.push(`Sending one short message to ${ai.BASE_URL}/chat/completions ...`);
    lines.push('');

    const started = Date.now();
    try {
      await ai.complete({
        system: 'Reply with the single word: ok',
        messages: [{ role: 'user', content: 'ok' }],
        maxTokens: 512,
        apiKey: key,
      });
      lines.push(`WORKING — replied in ${Date.now() - started} ms.`);
      lines.push('The address, the key and the model name are all good.');
    } catch (err) {
      lines.push(`FAILED after ${Date.now() - started} ms.`);
      lines.push('');
      lines.push(err.message);

      // complete() already turned the cause into a sentence; show it here so it
      // does not take a log dive to read.
      if (err.networkDetail) {
        lines.push('');
        lines.push('It never connected, so this is the address - not the key and not the model.');
        lines.push(err.networkDetail);
      }
    }

    res.type('text/plain').send(lines.join('\n'));
  })
);

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

    process.env.AI_API_KEY = trimmed;
    try {
      await validateKey(trimmed);
    } catch (err) {
      delete process.env.AI_API_KEY;
      return res.status(err.status === 429 ? 429 : 400).json({ error: friendlyKeyError(err) });
    }

    try {
      const existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
      const separator = existing && !existing.endsWith('\n') ? '\n' : '';
      fs.appendFileSync(ENV_PATH, `${separator}AI_API_KEY=${trimmed}\n`);
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
