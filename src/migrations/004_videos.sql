CREATE TABLE videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  youtube_id TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  author TEXT,
  transcript_source TEXT NOT NULL DEFAULT 'none',
  transcript TEXT,
  summary TEXT,
  fetched_at TEXT NOT NULL
);

CREATE TABLE video_summary_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_video_summary_views_user_id ON video_summary_views(user_id);
