// sw.js — service worker for offline app-shell caching (Phase 3, v2.6)
// Plain script, no modules/bundler — matches the rest of the app.
//
// Bump CACHE_VERSION on any deploy that changes a cached file (styles.css,
// app.js, pathfinder.js, icons, images, etc.) so returning visitors pick up
// the new version instead of continuing to serve the old cached one.
const CACHE_VERSION = 'v2.11.4'; // Bumped for a follow-up fix to the About full-view conversion: #about-view now shares #learn-view's width-cap rule (max-width:560px; margin:0 auto) so its cards stay in a narrow centered column on desktop instead of stretching edge-to-edge — it's a separate id so it didn't inherit the cap automatically when About was converted. Touches styles.css only. Previous bump (v2.11.3) was the About panel's conversion from a .modal-overlay bottom sheet to a full #about-view (same architecture as #learn-view) — fixed the persistent header and floating bottom-nav pill being dimmed/blurred behind About's old modal backdrop, and reused Learn's .lv-card component classes for the hub menu. App moved off root to /app/ — this file now lives at /app/sw.js so its default scope is /app/*, meaning it never controls the root landing page at all. SHELL_ASSETS below updated to match the new /app/ paths; shared root-level assets (styles.css, manifest.json, icons, logo.jpg) are unchanged since those files did not move.
const SHELL_CACHE = `savethehives-shell-${CACHE_VERSION}`;
const TILE_CACHE = `savethehives-tiles-${CACHE_VERSION}`;
const TILE_CACHE_MAX_ENTRIES = 200;

// Same-origin app shell — precached on install so the app works offline
// after the first visit. All same-origin, so a single cache.addAll() is
// reliable (no risk of one flaky cross-origin request failing the whole
// install).
const SHELL_ASSETS = [
  '/app/',
  '/app/index.html',
  '/styles.css',
  '/app/app.js',
  '/app/pathfinder.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.jpg',
  '/images/honeybee-on-comb.jpg',
];

// Hosts that must always go straight to the network — dynamic API calls
// and security-sensitive scripts that should never be served stale.
const NETWORK_ONLY_HOSTS = [
  'supabase.co',            // matched via endsWith below (covers the project subdomain)
  'challenges.cloudflare.com', // Turnstile
  'photon.komoot.io',        // geocoding search
  'nominatim.openstreetmap.org', // geocoding fallback
];

function isNetworkOnly(url) {
  return NETWORK_ONLY_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.' + h));
}

function isMapTile(url) {
  return url.hostname.endsWith('.basemaps.cartocdn.com');
}

self.addEventListener('install', event => {
  // Bug found 2026-07-23: cache.addAll(SHELL_ASSETS) with plain URL strings
  // fetches each one using the browser's default HTTP cache behavior — so
  // even on a genuine CACHE_VERSION bump (a real new SHELL_CACHE key),
  // addAll() could silently populate it with a *stale* app.js/index.html
  // pulled straight from the ordinary HTTP cache instead of the network,
  // if that file's Cache-Control headers hadn't expired yet. The key was
  // fresh; the bytes inside it weren't. Confirmed live: v2.10.3's Learn
  // tab still showed pre-v2.10.3 content despite Cache Storage showing
  // the correct new shell cache name. Fixed by building explicit Request
  // objects with {cache:'reload'}, which forces each precache fetch to
  // bypass HTTP cache and hit the network for real — the standard fix for
  // this well-documented Cache.addAll() gotcha.
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => Promise.all(
        SHELL_ASSETS.map(url =>
          fetch(new Request(url, { cache: 'reload' }))
            .then(res => { if (res.ok) return cache.put(url, res); })
        )
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names
          .filter(name => name !== SHELL_CACHE && name !== TILE_CACHE)
          .map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

function trimTileCache(cache) {
  cache.keys().then(keys => {
    if (keys.length > TILE_CACHE_MAX_ENTRIES) {
      cache.delete(keys[0]); // simple FIFO eviction of the oldest entry
    }
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return; // never intercept writes (checkins, hive inserts, auth, etc.)

  const url = new URL(req.url);

  // Supabase API/auth, Turnstile, geocoding: always network, never cached.
  if (isNetworkOnly(url)) return;

  // Map tiles: network-first with a small capped cache, so the map still
  // shows *something* offline without unbounded storage growth.
  if (isMapTile(url)) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            caches.open(TILE_CACHE).then(cache => {
              cache.put(req, res.clone());
              trimTileCache(cache);
            });
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Everything else (app shell + CDN libs like Leaflet/Supabase-js/fonts):
  // cache-first, falling back to network and opportunistically caching
  // the response for next time.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
