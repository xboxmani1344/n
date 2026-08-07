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

## Deploy to a live URL (Render)

This repo includes a `render.yaml` blueprint, so deploying is mostly clicking through prompts:

1. Sign up at **https://render.com** (the free tier is enough) and connect your GitHub account.
2. Click **New → Blueprint**, pick this repository, and Render reads `render.yaml` automatically.
3. When it asks for the `ANTHROPIC_API_KEY` environment variable, paste your key from https://console.anthropic.com/.
4. Click **Apply** / **Create**. First build takes a few minutes; you'll get a URL like `https://study-buddy-xxxx.onrender.com`.

**Important caveat about the free tier:** Render's free plan uses an *ephemeral* filesystem and spins the service down after ~15 minutes of inactivity. Since this app stores everything in a SQLite file on disk, **accounts, chats, and tasks are erased on every spin-down and redeploy.** That's fine for a demo or personal link, but for real use you'd want either:

- a paid Render instance with a persistent disk mounted at `/data`, plus `DB_PATH=/data/study-buddy.db`, or
- migrating the storage layer from SQLite to a hosted Postgres.

Also note the first request after an idle period takes ~30 seconds while the free instance wakes up.

If you enabled Google sign-in, add your deployed callback URL (`https://your-app.onrender.com/api/auth/google/callback`) to the authorized redirect URIs in the Google Cloud console — otherwise Google sign-in will only work locally.

## Setup (running it locally)

Requires Node.js 22+ (uses the built-in `node:sqlite` module) and an [Anthropic API key](https://console.anthropic.com/).

```bash
npm install
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...
npm start
```

Then open http://localhost:3000, create an account, and start studying. Google sign-in and Stripe billing are both optional — the app runs fully without them (see `.env.example` for how to turn them on).

## How it works

```
server.js                 # thin bootstrap: env, DB, mounts routers, serves public/
src/
  db.js                    # opens data/study-buddy.db (node:sqlite), runs migrations
  migrations/*.sql          # one file per schema change, applied in order on boot
  prompts.js                 # phase prompts, tutor prompt, video-summary prompts
  middleware/{auth,errors}.js
  services/{auth,anthropic,youtube,usage}.js
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
| `ANTHROPIC_API_KEY` | — | required, your Claude API key |
| `PORT` | `3000` | port the server listens on |
| `MODEL_ID` | `claude-sonnet-5` | Claude model to use |
| `DB_PATH` | `./data/study-buddy.db` | where the SQLite database file lives |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | — | optional; enables "Continue with Google". Email/password works fully without it. |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` | — | optional; enables real paid-plan upgrades. The free plan (with usage limits) works fully without it — the Upgrade button just explains billing isn't set up yet. |

### Free plan limits

Defined in `src/services/usage.js` (`PLAN_LIMITS`) — change the numbers there, nothing else needs to know:

- Free: 20 AI messages/day, 3 video summaries/month.
- Paid: 500 AI messages/day, 50 video summaries/month.
