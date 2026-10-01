'use strict';

// Why this file exists at all: the manifest has been promising
// `display: standalone` for weeks, but Chrome will not offer "add to home
// screen" unless a service worker with a fetch handler is registered. The app
// was describing itself as installable and could not be installed.
//
// Deliberately small. A service worker is the one piece of this app that
// outlives a deploy inside somebody's browser, so a mistake here is a mistake
// that cannot be fixed by pushing again.

// Replaced when this file is served - see the /sw.js route in server.js. The
// value is the build stamp, so every deploy names a new cache and the old one
// is deleted on activate. No version number for anyone to forget to bump.
const CACHE = 'buddy-__BUILD_STAMP__';

// Cache-first is safe only for things that cannot change without the stamp
// changing with them, which is everything the build ships.
const STATIC = /^\/(brand|vendor|legal)\/|\.(css|js|svg|png|webmanifest|woff2?)$/;

self.addEventListener('install', (event) => {
  // No precache list. Listing files here means a deploy that renames one
  // fails to install the worker at all, and an app that will not start
  // offline is better than an app that will not start.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never. Replies, settings, photographs, the progress figures - all of it
  // is per-person and some of it changes on every request. A cached API
  // response is the bug where somebody sees yesterday's streak, or worse,
  // somebody else's.
  if (url.pathname.startsWith('/api/')) return;

  if (STATIC.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Everything else - the pages - network first.
  //
  // The other way round is the classic way to break an app like this: a
  // cached shell from last month talking to an API that has moved on, and
  // nobody can work out why nothing loads. The cache here is only a fallback
  // for being offline.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(async () => (await caches.match(request)) || caches.match('/app'))
  );
});
