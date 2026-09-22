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

// A missing or unwritable database folder on a managed host almost always means
// the disk is not where the app thinks it is. Three guesses at that - wrong
// name, wrong path, no redeploy - were all ruled out by evidence while the site
// stayed down, so this stopped guessing and started reporting.
//
// It says which call failed, and then what is actually on the filesystem. One
// deploy answers the question instead of three.

// Every one of these is wrapped: a diagnostic that throws while explaining a
// failure is worse than no diagnostic at all.
function describe(target) {
  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch (err) {
    return err.code === 'ENOENT' ? 'does not exist' : `cannot stat (${err.code})`;
  }

  if (stat.isSymbolicLink()) {
    // A dangling symlink is the one shape that reports ENOENT from accessSync
    // while looking present to anything that only checks the parent.
    let to = '?';
    try {
      to = fs.readlinkSync(target);
    } catch {
      /* the link is there even if its target cannot be read */
    }
    const dangling = !fs.existsSync(target) ? ', DANGLING' : '';
    return `symlink -> ${to}${dangling}`;
  }
  if (stat.isDirectory()) {
    try {
      const entries = fs.readdirSync(target);
      const shown = entries.slice(0, 12).join(', ');
      return `directory, ${entries.length} entries${entries.length ? `: ${shown}` : ' (empty)'}`;
    } catch (err) {
      return `directory, cannot list (${err.code})`;
    }
  }
  return stat.isFile() ? 'a file, not a directory' : 'exists, not a directory';
}

// From the folder we wanted up to the root, so the first thing that does exist
// is visible along with everything missing beneath it.
function ancestry(dir) {
  const parts = [];
  let current = path.resolve(dir);
  for (let i = 0; i < 12; i += 1) {
    parts.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return parts.reverse().map((p) => `    ${p.padEnd(34)} ${describe(p)}`);
}

let failedAt = null;
let failure = null;
try {
  fs.mkdirSync(DB_DIR, { recursive: true });
} catch (err) {
  failedAt = 'creating the folder';
  failure = err;
}
if (!failure) {
  try {
    fs.accessSync(DB_DIR, fs.constants.W_OK);
  } catch (err) {
    // Reached separately on purpose. mkdirSync with recursive swallows EEXIST,
    // so an ENOENT arriving here is a different fault from "could not create
    // it" - a dangling symlink, or a mount the panel shows but the container
    // does not have - and it was being reported as the same thing.
    failedAt = 'writing to the folder';
    failure = err;
  }
}

if (failure) {
  // The headline follows which call failed, not the errno. Keying it off
  // ENOENT said "cannot be written to" about a folder that could not be
  // created in the first place - the two want different fixes.
  die([
    failedAt === 'creating the folder'
      ? 'Buddy could not start: the database folder is not there and could not be created.'
      : 'Buddy could not start: the database folder is there but cannot be written to.',
    '',
    `  DB_PATH:  ${DB_PATH}`,
    `  folder:   ${DB_DIR}`,
    `  failed:   ${failedAt}`,
    `  error:    ${failure.code || failure.message}`,
    '',
    '  Where the app is running from:',
    `    cwd:       ${process.cwd()}`,
    `    this file: ${__dirname}`,
    '',
    '  The path, one level at a time:',
    ...ancestry(DB_DIR),
    '',
    '  Other places a disk is commonly mounted:',
    ...['/app', '/usr/src/app', '/data', '/mnt', '/srv'].map(
      (p) => `    ${p.padEnd(34)} ${describe(p)}`
    ),
    '',
    'Read the listing above before changing anything. If the folder is simply',
    'absent, no disk is mounted there - create one in the host panel and set',
    'DB_PATH inside it. If a different directory above holds the app, DB_PATH',
    'and the mount path both belong there instead.',
    '',
    'Not started rather than started without a disk: writing the database to',
    'storage that the next deploy discards loses every account silently, which',
    'is worse than refusing to boot.',
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

    // One transaction per migration, covering the statements AND the row that
    // records it. Without this a migration that failed halfway left its early
    // statements behind and was never marked applied, so the next boot ran it
    // again, hit "table already exists" on the first line, and threw. That is
    // not a failed deploy you can retry - it is a server that can never start
    // again, and the fix would have to be done by hand inside the database.
    //
    // SQLite runs DDL inside a transaction, so the rollback is real: a failed
    // migration leaves the database exactly as it was, and redeploying once the
    // migration is corrected simply works.
    db.exec('BEGIN');
    try {
      db.exec(sql);
      recordApplied.run(file, new Date().toISOString());
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      err.message = `Migration ${file} failed and was rolled back: ${err.message}`;
      throw err;
    }
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
