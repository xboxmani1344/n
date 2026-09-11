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
    ai_messages: { period: 'day', limit: 20 },
    video_summaries: { period: 'month', limit: 3 },
  },
  basic: {
    priceRial: 990000,      // 99,000 Toman
    ai_messages: { period: 'day', limit: 100 },
    video_summaries: { period: 'month', limit: 15 },
  },
  plus: {
    priceRial: 1990000,     // 199,000 Toman
    ai_messages: { period: 'day', limit: 300 },
    video_summaries: { period: 'month', limit: 40 },
  },
  pro: {
    priceRial: 3990000,     // 399,000 Toman
    ai_messages: { period: 'day', limit: 1000 },
    video_summaries: { period: 'month', limit: 150 },
  },
};

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
  isPaidPlan,
  planPriceRial,
  limitsFor, PLAN_LIMITS, getPlan, checkLimit, increment, getUsageSummary, periodLabel };
