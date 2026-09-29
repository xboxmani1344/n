-- One row per day a person actually did something. The streak is counted from
-- these and nothing else.
--
-- A separate table rather than reading usage_counters, which already records
-- per-day rows. Those keys are built in UTC (see periodKey in
-- src/services/usage.js), which is right for a quota - a day is a day, and
-- where the user sleeps is not the billing system's business - and wrong here.
-- A day boundary at 00:00 UTC is 03:30 in Tehran, so a student working at one
-- in the morning would be told they had broken a streak they had just extended.
-- A streak that lies about last night is worse than having no streak.
--
-- So: days keyed to Tehran, written whenever real work happens, and quota
-- accounting left alone.
CREATE TABLE activity_days (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- YYYY-MM-DD as it reads on a wall in Tehran, not as it reads in UTC.
  day TEXT NOT NULL,
  PRIMARY KEY (user_id, day)
);

CREATE INDEX idx_activity_days_user ON activity_days(user_id, day DESC);
