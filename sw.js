// sw.js — service worker for offline app-shell caching (Phase 3, v2.6)
// Plain script, no modules/bundler — matches the rest of the app.
//
// Bump CACHE_VERSION on any deploy that changes a cached file (styles.css,
// app.js, pathfinder.js, icons, images, etc.) so returning visitors pick up
// the new version instead of continuing to serve the old cached one.
const CACHE_VERSION = 'v2.10.4'; // Fix: install handler's cache.addAll(SHELL_ASSETS) could populate a brand-new SHELL_CACHE with STALE files pulled from the browser's ordinary HTTP cache (v2.10.3's Learn tab changes didn't show up despite a correct new cache name). Now fetches each shell asset with {cache:'reload'} to force a real network hit. This bump exists specifically to force one more fresh install past the bad v2.10.3 cache.
const SHELL_CACHE = `savethehives-shell-${CACHE_VERSION}`;
const TILE_CACHE = `savethehives-tiles-${CACHE_VERSION}`;
const TILE_CACHE_MAX_ENTRIES = 200;

// Same-origin app shell — precached on install so the app works offline
// after the first visit. All same-origin, so a single cache.addAll() is
// reliable (no risk of one flaky cross-origin request failing the whole
// install).
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/pathfinder.js',
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
