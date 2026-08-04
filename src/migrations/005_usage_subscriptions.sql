CREATE TABLE usage_counters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  counter_type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, period_key, counter_type)
);

CREATE INDEX idx_usage_counters_user_id ON usage_counters(user_id);
