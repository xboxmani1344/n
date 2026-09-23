'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');
const ai = require('../services/ai');
const apiKeys = require('../services/apiKeys');
const email = require('../services/email');
const zarinpal = require('../services/zarinpal');
const usage = require('../services/usage');
const { DB_PATH, onSeparateVolume } = require('../db');
const { TIDIED } = require('../env');
const { appOrigin, googleCallbackUrl } = require('../services/appUrl');

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

// Everything a fresh deployment can be silently wrong about, on one page.
//
// This project has now lost time four separate ways to the same shape of
// problem: a doubled scheme in AI_BASE_URL, a redirect URI Google would not
// match, a database sitting on a filesystem the next deploy throws away, and a
// subdomain with a deadline nobody saw. Each was invisible until something
// failed much later, and each was solved by adding somewhere to look. There
// were three such places by the end and no way to know which to check.
//
// Every answer here comes from the function that already decides it elsewhere,
// so this page cannot drift from the boot log or from the behaviour itself.
//
// Behind requireAuth, which on a brand-new app means signing up first. That is
// useful rather than annoying: it proves the database takes writes before
// anything else on the page is worth believing.
router.get('/health', requireAuth, (req, res) => {
  const lines = [];
  const problems = [];

  // A hint with no label of its own hangs off the line above it, rather than
  // printing an empty padded line first.
  const say = (label, value, hint) => {
    if (label || value) lines.push(`${label.padEnd(12)} ${value}`);
    if (hint) lines.push(`${' '.repeat(12)} ${hint}`);
  };
  const flag = (label, value, hint) => {
    problems.push(label.trim());
    say(label, value, hint);
  };

  // Before anything else, so a page read from a stale deploy gives itself away
  // rather than being trusted.
  say('build', `${require('../version').STAMP}   (compare with npm run stamp)`);
  lines.push('');

  // First, because it is the one that destroys data rather than failing.
  const separate = onSeparateVolume();
  if (separate === true) say('database', `${DB_PATH}  (on its own disk)`);
  else if (separate === false)
    flag('database', `${DB_PATH}  (on the container filesystem)`,
      'NOT on a disk - everything here is wiped by the next deploy. Attach one and set DB_PATH into it.');
  else say('database', `${DB_PATH}  (cannot tell where this is)`);

  // A relative DB_PATH is measured from wherever the process happens to have
  // started, which on a host is a coincidence rather than a decision.
  if (!path.isAbsolute(DB_PATH)) {
    problems.push('database');
    say('', '', `DB_PATH is not an absolute path, so it is measured from ${process.cwd()} - almost certainly not what was meant.`);
  }

  // Whitespace that arrived with a pasted value. Worth a line of its own: the
  // variables here are printed with it already stripped, so without this the
  // page would show a value that is not the one in the panel.
  lines.push('');
  if (!TIDIED.length) say('env', 'no stray whitespace in any variable');
  else
    flag('env', `${TIDIED.length} variable(s) arrived with stray whitespace`,
      `${TIDIED.map((v) => `${v.name} had ${v.had}`).join('; ')}. Running on the trimmed values - fix them in the panel.`);

  lines.push('');
  say('address', appOrigin(req) + (process.env.APP_URL ? '   (from APP_URL)' : '   (guessed from this request)'));
  if (!process.env.APP_URL) {
    say('', '', 'Set APP_URL once the domain is settled: the payment return and the Google callback are both built from it.');
  }

  lines.push('');
  if (!ai.isConfigured()) flag('ai', 'NO KEY - the coach cannot reply', 'Set AI_API_KEY.');
  else if (ai.BASE_URL_WAS_CORRECTED)
    flag('ai', `${ai.RAW_BASE_URL}`, `Two schemes in AI_BASE_URL. Working around it with ${ai.BASE_URL} - fix the variable.`);
  else if (ai.baseUrlLooksWrong()) flag('ai', ai.BASE_URL, 'Not a usable URL. It should read https://host/path.');
  else say('ai', ai.BASE_URL);
  say('model', ai.MODEL_ID, 'Test it live at /api/setup/ai-check');

  lines.push('');
  const googleOn = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  say('google', googleOn ? 'configured' : 'off - the sign-in button stays disabled');
  if (googleOn) say('', '', `Register exactly: ${googleCallbackUrl(req)}`);

  lines.push('');
  say('email', email.isConfigured() ? 'configured' : 'off - discount codes are issued but never sent');
  say('payments', zarinpal.isConfigured() ? 'ZarinPal configured' : 'off - nobody can upgrade');

  if (usage.UNLOCK_ALL) {
    lines.push('');
    flag('tracks', 'ALL UNLOCKED', 'UNLOCK_ALL_TRACKS=1 - every plan has every coach. Unset it before charging anyone.');
  }

  lines.push('');
  lines.push(problems.length ? `${problems.length} thing(s) to fix: ${problems.join(', ')}` : 'Everything configured.');

  res.type('text/plain').send(lines.join('\n'));
});

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

    lines.push(`AI_BASE_URL  ${ai.RAW_BASE_URL}`);
    if (ai.BASE_URL_WAS_CORRECTED) {
      lines.push('             ^ this has two schemes in it. Being worked around by using:');
      lines.push(`               ${ai.BASE_URL}`);
      lines.push('               Still fix the variable - the workaround is not a promise.');
    }
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
