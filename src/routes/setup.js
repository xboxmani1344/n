'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { asyncHandler } = require('../middleware/errors');
const ai = require('../services/ai');

const router = express.Router();

const ENV_PATH = path.join(process.cwd(), '.env');

// Setup is only reachable from the machine running the server. Read the socket
// address directly rather than req.ip: 'trust proxy' is enabled for deployment,
// which makes req.ip follow a client-supplied X-Forwarded-For header.
function isLocalRequest(req) {
  const addr = req.socket.remoteAddress || '';
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

router.get('/status', (req, res) => {
  res.json({ configured: ai.isConfigured(), local: isLocalRequest(req) });
});

router.post(
  '/key',
  asyncHandler(async (req, res) => {
    // Once a key is in place, this endpoint stops existing. Otherwise it would
    // be a way to swap the server's credentials at runtime.
    if (ai.isConfigured()) {
      return res.status(409).json({ error: 'An API key is already configured.' });
    }

    if (!isLocalRequest(req)) {
      return res.status(403).json({
        error: 'For safety, the API key can only be set from the computer running the app.',
      });
    }

    const { key } = req.body || {};
    if (typeof key !== 'string' || !key.trim()) {
      return res.status(400).json({ error: 'Please paste your API key.' });
    }

    const trimmed = key.trim().replace(/^["']|["']$/g, '');

    // A key that looks fine can still be rejected by Google. Prove it works
    // before writing it to disk, so a bad paste is caught here rather than
    // surfacing later as a confusing error mid-conversation.
    process.env.GEMINI_API_KEY = trimmed;
    try {
      await ai.complete({
        system: 'Reply with the single word: ok',
        messages: [{ role: 'user', content: 'ok' }],
        maxTokens: 512,
      });
    } catch (err) {
      delete process.env.GEMINI_API_KEY;

      // ai.js phrases a rejected key as "check your .env file", which is the
      // right advice everywhere except here, where the user just pasted into a
      // box and has no idea what .env is.
      const rejected = err.status === 502 && /rejected/i.test(err.message);
      const message = rejected
        ? "Google didn't accept that key. Check you copied all of it, then try again."
        : err.message;

      return res.status(err.status === 429 ? 429 : 400).json({ error: message });
    }

    // Append so anything already in .env (Google or Stripe settings) survives.
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

module.exports = router;
