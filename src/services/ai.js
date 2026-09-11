'use strict';

// One adapter, many providers.
//
// Everything here speaks the OpenAI "chat completions" shape, which is a
// de-facto standard: OpenAI, Liara AI, OpenRouter, Ollama and Google all accept
// it. Google publishes an OpenAI-compatible endpoint alongside its native one,
// so pointing AI_BASE_URL at that keeps Gemini working while freeing the app
// from any single vendor. That matters because a server hosted inside Iran
// cannot reach Google at all, and switching providers there has to be a config
// change rather than a rewrite.
//
// Plain fetch rather than a vendor SDK: the request is a single JSON POST, and
// dropping the SDK removes ~40 MB of install and one more dependency that can
// break on a managed platform.

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';

// Trailing slashes are the classic copy-paste error when a base URL comes out
// of a dashboard, so normalise rather than producing a 404.
const BASE_URL = (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

const MODEL_ID = process.env.MODEL_ID || 'gemini-3.6-flash';

// Reasoning models spend part of the output budget thinking before they write
// anything, so a ceiling that looks generous can still cut a reply off
// mid-sentence. Keep this well above what the prompts ask for; generation stops
// when the model is done, so headroom costs nothing.
const DEFAULT_MAX_TOKENS = 4096;

const REQUEST_TIMEOUT_MS = 120000;

// GEMINI_API_KEY is still honoured so existing .env files and the Windows
// launcher keep working after the rename to the provider-neutral AI_API_KEY.
function serverApiKey() {
  return process.env.AI_API_KEY || process.env.GEMINI_API_KEY || null;
}

function isConfigured() {
  return Boolean(serverApiKey());
}

function fail(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// The conversation is stored with a separate system prompt and turns labelled
// user/assistant, which is already the OpenAI shape - no role translation
// needed, unlike Gemini's native API which calls the assistant "model".
function toChatMessages(system, messages) {
  const out = [];
  if (system) out.push({ role: 'system', content: system });
  for (const m of messages) {
    out.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
  }
  return out;
}

// Providers disagree about error shape: OpenAI returns {error:{message,code}},
// Google returns {error:{message,code,status,details}} - and Google's
// OpenAI-compatible endpoint wraps that in a single-element array. All of them
// put a human sentence at error.message, so dig it out and treat the rest as
// optional.
function parseErrorBody(raw) {
  try {
    let parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) parsed = parsed[0];
    const body = (parsed && parsed.error) || parsed;
    if (body && typeof body.message === 'string') return body;
  } catch {
    // Not JSON - an HTML error page from a proxy, most likely.
  }
  return null;
}

function retryAfterSeconds(res, body) {
  const header = res && res.headers && res.headers.get('retry-after');
  if (header) {
    const seconds = Math.ceil(parseFloat(header));
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  }
  // Google puts the delay in the error details rather than the header.
  for (const d of (body && body.details) || []) {
    const delay = d.retryDelay || (d.retryInfo && d.retryInfo.retryDelay);
    if (typeof delay === 'string') {
      const seconds = Math.ceil(parseFloat(delay));
      if (Number.isFinite(seconds) && seconds > 0) return seconds;
    }
  }
  return null;
}

// Raw provider errors are walls of JSON full of quota IDs and internal URLs,
// and whatever comes back is rendered straight into a chat bubble. Turn them
// into sentences a person can act on.
function translateHttpError(res, raw) {
  const body = parseErrorBody(raw);
  const status = res.status;

  if (status === 429) {
    const seconds = retryAfterSeconds(res, body);
    const wait = seconds ? `about ${seconds} seconds` : 'a minute';
    return fail(`The AI service is rate-limited right now. Wait ${wait} and send it again.`, 429);
  }

  // A rejected key arrives as 400 INVALID_ARGUMENT from Google but 401 from
  // most others, and the wording varies by provider and endpoint ("API key not
  // valid", "Please pass a valid API key", "Incorrect API key provided").
  // Rather than chase phrasings, treat any client error mentioning an API key
  // as a key problem - it is the likeliest setup mistake and deserves a message
  // that points at the fix.
  const mentionsKey = body && /api[ _-]?key/i.test(body.message);
  const badKey =
    status === 401 ||
    status === 403 ||
    (body && (body.details || []).some((d) => d.reason === 'API_KEY_INVALID')) ||
    (status === 400 && mentionsKey);

  if (badKey) {
    return fail(
      'The AI API key was rejected. If you set it up, check AI_API_KEY on the server; otherwise this is on the site owner, not you.',
      502
    );
  }

  if (status === 503 || status === 502 || status === 504) {
    return fail('The AI service is busy right now. Please try again in a moment.', 503);
  }

  // Providers' own wording is usually plain English ("This model is no longer
  // available to new users"), so pass it along rather than the JSON around it.
  if (body) return fail(body.message, status >= 400 && status < 600 ? status : 502);

  return fail(`The AI service returned an unexpected error (HTTP ${status}).`, 502);
}

// Node's fetch throws a bare "fetch failed" and puts the reason one level down
// in err.cause. That reason is the whole diagnosis - ENOTFOUND is a wrong
// address, ECONNREFUSED is a right address with nothing listening, a timeout is
// a host this server cannot reach - and it was being thrown away.
// Whether AI_BASE_URL is shaped like a URL this can actually post to.
//
// Checking it parses is not enough: "https:https://host/path" parses happily as
// host "https" with the rest as a path, which is exactly the doubled-scheme
// paste that started all this. The tells are a hostname with no dot in it, and
// a second scheme showing up further along as a doubled slash.
function baseUrlLooksWrong(url = BASE_URL) {
  try {
    const parsed = new URL(url);
    return (
      !/^https?:$/.test(parsed.protocol) ||
      !(parsed.hostname.includes('.') || parsed.hostname === 'localhost') ||
      parsed.pathname.includes('//')
    );
  } catch {
    return true;
  }
}

function networkCause(err) {
  const cause = err && err.cause;
  return (cause && (cause.code || cause.name)) || null;
}

// Plain English for the operator reading the log. Not shown to the person
// chatting: they cannot fix any of it, and it names internal addresses.
function explainNetworkCause(code, baseUrl) {
  let host = null;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    /* the URL itself is the problem, which the caller already reports */
  }

  switch (code) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return (
        `DNS could not find "${host || '?'}".` +
        (host && !host.includes('.') && host !== 'localhost'
          ? ` That is not a hostname - AI_BASE_URL probably has two schemes in it, like "https:https://...".`
          : ' Check AI_BASE_URL for a typo.')
      );
    case 'ECONNREFUSED':
      return `"${host}" answered and refused the connection. The address resolves but nothing is serving on that port.`;
    case 'ECONNRESET':
      return `The connection to "${host}" was cut mid-request.`;
    case 'ETIMEDOUT':
    case 'UND_ERR_CONNECT_TIMEOUT':
      return `No answer from "${host}". It is probably not reachable from where this server runs.`;
    case 'CERT_HAS_EXPIRED':
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
      return `The TLS certificate at "${host}" was rejected (${code}).`;
    default:
      return `Could not connect to "${host || baseUrl}"${code ? ` (${code})` : ''}.`;
  }
}

function translateNetworkError(err) {
  if (err.name === 'AbortError') {
    console.error(`AI request timed out after ${REQUEST_TIMEOUT_MS}ms — ${BASE_URL}`);
    return fail('The AI took too long to respond. Please try again.', 504);
  }

  const code = networkCause(err);
  if (code || /fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|certificate/i.test(err.message || '')) {
    const detail = explainNetworkCause(code, BASE_URL);
    // The log is where the person who can fix this is looking.
    console.error(`AI request could not connect: ${detail}\n  AI_BASE_URL = ${BASE_URL}`);
    const translated = fail(
      "Couldn't reach the AI service. Check the server's connection, and that AI_BASE_URL is reachable from where this is hosted.",
      502
    );
    // fail() builds a fresh Error, so the reason would be lost here. Carried on
    // the error rather than folded into the message: the message is rendered
    // into a chat bubble, and this names internal addresses.
    translated.networkDetail = detail;
    return translated;
  }
  return err;
}

// `apiKey` is the caller's key. Callers serving a signed-in user should pass
// that user's key (see services/apiKeys.js) so rate limits and usage
// attribution land on the right person. Omitting it falls back to the server's
// own key, which is what both a single-user local install and a deployment
// running on the operator's key want.
async function complete({ system, messages, maxTokens = DEFAULT_MAX_TOKENS, apiKey }) {
  const key = apiKey || serverApiKey();
  if (!key) {
    throw fail('No AI API key is configured yet.', 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  let raw;
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: toChatMessages(system, messages),
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });
    raw = await res.text();
  } catch (err) {
    throw translateNetworkError(err);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) throw translateHttpError(res, raw);

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw fail('The AI service returned a response this app could not read.', 502);
  }

  const choice = data.choices && data.choices[0];
  if (!choice) {
    throw fail('The AI returned an empty response. Please try again.', 502);
  }

  // The caller writes this straight into the messages table, so a truncated
  // reply would become permanent conversation history. Fail loudly rather than
  // storing half a sentence.
  if (choice.finish_reason === 'length') {
    throw fail(
      'The AI ran out of room before finishing its answer. Please try again, or ask for something shorter.',
      502
    );
  }

  const text = choice.message && choice.message.content;
  if (!text || !text.trim()) {
    // Empty content usually means a safety filter blocked it, or quota ran out
    // mid-flight. Either way, don't store a blank reply.
    throw fail(
      'The AI returned an empty response. It may have been blocked, or the usage limit may have been reached. Please try again.',
      502
    );
  }

  return text.trim();
}

module.exports = {
  complete,
  isConfigured,
  serverApiKey,
  baseUrlLooksWrong,
  explainNetworkCause,
  networkCause,
  MODEL_ID,
  BASE_URL,
};
