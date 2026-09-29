-- What the coach knows about the person it is coaching.
--
-- Every chat used to start cold: no field of study, no year, no goal, no date
-- anything is due. A coach that has to be told who you are at the start of
-- every conversation is a chatbot wearing a coach's name.
--
-- One row per user, cascading with the account so deletion stays the single
-- statement it already is.
--
-- Deliberately nothing medical - no weight, no conditions, no measurements -
-- even though the diet and workout coaches would use them. Holding health data
-- changes what the privacy policy has to promise and what a breach would cost,
-- and that is a decision to take on its own rather than one to inherit from a
-- memory feature.
CREATE TABLE user_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- Free text on purpose. "کنکور تجربی ۱۴۰۵" and "ارشد کامپیوتر" and "سال دهم"
  -- are all answers to the same question, and a dropdown would have to guess
  -- which ones exist.
  study_level TEXT,
  goal TEXT,
  -- A plain YYYY-MM-DD date. The countdown reads it; nothing parses it as a
  -- timestamp, because "the exam is on the 14th" has no time of day.
  exam_at TEXT,
  hours_per_day REAL,
  -- The things that do not fit a field: works nights, weak at geometry, has
  -- three months left. The part a real coach would remember.
  notes TEXT,
  updated_at TEXT NOT NULL
);
