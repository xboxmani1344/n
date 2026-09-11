-- Deleting an account must not erase the record that money moved.
--
-- payments.user_id was NOT NULL ... ON DELETE CASCADE, so the delete-account
-- button added alongside this migration would have taken the operator's own
-- financial history with it - the rows needed for accounting and for any
-- dispute with ZarinPal, which holds its side of them regardless.
--
-- The row now survives with the person detached from it: amount, ref_id and
-- dates stay, user_id becomes NULL. That is what the privacy policy describes,
-- and it is the reason it can describe it truthfully.
--
-- SQLite cannot alter a constraint, so the table is rebuilt. Every existing row
-- is copied first; nothing is dropped until the copy is in place.

CREATE TABLE payments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Nullable now, and cleared rather than cascaded when the account goes.
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

  authority TEXT UNIQUE NOT NULL,

  -- In Rial. (The 009 comment says Toman; the code has always sent IRR -
  -- src/services/zarinpal.js. Recorded here rather than edited there, because
  -- an applied migration is a historical record.)
  amount INTEGER NOT NULL,
  discount_code TEXT,

  status TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | failed
  ref_id TEXT,
  created_at TEXT NOT NULL,
  settled_at TEXT,
  plan TEXT
);

INSERT INTO payments_new (id, user_id, authority, amount, discount_code, status, ref_id, created_at, settled_at, plan)
SELECT id, user_id, authority, amount, discount_code, status, ref_id, created_at, settled_at, plan FROM payments;

DROP TABLE payments;
ALTER TABLE payments_new RENAME TO payments;

-- Dropped with the old table.
CREATE INDEX idx_payments_user_id ON payments(user_id);
