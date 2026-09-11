'use strict';

const crypto = require('crypto');
const express = require('express');
const { db } = require('../db');
const {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} = require('../services/auth');
const { asyncHandler } = require('../middleware/errors');
const discounts = require('../services/discounts');
const welcomeEmail = require('../services/welcomeEmail');

const router = express.Router();
const isProd = process.env.NODE_ENV === 'production';
const GOOGLE_STATE_COOKIE = 'sb_oauth_state';

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: SESSION_TTL_MS,
  });
}

function publicUser(user) {
  return { id: user.id, email: user.email, displayName: user.display_name, theme: user.theme };
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createUserWithFreeSubscription({ email, passwordHash, displayName }) {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      'INSERT INTO users (email, password_hash, display_name, theme, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(email.toLowerCase(), passwordHash, displayName || null, 'system', now);
  const userId = Number(info.lastInsertRowid);

  db.prepare(
    'INSERT INTO subscriptions (user_id, plan, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, 'free', 'active', now, now);

  // Their welcome discount. Issued here rather than at the first upgrade so it
  // exists in time to be emailed, and so it is the same code either way.
  discounts.issueForUser(userId);

  return userId;
}

// Sent without being waited on: a mail server having a bad afternoon must not
// turn into a failed signup.
function sendWelcome(userId, req) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return;
  const origin = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  welcomeEmail.sendWelcome(user, origin.replace(/\/$/, ''));
}

router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { email, password, displayName } = req.body || {};
    if (!isValidEmail(email) || typeof password !== 'string' || password.length < 8) {
      return res
        .status(400)
        .json({ error: 'A valid email and a password of at least 8 characters are required.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await hashPassword(password);
    const userId = createUserWithFreeSubscription({ email, passwordHash, displayName });
    sendWelcome(userId, req);

    const session = createSession(userId, req.headers['user-agent']);
    setSessionCookie(res, session.id);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.status(201).json({ user: publicUser(user) });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!isValidEmail(email) || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    const ok = user && (await verifyPassword(password, user.password_hash));
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const session = createSession(user.id, req.headers['user-agent']);
    setSessionCookie(res, session.id);
    res.json({ user: publicUser(user) });
  })
);

router.post('/logout', (req, res) => {
  const token = req.cookies ? req.cookies[SESSION_COOKIE] : null;
  if (token) deleteSession(token);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user: publicUser(req.user) });
});

function googleRedirectUri(req) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  return `${proto}://${req.get('host')}/api/auth/google/callback`;
}

router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({ error: 'Google sign-in is not configured yet.' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 10 * 60 * 1000,
  });

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', googleRedirectUri(req));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  res.redirect(url.toString());
});

router.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(503).send('Google sign-in is not configured yet.');
    }

    const { code, state } = req.query;
    const expectedState = req.cookies ? req.cookies[GOOGLE_STATE_COOKIE] : null;
    res.clearCookie(GOOGLE_STATE_COOKIE);

    if (!code || !state || state !== expectedState) {
      return res.status(400).send('That sign-in attempt expired or was invalid. Please try again.');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: googleRedirectUri(req),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      return res.status(502).send('Google sign-in failed. Please try again.');
    }
    const tokenData = await tokenRes.json();

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileRes.ok) {
      return res.status(502).send('Google sign-in failed. Please try again.');
    }
    const profile = await profileRes.json();

    if (!profile.email) {
      return res.status(502).send('Google did not share an email address. Please try again.');
    }

    const now = new Date().toISOString();
    const existingAccount = db
      .prepare('SELECT * FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?')
      .get('google', profile.sub);

    let userId;
    if (existingAccount) {
      userId = existingAccount.user_id;
    } else {
      const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(profile.email.toLowerCase());
      userId = existingUser
        ? existingUser.id
        : createUserWithFreeSubscription({
            email: profile.email,
            passwordHash: null,
            displayName: profile.name,
          });
      if (!existingUser) sendWelcome(userId, req);

      db.prepare(
        'INSERT INTO oauth_accounts (user_id, provider, provider_user_id, created_at) VALUES (?, ?, ?, ?)'
      ).run(userId, 'google', profile.sub, now);
    }

    const session = createSession(userId, req.headers['user-agent']);
    setSessionCookie(res, session.id);
    res.redirect('/');
  })
);

module.exports = router;
