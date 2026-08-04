'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { PHASES, getPhaseByKey, getSystemPrompt } = require('./src/prompts');

const PORT = process.env.PORT || 3000;
const MODEL_ID = process.env.MODEL_ID || 'claude-sonnet-5';
const MAX_HISTORY_MESSAGES = 24;

const apiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/phases', (_req, res) => {
  res.json({ phases: PHASES });
});

app.post('/api/chat', async (req, res) => {
  try {
    if (!anthropic) {
      return res.status(503).json({
        error:
          'Server is missing ANTHROPIC_API_KEY. Copy .env.example to .env, add your key, and restart the server.',
      });
    }

    const { topic, phaseKey, messages } = req.body || {};

    const phase = getPhaseByKey(phaseKey);
    if (!phase) {
      return res.status(400).json({ error: `Unknown phase: ${phaseKey}` });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages must be a non-empty array' });
    }

    const trimmed = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-MAX_HISTORY_MESSAGES);

    const system = getSystemPrompt(phase.key, topic);

    const response = await anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 1024,
      system,
      messages: trimmed.map((m) => ({ role: m.role, content: m.content })),
    });

    const reply = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    res.json({ reply });
  } catch (err) {
    console.error('Error in /api/chat:', err);
    res.status(500).json({ error: 'Something went wrong talking to the model. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`Study Buddy running at http://localhost:${PORT}`);
  if (!anthropic) {
    console.warn('Warning: ANTHROPIC_API_KEY is not set. Set it in a .env file to enable chat.');
  }
});
