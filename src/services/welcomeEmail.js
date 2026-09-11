'use strict';

const email = require('./email');
const discounts = require('./discounts');

// The one email this app sends. Written in the language the reader chose, and
// sent without anyone waiting on it.

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// The interface renders numerals in Persian; an email that says "10٪" in the
// middle of Persian prose does not match what the reader just signed up to.
const PERSIAN_DIGITS = '\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9';
function faNum(value) {
  return String(value).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

function content(lang, { name, code, percent, url }) {
  if (lang === 'fa') {
    percent = faNum(percent);
    return {
      subject: `${percent}٪ تخفیف برای شروع — Buddy`,
      text: [
        `${name ? name + ' جان، س' : 'س'}لام!`,
        '',
        'خوش آمدی به Buddy — مربی‌ای که برای درس، تمرین، تغذیه و کدنویسی کنارت است.',
        '',
        `به عنوان هدیه‌ی شروع، ${percent}٪ تخفیف روی اشتراک برایت گذاشتیم:`,
        '',
        `    ${code}`,
        '',
        'موقع ارتقای اشتراک واردش کن. تا ۳۰ روز اعتبار دارد و فقط روی همین حساب کار می‌کند.',
        '',
        url,
      ].join('\n'),
    };
  }

  return {
    subject: `${percent}% off to get started — Buddy`,
    text: [
      `Hi${name ? ' ' + name : ''},`,
      '',
      'Welcome to Buddy — a coach for studying, training, eating better and learning to code.',
      '',
      `Here is ${percent}% off your first subscription:`,
      '',
      `    ${code}`,
      '',
      'Enter it when you upgrade. It lasts 30 days and works only on this account.',
      '',
      url,
    ].join('\n'),
  };
}

function htmlFor(lang, body, code) {
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  const paragraphs = body
    .split('\n\n')
    .map((p) => (p.trim() === code ? '' : `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`))
    .join('');

  return `<div dir="${dir}" style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.7;color:#111;max-width:34rem">
${paragraphs}
<p style="margin:22px 0"><code style="display:inline-block;padding:12px 20px;border-radius:10px;background:#f2f2f0;font-size:19px;font-weight:700;letter-spacing:0.08em">${escapeHtml(code)}</code></p>
</div>`;
}

// Fire and forget. The caller must not wait on the network to answer a signup.
function sendWelcome(user, appUrl) {
  const record = discounts.forUser(user.id);
  if (!record) return;

  const lang = user.language === 'fa' ? 'fa' : 'en';
  const { subject, text } = content(lang, {
    name: user.display_name,
    code: record.code,
    percent: record.percent,
    url: appUrl,
  });

  email
    .send({ to: user.email, subject, text, html: htmlFor(lang, text, record.code) })
    .then((result) => {
      if (result.sent) discounts.markEmailed(record.code);
    })
    .catch((err) => console.error('Welcome email failed:', err.message));
}

module.exports = { sendWelcome, content };
