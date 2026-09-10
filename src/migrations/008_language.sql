-- The interface, and the coach, speak Persian or English.
--
-- Stored beside `theme` because it behaves the same way: a per-account display
-- preference that follows the user to a new browser. The client also keeps it
-- in localStorage, which is what the first paint reads -- waiting for this
-- column to arrive over the network would flip the whole layout after render.
--
-- 'en' as the default only decides what an account created before this
-- migration gets; a new visitor's language is detected from their browser and
-- saved on their first choice.
ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'en';

-- Summaries are written in the language of whoever asked for them, so they
-- cannot stay in `videos` -- that table is one row per YouTube video, and the
-- second person to summarize a video in another language would have been
-- handed the first person's.
--
-- Splitting them keeps the expensive half shared: the transcript is fetched
-- once per video regardless of language, and only the summarizing is repeated.
CREATE TABLE video_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (video_id, language)
);

-- Everything summarized before today was necessarily in English.
INSERT INTO video_summaries (video_id, language, summary, created_at)
SELECT id, 'en', summary, fetched_at FROM videos WHERE summary IS NOT NULL AND summary <> '';
