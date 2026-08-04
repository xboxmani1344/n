# Study Buddy 📚

A study chatbot with accounts and persisted chat history. Each study session runs through **four phases**:

1. **Warm-Up** — figure out the topic, your current knowledge level, and your goal for the session.
2. **Learn** — the bot teaches the core concepts in digestible chunks, with examples and quick understanding checks.
3. **Practice** — active recall: one question/problem at a time, with immediate feedback, adapting to your weak spots.
4. **Review** — a summary cheat-sheet, a recap of weak areas, and a spaced-repetition plan for what to revisit and when.

You move between phases with the **Next Phase** button whenever the bot says you're ready (or whenever you want).

## Setup

Requires Node.js 22+ (uses the built-in `node:sqlite` module) and an [Anthropic API key](https://console.anthropic.com/).

```bash
npm install
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...
npm start
```

Then open http://localhost:3000, create an account, and start studying.

## How it works

- `server.js` — thin Express bootstrap: loads env, opens the DB, mounts routers, serves `public/`.
- `src/db.js` — opens a local SQLite database (Node's built-in `node:sqlite`) and applies any pending files in `src/migrations/` on boot.
- `src/routes/auth.js` — signup, login, logout, session cookie handling, and Google OAuth (inert until configured, see below).
- `src/routes/chats.js` — persisted chats + messages, replacing the old single-conversation `/api/chat` endpoint. Each chat remembers its own phase; messages are stored server-side rather than resent by the client on every turn.
- `src/prompts.js` — the four phase system prompts, plus a freeform tutor prompt for future "ask anything" mode.
- `public/` — a vanilla HTML/CSS/JS chat UI: a login/signup screen gates the app, then the existing phase-tracker + chat UI, now backed by the persisted API.

Sessions are opaque tokens stored in a `sessions` table and set as an `httpOnly` cookie — not JWTs — so logging out (or a future "sign out everywhere") is a simple row delete.

## Configuration

Environment variables (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | required, your Claude API key |
| `PORT` | `3000` | port the server listens on |
| `MODEL_ID` | `claude-sonnet-5` | Claude model to use |
| `DB_PATH` | `./data/study-buddy.db` | where the SQLite database file lives |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | optional; enables "Continue with Google" on sign-in. Without these, email/password sign-in still works fully and the Google button just shows as not configured. |
| `GOOGLE_REDIRECT_URI` | derived from the request | optional override for the OAuth callback URL |

This is the first milestone of a larger build-out (multi-chat sidebar, an always-on AI teacher chat, a task/calendar planner, a YouTube video summarizer, settings, and subscription tiers with real Stripe billing) — more of that lands in follow-up commits.
