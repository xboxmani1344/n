'use strict';

function extractYoutubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1).split('/')[0] || null;
    }
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const shortsMatch = u.pathname.match(/^\/shorts\/([^/]+)/);
      if (shortsMatch) return shortsMatch[1];
      const embedMatch = u.pathname.match(/^\/embed\/([^/]+)/);
      if (embedMatch) return embedMatch[1];
    }
  } catch (err) {
    return null;
  }
  return null;
}

async function fetchMetadata(url) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!res.ok) return {};
    const data = await res.json();
    return { title: data.title, author: data.author_name };
  } catch (err) {
    return {};
  }
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function makeError(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function fetchTranscript(videoId) {
  const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  if (!watchRes.ok) {
    throw makeError('Could not reach YouTube to fetch this video.', 'fetch_failed');
  }
  const html = await watchRes.text();

  const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
  if (!match) {
    throw makeError(
      'This video could not be read (it may be private, age-restricted, or unavailable).',
      'unavailable'
    );
  }

  let playerResponse;
  try {
    playerResponse = JSON.parse(match[1]);
  } catch (err) {
    throw makeError('This video could not be read.', 'unavailable');
  }

  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || !tracks.length) {
    throw makeError("This video doesn't have captions available.", 'no_transcript');
  }

  const track =
    tracks.find((t) => t.languageCode === 'en') ||
    tracks.find((t) => t.languageCode && t.languageCode.startsWith('en')) ||
    tracks[0];

  const trackRes = await fetch(track.baseUrl);
  if (!trackRes.ok) {
    throw makeError("This video's captions could not be downloaded.", 'no_transcript');
  }
  const xml = await trackRes.text();

  const lines = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) =>
    decodeHtmlEntities(m[1].replace(/<[^>]+>/g, '')).trim()
  );
  const transcript = lines.filter(Boolean).join(' ');

  if (!transcript) {
    throw makeError("This video doesn't have usable captions.", 'no_transcript');
  }

  return { transcript, languageCode: track.languageCode || null };
}

module.exports = { extractYoutubeId, fetchMetadata, fetchTranscript };
