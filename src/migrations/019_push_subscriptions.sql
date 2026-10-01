-- Where to send a notification.
--
-- One row per browser, not per person: somebody with a phone and a laptop has
-- two, and signing out of one must not silence the other.
--
-- Worth saying plainly, because it is the reason this may turn out to be
-- wasted work: on Android Chrome a push is delivered through Google's own
-- servers. Where those are not reachable - which is a daily fact of life for
-- the people this app is for - the message is not delayed, it simply never
-- arrives, and nothing anywhere reports a failure. This is built because it
-- costs little and might work; it is not something to rely on until somebody
-- on a real Iranian connection has seen one land.
CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- The push service's URL for this browser. Unique, because re-subscribing
  -- the same browser must update the row rather than collect duplicates and
  -- send somebody the same notification four times.
  endpoint TEXT NOT NULL UNIQUE,

  -- The browser's half of the encryption. Every payload is encrypted to these
  -- before it leaves, so the push service carries ciphertext it cannot read.
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,

  created_at TEXT NOT NULL,

  -- Set when the push service says the subscription is dead (404/410). Kept
  -- rather than deleted for one pass so a transient error cannot quietly
  -- unsubscribe somebody.
  failed_at TEXT
);

CREATE INDEX idx_push_user ON push_subscriptions(user_id);
