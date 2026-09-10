'use strict';

const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');
const { extractYoutubeId, fetchMetadata, fetchTranscript } = require('../services/youtube');
const ai = require('../services/ai');
const apiKeys = require('../services/apiKeys');
const usage = require('../services/usage');
const { VIDEO_SUMMARY_PROMPT, VIDEO_CHUNK_PROMPT, VIDEO_REDUCE_PROMPT, languageLine } = require('../prompts');

const router = express.Router();
router.use(requireAuth);

const CHUNK_THRESHOLD = 120000; // characters — above this we map-reduce instead of single-pass
const CHUNK_SIZE = 90000;

function splitIntoChunks(text, size) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + size, text.length);
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end);
      if (lastSpace > i) end = lastSpace;
    }
    chunks.push(text.slice(i, end).trim());
    i = end;
  }
  return chunks.filter(Boolean);
}

// Ceilings are deliberately well above the length these prompts ask for: the
// model's thinking tokens are drawn from the same budget, and on a long
// transcript they alone can run into the hundreds. Generation still stops when
// the model is done, so headroom costs nothing.
const SUMMARY_MAX_TOKENS = 8192;
const CHUNK_MAX_TOKENS = 2048;

async function summarizeTranscript(transcript, title, apiKey, lang) {
  const titleLine = title ? `\n\nVideo title: "${title}"` : '';
  // Only the notes the user reads are translated. The intermediate per-segment
  // notes stay in English: they are fed back to the model, never displayed, and
  // round-tripping them through Persian only loses detail.
  const langLine = languageLine(lang);

  if (transcript.length <= CHUNK_THRESHOLD) {
    return ai.complete({
      system: `${VIDEO_SUMMARY_PROMPT}${titleLine}${langLine}`,
      messages: [{ role: 'user', content: transcript }],
      maxTokens: SUMMARY_MAX_TOKENS,
      apiKey,
    });
  }

  const chunks = splitIntoChunks(transcript, CHUNK_SIZE);
  const chunkSummaries = [];
  for (const chunk of chunks) {
    const summary = await ai.complete({
      system: VIDEO_CHUNK_PROMPT,
      messages: [{ role: 'user', content: chunk }],
      maxTokens: CHUNK_MAX_TOKENS,
      apiKey,
    });
    chunkSummaries.push(summary);
  }

  const combined = chunkSummaries.map((s, i) => `Segment ${i + 1} notes:\n${s}`).join('\n\n');
  return ai.complete({
    system: `${VIDEO_REDUCE_PROMPT}${titleLine}${langLine}`,
    messages: [{ role: 'user', content: combined }],
    maxTokens: SUMMARY_MAX_TOKENS,
    apiKey,
  });
}

function videoOut(v, summary) {
  return {
    id: v.id,
    youtubeId: v.youtube_id,
    url: v.url,
    title: v.title,
    author: v.author,
    summary: summary !== undefined ? summary : v.summary,
  };
}

function findSummary(videoId, lang) {
  const row = db
    .prepare('SELECT summary FROM video_summaries WHERE video_id = ? AND language = ?')
    .get(videoId, lang);
  return row ? row.summary : null;
}

function saveSummary(videoId, lang, summary) {
  db.prepare(
    `INSERT INTO video_summaries (video_id, language, summary, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (video_id, language) DO UPDATE SET summary = excluded.summary, created_at = excluded.created_at`
  ).run(videoId, lang, summary, new Date().toISOString());
}

router.post(
  '/summarize',
  asyncHandler(async (req, res) => {
    const { url, transcript: manualTranscript } = req.body || {};
    if (typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'A YouTube URL is required.' });
    }

    const youtubeId = extractYoutubeId(url.trim());
    if (!youtubeId) {
      return res.status(400).json({ error: "That doesn't look like a valid YouTube URL." });
    }

    const lang = req.user.language;
    let video = db.prepare('SELECT * FROM videos WHERE youtube_id = ?').get(youtubeId);
    let summary = video ? findSummary(video.id, lang) : null;
    const cached = Boolean(summary) && !manualTranscript;

    if (!cached) {
      const limitCheck = usage.checkLimit(req.user.id, 'video_summaries');
      if (!limitCheck.ok) {
        return res.status(429).json({
          error: `You've hit your ${usage.periodLabel(limitCheck.period)} limit on the free plan. Upgrade for more.`,
          code: 'limit_reached',
          plan: limitCheck.plan,
          upgradeAvailable: limitCheck.plan === 'free',
        });
      }

      let transcriptText;
      let transcriptSource;

      if (typeof manualTranscript === 'string' && manualTranscript.trim()) {
        transcriptText = manualTranscript.trim();
        transcriptSource = 'manual';
      } else if (video && video.transcript) {
        // Already fetched for another language. The transcript does not change,
        // and re-fetching risks YouTube's bot detection for nothing.
        transcriptText = video.transcript;
        transcriptSource = video.transcript_source;
      } else {
        try {
          const result = await fetchTranscript(youtubeId);
          transcriptText = result.transcript;
          transcriptSource = 'captions';
        } catch (err) {
          const status = err.code === 'no_transcript' ? 422 : 502;
          return res.status(status).json({ error: err.message, code: err.code || 'fetch_failed' });
        }
      }

      const meta = video && video.title ? { title: video.title, author: video.author } : await fetchMetadata(url.trim());
      summary = await summarizeTranscript(transcriptText, meta.title, apiKeys.resolveKey(req.user.id), lang);
      const now = new Date().toISOString();

      if (video) {
        db.prepare(
          `UPDATE videos SET title = ?, author = ?, transcript_source = ?, transcript = ?, fetched_at = ?
           WHERE id = ?`
        ).run(meta.title || null, meta.author || null, transcriptSource, transcriptText, now, video.id);
        video = db.prepare('SELECT * FROM videos WHERE id = ?').get(video.id);
      } else {
        const info = db
          .prepare(
            `INSERT INTO videos (youtube_id, url, title, author, transcript_source, transcript, fetched_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(youtubeId, url.trim(), meta.title || null, meta.author || null, transcriptSource, transcriptText, now);
        video = db.prepare('SELECT * FROM videos WHERE id = ?').get(Number(info.lastInsertRowid));
      }

      saveSummary(video.id, lang, summary);
      usage.increment(req.user.id, 'video_summaries');
    }

    db.prepare('INSERT INTO video_summary_views (user_id, video_id, created_at) VALUES (?, ?, ?)').run(
      req.user.id,
      video.id,
      new Date().toISOString()
    );

    res.json({ video: videoOut(video, summary), cached });
  })
);

router.get('/summaries', (req, res) => {
  // A video the user opened is listed whether or not a summary exists in their
  // current language; opening it re-summarizes rather than showing a blank.
  const rows = db
    .prepare(
      `SELECT videos.*, video_summaries.summary AS lang_summary,
              MAX(video_summary_views.created_at) as viewed_at
       FROM video_summary_views
       JOIN videos ON videos.id = video_summary_views.video_id
       LEFT JOIN video_summaries
              ON video_summaries.video_id = videos.id AND video_summaries.language = ?
       WHERE video_summary_views.user_id = ?
       GROUP BY videos.id
       ORDER BY viewed_at DESC`
    )
    .all(req.user.language, req.user.id);

  res.json({
    videos: rows.map((v) => ({ ...videoOut(v, v.lang_summary), viewedAt: v.viewed_at })),
  });
});

module.exports = router;
