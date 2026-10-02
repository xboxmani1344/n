#!/bin/bash
# SessionStart hook: prepares a Claude Code cloud session to run this app.
# Safe to run repeatedly — every step is idempotent.
set -euo pipefail

# Only cloud sessions start from a bare checkout; a local machine is already set up.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# node:sqlite (used by src/db.js) only exists on Node 22.5+, which package.json requires.
node_version="$(node --version)"
echo "Node ${node_version}"
if ! node -e 'const [maj, min] = process.versions.node.split(".").map(Number); process.exit(maj > 22 || (maj === 22 && min >= 5) ? 0 : 1)'; then
  echo "WARNING: Node >= 22.5.0 is required for the built-in node:sqlite module." >&2
fi

# install, not ci: the container image is cached after this hook, so reusing an
# existing node_modules keeps later sessions fast.
echo "Installing npm dependencies..."
npm install --no-audit --no-fund

# server.js calls dotenv at startup; without a .env the app boots but every AI
# call fails on a missing key. Seed one from the example so the failure is a
# placeholder key rather than a missing file.
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — set a real GEMINI_API_KEY to use the AI features."
fi

# Migrations run on first require of src/db.js; doing it here means the session
# starts with a ready database instead of paying for it on the first request.
echo "Applying database migrations..."
node -e 'require("./src/db");'

echo "Setup complete. Start the app with: npm start"
