'use strict';

const crypto = require('crypto');
const { db } = require('./../db');
const email = require('./email');
const progress = require('./progress');
const push = require('./push');

// The one email this app sends that nobody asked for at the moment it
// arrives, which is why almost all of the care here is about not sending it.
//
// Three rules it follows:
//   - off until switched on, because unrequested mail costs the deliverability
//     of the welcome email and the discount codes too;
//   - nothing to say means nothing sent, because a daily "no tasks today"
//     teaches people to filter the address;
//   - never twice in a day, including across a restart.

// Seven in the morning in Tehran. Early enough to be read before the day
// starts, late enough not to arrive in the night.
const SEND_HOUR_TEHRAN = 7;

// The timer wakes more often than it sends: a fifteen-minute check cannot miss
// the hour, and every wake that is not the hour costs one comparison.
const TICK_MS = 15 * 60 * 1000;

const TEHRAN_HOUR = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tehran',
  hour: '2-digit',
  hour12: false,
});

function tehranHour(date = new Date()) {
  return Number(TEHRAN_HOUR.format(date));
}

function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

// Switching them on issues the token; switching them off keeps it, so a link
// in an email already sent still works and does not 404 at somebody trying to
// unsubscribe twice.
function setReminders(userId, on) {
  const user = db.prepare('SELECT reminder_token FROM users WHERE id = ?').get(userId);
  const token = user && user.reminder_token ? user.reminder_token : newToken();
  db.prepare('UPDATE users SET reminders_on = ?, reminder_token = ? WHERE id = ?').run(on ? 1 : 0, token, userId);
  return token;
}

function unsubscribeByToken(token) {
  if (!token) return false;
  const result = db.prepare('UPDATE users SET reminders_on = 0 WHERE reminder_token = ?').run(token);
  return result.changes > 0;
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
function faNum(value) {
  return String(value).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// What there is to say today, or nothing.
//
// Deliberately not "here is your streak" on its own: a streak with no tasks
// and no exam is a number about nothing, and an email that exists only to
// report it is the kind people stop opening. There has to be something to do
// in it.
function digestFor(userId, now = new Date()) {
  const today = progress.tehranDay(now);

  const due = db
    .prepare(
      `SELECT title, due_at FROM tasks
        WHERE user_id = ? AND status != 'done' AND due_at IS NOT NULL AND date(due_at) <= date(?)
        ORDER BY due_at ASC
        LIMIT 10`
    )
    .all(userId, today);

  if (!due.length) return null;

  const overdue = due.filter((t) => String(t.due_at).slice(0, 10) < today);
  const profile = db.prepare('SELECT exam_at FROM user_profiles WHERE user_id = ?').get(userId);

  return {
    due,
    overdue,
    streak: progress.streakFor(userId, now),
    examInDays: progress.daysUntil(profile ? profile.exam_at : null, now),
  };
}

function content(lang, digest, { name, appUrl, unsubscribeUrl }) {
  const fa = lang === 'fa';
  const n = fa ? faNum : String;
  const lines = [];

  if (fa) {
    lines.push(`${name ? name + ' جان، س' : 'س'}لام!`);
    lines.push('');
    lines.push(
      digest.overdue.length
        ? `${n(digest.due.length)} کار روی میزت مانده که ${n(digest.overdue.length)} تایش از موعدش گذشته:`
        : `${n(digest.due.length)} کار برای امروز داری:`
    );
  } else {
    lines.push(`Hi${name ? ' ' + name : ''},`);
    lines.push('');
    lines.push(
      digest.overdue.length
        ? `${digest.due.length} task(s) waiting, ${digest.overdue.length} of them past due:`
        : `${digest.due.length} task(s) for today:`
    );
  }

  lines.push('');
  for (const task of digest.due) lines.push(`    • ${task.title}`);
  lines.push('');

  // Encouragement only where it is earned. A streak of zero and a countdown
  // to nothing are both left out rather than padded in.
  if (digest.streak >= 2) {
    lines.push(fa ? `${n(digest.streak)} روز پشت سر هم ادامه داده‌ای. نگهش دار.` : `${digest.streak} days in a row so far. Keep it.`);
  }
  if (typeof digest.examInDays === 'number' && digest.examInDays >= 0) {
    lines.push(fa ? `${n(digest.examInDays)} روز تا آن تاریخ مانده.` : `${digest.examInDays} days until the date that matters.`);
  }

  lines.push('');
  lines.push(appUrl);
  lines.push('');
  lines.push(fa ? `برای قطع این ایمیل‌ها: ${unsubscribeUrl}` : `To stop these emails: ${unsubscribeUrl}`);

  return {
    subject: fa ? 'کارهای امروزت — Buddy' : 'Today, at a glance — Buddy',
    text: lines.join('\n'),
  };
}

function htmlFor(lang, body) {
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  const paragraphs = body
    .split('\n\n')
    .map((p) => `<p style="margin:0 0 14px">${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<div dir="${dir}" style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.7;color:#111;max-width:34rem">
${paragraphs}
</div>`;
}

// One pass over everyone who has asked for this. Marked as sent whether or not
// there was anything to say, so a quiet day is not retried every fifteen
// minutes until the hour is over.
async function runOnce(appUrl, now = new Date()) {
  // Either channel is reason enough to run. Gating the whole pass on SMTP
  // would have meant a site with notifications and no mail server sending
  // nothing at all.
  if (!email.isConfigured() && !push.isConfigured()) return { considered: 0, sent: 0, pushed: 0 };

  const today = progress.tehranDay(now);
  const waiting = db
    .prepare(
      `SELECT u.id, u.email, u.display_name, u.language, u.reminder_token, u.reminders_on,
              (SELECT COUNT(*) FROM push_subscriptions p WHERE p.user_id = u.id) AS devices
         FROM users u
        WHERE (u.reminders_on = 1 OR EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = u.id))
          AND (u.last_reminder_at IS NULL OR u.last_reminder_at < ?)`
    )
    .all(today);

  let sent = 0;
  let pushed = 0;
  for (const user of waiting) {
    // Written before the attempt, not after. A send that throws halfway
    // through must not leave the row eligible again on the next tick, which
    // would retry all morning.
    db.prepare('UPDATE users SET last_reminder_at = ? WHERE id = ?').run(today, user.id);

    const digest = digestFor(user.id, now);
    if (!digest) continue;

    const lang = user.language === 'fa' ? 'fa' : 'en';
    const { subject, text } = content(lang, digest, {
      name: user.display_name,
      appUrl,
      unsubscribeUrl: `${appUrl}/unsubscribe/${user.reminder_token}`,
    });

    // A notification is a glance, not a letter: the count and nothing else.
    // Putting the task list in it would be a wall of text on a lock screen.
    if (user.devices) {
      const first = digest.due[0].title;
      pushed += await push.sendTo(user.id, {
        title: subject,
        body: digest.due.length === 1 ? first : `${first} +${digest.due.length - 1}`,
        dir: lang === 'fa' ? 'rtl' : 'ltr',
        lang,
        url: '/app',
      });
    }

    if (user.reminders_on && email.isConfigured()) {
      try {
        await email.send({ to: user.email, subject, text, html: htmlFor(lang, text) });
        sent += 1;
      } catch (err) {
        console.error(`Reminder to user ${user.id} failed:`, err.message);
      }
    }
  }

  return { considered: waiting.length, sent, pushed };
}

// Started once at boot. An interval in the process rather than a host cron:
// there is one container, the guard against double-sending is in the database
// rather than in the scheduler, and nothing here would change if this moved to
// a cron later.
function start(appUrl) {
  if (!email.isConfigured() && !push.isConfigured()) return null;

  const tick = () => {
    if (tehranHour() !== SEND_HOUR_TEHRAN) return;
    runOnce(appUrl).catch((err) => console.error('Reminder pass failed:', err.message));
  };

  const timer = setInterval(tick, TICK_MS);
  // Not a reason to keep the process alive if everything else has finished.
  if (timer.unref) timer.unref();
  return timer;
}

module.exports = {
  SEND_HOUR_TEHRAN,
  setReminders,
  unsubscribeByToken,
  digestFor,
  content,
  runOnce,
  start,
  tehranHour,
};
