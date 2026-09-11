-- Paying from Iran.
--
-- Stripe does not serve Iran, so the existing checkout could never be used by
-- the people this site is for. ZarinPal is the gateway they can actually pay
-- through, and it is a redirect flow rather than a hosted subscription: the
-- app records an intent, sends the customer away, and confirms when they come
-- back. That needs a row per attempt, which Stripe's model did not.
CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- ZarinPal's handle for the attempt. Unique so a replayed callback - a
  -- refresh, a double-click, someone re-opening the return URL - cannot be
  -- verified and credited twice.
  authority TEXT UNIQUE NOT NULL,

  -- What we asked for, in Toman, after any discount. Verification must send
  -- back exactly this, so it is stored rather than recomputed: prices change.
  amount INTEGER NOT NULL,
  discount_code TEXT,

  status TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | failed
  ref_id TEXT,                             -- the bank's reference, shown to the payer
  created_at TEXT NOT NULL,
  settled_at TEXT
);

CREATE INDEX idx_payments_user_id ON payments(user_id);

-- One code per account, handed out at sign-up and emailed to them.
CREATE TABLE discount_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  percent INTEGER NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  used_at TEXT,
  emailed_at TEXT
);

CREATE INDEX idx_discount_codes_user_id ON discount_codes(user_id);
