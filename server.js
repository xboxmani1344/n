'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

require('./src/db');
const { attachUser } = require('./src/middleware/auth');
const { errorHandler } = require('./src/middleware/errors');
const { TRACKS, PHASES } = require('./src/prompts');
const authRoutes = require('./src/routes/auth');
const chatsRoutes = require('./src/routes/chats');
const tasksRoutes = require('./src/routes/tasks');
const videoRoutes = require('./src/routes/video');
const settingsRoutes = require('./src/routes/settings');
const billingRoutes = require('./src/routes/billing');
const setupRoutes = require('./src/routes/setup');

const PORT = process.env.PORT || 3000;

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

// The marketing page is index.html at /; the application itself lives at /app.
// Served explicitly because express.static only resolves index.html by
// directory, and app.html has no directory of its own.
app.get('/app', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
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

app.listen(PORT, () => {
  console.log(`Study Buddy running at http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn(
      `Note: no Gemini API key yet. You don't need to edit any files — open http://localhost:${PORT} and paste your key into the setup screen. Get a free one at https://aistudio.google.com/apikey`
    );
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('Note: GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set — Google sign-in stays disabled until configured.');
  }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    console.warn('Note: STRIPE_SECRET_KEY/STRIPE_PRICE_ID not set — upgrades stay disabled until configured.');
  }
});
