-- The daily nudge, and the right to stop it.
--
-- Off by default, and it stays off until somebody asks for it. Email nobody
-- requested is how a sending domain ends up blacklisted, and this one also
-- carries the welcome message and the discount codes - the cost of getting it
-- wrong is not a few annoyed readers, it is every email the app sends going to
-- spam.
ALTER TABLE users ADD COLUMN reminders_on INTEGER NOT NULL DEFAULT 0;

-- Unsubscribing must not require signing in. Somebody reading this on a phone
-- at seven in the morning, who has forgotten their password, still gets to
-- make it stop - one link, one click. Issued when the reminders are switched
-- on, so an account that never wanted them has no token to leak.
ALTER TABLE users ADD COLUMN reminder_token TEXT;

-- The guard against sending twice. A container restart re-runs the timer from
-- the beginning, and without a record of the last send that would mean a
-- second copy of the same digest - the single fastest way to teach somebody to
-- filter your mail.
ALTER TABLE users ADD COLUMN last_reminder_at TEXT;

CREATE UNIQUE INDEX idx_users_reminder_token ON users(reminder_token) WHERE reminder_token IS NOT NULL;
