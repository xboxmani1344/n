'use strict';

const { db } = require('../db');

// Free/paid limits — trivially adjustable, all gating reads only this object.
// Plans, in one place: what each allows and what it costs.
//
// Prices are in RIAL, which is what the payment gateway is sent. The interface
// divides by ten to show Toman. One number, converted for display - never two
// that can drift apart, so what is charged is always what was shown.
//
// The limits are also the spend control. With SHARED_API_KEY=1 the operator's
// credit pays for every message, so these numbers are the only thing between
// one enthusiastic user and the bill.
const PLAN_LIMITS = {
  free: {
    priceRial: 0,
    tracks: ['study'],
    ai_messages: { period: 'day', limit: 20 },
    video_summaries: { period: 'month', limit: 3 },
  },
  basic: {
    priceRial: 2000000,     // 200,000 Toman
    tracks: ['study', 'workout'],
    ai_messages: { period: 'day', limit: 100 },
    video_summaries: { period: 'month', limit: 15 },
  },
  plus: {
    priceRial: 5500000,     // 550,000 Toman
    tracks: ['study', 'workout', 'diet'],
    ai_messages: { period: 'day', limit: 300 },
    video_summaries: { period: 'month', limit: 40 },
  },
  pro: {
    priceRial: 12000000,    // 1,200,000 Toman
    tracks: ['study', 'workout', 'diet', 'code'],
    ai_messages: { period: 'day', limit: 1000 },
    video_summaries: { period: 'month', limit: 150 },
  },
};

// The tutor is freeform help rather than a coached track, and every plan has
// it - including free. Gating the ability to ask a question at all would make
// the free tier useless rather than limited.
const ALWAYS_AVAILABLE = ['tutor'];

const PAID_PLANS = ['basic', 'plus', 'pro'];

function isPaidPlan(plan) {
  return PAID_PLANS.includes(plan);
}

function planPriceRial(plan) {
  const entry = PLAN_LIMITS[plan];
  return entry ? entry.priceRial : 0;
}

// Anything unrecognised - an old row, a hand-edited database - falls back to
// free rather than handing out the most generous limits by accident.
function limitsFor(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

// A switch for looking at everything without paying for it. Set
// UNLOCK_ALL_TRACKS=1 to open every track on every plan, including free.
//
// An environment variable rather than an edit to the table above, so turning it
// back off is one change in the host's panel and cannot be forgotten in the
// code. It is also announced at boot, because a site quietly giving away the
// thing it sells is worth noticing in a log.
const UNLOCK_ALL = process.env.UNLOCK_ALL_TRACKS === '1';

// Which coached tracks a plan opens. 'phased' is the old name for study.
function tracksFor(plan) {
  return UNLOCK_ALL ? PLAN_LIMITS.pro.tracks : limitsFor(plan).tracks;
}

function canUseTrack(plan, mode) {
  const key = mode === 'phased' || !mode ? 'study' : mode;
  return ALWAYS_AVAILABLE.includes(key) || tracksFor(plan).includes(key);
}

// The cheapest plan that opens a given track, for telling someone what to buy
// rather than only that they cannot have it.
function planForTrack(mode) {
  const key = mode === 'phased' || !mode ? 'study' : mode;
  return ['free', ...PAID_PLANS].find((plan) => tracksFor(plan).includes(key)) || null;
}

function periodKey(period, date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  if (period === 'day') {
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return `${y}-${m}`;
}

function getPlan(userId) {
  const sub = db.prepare('SELECT plan, status FROM subscriptions WHERE user_id = ?').get(userId);
  if (!sub || sub.status !== 'active') return 'free';

  // 'paid' was the single tier before there were three. Rows written then are
  // honoured as the middle one rather than being silently demoted to free,
  // which would take away limits someone had already paid for.
  if (sub.plan === 'paid') return 'plus';

  return isPaidPlan(sub.plan) ? sub.plan : 'free';
}

function currentUsed(userId, counterType, key) {
  const row = db
    .prepare('SELECT count FROM usage_counters WHERE user_id = ? AND period_key = ? AND counter_type = ?')
    .get(userId, key, counterType);
  return row ? row.count : 0;
}

function checkLimit(userId, counterType) {
  const plan = getPlan(userId);
  const rule = limitsFor(plan)[counterType];
  const used = currentUsed(userId, counterType, periodKey(rule.period));
  return { ok: used < rule.limit, plan, limit: rule.limit, used, period: rule.period };
}

function increment(userId, counterType) {
  const plan = getPlan(userId);
  const rule = limitsFor(plan)[counterType];
  const key = periodKey(rule.period);
  db.prepare(
    `INSERT INTO usage_counters (user_id, period_key, counter_type, count) VALUES (?, ?, ?, 1)
     ON CONFLICT(user_id, period_key, counter_type) DO UPDATE SET count = count + 1`
  ).run(userId, key, counterType);
}

function periodLabel(period) {
  return period === 'day' ? 'daily' : 'monthly';
}

// The counters a plan meters. Named explicitly rather than read off the plan's
// keys, which now also carry the price - iterating those would invent a
// "priceRial" counter and then read .period off a number.
const COUNTER_TYPES = ['ai_messages', 'video_summaries'];

function getUsageSummary(userId) {
  const plan = getPlan(userId);
  const limits = limitsFor(plan);
  const summary = {};
  for (const counterType of COUNTER_TYPES) {
    const rule = limits[counterType];
    summary[counterType] = {
      used: currentUsed(userId, counterType, periodKey(rule.period)),
      limit: rule.limit,
      period: rule.period,
    };
  }
  return { plan, usage: summary };
}

module.exports = {
  PAID_PLANS,
  UNLOCK_ALL,
  PLAN_LIMITS,
  tracksFor,
  canUseTrack,
  planForTrack,
  isPaidPlan,
  planPriceRial,
  limitsFor, PLAN_LIMITS, getPlan, checkLimit, increment, getUsageSummary, periodLabel };
