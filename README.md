# Study Buddy 📚

A study chatbot that runs every session through **four phases**:

1. **Warm-Up** — figure out the topic, your current knowledge level, and your goal for the session.
2. **Learn** — the bot teaches the core concepts in digestible chunks, with examples and quick understanding checks.
3. **Practice** — active recall: one question/problem at a time, with immediate feedback, adapting to your weak spots.
4. **Review** — a summary cheat-sheet, a recap of weak areas, and a spaced-repetition plan for what to revisit and when.

You move between phases with the **Next Phase** button whenever the bot says you're ready (or whenever you want).

## Setup

Requires Node.js 18+ and an [Anthropic API key](https://console.anthropic.com/).

```bash
npm install
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...
npm start
```

Then open http://localhost:3000.

## How it works

- `server.js` — a small Express server exposing `POST /api/chat`, which forwards the conversation to Claude with a phase-specific system prompt.
- `src/prompts.js` — defines the four phases and the system prompt instructions for each.
- `public/` — a vanilla HTML/CSS/JS chat UI with a phase progress tracker, chat log, and composer.

The frontend keeps the full conversation history client-side and resends it with each request, along with the current phase key, so the bot only ever gets instructions for the phase you're currently in while still remembering everything said earlier in the session.

## Configuration

Environment variables (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | required, your Claude API key |
| `PORT` | `3000` | port the server listens on |
| `MODEL_ID` | `claude-sonnet-5` | Claude model to use |
