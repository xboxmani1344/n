# Study Buddy 📚

An AI coach that runs four-phase sessions for **studying**, **training** and **eating better**, plus a freeform teacher chat, a task/calendar planner, a YouTube video summarizer, accounts, and free/paid tiers.

## Features

- **Three coached tracks**, each four phases, moved along with the **Next Phase** button:

  | Track | Phases |
  |---|---|
  | Study | Warm-Up → Learn → Practice → Review |
  | Workout | Assess → Plan → Train → Progress |
  | Nutrition | Check In → Shape → Meals → Adjust |

  The training and nutrition coaches route pain, medical conditions and any sign of disordered eating to a professional rather than coaching through them, and the nutrition track never prescribes calorie targets or comments on anyone's body — a large share of the audience are students, some of them teenagers.
- **AI Teacher** — a freeform, always-available chat for one-off questions on any topic, no phases required.
- **Recent chats** — a sidebar lists every past session across all tracks, auto-titled from your first message; switch between them any time.
- **Planner** — a month calendar plus a task list: add assignments with due dates and subjects, click a day to filter, check things off.
- **Video Summarizer** — paste a YouTube link and get structured study notes from its captions. If auto-fetch fails for a video (YouTube's caption/bot-detection endpoints change often), you can paste the transcript in yourself instead — summarization always works either way.
- **Accounts** — email/password sign-in, plus optional "Continue with Google" once configured (see below).
- **Settings** — profile name, light/system/dark theme, password change, plan/usage.
- **Subscriptions** — a free tier with daily/monthly usage limits, and a paid tier via real Stripe Checkout once configured.

## Setup

Requires **Node.js 22+** (it uses the built-in `node:sqlite` module) and a **free Gemini API key** — no credit card needed.

1. Get a key at **https://aistudio.google.com/apikey** → *Create API key*, and copy it.

**On Windows**, that's the only step — **double-click `start.bat`**. It installs everything, asks for your key once, and opens the app. Skip the rest of this section.

Otherwise:

```bash
npm install
npm start
```

Then open http://localhost:3000 and paste your key into the setup screen — **you don't need to create or edit any files.** The app checks the key against Google, saves it to `.env` itself, and starts working immediately without a restart. (You can still write `.env` by hand if you prefer: copy `.env.example` to `.env` and set `AI_API_KEY=`.)

The setup screen only appears when no key is configured, and only for a browser on the same machine as the server — so a deployed instance never exposes it.

Open http://localhost:3000, create an account, and start studying. Google sign-in and Stripe billing are optional — the app runs fully without them (see `.env.example`).

> ⚠️ **Gemini's free tier is not private.** Per [Google's API terms](https://ai.google.dev/gemini-api/terms), on the unpaid tier Google uses your prompts and responses to improve its products, and human reviewers may read them. Google's own advice is: *"Do not submit sensitive, confidential, or personal information to the Unpaid Services."* Enabling billing on your Google Cloud project switches this off. Keep it in mind for anything you'd rather not have reviewed.

The free tier is also rate-limited, and the **per-minute** cap is the one you'll actually notice: `gemini-3.6-flash` allows only **5 requests per minute**, so firing off several messages back-to-back will get you a "wait about N seconds" message. There's a daily cap too (a few hundred requests, depending on model). Check your live limits in [AI Studio](https://aistudio.google.com/).

## Who pays for the AI? (read before deploying publicly)

Running this for one person and running it for strangers are different problems, and the difference is the API key.

- **Locally, for yourself:** one key in `.env` (or entered in the setup screen). Everything works, nothing else to think about.
- **Deployed for other people:** leave `AI_API_KEY` **unset**. Each user adds their own key under **Settings → AI key**, and it's stored against their account.

That isn't bureaucracy — the free tier allows roughly **5 requests per minute per key**, so a shared key means two people studying simultaneously interfere with each other. Google also attributes every prompt to the key's owner, so a shared key means your account is credited with strangers' conversations.

If you genuinely want everyone on one key — because you're paying for it and accept that attribution — set `SHARED_API_KEY=1`. Users can still add their own to opt out of the shared pool.

Keys are validated against Google before they're saved, so a mistyped key is rejected at entry rather than failing later mid-conversation.

## Choosing an AI provider

The app talks to whatever `AI_BASE_URL` points at, using the OpenAI *chat completions* format. That covers OpenAI, OpenRouter, a local Ollama, Iranian services such as Liara AI, and Google — whose OpenAI-compatible endpoint is the default. Switching provider is configuration, not code:

```bash
AI_BASE_URL=https://your-provider.example/v1
AI_API_KEY=...
MODEL_ID=whatever-they-call-it
```

**This matters if you host somewhere Google is unreachable.** A server inside Iran cannot reach `generativelanguage.googleapis.com` at all, so every message fails with "Couldn't reach the AI service" no matter how valid the key is. The fix is to point `AI_BASE_URL` at a provider that *is* reachable from the server.

Two other features reach the internet and will also fail on such a host:

- **YouTube auto-transcripts** — blocked. The manual transcript paste box still works and is a first-class path, so the summarizer stays usable.
- **"Continue with Google" sign-in** — blocked. Optional and off unless configured; email/password is unaffected.

## Running it on your own key, for everyone

If you'd rather your users didn't have to get their own key, set both:

```bash
AI_API_KEY=your-key
SHARED_API_KEY=1
NODE_ENV=production
```

Everyone who signs in then uses your key, and the Settings panel presents adding a personal key as optional rather than as a step they must complete.

**Two things to understand before you do this.**

*Your bill is now capped only by the app's own limits.* `PLAN_LIMITS` in `src/services/usage.js` — currently **20 AI messages per day** and 3 video summaries per month on the free plan — is the only thing between one enthusiastic user and your credit. Those numbers were chosen when each user paid for their own usage. Set them deliberately now.

*A free tier will not survive more than one person.* Gemini's free tier allows roughly **5 requests per minute for the whole key**, so a second person chatting at the same time gets "wait about 30 seconds". Sharing a key only works in practice on a paid plan.

## Deploying to a managed host (Liara, Render, etc.)

The app is a normal long-running Node server with a SQLite file, so it runs on
anything that gives it a persistent disk. It does **not** run on serverless
platforms such as Vercel: there the filesystem is discarded between invocations,
so every account, chat and task would vanish on each cold start — silently.

Environment variables to set in the host's panel:

| Variable | Value |
|---|---|
| `AI_API_KEY` | your provider key |
| `AI_BASE_URL` | your provider's endpoint, if it isn't Google |
| `MODEL_ID` | the model name your provider uses |
| `SHARED_API_KEY` | `1` if you're paying for the key on your users' behalf |
| `NODE_ENV` | `production` |
| `DB_PATH` | a file **inside the mounted disk**, e.g. `/var/lib/data/study-buddy.db` |

Two requirements are worth checking before the first deploy, because both are
easy to miss and neither is obvious from a stack trace:

- **Node 22.5 or newer.** The database uses Node's built-in SQLite, added in
  22.5. On an older runtime the app now stops at boot and says so, naming the
  version it found, rather than failing with `ERR_UNKNOWN_BUILTIN_MODULE`.
- **A persistent disk, with `DB_PATH` pointing inside it.** Without one the
  database is wiped on every redeploy. If the path isn't writable the app stops
  at boot and says which folder it tried, rather than crashing deeper in.

## Deploy to a live URL (optional)

The repo includes a `render.yaml` blueprint for [Render](https://render.com). Note that Blueprints are a paid Render feature — on the free plan, create a **Web Service** manually instead (build `npm ci`, start `npm start`, instance type **Free**) and set `AI_API_KEY` and `NODE_ENV=production` as environment variables.

**Caveat:** Render's free plan uses an *ephemeral* filesystem and sleeps after ~15 minutes idle. Since this app stores everything in a SQLite file, **accounts, chats, and tasks are erased on every sleep and redeploy**, and the first request after idling takes ~30 seconds. For durable hosting you'd want a paid instance with a disk at `/data` (plus `DB_PATH=/data/study-buddy.db`), or a migration to hosted Postgres.

If you enabled Google sign-in, add your deployed callback URL (`https://your-app.example.com/api/auth/google/callback`) to the authorized redirect URIs in the Google Cloud console — otherwise it only works locally.

## How it works

```
server.js                 # thin bootstrap: env, DB, mounts routers, serves public/
src/
  db.js                    # opens data/study-buddy.db (node:sqlite), runs migrations
  migrations/*.sql          # one file per schema change, applied in order on boot
  prompts.js                 # phase prompts, tutor prompt, video-summary prompts
  middleware/{auth,errors}.js
  services/{auth,ai,youtube,usage}.js
  routes/{auth,chats,tasks,video,settings,billing}.js
public/
  index.html, styles.css     # monochrome "liquid glass" UI — translucent panels,
                               # a segmented phase tracker, ChatGPT-style composer
  app.js                      # sidebar + view router (Chats / Planner / Video / Settings),
                                # all wired to the API below
```

- **Auth**: opaque session tokens (not JWTs) in a `sessions` table, set as an `httpOnly` cookie — logout (or a future "sign out everywhere") is just a row delete. Google OAuth is a standard redirect + code exchange, no extra dependency.
- **Chats**: persisted `chats`/`messages` tables. Each chat has a `mode` (`phased` or `tutor`) and, for phased chats, its own `phase_key`. The server rebuilds conversation history from the DB on each turn rather than trusting a client-supplied array.
- **Planner**: a `tasks` table with due dates, subjects, and status; the calendar view is hand-rolled vanilla JS (no library).
- **Video summarizer**: `src/services/youtube.js` extracts caption tracks from the watch page (no API key needed) and fetches the timedtext track; falls back to map-reduce chunking for very long transcripts. Results are cached per-video. Manual transcript paste is a first-class fallback, not an afterthought — YouTube's anti-bot measures mean automated fetching can fail unpredictably depending on where this is deployed.
- **Usage limits & billing**: `src/services/usage.js` holds the free/paid limits in one config object and a `usage_counters` table; `src/routes/billing.js` wraps Stripe Checkout, the billing portal, and a webhook that keeps `subscriptions.plan` in sync. All gating logic reads only that one field, so it doesn't care whether billing is configured.

## Configuration

Environment variables (see `.env.example` for details on each):

| Variable | Default | Description |
|---|---|---|
| `AI_API_KEY` | — | required, your provider key. A free Gemini key from [AI Studio](https://aistudio.google.com/apikey) works out of the box. `GEMINI_API_KEY` still accepted as the older name. |
| `AI_BASE_URL` | Google's OpenAI-compatible endpoint | any OpenAI-compatible service — see *Choosing an AI provider* |
| `PORT` | `3000` | port the server listens on |
| `MODEL_ID` | `gemini-3.6-flash` | Gemini model to use (`gemini-flash-latest` tracks the newest release) |
| `SHARED_API_KEY` | unset | Only read when `NODE_ENV=production`. Set to `1` to let every signed-in user spend the server's `AI_API_KEY`. Leave unset so each user supplies their own — see below. |
| `DB_PATH` | `./data/study-buddy.db` | where the SQLite database file lives |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | — | optional; enables "Continue with Google". Email/password works fully without it. |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` | — | optional; enables real paid-plan upgrades. The free plan (with usage limits) works fully without it — the Upgrade button just explains billing isn't set up yet. |

### Free plan limits

Defined in `src/services/usage.js` (`PLAN_LIMITS`) — change the numbers there, nothing else needs to know:

- Free: 20 AI messages/day, 3 video summaries/month.
- Paid: 500 AI messages/day, 50 video summaries/month.
