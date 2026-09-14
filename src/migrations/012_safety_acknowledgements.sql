-- Who has been shown the safety notice, and when.
--
-- The nutrition and training tracks put a language model in front of someone
-- asking about their body. The terms of service say Buddy is not a doctor, but
-- a terms page is not where anyone reads it, so the notice is shown in the app
-- before the first session of those tracks.
--
-- Stored per account rather than in the browser: it should follow someone to a
-- new phone, and "we told them" ought to be a fact on the server rather than a
-- flag the reader can clear by opening a private window.
--
-- One row per track, not one per user: the nutrition warning and the training
-- warning say different things, and agreeing to one is not agreeing to the
-- other.
CREATE TABLE safety_acknowledgements (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track TEXT NOT NULL,
  acknowledged_at TEXT NOT NULL,
  PRIMARY KEY (user_id, track)
);
