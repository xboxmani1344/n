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
const { appOrigin, googleCallbackUrl } = require('../services/appUrl');

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

// The language the person is actually reading. Sent by the signup form, which
// knows what it is showing; the header is the fallback for a client that does
// not send it. The account's own preference takes over from the first save.
function requestedLanguage(req, body) {
  if (body && (body.language === 'fa' || body.language === 'en')) return body.language;
  return /(^|,)\s*fa\b/i.test(req.headers['accept-language'] || '') ? 'fa' : 'en';
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createUserWithFreeSubscription({ email, passwordHash, displayName, language }) {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      'INSERT INTO users (email, password_hash, display_name, theme, language, created_at)' +
        ' VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(
      email.toLowerCase(),
      passwordHash,
      displayName || null,
      'system',
      language === 'fa' ? 'fa' : 'en',
      now
    );
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
  welcomeEmail.sendWelcome(user, appOrigin(req));
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
    const userId = createUserWithFreeSubscription({
      email,
      passwordHash,
      displayName,
      language: requestedLanguage(req, req.body),
    });
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

// Prints the exact string this app sends to Google, so it can be copied into
// the OAuth client's "Authorized redirect URIs" instead of guessed at.
//
// redirect_uri_mismatch names no value, and neither did this app, which left
// no way to tell a wrong path from a wrong scheme from the wrong box in the
// console. Open, select, paste.
//
// Not behind requireAuth and not gated on Google being configured: it is most
// needed before sign-in works at all, and it discloses only this app's own
// public address - the one already in the visitor's address bar.
router.get('/google/redirect-uri', (req, res) => {
  res.type('text/plain').send(googleCallbackUrl(req));
});

// Every way a Google sign-in can end badly, as a code the browser carries back
// to /app.
//
// This used to be a set of plain-text pages - "Google sign-in failed. Please
// try again." - in English, in an app whose users read Persian, naming no cause
// and offering no way back to the form. A dead end is the worst possible answer
// to a sign-in problem, because the person cannot tell whether to retry, use a
// password, or give up.
//
// Rides along on the router so the interface's dictionary can be checked
// against this list rather than a second copy of it that would drift.
const AUTH_ERROR_CODES = ['off', 'expired', 'access_denied', 'google', 'noemail', 'unverified'];
router.AUTH_ERROR_CODES = AUTH_ERROR_CODES;

function authFailed(res, code) {
  return res.redirect(`/app?auth_error=${encodeURIComponent(code)}`);
}

// The browser gets a code; the log gets the diagnosis. Google's refusals name
// their cause precisely and each one has exactly one fix, so saying which is
// the difference between a five-minute correction and another day of guessing.
function explainTokenRefusal(reason, callbackUrl) {
  if (reason === 'invalid_client') {
    return '  GOOGLE_CLIENT_SECRET does not match GOOGLE_CLIENT_ID. Both belong to one OAuth client in Google Cloud - copy them from the same place.';
  }
  if (reason === 'redirect_uri_mismatch') {
    return `  What is registered in Google Cloud is not what this app sent.\n  Register exactly, character for character: ${callbackUrl}`;
  }
  if (reason === 'invalid_grant') {
    return '  The code was already spent or has expired - usually a refreshed callback page. Harmless on its own.';
  }
  return `  The redirect URI this app sends is: ${callbackUrl}`;
}

router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  // Reached by following a link, not by fetch, so a JSON body would land in
  // the address bar as raw text.
  if (!clientId) return authFailed(res, 'off');

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 10 * 60 * 1000,
  });

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', googleCallbackUrl(req));
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
    if (!clientId || !clientSecret) return authFailed(res, 'off');

    const { code, state } = req.query;
    const expectedState = req.cookies ? req.cookies[GOOGLE_STATE_COOKIE] : null;
    res.clearCookie(GOOGLE_STATE_COOKIE);

    // Google says why it is sending somebody back empty-handed, and this never
    // read it. Declining the consent screen - by far the most common of these -
    // looked exactly like a broken app.
    if (req.query.error) {
      const said = String(req.query.error);
      if (said !== 'access_denied') {
        console.error(`Google sign-in: Google refused with "${said}".\n${explainTokenRefusal(said, googleCallbackUrl(req))}`);
      }
      // Anything other than a plain decline is reported as a Google-side
      // failure: inventing a message for a code with no wording behind it
      // would show the person an empty error.
      return authFailed(res, said === 'access_denied' ? 'access_denied' : 'google');
    }

    if (!code || !state || state !== expectedState) return authFailed(res, 'expired');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: googleCallbackUrl(req),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => '');
      let reason = '';
      let described = '';
      try {
        const parsed = JSON.parse(body);
        reason = parsed.error || '';
        described = parsed.error_description || '';
      } catch {
        /* a non-JSON refusal still has a status worth logging */
      }
      console.error(
        `Google sign-in: the token endpoint refused (${tokenRes.status}${reason ? ` ${reason}` : ''}${described ? ` - ${described}` : ''}).\n` +
          explainTokenRefusal(reason, googleCallbackUrl(req))
      );
      return authFailed(res, 'google');
    }
    const tokenData = await tokenRes.json();

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileRes.ok) {
      console.error(`Google sign-in: the profile endpoint refused (${profileRes.status}).`);
      return authFailed(res, 'google');
    }
    const profile = await profileRes.json();

    if (!profile.email) return authFailed(res, 'noemail');

    const now = new Date().toISOString();
    const existingAccount = db
      .prepare('SELECT * FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?')
      .get('google', profile.sub);

    let userId;
    if (existingAccount) {
      userId = existingAccount.user_id;
    } else {
      const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(profile.email.toLowerCase());

      // Matching on the email address is how a Google sign-in joins up with an
      // account someone already made with a password. That match is only safe
      // if Google says it verified the address: an unverified one is a string
      // the signer-in typed, so honouring it would hand over any account whose
      // email could be guessed. Google sends email_verified for exactly this.
      if (existingUser && profile.email_verified !== true) return authFailed(res, 'unverified');

      userId = existingUser
        ? existingUser.id
        : createUserWithFreeSubscription({
            email: profile.email,
            passwordHash: null,
            displayName: profile.name,
            // No form to read here, so the browser's own header decides.
            language: requestedLanguage(req, null),
          });
      if (!existingUser) sendWelcome(userId, req);

      db.prepare(
        'INSERT INTO oauth_accounts (user_id, provider, provider_user_id, created_at) VALUES (?, ?, ?, ?)'
      ).run(userId, 'google', profile.sub, now);
    }

    const session = createSession(userId, req.headers['user-agent']);
    setSessionCookie(res, session.id);
    // Not '/': that is the marketing page, and someone who has just signed in
    // has already read it.
    res.redirect('/app');
  })
);

module.exports = router;
