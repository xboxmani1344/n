'use strict';

const { GoogleGenAI } = require('@google/genai');

// gemini-3.6-flash is the current general-purpose stable model. Override with
// MODEL_ID if you want a different one (e.g. gemini-flash-latest to track the
// newest release automatically).
const MODEL_ID = process.env.MODEL_ID || 'gemini-3.6-flash';

// Gemini 3.x models "think" before answering, and those thinking tokens are
// billed against maxOutputTokens. Setting this to MINIMAL roughly halves reply
// latency; the default (unset) leaves the model's own reasoning in place, which
// matters most in the Practice phase where the tutor grades answers.
// Valid values: MINIMAL, LOW, MEDIUM, HIGH.
const THINKING_LEVEL = process.env.THINKING_LEVEL;

// Note: gemini-3.x rejects thinkingConfig.thinkingBudget (400 INVALID_ARGUMENT).
// thinkingLevel is the supported knob — don't swap one for the other.
const DEFAULT_MAX_TOKENS = 4096;

// Built on demand rather than at import time, so a key saved through the setup
// screen takes effect immediately instead of needing a server restart.
let cachedClient = null;
let cachedKey = null;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (apiKey !== cachedKey) {
    cachedClient = new GoogleGenAI({ apiKey });
    cachedKey = apiKey;
  }
  return cachedClient;
}

function isConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Conversations are stored with the assistant turn labelled 'assistant';
// Gemini's Content.role only accepts 'user' or 'model'.
function toGeminiContents(messages) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

function fail(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// The SDK stringifies the whole API error envelope into err.message — a wall of
// JSON with quota IDs and internal URLs. That ends up rendered verbatim in a
// chat bubble, so unpack it into something a person can act on.
function parseApiError(err) {
  try {
    const body = JSON.parse(err.message).error;
    if (body && typeof body.message === 'string') return body;
  } catch {
    // Not a JSON envelope — nothing to unpack.
  }
  return null;
}

function retryAfterSeconds(body) {
  for (const d of (body && body.details) || []) {
    const delay = d.retryDelay || (d.retryInfo && d.retryInfo.retryDelay);
    if (typeof delay === 'string') {
      const seconds = Math.ceil(parseFloat(delay));
      if (Number.isFinite(seconds) && seconds > 0) return seconds;
    }
  }
  return null;
}

function translateApiError(err) {
  const body = parseApiError(err);
  const status = err.status || (body && body.code);

  if (status === 429) {
    const seconds = retryAfterSeconds(body);
    const wait = seconds ? `about ${seconds} seconds` : 'a minute';
    return fail(
      `Gemini's free tier only allows a few requests per minute. Wait ${wait} and send it again.`,
      429
    );
  }

  // A bad key comes back as 400 INVALID_ARGUMENT, not 401, so match on the
  // reason as well as the status — this is the likeliest setup mistake and
  // deserves a message that points at the fix.
  const badKey =
    status === 401 ||
    status === 403 ||
    (body && (body.details || []).some((d) => d.reason === 'API_KEY_INVALID')) ||
    (body && /API key not valid|API_KEY_INVALID/i.test(body.message));

  if (badKey) {
    return fail(
      'Your Gemini API key was rejected. Check GEMINI_API_KEY in your .env file, or create a new key at https://aistudio.google.com/apikey.',
      502
    );
  }

  if (status === 503) {
    return fail('The AI service is busy right now. Please try again in a moment.', 503);
  }

  // Anything else: Google's own message is usually plain English ("This model
  // is no longer available to new users", "Request contains an invalid
  // argument"), so pass that along rather than the surrounding JSON.
  if (body) return fail(body.message, status >= 400 && status < 600 ? status : 502);

  // No envelope at all usually means the request never reached Google.
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(err.message || '')) {
    return fail("Couldn't reach Google's servers. Check your internet connection and try again.", 502);
  }

  return err;
}

async function complete({ system, messages, maxTokens = DEFAULT_MAX_TOKENS }) {
  const client = getClient();
  if (!client) {
    throw fail(
      'Server is missing GEMINI_API_KEY. Get a free key at https://aistudio.google.com/apikey, add it to .env, and restart the server.',
      503
    );
  }

  let response;
  try {
    response = await client.models.generateContent({
      model: MODEL_ID,
      contents: toGeminiContents(messages),
      config: {
        systemInstruction: system,
        maxOutputTokens: maxTokens,
        ...(THINKING_LEVEL ? { thinkingConfig: { thinkingLevel: THINKING_LEVEL } } : {}),
      },
    });
  } catch (err) {
    throw translateApiError(err);
  }

  // Thinking tokens come out of the same budget as the visible reply, so a
  // ceiling that looks generous can still cut the answer off mid-sentence. The
  // caller writes this straight into the messages table, so a partial reply
  // would become permanent history — fail loudly instead.
  if (response.candidates && response.candidates[0] && response.candidates[0].finishReason === 'MAX_TOKENS') {
    throw fail(
      'The AI ran out of room before finishing its answer. Please try again, or ask for something shorter.',
      502
    );
  }

  // `.text` is undefined when the model returns no text part — e.g. the
  // response was blocked by a safety filter, or the free-tier quota ran out
  // mid-flight. Surface that rather than storing an empty reply.
  const text = response.text;
  if (!text) {
    throw fail(
      'The AI returned an empty response. It may have been blocked or you may have hit your daily free-tier limit. Please try again.',
      502
    );
  }

  return text.trim();
}

module.exports = { complete, isConfigured, MODEL_ID };
