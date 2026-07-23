// sw.js — service worker for offline app-shell caching (Phase 3, v2.6)
// Plain script, no modules/bundler — matches the rest of the app.
//
// Bump CACHE_VERSION on any deploy that changes a cached file (styles.css,
// app.js, pathfinder.js, icons, images, etc.) so returning visitors pick up
// the new version instead of continuing to serve the old cached one.
const CACHE_VERSION = 'v2.10.1'; // Fix: shared hive links flew to the right pin and opened its popup, but two other first-load behaviors could then silently override it — the geolocate-on-load call (permission prompt can resolve seconds later, recentering the map to the visitor's own location) and the first-visit on-ramp overlay (buries the popup). Both now skip themselves when ?hive=<id> is present.
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
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS))
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
