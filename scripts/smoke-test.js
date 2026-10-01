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
    // A closed port, so the AI diagnostic below fails instantly instead of
    // waiting out a real provider timeout. No test makes a real AI call.
    AI_BASE_URL: 'http://127.0.0.1:1/v1',
    // The plan check runs before the safety check, so on a free plan the diet
    // and workout tracks are refused as locked (403) and the safety gate below
    // never gets a turn. This is also how the site runs today.
    UNLOCK_ALL_TRACKS: '1',
    // Obvious fakes, and never sent anywhere: every sign-in failure checked
    // below is decided before the token exchange happens. They are here because
    // the callback refuses outright when Google is unconfigured, which would
    // make all of those cases report the same thing.
    GOOGLE_CLIENT_ID: 'smoke-test.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'smoke-test-placeholder',
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

  // What the client actually boots from. The shape of it, not the count - how
  // many coaches there are is checked directly against the registry below,
  // where adding one does not mean editing a number in a test.
  try {
    const { tracks, skills } = await (await fetch(`http://127.0.0.1:${PORT}/api/phases`)).json();
    const keys = Object.keys(tracks || {});
    report(
      keys.length > 0 && keys.every((k) => tracks[k].phases.length === 4),
      'the catalogue serves four phases per coach',
      `${keys.length} coaches`
    );
    report(
      Array.isArray(skills) && skills.length > 0 && skills.every((s) => s.key && s.labelFa && s.descriptionFa),
      'the catalogue serves the skills, in both languages',
      `${(skills || []).length} skills`
    );
  } catch (err) {
    report(false, 'the catalogue parses', err.message);
  }

  // Every coach, including the specialised agents, must be fully formed and
  // reachable: four named phases in both languages, a prompt behind each, and
  // some plan that includes it. An agent nobody can open is dead weight.
  try {
    const { TRACKS, getSystemPrompt, SKILLS } = require('../src/prompts');
    const { PLAN_LIMITS } = require('../src/services/usage');
    const everyPlanTrack = new Set(Object.values(PLAN_LIMITS).flatMap((p) => p.tracks));

    const broken = [];
    for (const [key, track] of Object.entries(TRACKS)) {
      if (track.phases.length !== 4) broken.push(`${key}: ${track.phases.length} phases`);
      if (!track.labelFa || !track.blurbFa) broken.push(`${key}: not bilingual`);
      if (!everyPlanTrack.has(key)) broken.push(`${key}: no plan includes it`);
      for (const phase of track.phases) {
        if (!phase.labelFa) broken.push(`${key}.${phase.key}: no Persian name`);
        // A missing phase prompt silently falls back to phase one, which reads
        // as the coach forgetting where it is.
        const prompt = getSystemPrompt(phase.key, 'x', key, 'en');
        if (!prompt.includes(`CURRENT PHASE: ${phase.id}`)) broken.push(`${key}.${phase.key}: no prompt`);
      }
    }
    report(broken.length === 0, 'every coach is complete and reachable',
      broken.length ? broken.slice(0, 3).join('; ') : `${Object.keys(TRACKS).length} coaches, ${Object.keys(SKILLS).length} skills`);
  } catch (err) {
    report(false, 'every coach is complete and reachable', err.message);
  }

  // A migration that fails partway must roll back, or the next boot hits
  // "already exists" on its first line and the server can never start again -
  // not a failed deploy you retry, a database that needs fixing by hand.
  try {
    const { execFileSync } = require('node:child_process');
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'studybuddy-mig-'));
    fs.cpSync(path.join(__dirname, '..', 'src'), path.join(sandbox, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(sandbox, 'src', 'migrations', '999_deliberately_broken.sql'),
      'CREATE TABLE rollback_probe (id INTEGER PRIMARY KEY);\nINSERT INTO no_such_table (x) VALUES (1);\n'
    );

    const boot = () => {
      try {
        execFileSync(process.execPath, ['-e', `require(${JSON.stringify(path.join(sandbox, 'src', 'db'))})`], {
          env: { ...process.env, DB_PATH: path.join(sandbox, 'probe.db') },
          stdio: 'pipe',
        });
        return '';
      } catch (err) {
        return String(err.stderr || err.message);
      }
    };

    const first = boot();
    const second = boot();
    // The same honest error both times. "already exists" on the second run is
    // the symptom of the partial write surviving.
    const rolledBack = /rolled back/.test(first) && /rolled back/.test(second) && !/already exists/.test(second);
    fs.rmSync(sandbox, { recursive: true, force: true });
    report(rolledBack, 'a failed migration rolls back and stays retryable',
      rolledBack ? 'the same error twice, not an unfixable one' : 'second boot: ' + second.split('\n')[0]);
  } catch (err) {
    report(false, 'a failed migration rolls back and stays retryable', err.message);
  }

  // A tab nobody can see must not take the site down.
  //
  // This is not hypothetical: DB_PATH in the host's panel held a leading tab,
  // which stopped the path being absolute, so the app measured it from the
  // working directory, waited a minute for /app/<tab>/app/data, and refused to
  // boot - while the disk it wanted was mounted and empty and fine. Three
  // deploys went into reading a failure block that was pointing at a path
  // nobody had ever set.
  //
  // Boot the real module with a value shaped exactly like the one that broke
  // it, and check the database lands where the variable says, not where the
  // whitespace would have put it.
  try {
    const { spawnSync } = require('node:child_process');
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'studybuddy-env-'));
    const wanted = path.join(sandbox, 'nested', 'buddy.db');

    const run = spawnSync(
      process.execPath,
      ['-e', `require(${JSON.stringify(path.join(__dirname, '..', 'src', 'db'))})`],
      { env: { ...process.env, DB_PATH: `\t${wanted} ` }, encoding: 'utf8' }
    );

    const booted = run.status === 0;
    const landed = fs.existsSync(wanted);
    const said = /DB_PATH had a tab at the start/.test(run.stderr || '');
    fs.rmSync(sandbox, { recursive: true, force: true });

    report(booted && landed && said, 'a tab pasted into DB_PATH does not take the site down',
      booted && landed && said
        ? 'trimmed, reported, and the database landed where the variable says'
        : [
            booted ? null : `did not boot: ${(run.stderr || '').split('\n').find(Boolean)}`,
            landed ? null : 'the database is not at the un-prefixed path',
            said ? null : 'booted but never said the variable was wrong',
          ].filter(Boolean).join('; '));
  } catch (err) {
    report(false, 'a tab pasted into DB_PATH does not take the site down', err.message);
  }

  // A build stamp that never moves is worse than none at all: it would make
  // every stale log look current. Two rounds of debugging this deployment went
  // into reading the wrong deploy's output, so the value that is supposed to
  // settle that question has to be shown to change.
  try {
    const { execFileSync } = require('node:child_process');
    const here = require('../src/version').STAMP;

    // Copying exactly what the fingerprint covers, taken from the module
    // itself - a hand-written list here would drift the moment one is added,
    // and the test would fail for a reason that has nothing to do with the app.
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'studybuddy-stamp-'));
    for (const source of require('../src/version').SOURCES) {
      fs.cpSync(path.join(__dirname, '..', source), path.join(sandbox, source), { recursive: true });
    }

    const copied = String(execFileSync(process.execPath,
      ['-p', `require(${JSON.stringify(path.join(sandbox, 'src', 'version'))}).STAMP`],
      { encoding: 'utf8' })).trim();

    fs.appendFileSync(path.join(sandbox, 'src', 'version.js'), '\n// one more byte\n');
    const changed = String(execFileSync(process.execPath,
      ['-p', `require(${JSON.stringify(path.join(sandbox, 'src', 'version'))}).STAMP`],
      { encoding: 'utf8' })).trim();

    fs.rmSync(sandbox, { recursive: true, force: true });

    const shaped = [here, copied, changed].every((v) => /^[0-9a-f]{8}$/.test(v));
    // An identical copy hashes the same; one byte more does not.
    const sound = shaped && copied === here && changed !== here;
    report(sound, 'the build stamp identifies the code that is running',
      sound ? `${here}, and it moves when a byte does`
            : `here ${here}, copy ${copied}, after a one-byte change ${changed}`);
  } catch (err) {
    report(false, 'the build stamp identifies the code that is running', err.message);
  }

  // Every coach needs its own title, subtitle and opening line in the
  // dictionary. Without them the client falls back to Study, which is how a
  // Writing session came to open with the Study welcome and be called "Study
  // session" - wrong in a way that reads as the coach having failed to load.
  try {
    const { TRACKS } = require('../src/prompts');
    const dict = fs.readFileSync(path.join(__dirname, '..', 'public', 'i18n.js'), 'utf8');
    const missing = [];
    for (const key of Object.keys(TRACKS)) {
      for (const part of ['title', 'sub', 'welcome']) {
        if (!dict.includes(`'track.${key}.${part}'`)) missing.push(`track.${key}.${part}`);
      }
    }
    // The freeform tutor is not a track - it has no phases - and its opening
    // line lives under chat.tutorWelcome rather than following this pattern.
    for (const key of ["'track.tutor.title'", "'track.tutor.sub'", "'chat.tutorWelcome'"]) {
      if (!dict.includes(key)) missing.push(key);
    }
    report(missing.length === 0, 'every coach has its own wording', missing.length ? missing.join(', ') : `${Object.keys(TRACKS).length + 1} coaches`);
  } catch (err) {
    report(false, 'every coach has its own wording', err.message);
  }

  // Skills arrive from the client and end up in a prompt, so the filter is the
  // only thing between a request body and the model's instructions.
  try {
    const { normalizeSkills, getSystemPrompt } = require('../src/prompts');
    const checks = [
      [['brief', 'simple'], ['simple', 'brief'], 'a fixed order, not the order sent'],
      [['simple', 'simple'], ['simple'], 'duplicates collapse'],
      [['nope', 'simple'], ['simple'], 'unknown keys dropped'],
      ['not an array', [], 'a non-array is no skills'],
      [[{ toString: () => 'simple' }], [], 'only real strings count'],
    ];
    const wrong = checks.filter(([input, want]) => JSON.stringify(normalizeSkills(input)) !== JSON.stringify(want));
    const reaches = /HOW TO ANSWER/.test(getSystemPrompt('learn', 'x', 'study', 'en', ['quiz']));
    const absent = !/HOW TO ANSWER/.test(getSystemPrompt('learn', 'x', 'study', 'en', []));
    report(wrong.length === 0 && reaches && absent, 'skills are filtered and reach the prompt',
      wrong.length ? wrong.map(([, , l]) => l).join('; ') : 'filtered, ordered, and only present when chosen');
  } catch (err) {
    report(false, 'skills are filtered and reach the prompt', err.message);
  }

  // The notice before a first nutrition or training session. Enforced on the
  // server, not only in the dialog: "they were told" should be a fact, not a
  // hope about which client they used.
  try {
    const signup = await fetch(`http://127.0.0.1:${PORT}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `safety-${Date.now()}@example.com`, password: 'password123' }),
    });
    const cookie = (signup.headers.get('set-cookie') || '').split(';')[0];
    const post = (path, body) =>
      fetch(`http://127.0.0.1:${PORT}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify(body),
      });

    const blocked = await post('/api/chats', { mode: 'diet' });
    const study = await post('/api/chats', { mode: 'study' });
    await post('/api/chats/safety-notice', { track: 'diet' });
    const allowed = await post('/api/chats', { mode: 'diet' });
    // Agreeing to the nutrition notice is not agreeing to the training one.
    const otherTrack = await post('/api/chats', { mode: 'workout' });

    const ok =
      blocked.status === 409 && study.status === 201 && allowed.status === 201 && otherTrack.status === 409;
    report(ok, 'the safety notice gates diet and workout',
      ok ? 'blocked, then allowed once accepted; study untouched; workout asks separately'
         : `diet ${blocked.status}/${allowed.status}, study ${study.status}, workout ${otherTrack.status}`);
  } catch (err) {
    report(false, 'the safety notice gates diet and workout', err.message);
  }

  // The safety floor in the prompts themselves. The dialog tells the person
  // once; this is what constrains the model that writes the plan.
  try {
    const { getSystemPrompt, getTrack } = require('../src/prompts');
    const wrong = ['diet', 'workout'].filter(
      (t) => !/SAFETY - this overrides/.test(getSystemPrompt(getTrack(t).phases[1].key, 'x', t, 'en'))
    );
    const leaked = ['study', 'code'].filter((t) =>
      /SAFETY - this overrides/.test(getSystemPrompt(getTrack(t).phases[1].key, 'x', t, 'en'))
    );
    report(wrong.length === 0 && leaked.length === 0, 'diet and workout prompts carry the safety floor',
      wrong.length ? `missing on ${wrong.join(', ')}` : leaked.length ? `wrongly on ${leaked.join(', ')}` : 'and study and code do not');
  } catch (err) {
    report(false, 'diet and workout prompts carry the safety floor', err.message);
  }

  // The doubled-scheme correction. A pure function, so checked directly - and
  // worth pinning, because the one case that must NOT be corrected (a URL with
  // no scheme at all, where defaulting to http would send the API key in the
  // clear) looks similar enough to be broken by a careless edit.
  try {
    const { normalizeBaseUrl } = require('../src/services/ai');
    const cases = [
      ['https:https://ai.example/api/x/v1', 'https://ai.example/api/x/v1'],
      ['https://https://ai.example/v1', 'https://ai.example/v1'],
      ['https:http://internal.example/v1', 'http://internal.example/v1'],
      ['https://ai.example/v1///', 'https://ai.example/v1'],
      ['https://ai.example/v1', 'https://ai.example/v1'],
      // Left exactly as it is: adding a scheme would be a guess, and the wrong
      // guess sends the key unencrypted.
      ['ai.example/v1', 'ai.example/v1'],
    ];
    const wrong = cases.filter(([input, want]) => normalizeBaseUrl(input) !== want);
    report(wrong.length === 0, 'AI_BASE_URL normalisation', wrong.length ? wrong.map(([i]) => i).join(', ') : `${cases.length} shapes`);
  } catch (err) {
    report(false, 'AI_BASE_URL normalisation', err.message);
  }

  // The one page that says whether a deployment is set up right. It names the
  // AI base URL, the callback and the database path, so the rule that matters
  // is that it never names a secret - and it must not answer a stranger.
  try {
    const signedOut = await fetch(`http://127.0.0.1:${PORT}/api/setup/health`);
    const signup = await fetch(`http://127.0.0.1:${PORT}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `health-${Date.now()}@example.com`, password: 'password123' }),
    });
    const cookie = (signup.headers.get('set-cookie') || '').split(';')[0];
    const text = await (await fetch(`http://127.0.0.1:${PORT}/api/setup/health`, { headers: { cookie } })).text();

    // The smoke server runs with a recognisable key and an unmounted DB_PATH,
    // so both the secret rule and the it-noticed rule are checkable here.
    const leaks = ['smoke-test-placeholder'].filter((secret) => text.includes(secret));
    const noticesTheDisk = /container filesystem/.test(text);
    const ok = signedOut.status === 401 && leaks.length === 0 && noticesTheDisk;
    report(ok, 'the health page reports without leaking',
      leaks.length ? 'IT PRINTED A SECRET'
        : signedOut.status !== 401 ? `signed out got ${signedOut.status}`
        : noticesTheDisk ? 'refuses a stranger, names no secret, spots the unmounted database'
        : 'did not notice the database is not on a disk');
  } catch (err) {
    report(false, 'the health page reports without leaking', err.message);
  }

  // The diagnostic that tells the operator why the AI is unreachable. It names
  // the base URL and the model, so it must not answer a stranger.
  try {
    const signedOut = await fetch(`http://127.0.0.1:${PORT}/api/setup/ai-check`);
    report(signedOut.status === 401, 'the AI check refuses a signed-out request', `got ${signedOut.status}`);

    const signup = await fetch(`http://127.0.0.1:${PORT}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `aicheck-${Date.now()}@example.com`, password: 'password123' }),
    });
    const cookie = (signup.headers.get('set-cookie') || '').split(';')[0];
    const text = await (
      await fetch(`http://127.0.0.1:${PORT}/api/setup/ai-check`, { headers: { cookie } })
    ).text();

    // It must name what is wrong, and must never print the key itself.
    const namesUrl = text.includes('http://127.0.0.1:1/v1');
    const saysFailed = /FAILED/.test(text);
    const leaksKey = text.includes('smoke-test-placeholder');
    report(namesUrl && saysFailed && !leaksKey, 'the AI check diagnoses a dead endpoint',
      leaksKey ? 'IT PRINTED THE API KEY' : (namesUrl && saysFailed ? 'names the URL, reports the failure, hides the key' : text.slice(0, 120)));
  } catch (err) {
    report(false, 'the AI check', err.message);
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

  // A failed Google sign-in used to end on an English plain-text page in a
  // Persian app, naming no cause and offering no way back. Now it comes back to
  // the sign-in form carrying a code. Two things have to hold for that to be an
  // improvement rather than a different dead end.
  //
  // First: the callback actually redirects, and carries the right code.
  try {
    // 'off' is the one code this cannot exercise: the server above is given
    // credentials, which is what lets any of the rest be reached at all.
    const cases = [
      ['?error=access_denied&state=x', 'access_denied', 'someone declined the consent screen'],
      ['?error=admin_policy_enforced&state=x', 'google', 'a refusal with no wording of its own'],
      ['?code=abc&state=nope', 'expired', 'a state cookie that does not match'],
      ['', 'expired', 'nothing at all'],
    ];

    const wrong = [];
    for (const [query, want, what] of cases) {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/auth/google/callback${query}`, { redirect: 'manual' });
      const to = res.headers.get('location') || '';
      if (res.status !== 302 || to !== `/app?auth_error=${want}`) {
        wrong.push(`${what}: ${res.status} -> ${to || 'no redirect'}`);
      }
    }
    report(wrong.length === 0, 'a failed Google sign-in comes back with a reason',
      wrong.length ? wrong.join('; ') : `${cases.length} ways to fail, each named`);
  } catch (err) {
    report(false, 'a failed Google sign-in comes back with a reason', err.message);
  }

  // Second: every code the server can emit has wording behind it. A code with
  // no message shows the person a blank error, which is the dead end again
  // wearing a different hat. Walked from the router's own list rather than a
  // copy of it here, so adding a code without wording fails this.
  try {
    const codes = require('../src/routes/auth').AUTH_ERROR_CODES;
    const dict = fs.readFileSync(path.join(__dirname, '..', 'public', 'i18n.js'), 'utf8');
    const missing = codes.filter((code) => !dict.includes(`'auth.err.${code}'`));
    report(Array.isArray(codes) && codes.length > 0 && missing.length === 0,
      'every sign-in failure has wording in both languages',
      missing.length ? `no message for: ${missing.join(', ')}` : `${codes.length} codes`);
  } catch (err) {
    report(false, 'every sign-in failure has wording in both languages', err.message);
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

  // The coach's memory. Two halves, and the second is the one that bites.
  //
  // The obvious half is that a saved profile survives a round trip. The half
  // that matters is that an EMPTY profile adds nothing whatsoever to the
  // prompt: a model handed "their goal is: (not set)" starts remarking on what
  // it has not been told, which reads as the app being broken rather than as
  // the person not having filled a form in.
  try {
    const { profileLine, getSystemPrompt, getTutorSystemPrompt } = require('../src/prompts');

    const emptyAdds = [
      profileLine(null),
      profileLine({}),
      profileLine({ goal: '   ', notes: null, hours_per_day: undefined }),
    ].every((line) => line === '');

    const filled = { study_level: 'کنکور تجربی', goal: 'پزشکی', exam_at: '2027-06-20', hours_per_day: 5 };
    const withProfile = getSystemPrompt('plan', 'شیمی', 'study', 'fa', [], filled);
    const without = getSystemPrompt('plan', 'شیمی', 'study', 'fa', [], null);
    const tutorWith = getTutorSystemPrompt('شیمی', 'fa', [], filled);

    // Every field reaches it, both prompt builders carry it, and the prompt
    // without a profile is byte-for-byte what it was before this existed.
    const reaches = ['کنکور تجربی', 'پزشکی', '2027-06-20', '5'].every((v) => withProfile.includes(v));
    const tutorToo = tutorWith.includes('پزشکی');
    const unchanged = without === getSystemPrompt('plan', 'شیمی', 'study', 'fa', [], undefined);

    const ok = emptyAdds && reaches && tutorToo && unchanged;
    report(ok, 'the coach reads the profile, and an empty one changes nothing',
      ok ? 'all five fields, both prompt builders, silent when blank'
         : [
             emptyAdds ? null : 'an empty profile still adds text',
             reaches ? null : 'a field never reached the prompt',
             tutorToo ? null : 'the tutor prompt ignores it',
             unchanged ? null : 'no-profile prompts differ from each other',
           ].filter(Boolean).join('; '));
  } catch (err) {
    report(false, 'the coach reads the profile, and an empty one changes nothing', err.message);
  }

  // Saving it, reading it back, and the two values the server refuses. A bad
  // date silently stored as a string would break the countdown later, a long
  // way from the form that accepted it.
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `memory-${Date.now()}@example.com`, password: 'password123' }),
    });
    const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
    const patch = (body) =>
      fetch(`http://127.0.0.1:${PORT}/api/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify(body),
      });

    const saved = await (await patch({ profile: { goal: 'پزشکی', exam_at: '2027-06-20', hours_per_day: 4.5 } })).json();
    const badDate = await patch({ profile: { exam_at: '2027-0' } });
    const badHours = await patch({ profile: { hours_per_day: 99 } });

    // A second save naming only one field must not wipe the others - the
    // difference between "not mentioned" and "cleared".
    const after = await (await patch({ profile: { notes: 'شب‌ها کار می‌کنم' } })).json();

    const ok =
      saved.profile && saved.profile.goal === 'پزشکی' && saved.profile.hours_per_day === 4.5 &&
      badDate.status === 400 && badHours.status === 400 &&
      after.profile.goal === 'پزشکی' && after.profile.notes === 'شب‌ها کار می‌کنم';
    report(ok, 'the profile saves, refuses nonsense, and keeps what it was not asked about',
      ok ? 'round-tripped; a half-typed date and 99 hours both refused'
         : JSON.stringify({ saved: saved.profile, badDate: badDate.status, badHours: badHours.status, after: after.profile }));
  } catch (err) {
    report(false, 'the profile saves, refuses nonsense, and keeps what it was not asked about', err.message);
  }

  // The streak, which is arithmetic about somebody's effort and therefore has
  // to be right. Driven through the service against a seeded table rather than
  // through the API, because the interesting cases are all about which day it
  // is and waiting a day per case is not a test.
  try {
    const { execFileSync } = require('node:child_process');
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'studybuddy-streak-'));

    const script = `
      const { db } = require(${JSON.stringify(path.join(__dirname, '..', 'src', 'db'))});
      const p = require(${JSON.stringify(path.join(__dirname, '..', 'src', 'services', 'progress'))});
      const now = new Date('2026-10-15T09:00:00Z');
      const today = p.tehranDay(now);
      db.prepare("INSERT INTO users (email, password_hash, theme, created_at) VALUES ('s@x','x','system','n')").run();
      const uid = db.prepare('SELECT id FROM users LIMIT 1').get().id;
      const add = (offset) => db.prepare('INSERT OR IGNORE INTO activity_days (user_id, day) VALUES (?, ?)')
        .run(uid, p.shiftDay(today, offset));

      // Yesterday and the two before it - three days, and nothing today yet.
      [-1, -2, -3].forEach(add);
      const beforeToday = p.streakFor(uid, now);

      // Now today as well.
      add(0);
      const withToday = p.streakFor(uid, now);

      // A gap five days back must not be counted through.
      [-5, -6].forEach(add);
      const acrossGap = p.streakFor(uid, now);

      const fortnight = p.recentDays(uid, 14, now);
      console.log(JSON.stringify({
        beforeToday, withToday, acrossGap,
        len: fortnight.length,
        lastIsToday: fortnight[fortnight.length - 1].day === today,
        oldestFirst: fortnight[0].day < fortnight[fortnight.length - 1].day,
        activeCount: fortnight.filter((d) => d.active).length,
      }));
    `;

    const out = execFileSync(process.execPath, ['-e', script], {
      env: { ...process.env, DB_PATH: path.join(sandbox, 'streak.db') },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    fs.rmSync(sandbox, { recursive: true, force: true });
    const r = JSON.parse(out.trim().split('\n').pop());

    // beforeToday is the one that matters. Somebody on day three who opens the
    // app over breakfast, before doing anything, must not be told the streak
    // is gone - it is only just morning.
    const ok =
      r.beforeToday === 3 && r.withToday === 4 && r.acrossGap === 4 &&
      r.len === 14 && r.lastIsToday && r.oldestFirst && r.activeCount === 6;

    report(ok, 'the streak counts days, forgives the morning, and stops at a gap',
      ok ? 'three days before doing anything today, four after, and a gap does not carry'
         : JSON.stringify(r));
  } catch (err) {
    report(false, 'the streak counts days, forgives the morning, and stops at a gap', err.message);
  }

  // The day boundary. Iran is +03:30, so 21:00 UTC is already tomorrow there -
  // and that is exactly the hour a student is working. Keyed the way the quota
  // counters are, a late-night session would land on the previous day and read
  // as a broken streak the next morning.
  try {
    const p = require('../src/services/progress');
    const lateNight = new Date('2026-10-01T21:00:00Z');
    const tehran = p.tehranDay(lateNight);
    const utc = lateNight.toISOString().slice(0, 10);
    const ok = tehran === '2026-10-02' && utc === '2026-10-01';
    report(ok, 'a day is a day in Tehran, not in UTC',
      ok ? `21:00Z reads as ${tehran} there, ${utc} here` : `got ${tehran} vs ${utc}`);
  } catch (err) {
    report(false, 'a day is a day in Tehran, not in UTC', err.message);
  }

  // Photographs, at the adapter. A picture costs many times what the sentence
  // beside it costs, so a chat with ten of them must not re-send nine on every
  // turn - and the ones it drops have to be announced, or the model reads a
  // bare "and this one?" and answers as though it could see something.
  try {
    const ai = require('../src/services/ai');
    const shot = (n) => ({ data: Buffer.from(`photo${n}`), type: 'image/jpeg' });
    const built = ai.toChatMessages('SYS', [
      { role: 'user', content: 'q1', image: shot(1) },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'q2', image: shot(2) },
      { role: 'user', content: 'q3', image: shot(3) },
    ]);

    const asArray = built.filter((m) => Array.isArray(m.content));
    const dropped = built.filter((m) => typeof m.content === 'string' && m.content.includes('[an image was attached here'));
    const plainStaysPlain = typeof ai.toChatMessages(null, [{ role: 'user', content: 'hi' }])[0].content === 'string';
    // A picture the caller could not load must degrade to the note, never to
    // the word "undefined" inside a data: URI.
    const noBytes = ai.toChatMessages(null, [{ role: 'user', content: 'q', image: { type: 'image/jpeg' } }]);
    const degrades = typeof noBytes[0].content === 'string';

    const carriedLast = asArray.length === 2 &&
      asArray[1].content[1].image_url.url.includes(Buffer.from('photo3').toString('base64'));

    const ok = asArray.length === ai.MAX_IMAGES_IN_CONTEXT && dropped.length === 1 && carriedLast && plainStaysPlain && degrades;
    report(ok, 'only the last two photos travel, and the dropped one is named',
      ok ? `${ai.MAX_IMAGES_IN_CONTEXT} carried, the oldest announced, text messages untouched`
         : JSON.stringify({ arrays: asArray.length, dropped: dropped.length, carriedLast, plainStaysPlain, degrades }));
  } catch (err) {
    report(false, 'only the last two photos travel, and the dropped one is named', err.message);
  }

  // Photographs, through the API. The size cap is the rule - the browser
  // shrinking pictures first is a convenience, and a request that skips the
  // page entirely must not be able to put four megabytes in a row.
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `photo-${Date.now()}@example.com`, password: 'password123' }),
    });
    const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
    const chat = await (
      await fetch(`http://127.0.0.1:${PORT}/api/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ mode: 'study' }),
      })
    ).json();

    const send = (body) =>
      fetch(`http://127.0.0.1:${PORT}/api/chats/${chat.chat.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify(body),
      });

    // A one-pixel PNG, which is a real image of a real type.
    const tiny = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const tooBig = Buffer.alloc(600 * 1024, 7).toString('base64');

    const badType = await send({ content: 'x', image: { data: tiny, type: 'image/gif' } });
    const oversized = await send({ content: 'x', image: { data: tooBig, type: 'image/png' } });
    const junk = await send({ content: 'x', image: { data: '', type: 'image/png' } });
    // The AI call fails in this environment (the base URL is a closed port),
    // so the request 5xxs - but the picture is checked before any of that, and
    // a 400 here would mean the cap rejected something it should have taken.
    const good = await send({ content: 'what is this?', image: { data: tiny, type: 'image/png' } });

    const ok = badType.status === 400 && oversized.status === 400 && junk.status === 400 && good.status !== 400;
    report(ok, 'the photo cap is the server\'s, not the browser\'s',
      ok ? 'a GIF, 600KB and an empty string all refused; a real PNG accepted'
         : JSON.stringify({ badType: badType.status, oversized: oversized.status, junk: junk.status, good: good.status }));
  } catch (err) {
    report(false, 'the photo cap is the server\'s, not the browser\'s', err.message);
  }

  // The privacy policy lists what is held, so shipping a feature that holds
  // something new makes that page wrong rather than merely out of date. This
  // is the same guard as the terms-versus-PLAN_LIMITS check: a document that
  // disagrees with the code is expensive to be wrong about.
  //
  // Checked in both languages, because a policy that is complete in English
  // and stale in Persian is stale for almost everybody using this.
  try {
    const policy = await (await fetch(`http://127.0.0.1:${PORT}/privacy`)).text();
    const mustMention = [
      ['photo', 'عکس'],       // attached pictures, added with the camera button
      ['coach', 'مربی'],      // the profile, sent with every message
      ['active', 'فعال'],     // the record of which days, behind the streak
      ['reminder', 'یادآور'], // the daily email, and that it is opt-in
    ];
    const missing = mustMention
      .filter(([en, fa]) => !(policy.includes(en) && policy.includes(fa)))
      .map(([en]) => en);
    report(missing.length === 0, 'the privacy policy lists what the app now stores',
      missing.length ? `not mentioned in both languages: ${missing.join(', ')}` : 'photos, profile and activity, in both languages');
  } catch (err) {
    report(false, 'the privacy policy lists what the app now stores', err.message);
  }

  // The daily email, where almost all the care is about not sending it.
  //
  // Driven against a sandbox database with a stubbed transport, because the
  // three cases that matter are "nothing to say", "already sent today" and
  // "somebody asked it to stop" - none of which can be seen by sending one.
  try {
    const { execFileSync } = require('node:child_process');
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'studybuddy-digest-'));
    const root = path.join(__dirname, '..');

    const script = `
      const email = require(${JSON.stringify(path.join(root, 'src', 'services', 'email'))});
      // Stubbed before reminders.js reads it, so nothing leaves the machine.
      const outbox = [];
      email.isConfigured = () => true;
      email.send = async (m) => { outbox.push(m); return { sent: true }; };

      const { db } = require(${JSON.stringify(path.join(root, 'src', 'db'))});
      const reminders = require(${JSON.stringify(path.join(root, 'src', 'services', 'reminders'))});
      const progress = require(${JSON.stringify(path.join(root, 'src', 'services', 'progress'))});

      const now = new Date('2026-10-15T04:00:00Z');
      const today = progress.tehranDay(now);
      const mk = (mail, lang) => {
        db.prepare("INSERT INTO users (email, password_hash, theme, language, created_at) VALUES (?,'x','system',?,'n')").run(mail, lang);
        return db.prepare('SELECT id FROM users WHERE email = ?').get(mail).id;
      };

      const quiet = mk('quiet@x', 'en');    // asked for it, but has nothing due
      const busy  = mk('busy@x', 'fa');     // asked for it, and does
      const off   = mk('off@x', 'en');      // never asked
      reminders.setReminders(quiet, true);
      const token = reminders.setReminders(busy, true);

      db.prepare("INSERT INTO tasks (user_id, title, due_at, status, created_at, updated_at) VALUES (?,?,?,'pending','n','n')")
        .run(busy, 'فصل ۳ شیمی', today);
      db.prepare("INSERT INTO tasks (user_id, title, due_at, status, created_at, updated_at) VALUES (?,?,?,'pending','n','n')")
        .run(busy, 'مرور دیروز', progress.shiftDay(today, -2));

      (async () => {
        const first = await reminders.runOnce('https://buddy.example', now);
        const second = await reminders.runOnce('https://buddy.example', now);

        // Somebody unsubscribing from the link in the mail they just got.
        const stopped = reminders.unsubscribeByToken(token);
        const tomorrow = new Date(now.getTime() + 86400000);
        db.prepare("INSERT INTO tasks (user_id, title, due_at, status, created_at, updated_at) VALUES (?,?,?,'pending','n','n')")
          .run(busy, 'باز هم کار', progress.tehranDay(tomorrow));
        const afterStop = await reminders.runOnce('https://buddy.example', tomorrow);

        console.log(JSON.stringify({
          firstSent: first.sent,
          secondSent: second.sent,
          afterStopSent: afterStop.sent,
          stopped,
          to: outbox.map((m) => m.to),
          persian: outbox[0] && /[\u0600-\u06FF]/.test(outbox[0].text),
          hasUnsubscribe: outbox[0] && outbox[0].text.includes('/unsubscribe/' + token),
          overdueNoted: outbox[0] && outbox[0].text.includes(progress.tehranDay(now)) === false,
          offUntouched: db.prepare('SELECT reminders_on FROM users WHERE id = ?').get(off).reminders_on,
        }));
      })();
    `;

    const out = execFileSync(process.execPath, ['-e', script], {
      env: { ...process.env, DB_PATH: path.join(sandbox, 'digest.db') },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    fs.rmSync(sandbox, { recursive: true, force: true });
    const r = JSON.parse(out.trim().split('\n').pop());

    const ok =
      r.firstSent === 1 &&            // only the one with something due
      r.to.length === 1 && r.to[0] === 'busy@x' &&
      r.secondSent === 0 &&           // a second pass the same day sends nothing
      r.stopped === true &&
      r.afterStopSent === 0 &&        // and nothing after unsubscribing, ever
      r.persian === true &&           // written in the reader's language
      r.hasUnsubscribe === true &&    // every one carries the way out
      r.offUntouched === 0;           // an account that never asked is never touched

    report(ok, 'the digest goes only to whoever asked, once a day, with a way out',
      ok ? 'nothing to say sends nothing; twice in a day sends once; unsubscribing holds'
         : JSON.stringify(r));
  } catch (err) {
    report(false, 'the digest goes only to whoever asked, once a day, with a way out', err.message);
  }

  // The unsubscribe page answers the same way whether or not the token was
  // real. Saying "no such token" would make this somewhere to test tokens.
  try {
    const bogus = await fetch(`http://127.0.0.1:${PORT}/unsubscribe/not-a-real-token`);
    const body = await bogus.text();
    const ok = bogus.status === 200 && /ایمیل یادآوری/.test(body) && !/not found|invalid/i.test(body);
    report(ok, 'an unknown unsubscribe token is told the same thing as a real one',
      ok ? 'HTTP 200, same page, no hint either way' : `status ${bogus.status}`);
  } catch (err) {
    report(false, 'an unknown unsubscribe token is told the same thing as a real one', err.message);
  }

  // The coach writing into the planner. The failure that matters is not a
  // task going missing - it is the block leaking. Left in the text it shows
  // the reader raw markup, and because the reply is stored before it is
  // displayed it would also be read back into the next prompt as though the
  // coach had already said it, and reappear on every reopen.
  try {
    const tp = require('../src/services/taskProposals');

    const reply = [
      'Hier ist dein Plan.',
      '',
      '\`\`\`buddy-tasks',
      'فصل ۳ شیمی | 2026-10-05',
      '2. مرور فرمول‌ها',
      'تست زدن | 2027-13-45',
      '',
      '\`\`\`',
      '',
      'Viel Erfolg!',
    ].join('\n');

    const out = tp.parse(reply);
    const clean = !out.text.includes(tp.FENCE_TAG) && !out.text.includes('\`\`\`') && !out.text.includes('فصل ۳');
    const kept = out.text.includes('Hier ist dein Plan.') && out.text.includes('Viel Erfolg!');
    const numberStripped = out.tasks[1] && out.tasks[1].title === 'مرور فرمول‌ها';
    // A string shaped like a date but impossible is dropped rather than
    // written into tasks.due_at, where the digest would trip over it later.
    const badDateDropped = out.tasks[2] && out.tasks[2].dueAt === null;
    const goodDateKept = out.tasks[0] && out.tasks[0].dueAt === '2026-10-05';

    // Two blocks in one reply: one left showing would be the whole bug.
    const twice = tp.parse(['a', '\`\`\`buddy-tasks', 'x', '\`\`\`', 'b', '\`\`\`buddy-tasks', 'y', '\`\`\`', 'c'].join('\n'));
    const bothGone = !twice.text.includes(tp.FENCE_TAG) && twice.tasks.length === 2;

    // A ceiling, so one reply cannot bury a planner.
    const flood = tp.parse(['\`\`\`buddy-tasks', ...Array.from({ length: 40 }, (_, i) => `task ${i}`), '\`\`\`'].join('\n'));
    const capped = flood.tasks.length === tp.MAX_TASKS;

    // An ordinary reply must come back untouched, not merely unharmed.
    const plain = tp.parse('Just an answer, no plan here.');
    const untouched = plain.text === 'Just an answer, no plan here.' && plain.tasks.length === 0;

    const ok = clean && kept && numberStripped && badDateDropped && goodDateKept && bothGone && capped && untouched;
    report(ok, 'the task block never reaches the reader, and never reaches the next prompt',
      ok ? `stripped, numbering removed, bad date dropped, capped at ${tp.MAX_TASKS}`
         : JSON.stringify({ clean, kept, numberStripped, badDateDropped, goodDateKept, bothGone, capped, untouched, text: out.text }));
  } catch (err) {
    report(false, 'the task block never reaches the reader, and never reaches the next prompt', err.message);
  }

  // Every coach is told it can do this, including the freeform tutor - a plan
  // is as likely to be asked for there as anywhere.
  try {
    const { TRACK_KEYS, getSystemPrompt, getTutorSystemPrompt, getPhases } = require('../src/prompts');
    const tp = require('../src/services/taskProposals');
    const missing = TRACK_KEYS.filter(
      (key) => !getSystemPrompt(getPhases(key)[0].key, null, key, 'en', [], null).includes(tp.FENCE_TAG)
    );
    const tutorToo = getTutorSystemPrompt(null, 'en', [], null).includes(tp.FENCE_TAG);
    const ok = missing.length === 0 && tutorToo;
    report(ok, 'every coach knows it can put work in the planner',
      ok ? `${TRACK_KEYS.length} coaches and the tutor` : `missing: ${missing.join(', ') || 'tutor'}`);
  } catch (err) {
    report(false, 'every coach knows it can put work in the planner', err.message);
  }

  // Referrals. The mechanics are twenty lines; everything worth testing is
  // the reason this is not simply free money for whoever owns the most email
  // addresses.
  try {
    const { execFileSync } = require('node:child_process');
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'studybuddy-ref-'));
    const root = path.join(__dirname, '..');

    const script = `
      const { db } = require(${JSON.stringify(path.join(root, 'src', 'db'))});
      const referrals = require(${JSON.stringify(path.join(root, 'src', 'services', 'referrals'))});
      const discounts = require(${JSON.stringify(path.join(root, 'src', 'services', 'discounts'))});

      const mk = (mail) => {
        db.prepare("INSERT INTO users (email, password_hash, theme, created_at) VALUES (?,'x','system','n')").run(mail);
        return db.prepare('SELECT id FROM users WHERE email = ?').get(mail).id;
      };
      const rewards = (id) =>
        db.prepare("SELECT COUNT(*) AS n FROM discount_codes WHERE user_id = ? AND kind = 'referral'").get(id).n;

      const alice = mk('alice@x');
      const bob = mk('bob@x');
      const code = referrals.codeFor(alice);

      // Inviting yourself is the first thing anybody tries.
      const selfClaim = referrals.claim(alice, code);
      // A code nobody owns.
      const junkClaim = referrals.claim(bob, 'BUDDY-ZZZZ-ZZZZ');

      const realClaim = referrals.claim(bob, code);
      // Signing up is not using it: no reward has been paid yet.
      const paidAtSignup = rewards(alice) + rewards(bob);

      // Bob actually uses the app.
      const firstReward = referrals.rewardIfEarned(bob);
      const afterUse = { alice: rewards(alice), bob: rewards(bob) };

      // Every later message must not pay again.
      referrals.rewardIfEarned(bob);
      referrals.rewardIfEarned(bob);
      const afterRepeats = { alice: rewards(alice), bob: rewards(bob) };

      // The reward is worth more than the signup code, and checkout offers
      // the better of the two rather than whichever came first.
      discounts.issueForUser(alice);
      const best = discounts.bestUnusedFor(alice);

      // The cap: one inviter cannot farm this forever.
      let capped = true;
      for (let i = 0; i < referrals.MAX_REWARDED_PER_INVITER + 3; i += 1) {
        const guest = mk(\`guest\${i}@x\`);
        referrals.claim(guest, code);
        referrals.rewardIfEarned(guest);
      }
      const total = db.prepare("SELECT COUNT(*) AS n FROM discount_codes WHERE user_id = ? AND kind = 'referral'").get(alice).n;
      capped = total <= referrals.MAX_REWARDED_PER_INVITER;

      console.log(JSON.stringify({
        selfClaim, junkClaim, realClaim, paidAtSignup,
        firstReward, afterUse, afterRepeats,
        bestPercent: best && best.percent, bestKind: best && best.kind,
        total, cap: referrals.MAX_REWARDED_PER_INVITER, capped,
      }));
    `;

    const out = execFileSync(process.execPath, ['-e', script], {
      env: { ...process.env, DB_PATH: path.join(sandbox, 'ref.db') },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    fs.rmSync(sandbox, { recursive: true, force: true });
    const r = JSON.parse(out.trim().split('\n').pop());

    const ok =
      r.selfClaim === false &&                        // no inviting yourself
      r.junkClaim === false &&                        // no inventing a code
      r.realClaim === true &&
      r.paidAtSignup === 0 &&                         // signing up earns nothing
      r.firstReward === true &&
      r.afterUse.alice === 1 && r.afterUse.bob === 1 &&   // both sides, once
      r.afterRepeats.alice === 1 && r.afterRepeats.bob === 1 &&  // and only once
      r.bestKind === 'referral' &&                    // checkout offers the better code
      r.capped;

    report(ok, 'a referral pays both sides once, and only for a real user',
      ok ? `self and junk codes refused, nothing at signup, capped at ${r.cap}`
         : JSON.stringify(r));
  } catch (err) {
    report(false, 'a referral pays both sides once, and only for a real user', err.message);
  }

  server.kill();
  fs.rmSync(dbDir, { recursive: true, force: true });

  console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
  process.exit(failures ? 1 : 0);
})();
