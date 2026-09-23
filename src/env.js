'use strict';

// One stray character cost this project a day.
//
// DB_PATH in the host's panel held a leading tab: "\t/app/data/buddy.db". A tab
// is invisible in a text field, in a panel, and in a log - but it stops a path
// being absolute, so Node measured it from the working directory and the app
// spent a minute waiting for /app/<tab>/app/data to appear. It never could. The
// disk was mounted the whole time, three deploys were spent looking at it, and
// the failure block pointed confidently at the wrong thing.
//
// Values reach this app by being typed or pasted into a web form, and a paste
// carries whatever came with it. Nothing this app reads from the environment
// has meaningful whitespace at either end, so take it off before anything gets
// a chance to read it.
//
// Every variable, not a list of the ones this app knows about: a list is one
// more thing to forget the next time a variable is added, and it would not have
// covered DB_PATH any better than trimming everything does.
//
// Corrected loudly, never silently. This follows what AI_BASE_URL already does
// in services/ai.js with a doubled scheme: work around it so the site runs, and
// say plainly that the variable is wrong so somebody fixes it at the source.
// A value that has been mistyped once will be mistyped again on the next one.

const NAMED = {
  '\t': 'a tab',
  '\n': 'a newline',
  '\r': 'a carriage return',
  ' ': 'a space',
};

function edge(character) {
  return NAMED[character] || 'whitespace';
}

// Named rather than counted. "a tab at the start" tells somebody staring at a
// panel field what to look for; "1 leading whitespace character" does not.
function describeEdges(value) {
  if (!value.trim()) return 'nothing but whitespace';

  const lead = /^\s/.test(value) ? edge(value[0]) : null;
  const trail = /\s$/.test(value) ? edge(value[value.length - 1]) : null;

  if (lead && trail) return `${lead} at the start and ${trail} at the end`;
  return lead ? `${lead} at the start` : `${trail} at the end`;
}

// Mutates, because the whole point is that every later reader of process.env -
// including modules that read it at require time - sees the tidy value without
// having to know this module exists.
function tidy(env) {
  const fixed = [];
  for (const name of Object.keys(env)) {
    const value = env[name];
    if (typeof value !== 'string' || value === value.trim()) continue;
    env[name] = value.trim();
    fixed.push({ name, had: describeEdges(value) });
  }
  return fixed;
}

const TIDIED = tidy(process.env);

for (const { name, had } of TIDIED) {
  // The name and the shape of the problem, never the value: boot logs get
  // pasted into chats and issues, and some of these variables are keys.
  console.warn(`Note: ${name} had ${had}. Using the trimmed value - fix the variable at its source.`);
}

module.exports = { TIDIED, tidy, describeEdges };
