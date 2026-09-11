'use strict';

const fs = require('fs');
const path = require('path');

// The two ways this fails on a managed host are both silent-looking: the
// runtime is older than the SQLite module needs, or the database path is not
// writable because no disk was attached. Both surface as stack traces that say
// nothing about the actual cause, so check for them by name first.

// Throws rather than exiting, so server.js can catch it and put the reason on
// a web page. On a managed host the logs are not always easy to reach - the
// panel's log view can come up empty - and "Application Error" on its own tells
// nobody anything. The message is worth more in the browser than in a log file
// no one can open.
function die(lines) {
  const message = lines.join('\n');
  console.error('\n' + message + '\n');
  throw Object.assign(new Error(message), { bootFailure: true });
}

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (err) {
  const [major, minor] = process.versions.node.split('.').map(Number);
  die([
    'Buddy could not start: this Node.js is too old.',
    '',
    `  running:  Node ${process.versions.node}`,
    '  required: Node 22.5 or newer',
    '',
    'The database uses Node\'s built-in SQLite, which was added in 22.5.',
    major < 22 || (major === 22 && minor < 5)
      ? 'Set a newer Node version in your host\'s settings and redeploy.'
      : `Unexpected: ${err.code || err.message}`,
  ]);
}

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'study-buddy.db');
const DB_DIR = path.dirname(DB_PATH);

// A read-only or missing directory almost always means DB_PATH points at a disk
// that was never mounted. Saying that plainly is the difference between a
// two-minute fix and an afternoon.
try {
  fs.mkdirSync(DB_DIR, { recursive: true });
  fs.accessSync(DB_DIR, fs.constants.W_OK);
} catch (err) {
  die([
    'Buddy could not start: the database folder is not writable.',
    '',
    `  DB_PATH:  ${DB_PATH}`,
    `  folder:   ${DB_DIR}`,
    `  error:    ${err.code || err.message}`,
    '',
    'On a hosted server this normally means no persistent disk is attached at',
    'that path, or DB_PATH points somewhere outside the disk. Attach a disk and',
    'set DB_PATH to a file inside it.',
  ]);
}

const db = new DatabaseSync(DB_PATH);

// A managed host's disk is a network mount, and SQLite will quietly decline WAL
// on one rather than failing: it stays in rollback-journal mode and carries on.
// Nothing breaks, but nothing says so either, so read back what actually took
// effect instead of assuming the PRAGMA above was honoured.
const journalMode = db.prepare('PRAGMA journal_mode = WAL').get().journal_mode;
db.exec('PRAGMA foreign_keys = ON');

if (journalMode !== 'wal') {
  console.warn(
    `Note: SQLite is in "${journalMode}" mode, not WAL — usually because DB_PATH is on a network disk. ` +
      'The app works either way; concurrent reads and writes just block each other more.'
  );
}

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(db.prepare('SELECT filename FROM migrations').all().map((r) => r.filename));

  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  const recordApplied = db.prepare('INSERT INTO migrations (filename, applied_at) VALUES (?, ?)');

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    db.exec(sql);
    recordApplied.run(file, new Date().toISOString());
    console.log(`Applied migration: ${file}`);
  }
}

runMigrations();

// Is the database on a disk of its own, or on the container's own filesystem
// that the next deploy throws away? A mounted volume is a different device, so
// comparing device ids answers it without needing to know anything about the
// host. Returns null where the check itself is not possible.
//
// This is the failure that costs the most and announces itself the least: the
// app runs perfectly, and then one redeploy later every account is gone.
function onSeparateVolume() {
  try {
    return fs.statSync(DB_DIR).dev !== fs.statSync(path.join(__dirname, '..')).dev;
  } catch {
    return null;
  }
}

// node:sqlite has no transaction() helper of its own - that is better-sqlite3's
// API - so this is the wrapper the rest of the code uses. Without it, a run of
// related writes can be left half-applied by a throw in the middle.
function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { db, DB_PATH, onSeparateVolume, transaction };
