// sw.js — ROOT service worker "killer" script. Added 2026-07-28 (v2.11.2).
//
// This is NOT the app's real service worker. The real one lives at
// /app/sw.js and only ever controls scope /app/* — see CLAUDE.md for why
// it moved there during the v2.11 landing-page restructure.
//
// Why this file exists at all: before v2.11, sw.js lived at repo root and
// controlled scope '/' for every visitor who loaded the site. When it
// moved to /app/sw.js, root sw.js was deleted outright — but any browser
// that had ALREADY registered the old root-scoped worker kept running it
// indefinitely. A service worker only checks its own script URL for byte
// changes; with nothing left at /sw.js (a 404), there was nothing to
// compare against, so those browsers never got a signal to update or
// unregister. Symptom: returning visitors stuck seeing the pre-v2.11 page
// forever, no matter how many times they reload — confirmed live on
// 2026-07-28 (both in a Chrome testing profile and on Ronnie's phone).
//
// The fix: put a new, tiny script back at /sw.js. Any browser with the old
// registration will fetch this, see it's different, install it, and this
// script's only job is to clean up after itself — delete every cache this
// origin owns, unregister, and force any open tab to reload once so the
// visitor lands on the real page immediately instead of needing a second
// visit.
//
// This file is intentionally NOT part of the real app's precache list and
// registers no fetch handler of its own — once every pre-v2.11 visitor has
// been swept, it has no more work to do. Safe to leave in place
// permanently as a safety net; nothing re-registers it going forward since
// no page references '/sw.js' anymore (the landing page has no service
// worker of its own, by design — see CLAUDE.md).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));

      await self.registration.unregister();

      const clientsList = await self.clients.matchAll({ type: 'window' });
      for (const client of clientsList) {
        client.navigate(client.url);
      }
    })()
  );
});
