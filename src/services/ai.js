'use strict';

const { GoogleGenAI } = require('@google/genai');

// gemini-3.6-flash is the current general-purpose stable model. Override with
// MODEL_ID if you want a different one (e.g. gemini-flash-latest to track the
// newest release automatically, or gemini-2.5-flash-lite for higher free-tier
// request limits).
const MODEL_ID = process.env.MODEL_ID || 'gemini-3.6-flash';

const apiKey = process.env.GEMINI_API_KEY;
const client = apiKey ? new GoogleGenAI({ apiKey }) : null;

function isConfigured() {
  return Boolean(client);
}

// Conversations are stored with the assistant turn labelled 'assistant';
// Gemini's Content.role only accepts 'user' or 'model'.
function toGeminiContents(messages) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

async function complete({ system, messages, maxTokens = 1024 }) {
  if (!client) {
    const err = new Error(
      'Server is missing GEMINI_API_KEY. Get a free key at https://aistudio.google.com/apikey, add it to .env, and restart the server.'
    );
    err.status = 503;
    throw err;
  }

  const response = await client.models.generateContent({
    model: MODEL_ID,
    contents: toGeminiContents(messages),
    config: {
      systemInstruction: system,
      maxOutputTokens: maxTokens,
    },
  });

  // `.text` is undefined when the model returns no text part — e.g. the
  // response was blocked by a safety filter, or the free-tier quota ran out
  // mid-flight. Surface that rather than storing an empty reply.
  const text = response.text;
  if (!text) {
    const err = new Error(
      'The AI returned an empty response. It may have been blocked or you may have hit your daily free-tier limit. Please try again.'
    );
    err.status = 502;
    throw err;
  }

  return text.trim();
}

module.exports = { complete, isConfigured, MODEL_ID };
