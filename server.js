'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

require('./src/db');
const { attachUser } = require('./src/middleware/auth');
const { errorHandler } = require('./src/middleware/errors');
const { PHASES } = require('./src/prompts');
const authRoutes = require('./src/routes/auth');
const chatsRoutes = require('./src/routes/chats');
const tasksRoutes = require('./src/routes/tasks');
const videoRoutes = require('./src/routes/video');
const settingsRoutes = require('./src/routes/settings');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(attachUser);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/phases', (_req, res) => {
  res.json({ phases: PHASES });
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

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Study Buddy running at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('Warning: ANTHROPIC_API_KEY is not set. Set it in a .env file to enable chat.');
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('Note: GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set — Google sign-in stays disabled until configured.');
  }
});
