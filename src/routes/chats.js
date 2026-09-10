'use strict';

const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');
const { getTrack, isTrackKey, getPhases, getPhaseByKey, getSystemPrompt, getTutorSystemPrompt } = require('../prompts');
const ai = require('../services/ai');
const apiKeys = require('../services/apiKeys');
const usage = require('../services/usage');

const router = express.Router();
const MAX_HISTORY_MESSAGES = 24;

router.use(requireAuth);

function chatSummary(row) {
  return {
    id: row.id,
    mode: row.mode,
    track: row.mode === 'tutor' ? null : getTrack(row.mode).key,
    title: row.title,
    topic: row.topic,
    phaseKey: row.phase_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function loadOwnedChat(userId, chatId) {
  return db.prepare('SELECT * FROM chats WHERE id = ? AND user_id = ?').get(Number(chatId), userId);
}

router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM chats WHERE user_id = ? AND archived_at IS NULL ORDER BY updated_at DESC')
    .all(req.user.id);
  res.json({ chats: rows.map(chatSummary) });
});

router.post('/', (req, res) => {
  const { mode, topic } = req.body || {};
  // 'tutor' is freeform and has no phases; everything else is a coached track.
  const chatMode = mode === 'tutor' ? 'tutor' : isTrackKey(mode) ? mode : 'study';
  const now = new Date().toISOString();
  const initialPhase = chatMode === 'tutor' ? null : getPhases(chatMode)[0].key;

  const info = db
    .prepare(
      `INSERT INTO chats (user_id, mode, title, topic, phase_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, chatMode, topic || null, topic || null, initialPhase, now, now);

  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json({ chat: chatSummary(chat) });
});

router.get('/:id', (req, res) => {
  const chat = loadOwnedChat(req.user.id, req.params.id);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });

  const messages = db
    .prepare('SELECT role, content, hidden, created_at FROM messages WHERE chat_id = ? ORDER BY id ASC')
    .all(chat.id)
    .filter((m) => !m.hidden)
    .map((m) => ({ role: m.role, content: m.content, createdAt: m.created_at }));

  res.json({ chat: chatSummary(chat), messages });
});

router.patch('/:id', (req, res) => {
  const chat = loadOwnedChat(req.user.id, req.params.id);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });

  const { title, phaseKey, archived } = req.body || {};
  if (phaseKey !== undefined && phaseKey !== null && !getPhaseByKey(phaseKey, chat.mode)) {
    return res.status(400).json({ error: `Unknown phase: ${phaseKey}` });
  }

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE chats SET
       title = COALESCE(?, title),
       phase_key = COALESCE(?, phase_key),
       archived_at = CASE WHEN ? = 1 THEN ? ELSE archived_at END,
       updated_at = ?
     WHERE id = ?`
  ).run(title ?? null, phaseKey ?? null, archived ? 1 : 0, now, now, chat.id);

  const updated = db.prepare('SELECT * FROM chats WHERE id = ?').get(chat.id);
  res.json({ chat: chatSummary(updated) });
});

router.delete('/:id', (req, res) => {
  const chat = loadOwnedChat(req.user.id, req.params.id);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  db.prepare('DELETE FROM chats WHERE id = ?').run(chat.id);
  res.status(204).end();
});

router.post(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const chat = loadOwnedChat(req.user.id, req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    const { content, hidden } = req.body || {};
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }

    // Hidden messages are system-generated nudges (e.g. "Next Phase" clicks), not a real user turn.
    if (!hidden) {
      const limitCheck = usage.checkLimit(req.user.id, 'ai_messages');
      if (!limitCheck.ok) {
        return res.status(429).json({
          error: `You've hit your ${usage.periodLabel(limitCheck.period)} limit on the free plan. Upgrade for more.`,
          code: 'limit_reached',
          plan: limitCheck.plan,
          upgradeAvailable: limitCheck.plan === 'free',
        });
      }
    }

    const now = new Date().toISOString();
    const inserted = db
      .prepare('INSERT INTO messages (chat_id, role, content, hidden, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(chat.id, 'user', content, hidden ? 1 : 0, now);
    const userMessageId = Number(inserted.lastInsertRowid);

    const history = db
      .prepare('SELECT role, content FROM messages WHERE chat_id = ? ORDER BY id ASC')
      .all(chat.id)
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content }));

    const lang = req.user.language;
    const system =
      chat.mode === 'tutor'
        ? getTutorSystemPrompt(chat.topic, lang)
        : getSystemPrompt(
            (getPhaseByKey(chat.phase_key, chat.mode) || getPhases(chat.mode)[0]).key,
            chat.topic,
            chat.mode,
            lang
          );

    // The user's turn is already stored so it can be part of the history above.
    // If the AI call fails — rate limits make that routine on the free tier —
    // take it back out, otherwise retrying the same message would stack a
    // duplicate copy into the conversation.
    let reply;
    try {
      reply = await ai.complete({ system, messages: history, apiKey: apiKeys.resolveKey(req.user.id) });
    } catch (err) {
      db.prepare('DELETE FROM messages WHERE id = ?').run(userMessageId);
      throw err;
    }

    db.prepare(
      'INSERT INTO messages (chat_id, role, content, hidden, created_at) VALUES (?, ?, ?, 0, ?)'
    ).run(chat.id, 'assistant', reply, new Date().toISOString());
    db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), chat.id);

    if (!hidden) {
      usage.increment(req.user.id, 'ai_messages');
    }

    res.json({ reply });
  })
);

module.exports = router;
