'use strict';

// The coach proposing work, and the planner receiving it.
//
// These were two halves of an app that had never been introduced. Asking for a
// study plan produced a list in a chat, and the list stayed there - while two
// centimetres away sat a planner with due dates, a streak counting the days
// something got finished, and a morning email reading from both. The plan and
// the place to act on it were in the same app and could not reach each other.
//
// The format and the parser live in one file on purpose. They are the two
// halves of one agreement, and the way that agreement breaks is somebody
// editing the wording of the instruction without noticing what reads it.

// Why a fenced block and not tool calling: tool calling depends on the
// provider supporting it, and src/services/ai.js is deliberately neutral about
// which provider is behind it - that neutrality has already survived two
// changes of model. A fenced code block with a language tag is the single most
// reliable thing a language model emits.
const FENCE_TAG = 'buddy-tasks';

const INSTRUCTION = `

PROPOSING TASKS - you can put work straight into this person's planner.

When they ask for a plan, a schedule, or what to do next, end your reply with a
block in exactly this form:

\`\`\`${FENCE_TAG}
Read chapter 3 | 2026-10-05
Practice past papers
\`\`\`

One task per line. A due date after a pipe is optional and must be written
YYYY-MM-DD. Nothing else goes inside the block - no numbering, no commentary.

Write the tasks in the same language as the rest of your reply, and keep each
one short enough to read at a glance in a list.

Only when a plan is actually what they asked for. A block on every reply turns
a planner into a junk drawer. Say what you have to say in the reply as usual -
the block is in addition to it, not instead of it.`;

// A planner is useful because it is short. Twelve is already more than anyone
// does in a day, and this is the ceiling on what one reply can suggest, not a
// target.
const MAX_TASKS = 12;
const MAX_TITLE = 200;

// Global and multiline so every block goes, not just the first - a model that
// emits two of them must not leave one of them showing as raw markup.
const BLOCK = new RegExp(`\`\`\`[ \\t]*${FENCE_TAG}[ \\t]*\\r?\\n([\\s\\S]*?)\`\`\``, 'g');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Same standard the profile's exam date is held to in src/routes/settings.js:
// a string that looks like a date but is not one would reach tasks.due_at and
// be tripped over much later by the digest, a long way from here.
function cleanDate(value) {
  if (!value || !ISO_DATE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : value;
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Models like to number things even when told not to, and a task called
  // "3. Read chapter 3" is worse than one called "Read chapter 3".
  const withoutBullet = trimmed.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '');

  const pipe = withoutBullet.indexOf('|');
  const title = (pipe === -1 ? withoutBullet : withoutBullet.slice(0, pipe)).trim().slice(0, MAX_TITLE);
  if (!title) return null;

  return { title, dueAt: pipe === -1 ? null : cleanDate(withoutBullet.slice(pipe + 1).trim()) };
}

// Returns the reply with every block removed, and the tasks that were in them.
//
// Removing it from the text is not cosmetic. The block is an instruction to
// this app, not something to show somebody - left in, the reader sees raw
// markup, and it would also be stored in the message and fed back into the
// next prompt as though the model had already said it.
function parse(reply) {
  if (typeof reply !== 'string' || !reply.includes(FENCE_TAG)) {
    return { text: reply, tasks: [] };
  }

  const tasks = [];
  const text = reply
    .replace(BLOCK, (_match, body) => {
      for (const line of body.split('\n')) {
        if (tasks.length >= MAX_TASKS) break;
        const task = parseLine(line);
        if (task) tasks.push(task);
      }
      return '';
    })
    // Cutting a block out of the middle leaves the blank lines that framed it.
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text, tasks };
}

module.exports = { FENCE_TAG, INSTRUCTION, MAX_TASKS, MAX_TITLE, parse };
