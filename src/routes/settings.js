'use strict';

const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');
const { hashPassword, verifyPassword, SESSION_COOKIE } = require('../services/auth');
const { transaction } = require('../db');
const { PROFILE_FIELDS } = require('../prompts');
const reminders = require('../services/reminders');

const router = express.Router();
router.use(requireAuth);

const VALID_THEMES = new Set(['system', 'light', 'dark']);
const VALID_LANGUAGES = new Set(['en', 'fa']);

function usageSummary(userId) {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId);
  return {
    plan: sub ? sub.plan : 'free',
    status: sub ? sub.status : 'active',
  };
}

// The profile the coach reads before every reply. Shaped for the form that
// edits it, so the interface never has to translate between two vocabularies.
//
// One place decides what a profile is - src/prompts.js, which is what actually
// consumes it. A second list here would drift, and the drift would be silent:
// a field saved and never read looks exactly like a field that works.
const PROFILE_KEYS = PROFILE_FIELDS.map(([field]) => field);

// A date the countdown can subtract, or nothing. A half-typed "2027-0" must not
// reach the database as though it meant something.
function cleanExamDate(value) {
  if (value === null || value === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : String(value);
}

function profileOut(userId) {
  const row = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
  const out = {};
  for (const key of PROFILE_KEYS) out[key] = row ? row[key] : null;
  return out;
}

function settingsOut(user) {
  return {
    displayName: user.display_name,
    email: user.email,
    theme: user.theme,
    language: user.language,
    remindersOn: Boolean(user.reminders_on),
    hasPassword: Boolean(user.password_hash),
  };
}

router.get('/', (req, res) => {
  res.json({
    settings: settingsOut(req.user),
    profile: profileOut(req.user.id),
    subscription: usageSummary(req.user.id),
  });
});

router.patch('/', (req, res) => {
  const { displayName, theme, language, profile, remindersOn } = req.body || {};

  if (theme !== undefined && !VALID_THEMES.has(theme)) {
    return res.status(400).json({ error: `Invalid theme: ${theme}` });
  }
  if (language !== undefined && !VALID_LANGUAGES.has(language)) {
    return res.status(400).json({ error: `Invalid language: ${language}` });
  }

  db.prepare(
    `UPDATE users SET
       display_name = CASE WHEN ? THEN ? ELSE display_name END,
       theme = COALESCE(?, theme),
       language = COALESCE(?, language)
     WHERE id = ?`
  ).run(
    displayName !== undefined ? 1 : 0,
    displayName ?? null,
    theme ?? null,
    language ?? null,
    req.user.id
  );

  // Its own call rather than a column in the UPDATE below, because switching
  // them on also has to issue the token the unsubscribe link is built from.
  if (remindersOn !== undefined) reminders.setReminders(req.user.id, Boolean(remindersOn));

  if (profile && typeof profile === 'object') {
    const examDate = profile.exam_at === undefined ? undefined : cleanExamDate(profile.exam_at);
    if (examDate === undefined && profile.exam_at !== undefined) {
      return res.status(400).json({ error: 'The exam date should look like 2027-06-20.', code: 'bad_date' });
    }

    // Hours are a rough number someone types about their own life, not a
    // measurement. Reject the absurd, round the rest, and do not argue about
    // whether it is 2 or 2.5.
    let hours;
    if (profile.hours_per_day !== undefined) {
      if (profile.hours_per_day === null || profile.hours_per_day === '') hours = null;
      else {
        hours = Number(profile.hours_per_day);
        if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
          return res.status(400).json({ error: 'Hours in a day is somewhere between 0 and 24.', code: 'bad_hours' });
        }
      }
    }

    const text = (value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      // Capped because it all goes into every prompt this person ever sends -
      // an essay pasted here would be paid for on every message.
      const trimmed = String(value).trim().slice(0, 500);
      return trimmed === '' ? null : trimmed;
    };

    const next = {
      study_level: text(profile.study_level),
      goal: text(profile.goal),
      exam_at: examDate,
      hours_per_day: hours,
      notes: text(profile.notes),
    };

    // One statement so a first save and a later edit are the same code path.
    // Undefined means "not mentioned in this request" and has to keep whatever
    // is stored, which is what each COALESCE(?, column) does.
    db.prepare(
      `INSERT INTO user_profiles (user_id, study_level, goal, exam_at, hours_per_day, notes, updated_at)
       VALUES (@user_id, @study_level, @goal, @exam_at, @hours_per_day, @notes, @updated_at)
       ON CONFLICT(user_id) DO UPDATE SET
         study_level   = CASE WHEN @set_study_level  THEN @study_level  ELSE study_level  END,
         goal          = CASE WHEN @set_goal         THEN @goal         ELSE goal         END,
         exam_at       = CASE WHEN @set_exam_at      THEN @exam_at      ELSE exam_at      END,
         hours_per_day = CASE WHEN @set_hours        THEN @hours_per_day ELSE hours_per_day END,
         notes         = CASE WHEN @set_notes        THEN @notes        ELSE notes        END,
         updated_at    = @updated_at`
    ).run({
      user_id: req.user.id,
      study_level: next.study_level ?? null,
      goal: next.goal ?? null,
      exam_at: next.exam_at ?? null,
      hours_per_day: next.hours_per_day ?? null,
      notes: next.notes ?? null,
      updated_at: new Date().toISOString(),
      set_study_level: next.study_level !== undefined ? 1 : 0,
      set_goal: next.goal !== undefined ? 1 : 0,
      set_exam_at: next.exam_at !== undefined ? 1 : 0,
      set_hours: next.hours_per_day !== undefined ? 1 : 0,
      set_notes: next.notes !== undefined ? 1 : 0,
    });
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ settings: settingsOut(updated), profile: profileOut(req.user.id) });
});

router.patch(
  '/password',
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const user = req.user;

    if (user.password_hash) {
      const ok = typeof currentPassword === 'string' && (await verifyPassword(currentPassword, user.password_hash));
      if (!ok) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
    }

    const newHash = await hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);

    res.json({ ok: true });
  })
);

// Deleting an account, for real: every row belonging to this person goes.
//
// Re-authenticated rather than taken on the session cookie alone. The cookie is
// SameSite=Lax, so a cross-site POST cannot reach here, but a shared or
// unattended browser can - and this is the one action in the app with nothing
// behind it.
router.delete(
  '/account',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const { password, email } = req.body || {};

    if (user.password_hash) {
      const ok = typeof password === 'string' && (await verifyPassword(password, user.password_hash));
      if (!ok) return res.status(401).json({ error: 'That password is not correct.' });
    } else {
      // Signed up through Google, so there is no password to ask for. Typing
      // the address is the confirmation instead - deliberately something to
      // type rather than a button to click.
      const typed = typeof email === 'string' && email.trim().toLowerCase();
      if (typed !== user.email) {
        return res.status(401).json({ error: 'Type your email address exactly to confirm.' });
      }
    }

    // Every per-user table hangs off users(id) with ON DELETE CASCADE, so one
    // delete empties the lot: sessions, the Google link, the subscription,
    // chats and their messages, planner tasks, video views, usage counters, a
    // stored API key, discount codes.
    //
    // payments is the deliberate exception. Migration 011 made it ON DELETE SET
    // NULL: the record that money moved stays, with the person detached from
    // it, because the operator needs it for accounting and ZarinPal keeps its
    // side regardless. The privacy policy says so in as many words.
    transaction(() => {
      db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    });

    res.clearCookie(SESSION_COOKIE);
    res.json({ ok: true });
  })
);

module.exports = router;
