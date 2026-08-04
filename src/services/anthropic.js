'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const MODEL_ID = process.env.MODEL_ID || 'claude-sonnet-5';
const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

function isConfigured() {
  return Boolean(client);
}

async function complete({ system, messages, maxTokens = 1024 }) {
  if (!client) {
    const err = new Error(
      'Server is missing ANTHROPIC_API_KEY. Copy .env.example to .env, add your key, and restart the server.'
    );
    err.status = 503;
    throw err;
  }

  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: maxTokens,
    system,
    messages,
  });

  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

module.exports = { complete, isConfigured, MODEL_ID };
