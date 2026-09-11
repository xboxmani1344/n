'use strict';

// Where this app lives, as one answer.
//
// Three places used to work this out for themselves - the payment return, the
// welcome-email link, and the Google callback - and they had already drifted:
// the Google one ignored APP_URL, which is the one place a difference is fatal,
// because Google compares the redirect_uri character for character and refuses
// on any mismatch.

// The path is a constant rather than a literal at each call site, so the string
// the app sends and the string the docs tell an operator to register in Google
// Console cannot come apart.
const GOOGLE_CALLBACK_PATH = '/api/auth/google/callback';

// APP_URL first: behind a proxy the headers describe the hop, not necessarily
// the address people type. `trust proxy` is on (server.js), so req.protocol
// already reflects X-Forwarded-Proto; the header is read directly as well for
// hosts that forward it without the proxy chain Express expects.
function appOrigin(req) {
  if (process.env.APP_URL) return process.env.APP_URL.trim().replace(/\/+$/, '');
  const proto = (req && req.headers && req.headers['x-forwarded-proto']) || (req && req.protocol) || 'http';
  // A proxy may forward a list - "https,http" - in which case the first entry
  // is the one the client actually spoke.
  const scheme = String(proto).split(',')[0].trim();
  return `${scheme}://${req.get('host')}`;
}

function googleCallbackUrl(req) {
  const explicit = process.env.GOOGLE_REDIRECT_URI;
  if (explicit) return explicit.trim().replace(/\/+$/, '');
  return appOrigin(req) + GOOGLE_CALLBACK_PATH;
}

module.exports = { appOrigin, googleCallbackUrl, GOOGLE_CALLBACK_PATH };
