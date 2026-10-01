-- Bringing someone with you.
--
-- There was no way at all for one user to produce a second one. The discount
-- machinery was already finished - codes, validation, percentages, single use -
-- and the only thing missing was the idea of having been invited.

-- One share code per account, made when it is first asked for rather than at
-- sign-up: most accounts will never open the invite card, and a code nobody
-- has seen is a row nobody needed.
ALTER TABLE users ADD COLUMN invite_code TEXT;
CREATE UNIQUE INDEX idx_users_invite_code ON users(invite_code) WHERE invite_code IS NOT NULL;

-- discount_codes held exactly one row per account, because the only code there
-- was came with the welcome email. A referral reward is a second kind of code,
-- so the two have to be told apart - otherwise issuing a reward would silently
-- hand back the sign-up code and look like it had worked.
--
-- Existing rows default to 'signup', which is what every one of them is.
ALTER TABLE discount_codes ADD COLUMN kind TEXT NOT NULL DEFAULT 'signup';

CREATE TABLE referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- UNIQUE, so an account can be the invited one exactly once, ever. Without
  -- it, deleting and re-creating an account would pay the same inviter again.
  invited_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  created_at TEXT NOT NULL,

  -- Null until the invited account has actually used the app. The reward is
  -- deliberately not paid at sign-up: that would price a referral at the cost
  -- of a throwaway email address, and somebody would notice.
  rewarded_at TEXT
);

CREATE INDEX idx_referrals_inviter ON referrals(inviter_id);
