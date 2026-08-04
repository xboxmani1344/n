'use strict';

const { db } = require('../db');

// Free/paid limits — trivially adjustable, all gating reads only this object.
const PLAN_LIMITS = {
  free: {
    ai_messages: { period: 'day', limit: 20 },
    video_summaries: { period: 'month', limit: 3 },
  },
  paid: {
    ai_messages: { period: 'day', limit: 500 },
    video_summaries: { period: 'month', limit: 50 },
  },
};

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
  if (sub && sub.plan === 'paid' && sub.status === 'active') return 'paid';
  return 'free';
}

function currentUsed(userId, counterType, key) {
  const row = db
    .prepare('SELECT count FROM usage_counters WHERE user_id = ? AND period_key = ? AND counter_type = ?')
    .get(userId, key, counterType);
  return row ? row.count : 0;
}

function checkLimit(userId, counterType) {
  const plan = getPlan(userId);
  const rule = PLAN_LIMITS[plan][counterType];
  const used = currentUsed(userId, counterType, periodKey(rule.period));
  return { ok: used < rule.limit, plan, limit: rule.limit, used, period: rule.period };
}

function increment(userId, counterType) {
  const plan = getPlan(userId);
  const rule = PLAN_LIMITS[plan][counterType];
  const key = periodKey(rule.period);
  db.prepare(
    `INSERT INTO usage_counters (user_id, period_key, counter_type, count) VALUES (?, ?, ?, 1)
     ON CONFLICT(user_id, period_key, counter_type) DO UPDATE SET count = count + 1`
  ).run(userId, key, counterType);
}

function periodLabel(period) {
  return period === 'day' ? 'daily' : 'monthly';
}

function getUsageSummary(userId) {
  const plan = getPlan(userId);
  const summary = {};
  for (const counterType of Object.keys(PLAN_LIMITS[plan])) {
    const rule = PLAN_LIMITS[plan][counterType];
    summary[counterType] = {
      used: currentUsed(userId, counterType, periodKey(rule.period)),
      limit: rule.limit,
      period: rule.period,
    };
  }
  return { plan, usage: summary };
}

module.exports = { PLAN_LIMITS, getPlan, checkLimit, increment, getUsageSummary, periodLabel };
