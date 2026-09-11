'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const PORT = process.env.PORT || 3000;

// The database is opened at require time and refuses to start on an old
// runtime or an unwritable path. Catch that here rather than letting the
// process die, so the reason can be served instead of vanishing into a log.
let DB_PATH;
let onSeparateVolume;
let bootFailure = null;
try {
  ({ DB_PATH, onSeparateVolume } = require('./src/db'));
} catch (err) {
  if (!err.bootFailure) throw err;
  bootFailure = err;
}
if (bootFailure) {
  const app = express();
  const body = `Buddy cannot start.\n\n${bootFailure.message}\n`;

  // Every path, so it does not matter where the reader lands. 503 rather than
  // 500: this is a configuration problem that a redeploy fixes, and it keeps
  // the page out of search results in the meantime.
  app.use((_req, res) => {
    res.status(503).type('text/plain; charset=utf-8').send(body);
  });

  app.listen(PORT, () => {
    console.error(`Serving the failure above at http://localhost:${PORT} until it is fixed.`);
  });

  return;
}

const { attachUser } = require('./src/middleware/auth');
const { errorHandler } = require('./src/middleware/errors');
const { TRACKS, PHASES } = require('./src/prompts');
const ai = require('./src/services/ai');
const authRoutes = require('./src/routes/auth');
const chatsRoutes = require('./src/routes/chats');
const tasksRoutes = require('./src/routes/tasks');
const videoRoutes = require('./src/routes/video');
const settingsRoutes = require('./src/routes/settings');
const billingRoutes = require('./src/routes/billing');
const setupRoutes = require('./src/routes/setup');

const app = express();

// Hosts like Render/Railway/Fly terminate TLS at a proxy and forward over plain
// HTTP, so without this req.protocol is always 'http' and any absolute URL we
// build (Stripe redirects, OAuth callbacks) points at the wrong scheme.
app.set('trust proxy', 1);

// Stripe webhook needs the raw body for signature verification, so it must be
// parsed before the global JSON body parser touches the request stream.
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(attachUser);
app.use(express.static(path.join(__dirname, 'public')));

// KaTeX is served from the app rather than a CDN. Both this server and most of
// its readers are in Iran, where a good many CDNs are unreachable - maths that
// renders for only some visitors is worse than maths that renders for none.
app.use(
  '/vendor/katex',
  express.static(path.join(__dirname, 'node_modules', 'katex', 'dist'), {
    maxAge: '30d',
    immutable: true,
  })
);

// The marketing page is index.html at /; the application itself lives at /app.
// Served explicitly because express.static only resolves index.html by
// directory, and app.html has no directory of its own.
app.get('/app', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// Clean URLs for the two legal pages, the way /app is served above. They are
// linked from the footer, from the signup screen, and - the reason the tidy URL
// matters - pasted into Google's OAuth consent screen and ZarinPal's merchant
// form, where a visible .html looks like something half-finished.
app.get('/privacy', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'legal', 'privacy.html'));
});

app.get('/terms', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'legal', 'terms.html'));
});

app.get('/api/phases', (_req, res) => {
  // `phases` is the study track, kept so an older cached client still works.
  res.json({ phases: PHASES, tracks: TRACKS });
});

app.get('/api/config', (_req, res) => {
  res.json({
    googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/setup', setupRoutes);

app.use(errorHandler);

// On a managed host the boot log is the only window into what the app actually
// resolved, and it is the first thing anyone asks for when a deploy misbehaves.
// Printing the settings that decide behaviour turns "it doesn't work" into a
// question that answers itself.
//
// Deliberately never the key itself, only whether one arrived: deploy logs get
// pasted into chats and issues.
function bootSummary() {
  const separate = onSeparateVolume();
  const disk =
    separate === true ? 'on its own disk' : separate === false ? 'on the container filesystem' : 'location unknown';

  const lines = [
    `  node      ${process.versions.node}`,
    `  database  ${DB_PATH}  (${disk})`,
    `  ai        ${ai.BASE_URL}`,
    `  model     ${ai.MODEL_ID}${ai.isConfigured() ? '' : '   (no key set — the AI cannot reply yet)'}`,
  ];

  if (require('./src/services/usage').UNLOCK_ALL) {
    lines.push('  tracks    ALL UNLOCKED — every plan has every track (UNLOCK_ALL_TRACKS=1)');
  }

  if (process.env.SHARED_API_KEY === '1') {
    lines.push('  shared    on — every signed-in user spends this key');
  }

  console.log(lines.join('\n'));

  // The one that silently destroys data rather than just failing.
  if (separate === false && process.env.NODE_ENV === 'production') {
    console.warn(
      '\n  WARNING: the database is not on a mounted disk.\n' +
        '  Every account, chat and task will be erased on the next deploy.\n' +
        '  Attach a disk to the folder above and redeploy.\n'
    );
  }
}

app.listen(PORT, () => {
  console.log(`Buddy running at http://localhost:${PORT}`);
  bootSummary();

  // A malformed AI_BASE_URL fails on the first message with a network error
  // that names nothing. It is worth one line here: a doubled scheme from a
  // paste - "https:https://..." - is exactly the sort of thing that is
  // invisible in a settings panel and obvious in a log.
  //
  // The shape check lives in ai.js, so the diagnostic endpoint below asks the
  // same question rather than repeating the reasoning.
  if (ai.baseUrlLooksWrong()) {
    console.error(
      `\n  WARNING: AI_BASE_URL is not a usable URL:\n    ${ai.BASE_URL}\n` +
        '  Every message will fail until it is fixed. It should read\n' +
        '  https://host/path - one scheme only, no trailing slash.\n' +
        '  Not corrected automatically: your API key is sent to this address,\n' +
        '  so it is not somewhere to guess at what you meant.\n' +
        '  Signed in, open /api/setup/ai-check to test it live.\n'
    );
  }

  // Deployed with no AI settings at all means the defaults are in use, and the
  // default is Google. A server that cannot reach Google will fail every single
  // message with a network error that says nothing about the cause, so say it
  // here instead, while someone is still looking at the log.
  if (process.env.NODE_ENV === 'production' && ai.BASE_URL.includes('googleapis.com')) {
    console.warn(
      '\n  WARNING: AI_BASE_URL is unset, so this is pointed at Google.\n' +
        '  Google is unreachable from some regions - notably Iran - and every\n' +
        '  message will fail with a connection error. Set AI_BASE_URL,\n' +
        '  MODEL_ID and AI_API_KEY to your provider.\n'
    );
  }

  if (!ai.isConfigured()) {
    console.warn(
      `Note: no AI API key yet. You don't need to edit any files — open http://localhost:${PORT} and paste your key into the setup screen. Get a free one at https://aistudio.google.com/apikey`
    );
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('Note: GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set — Google sign-in stays disabled until configured.');
  } else {
    // The other half of the same note. Google refuses with
    // redirect_uri_mismatch and names no value, so the one string that has to
    // match belongs in the log the operator is already reading after a deploy.
    const { GOOGLE_CALLBACK_PATH } = require('./src/services/appUrl');
    const known = process.env.GOOGLE_REDIRECT_URI
      ? process.env.GOOGLE_REDIRECT_URI.trim().replace(/\/+$/, '')
      : process.env.APP_URL
        ? process.env.APP_URL.trim().replace(/\/+$/, '') + GOOGLE_CALLBACK_PATH
        : null;
    if (known) {
      console.log(`Google sign-in: register this exact redirect URI\n  ${known}`);
    } else {
      // Without APP_URL the address depends on the request, so the app can only
      // report it while answering one.
      console.log(
        'Google sign-in: register the redirect URI this app sends. To see it,\n' +
          `  open <your site>${GOOGLE_CALLBACK_PATH.replace('/callback', '/redirect-uri')}`
      );
    }
  }
  const zarinpal = require('./src/services/zarinpal');
  if (!zarinpal.isConfigured() && !process.env.STRIPE_SECRET_KEY) {
    console.warn('Note: no payment gateway configured — set ZARINPAL_MERCHANT_ID to enable upgrades.');
  }
});
