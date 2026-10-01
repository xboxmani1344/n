'use strict';

const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');
const {
  getTrack,
  isTrackKey,
  getPhases,
  getPhaseByKey,
  getSystemPrompt,
  getTutorSystemPrompt,
  normalizeSkills,
} = require('../prompts');
const ai = require('../services/ai');
const apiKeys = require('../services/apiKeys');
const usage = require('../services/usage');
const progress = require('../services/progress');
const taskProposals = require('../services/taskProposals');
const referrals = require('../services/referrals');

// What the server will accept as a photograph of a question.
//
// The browser shrinks the picture before sending it, but the browser is a
// convenience and this is the rule: a request that skips the page entirely
// still cannot put four megabytes in a row. Half a megabyte is comfortably
// more than a 1280px photo of a test paper and comfortably less than the 1mb
// body limit, leaving room for the question alongside it.
const MAX_IMAGE_BYTES = 500 * 1024;

// Listed rather than sniffed. These are the three a phone camera or a
// screenshot produces, they are the three every vision model accepts, and
// anything else is either a mistake or someone trying it on.
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Returns the bytes to store, or a sentence saying why not.
function readImage(image) {
  if (image === undefined || image === null) return { bytes: null, type: null, error: null };
  if (typeof image !== 'object' || typeof image.data !== 'string' || typeof image.type !== 'string') {
    return { error: 'That image could not be read.' };
  }
  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    return { error: 'Photos need to be JPEG, PNG or WebP.' };
  }

  let bytes;
  try {
    bytes = Buffer.from(image.data, 'base64');
  } catch {
    return { error: 'That image could not be read.' };
  }
  // Buffer.from does not throw on rubbish, it returns whatever it could
  // decode - so an empty result means the input was not base64 at all.
  if (!bytes.length) return { error: 'That image could not be read.' };
  if (bytes.length > MAX_IMAGE_BYTES) {
    return { error: 'That photo is too large. Try again - the app usually shrinks it for you.' };
  }
  return { bytes, type: image.type, error: null };
}

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
    skills: skillsOf(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// The column holds JSON, and a column can hold anything a past version wrote.
// Parsing failures and keys that no longer exist both come back as "no skills"
// rather than throwing on the way to a prompt.
function skillsOf(chatRow) {
  try {
    return normalizeSkills(JSON.parse(chatRow.skills || '[]'));
  } catch {
    return [];
  }
}

function loadOwnedChat(userId, chatId) {
  return db.prepare('SELECT * FROM chats WHERE id = ? AND user_id = ?').get(Number(chatId), userId);
}

// The two tracks where a language model is answering questions about someone's
// body, and so the two that show a notice before the first session.
const NEEDS_SAFETY_NOTICE = new Set(['diet', 'workout']);

function hasAcknowledged(userId, track) {
  return Boolean(
    db
      .prepare('SELECT 1 FROM safety_acknowledgements WHERE user_id = ? AND track = ?')
      .get(userId, track)
  );
}

// Records that the notice was shown and accepted. Idempotent - reopening the
// dialog and accepting again keeps the first timestamp, which is the one that
// says when they were actually told.
router.post('/safety-notice', (req, res) => {
  const { track } = req.body || {};
  if (!NEEDS_SAFETY_NOTICE.has(track)) {
    return res.status(400).json({ error: 'Unknown track.' });
  }

  db.prepare(
    `INSERT INTO safety_acknowledgements (user_id, track, acknowledged_at) VALUES (?, ?, ?)
     ON CONFLICT (user_id, track) DO NOTHING`
  ).run(req.user.id, track, new Date().toISOString());

  res.json({ ok: true, track });
});

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

  // Enforced here, not in the interface. The buttons for locked tracks are
  // hidden client-side, but hiding a button is decoration - the check that
  // matters is the one a hand-written POST also has to pass.
  const plan = usage.getPlan(req.user.id);
  if (!usage.canUseTrack(plan, chatMode)) {
    return res.status(403).json({
      error: 'That track is not included in your plan.',
      code: 'track_locked',
      track: chatMode,
      requiredPlan: usage.planForTrack(chatMode),
      plan,
    });
  }
  // Same reasoning as the plan check above: the dialog is in the interface, but
  // the interface is decoration. A hand-written POST has to pass this too, or
  // "they were told" is a thing we hope rather than a thing we know.
  if (NEEDS_SAFETY_NOTICE.has(chatMode) && !hasAcknowledged(req.user.id, chatMode)) {
    return res.status(409).json({
      error: 'This track shows a safety notice before the first session.',
      code: 'safety_notice_required',
      track: chatMode,
    });
  }

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
    .prepare(
      'SELECT id, role, content, hidden, created_at, (image IS NOT NULL) AS has_image FROM messages WHERE chat_id = ? ORDER BY id ASC'
    )
    .all(chat.id)
    .filter((m) => !m.hidden)
    .map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
      // A path rather than the bytes: a conversation with a dozen photographs
      // in it would otherwise be megabytes of JSON before the first one is
      // on screen, and the browser can cache these individually.
      imageUrl: m.has_image ? `/api/chats/${chat.id}/messages/${m.id}/image` : null,
    }));

  res.json({ chat: chatSummary(chat), messages });
});

// Behind the same ownership check as the conversation it belongs to - the
// chat is loaded by owner first, and the message by chat, so neither id can
// be swapped for somebody else's.
router.get('/:id/messages/:messageId/image', (req, res) => {
  const chat = loadOwnedChat(req.user.id, req.params.id);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });

  const row = db
    .prepare('SELECT image, image_type FROM messages WHERE id = ? AND chat_id = ?')
    .get(Number(req.params.messageId), chat.id);
  if (!row || !row.image) return res.status(404).json({ error: 'No image on that message' });

  // Private, because it is: one person's photograph of their own homework,
  // behind a session cookie. Immutable because a message's picture never
  // changes once it is sent.
  res.set('Cache-Control', 'private, max-age=31536000, immutable');
  res.type(row.image_type || 'application/octet-stream').send(Buffer.from(row.image));
});

router.patch('/:id', (req, res) => {
  const chat = loadOwnedChat(req.user.id, req.params.id);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });

  const { title, phaseKey, archived, skills } = req.body || {};
  if (phaseKey !== undefined && phaseKey !== null && !getPhaseByKey(phaseKey, chat.mode)) {
    return res.status(400).json({ error: `Unknown phase: ${phaseKey}` });
  }

  // Normalised rather than rejected: an unknown key is almost always a client
  // left over from before a rename, and dropping it quietly is kinder than
  // failing the whole save. COALESCE keeps the stored set when none is sent.
  const skillsJson = skills === undefined ? null : JSON.stringify(normalizeSkills(skills));

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE chats SET
       title = COALESCE(?, title),
       phase_key = COALESCE(?, phase_key),
       skills = COALESCE(?, skills),
       archived_at = CASE WHEN ? = 1 THEN ? ELSE archived_at END,
       updated_at = ?
     WHERE id = ?`
  ).run(title ?? null, phaseKey ?? null, skillsJson, archived ? 1 : 0, now, now, chat.id);

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

    const { content, hidden, image } = req.body || {};
    const picture = readImage(image);
    if (picture.error) return res.status(400).json({ error: picture.error, code: 'bad_image' });

    // A photograph on its own is a question - "what is this?" - so the text
    // may be empty when there is one. Requiring a caption would mean typing
    // something meaningless to send the thing being asked about.
    if (typeof content !== 'string' || (!content.trim() && !picture.bytes)) {
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
      .prepare(
        'INSERT INTO messages (chat_id, role, content, hidden, created_at, image, image_type) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(chat.id, 'user', content, hidden ? 1 : 0, now, picture.bytes, picture.type);
    const userMessageId = Number(inserted.lastInsertRowid);

    // Which messages have a picture, without reading any of them. Selecting
    // the blobs here would pull every photograph in the conversation into
    // memory to send two.
    const history = db
      .prepare(
        'SELECT id, role, content, (image IS NOT NULL) AS has_image FROM messages WHERE chat_id = ? ORDER BY id ASC'
      )
      .all(chat.id)
      .slice(-MAX_HISTORY_MESSAGES);

    const carrying = new Set(
      history.filter((m) => m.has_image).slice(-ai.MAX_IMAGES_IN_CONTEXT).map((m) => m.id)
    );
    const pictures = new Map();
    for (const id of carrying) {
      const row = db.prepare('SELECT image, image_type FROM messages WHERE id = ?').get(id);
      if (row && row.image) pictures.set(id, { data: Buffer.from(row.image), type: row.image_type });
    }

    const historyForAi = history.map((m) => ({
      role: m.role,
      content: m.content,
      // Left undefined rather than null: the adapter tests for truthiness and
      // a null would read as "had one, dropped it" and add the note.
      ...(m.has_image ? { image: pictures.get(m.id) || { dropped: true } } : {}),
    }));

    const chatPlan = usage.getPlan(req.user.id);
    if (!usage.canUseTrack(chatPlan, chat.mode)) {
      // Reachable without any trickery: a plan can lapse while an old chat of
      // that track is still sitting in the sidebar.
      return res.status(403).json({
        error: 'That track is not included in your plan.',
        code: 'track_locked',
        track: chat.mode,
        requiredPlan: usage.planForTrack(chat.mode),
        plan: chatPlan,
      });
    }

    const lang = req.user.language;
    const chatSkills = skillsOf(chat);
    // Read per message rather than held on the chat: someone who corrects
    // their exam date should not have to start a new conversation for the
    // coach to know it.
    const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.user.id);
    const system =
      chat.mode === 'tutor'
        ? getTutorSystemPrompt(chat.topic, lang, chatSkills, profile)
        : getSystemPrompt(
            (getPhaseByKey(chat.phase_key, chat.mode) || getPhases(chat.mode)[0]).key,
            chat.topic,
            chat.mode,
            lang,
            chatSkills,
            profile
          );

    // The user's turn is already stored so it can be part of the history above.
    // If the AI call fails — rate limits make that routine on the free tier —
    // take it back out, otherwise retrying the same message would stack a
    // duplicate copy into the conversation.
    let reply;
    try {
      reply = await ai.complete({ system, messages: historyForAi, apiKey: apiKeys.resolveKey(req.user.id) });
    } catch (err) {
      db.prepare('DELETE FROM messages WHERE id = ?').run(userMessageId);
      throw err;
    }

    // The proposal block is an instruction to this app, not something to show
    // anybody. Stripped before the reply is stored, not just before it is
    // displayed: left in the row it would be read back into the next prompt as
    // though the coach had already said it, and it would reappear verbatim
    // when the conversation is reopened.
    const { text: visibleReply, tasks: proposedTasks } = taskProposals.parse(reply);

    db.prepare(
      'INSERT INTO messages (chat_id, role, content, hidden, created_at) VALUES (?, ?, ?, 0, ?)'
    ).run(chat.id, 'assistant', visibleReply, new Date().toISOString());
    // After the reply, not before: a call that failed is not a day's work, and
    // on the free tier failing is routine.
    progress.recordActivity(req.user.id);
    // The same moment is when a referral stops being a row and becomes a
    // user. Cheap: one indexed lookup that finds nothing for everybody who
    // was never invited, which is almost everybody.
    referrals.rewardIfEarned(req.user.id);
    db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), chat.id);

    if (!hidden) {
      usage.increment(req.user.id, 'ai_messages');
    }

    // Proposed, not created. Nothing reaches the planner until somebody says
    // so - a coach that quietly fills it with twenty entries is not a coach.
    res.json({ reply: visibleReply, proposedTasks });
  })
);

module.exports = router;
