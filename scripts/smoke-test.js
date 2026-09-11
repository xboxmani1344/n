'use strict';

// A real check, not a green tick. CI gates the deploy on Liara, so a test that
// passes without proving anything would let a broken build reach the site.
//
// This boots the actual server the way the host does and asks it for the pages
// a visitor lands on first. It catches the failures that have actually happened
// on this project: a syntax error in a file nothing imports at startup, a route
// that throws on mount, a boot preflight that exits.

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 4599;
const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studybuddy-smoke-'));

const checks = [
  ['/', 200, 'landing page'],
  ['/app', 200, 'app shell'],
  ['/api/phases', 200, 'track definitions'],
  ['/api/config', 200, 'client config'],
  ['/api/chats', 401, 'signed-out chats are refused, not crashed'],
  // Branding: a missing favicon or manifest is a 404 nobody notices in
  // development, because nothing on the page depends on it rendering.
  ['/favicon.svg', 200, 'tab icon'],
  ['/site.webmanifest', 200, 'installable manifest'],
  ['/brand/icon-180.png', 200, 'home-screen icon'],
  ['/brand/og.png', 200, 'link preview image'],
  ['/privacy', 200, 'privacy policy'],
  ['/terms', 200, 'terms of service'],
];

let failures = 0;

function report(ok, label, detail) {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? '  (' + detail + ')' : ''}`);
  if (!ok) failures += 1;
}

const server = spawn(process.execPath, ['server.js'], {
  env: {
    ...process.env,
    PORT: String(PORT),
    DB_PATH: path.join(dbDir, 'smoke.db'),
    AI_API_KEY: 'smoke-test-placeholder',
    NODE_ENV: 'test',
    APP_URL: 'https://smoke.example',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
server.stdout.on('data', (d) => (output += d));
server.stderr.on('data', (d) => (output += d));

server.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error('The server exited before it could be tested:\n');
    console.error(output);
    process.exit(1);
  }
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForListening() {
  for (let i = 0; i < 60; i += 1) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/api/config`);
      return true;
    } catch {
      await wait(250);
    }
  }
  return false;
}

(async () => {
  if (!(await waitForListening())) {
    console.error('The server never started listening. Its output was:\n');
    console.error(output || '(nothing)');
    server.kill();
    process.exit(1);
  }

  for (const [route, expected, label] of checks) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}${route}`);
      report(res.status === expected, `${route} -> ${expected}`, res.status === expected ? label : `got ${res.status}`);
    } catch (err) {
      report(false, `${route} -> ${expected}`, err.message);
    }
  }

  // The tracks the landing page and the app both read from the server.
  try {
    const { tracks } = await (await fetch(`http://127.0.0.1:${PORT}/api/phases`)).json();
    const keys = Object.keys(tracks || {});
    report(
      keys.length === 4 && keys.every((k) => tracks[k].phases.length === 4),
      'four tracks of four phases each',
      keys.join(', ')
    );
    report(
      keys.every((k) => tracks[k].phases.every((p) => p.label && p.labelFa)),
      'every phase named in both languages'
    );
  } catch (err) {
    report(false, 'track definitions parse', err.message);
  }

  // The terms page states every price and every refund window. PLAN_LIMITS is
  // where both actually live, and a document that disagrees with the checkout
  // is the one kind of drift that costs money to be wrong about. So the numbers
  // are read back out of the page and compared, in both languages - the Persian
  // half is written in Persian numerals and is just as easy to fumble.
  try {
    const { PLAN_LIMITS } = require('../src/services/usage');
    const html = await (await fetch(`http://127.0.0.1:${PORT}/terms`)).text();
    // Persian digits back to ASCII, so one comparison covers both halves.
    const ascii = html.replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

    let wrong = [];
    for (const plan of ['basic', 'plus', 'pro']) {
      const toman = (PLAN_LIMITS[plan].priceRial / 10).toLocaleString('en-US');
      const days = PLAN_LIMITS[plan].refundDays;
      // Twice: once in the English table, once in the Persian one.
      const prices = (ascii.match(new RegExp(toman.replace(/,/g, ','), 'g')) || []).length;
      if (prices < 2) wrong.push(`${plan} price ${toman} appears ${prices}x, expected 2`);
      const windows = (ascii.match(new RegExp(`${days} (days|روز)`, 'g')) || []).length;
      if (windows < 2) wrong.push(`${plan} refund window ${days} appears ${windows}x, expected 2`);
    }
    report(wrong.length === 0, 'terms match PLAN_LIMITS', wrong.length ? wrong.join('; ') : 'prices and refund windows, both languages');
  } catch (err) {
    report(false, 'terms match PLAN_LIMITS', err.message);
  }

  // The contact address is a placeholder until someone fills it in. Failing
  // only in production makes CI the thing that remembers, rather than a person.
  try {
    const pages = await Promise.all(
      ['/privacy', '/terms'].map(async (r) => [r, await (await fetch(`http://127.0.0.1:${PORT}${r}`)).text()])
    );
    const stillPlaceholder = pages.filter(([, html]) => html.includes('legal-todo')).map(([r]) => r);
    if (process.env.NODE_ENV === 'production') {
      report(stillPlaceholder.length === 0, 'legal pages name a contact address', stillPlaceholder.join(', ') || 'both filled in');
    } else {
      console.log(
        `skip  legal contact address${stillPlaceholder.length ? '  (still a placeholder on ' + stillPlaceholder.join(', ') + ' - this fails in production)' : ''}`
      );
    }
  } catch (err) {
    report(false, 'legal pages name a contact address', err.message);
  }

  // Google compares this string character for character and its error names no
  // value, so a stray slash introduced by a future refactor should fail here
  // rather than as a sign-in nobody can debug.
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/auth/google/redirect-uri`);
    const got = await res.text();
    const want = 'https://smoke.example/api/auth/google/callback';
    report(got === want, 'the Google redirect URI is exact', got === want ? want : `got ${JSON.stringify(got)}`);
  } catch (err) {
    report(false, 'the Google redirect URI is exact', err.message);
  }

  // The welcome email goes out the instant the account exists, so the language
  // has to be on the row by then. Signing up in Persian and reading back English
  // means every Iranian signup gets an English discount email.
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `smoke-${Date.now()}@example.com`,
        password: 'password123',
        language: 'fa',
      }),
    });
    const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
    const settings = await (
      await fetch(`http://127.0.0.1:${PORT}/api/settings`, { headers: { cookie } })
    ).json();
    report(
      settings.settings && settings.settings.language === 'fa',
      'signing up in Persian stores Persian',
      settings.settings ? settings.settings.language : 'no settings'
    );
  } catch (err) {
    report(false, 'signup language', err.message);
  }

  server.kill();
  fs.rmSync(dbDir, { recursive: true, force: true });

  console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
  process.exit(failures ? 1 : 0);
})();
