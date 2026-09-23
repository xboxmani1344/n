'use strict';

const { createHash } = require('crypto');
const fs = require('fs');
const path = require('path');

// A short fingerprint of the code that is running.
//
// Two rounds of this project's debugging were spent reading the wrong deploy's
// log: once studying v8's output while waiting on v10, once v11's while waiting
// on v12. Both times the conclusion drawn was wrong, and both times the only
// way to notice was comparing timestamps by hand. Every deploy prints output of
// exactly the same shape, so there was nothing in a log that said which build
// made it.
//
// The host hands the container no commit id and there is no Dockerfile to bake
// one into, but none is needed: hash the files the app is made of. The value
// changes whenever the code does, and it can be computed identically here and
// there - the working tree matches git exactly, and .gitattributes rewrites
// line endings for *.bat alone, so a checkout on the host is byte-for-byte this
// one.
//
// `npm run stamp` prints the expected value. Same value in the log means the
// running container is this code; different means it is not, with nothing left
// to argue about.

const ROOT = path.join(__dirname, '..');

// Everything that can differ between two deploys of this repository: the app
// itself, what it is built from, and how the host is told to run it. Not docs
// or the licence - a stamp that moves when a paragraph is reworded would make
// people stop trusting it. Not node_modules either: the lockfile already
// determines it, and hashing 40M at every boot to learn nothing is a poor trade.
const SOURCES = ['src', 'public', 'scripts', 'server.js', 'package.json', 'package-lock.json', 'liara.json'];

function filesUnder(target, found = []) {
  // Missing entries are skipped rather than fatal: a checkout without one of
  // these is still worth stamping, and degrading the whole value to 'unknown'
  // would throw away the answer over a file nobody asked about.
  if (!fs.existsSync(target)) return found;

  const stat = fs.statSync(target);
  if (!stat.isDirectory()) {
    found.push(target);
    return found;
  }
  // Sorted, so the hash depends on the contents and not on the order a
  // filesystem happens to hand back its entries.
  const entries = fs.readdirSync(target).sort();
  for (const entry of entries) filesUnder(path.join(target, entry), found);
  return found;
}

// 'unknown' rather than a throw. This value exists to help explain a failure,
// and a diagnostic that fails while explaining one is worse than no diagnostic
// at all - the same rule the boot preflight in db.js follows.
function fingerprint() {
  try {
    const hash = createHash('sha256');
    for (const source of SOURCES) {
      for (const file of filesUnder(path.join(ROOT, source))) {
        hash.update(path.relative(ROOT, file).split(path.sep).join('/'));
        hash.update(fs.readFileSync(file));
      }
    }
    return hash.digest('hex').slice(0, 8);
  } catch {
    return 'unknown';
  }
}

const STAMP = fingerprint();

module.exports = { STAMP, SOURCES, fingerprint };
