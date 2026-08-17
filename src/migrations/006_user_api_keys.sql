-- Each user brings their own Gemini key.
--
-- On a shared deployment the server's own key would be spent by whoever happens
-- to be chatting: the free tier allows about five requests a minute in total,
-- so two people studying at once collide. Google also attributes every prompt
-- to the key's owner. Storing a key per user keeps both the rate limit and the
-- attribution where they belong.
--
-- Kept in its own table rather than a users column so the secret isn't pulled
-- into memory by the ordinary `SELECT * FROM users` that runs on every request.
CREATE TABLE user_api_keys (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'gemini',
  api_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
