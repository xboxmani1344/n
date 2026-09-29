'use strict';

const { db } = require('../db');

// How long somebody has kept going, and how long they have left.
//
// Both halves are emotional rather than functional, which is exactly why the
// arithmetic has to be right: a countdown that is a day out, or a streak that
// forgets last night, is worse than not showing one at all. It turns the part
// of the app meant to encourage someone into the part that argues with them.

// Everything here is reckoned in Tehran, because that is where the people
// using this are. Intl owns the conversion - there is no offset to hard-code
// and nothing to update if the country changes its clocks again.
const TEHRAN_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Built from the parts rather than trusting a locale to format YYYY-MM-DD.
function tehranDay(date = new Date()) {
  const parts = Object.fromEntries(TEHRAN_DAY.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// These are calendar dates, already converted, so stepping between them is
// plain arithmetic on a UTC midnight. Doing it in local time is how a day goes
// missing twice a year in places that still change their clocks.
const DAY_MS = 86400000;

function shiftDay(day, by) {
  const at = new Date(`${day}T00:00:00Z`);
  at.setTime(at.getTime() + by * DAY_MS);
  return at.toISOString().slice(0, 10);
}

// Called wherever real work happens. Cheap, idempotent, and silent about
// having been called twice in a day, which it will be constantly.
function recordActivity(userId, date = new Date()) {
  db.prepare('INSERT OR IGNORE INTO activity_days (user_id, day) VALUES (?, ?)').run(userId, tehranDay(date));
}

function activeDaysSince(userId, from) {
  const rows = db
    .prepare('SELECT day FROM activity_days WHERE user_id = ? AND day >= ? ORDER BY day DESC')
    .all(userId, from);
  return new Set(rows.map((r) => r.day));
}

// A year back is further than any streak worth displaying, and it keeps one
// query from ever walking an unbounded table.
const STREAK_WINDOW_DAYS = 400;

function streakFor(userId, date = new Date()) {
  const today = tehranDay(date);
  const active = activeDaysSince(userId, shiftDay(today, -STREAK_WINDOW_DAYS));
  if (!active.size) return 0;

  // Today not being active yet does not break anything - it is only just
  // started. Without this, opening the app before doing any work would report
  // a streak of zero to somebody on day nine, which is the single worst
  // moment to tell them they have lost it.
  let cursor = active.has(today) ? today : shiftDay(today, -1);

  let streak = 0;
  while (active.has(cursor) && streak < STREAK_WINDOW_DAYS) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

// Oldest first, so the bars read left to right the way a fortnight does.
function recentDays(userId, count = 14, date = new Date()) {
  const today = tehranDay(date);
  const active = activeDaysSince(userId, shiftDay(today, -(count - 1)));
  const out = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const day = shiftDay(today, -i);
    out.push({ day, active: active.has(day) });
  }
  return out;
}

// Whole days, counted between calendar dates rather than between instants:
// "the exam is in 3 days" is about which day it is, not about the hours left.
// Negative once the date has passed, which the caller reads as "over".
function daysUntil(examAt, date = new Date()) {
  if (!examAt || !/^\d{4}-\d{2}-\d{2}$/.test(examAt)) return null;
  const then = new Date(`${examAt}T00:00:00Z`).getTime();
  const now = new Date(`${tehranDay(date)}T00:00:00Z`).getTime();
  if (Number.isNaN(then)) return null;
  return Math.round((then - now) / DAY_MS);
}

module.exports = { tehranDay, shiftDay, recordActivity, streakFor, recentDays, daysUntil };
