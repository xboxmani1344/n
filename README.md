# Study Buddy 📚

An AI study app: structured 4-phase study sessions, a freeform AI teacher, a task/calendar planner, a YouTube video summarizer, accounts, and free/paid subscription tiers.

## Features

- **Study sessions** — each one runs through four phases: **Warm-Up** (topic, level, goal) → **Learn** (concepts in digestible chunks) → **Practice** (active recall with feedback) → **Review** (cheat-sheet + spaced-repetition plan). Move on with the **Next Phase** button whenever you're ready.
- **AI Teacher** — a freeform, always-available chat for one-off questions on any topic, no phases required.
- **Recent chats** — a sidebar lists every past chat (both kinds), auto-titled from your first message; switch between them any time.
- **Planner** — a month calendar plus a task list: add assignments with due dates and subjects, click a day to filter, check things off.
- **Video Summarizer** — paste a YouTube link and get structured study notes from its captions. If auto-fetch fails for a video (YouTube's caption/bot-detection endpoints change often), you can paste the transcript in yourself instead — summarization always works either way.
- **Accounts** — email/password sign-in, plus optional "Continue with Google" once configured (see below).
- **Settings** — profile name, light/system/dark theme, password change, plan/usage.
- **Subscriptions** — a free tier with daily/monthly usage limits, and a paid tier via real Stripe Checkout once configured.

## Setup

Requires **Node.js 22+** (it uses the built-in `node:sqlite` module) and a **free Gemini API key** — no credit card needed.

1. Get a key at **https://aistudio.google.com/apikey** → *Create API key*, and copy it.
2. Then:

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
# open .env and paste your key after GEMINI_API_KEY=
npm start
```

Open http://localhost:3000, create an account, and start studying. Google sign-in and Stripe billing are optional — the app runs fully without them (see `.env.example`).

> ⚠️ **Gemini's free tier is not private.** Per [Google's API terms](https://ai.google.dev/gemini-api/terms), on the unpaid tier Google uses your prompts and responses to improve its products, and human reviewers may read them. Google's own advice is: *"Do not submit sensitive, confidential, or personal information to the Unpaid Services."* Enabling billing on your Google Cloud project switches this off. Keep it in mind for anything you'd rather not have reviewed.

The free tier is also rate-limited, and the **per-minute** cap is the one you'll actually notice: `gemini-3.6-flash` allows only **5 requests per minute**, so firing off several messages back-to-back will get you a "wait about N seconds" message. There's a daily cap too (a few hundred requests, depending on model). Check your live limits in [AI Studio](https://aistudio.google.com/).

## Deploy to a live URL (optional)

The repo includes a `render.yaml` blueprint for [Render](https://render.com). Note that Blueprints are a paid Render feature — on the free plan, create a **Web Service** manually instead (build `npm ci`, start `npm start`, instance type **Free**) and set `GEMINI_API_KEY` and `NODE_ENV=production` as environment variables.

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
| `GEMINI_API_KEY` | — | required, your free Gemini key from [AI Studio](https://aistudio.google.com/apikey) |
| `PORT` | `3000` | port the server listens on |
| `MODEL_ID` | `gemini-3.6-flash` | Gemini model to use (`gemini-flash-latest` tracks the newest release) |
| `THINKING_LEVEL` | unset | `MINIMAL` makes replies ~2x faster by skipping the model's reasoning step. Left unset, the model thinks as it normally would — worth keeping for the Practice phase, which grades your answers. |
| `DB_PATH` | `./data/study-buddy.db` | where the SQLite database file lives |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | — | optional; enables "Continue with Google". Email/password works fully without it. |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` | — | optional; enables real paid-plan upgrades. The free plan (with usage limits) works fully without it — the Upgrade button just explains billing isn't set up yet. |

### Free plan limits

Defined in `src/services/usage.js` (`PLAN_LIMITS`) — change the numbers there, nothing else needs to know:

- Free: 20 AI messages/day, 3 video summaries/month.
- Paid: 500 AI messages/day, 50 video summaries/month.
