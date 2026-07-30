// functions/_middleware.js — Cloudflare Pages Function
//
// Lightweight, first-party, aggregate-only visit counter by US state and
// city (plus a country-only counter for non-US visitors). No cookies, no
// IP storage, no per-visitor record, no client-side script at all — just
// a running tally per location, incremented on real page loads (not the
// dozens of sub-resource requests — images, CSS, JS, map tiles — that a
// single visit also triggers).
//
// Added 2026-07-29 per Ronnie's request for a state/city breakdown of
// visitors, after finding Cloudflare's free-tier dashboard only shows
// country-level geo data. Deliberately NOT a JS analytics beacon (like
// Plausible/Umami) — this runs entirely at Cloudflare's edge, before any
// response reaches the visitor's browser, so it keeps privacy.html's
// existing "no tracking pixels" promise fully intact. See
// WHY_TRACKER_BLOCKED.md for why that distinction matters here.
//
// Requires a KV namespace bound to this Pages project as `VISITS` — see
// SAVETHEHIVES_SPEC.md for the one-time dashboard setup steps.

export async function onRequest(context) {
  const { request, next, env } = context;

  // Only count real page loads, not every sub-resource request a single
  // visit triggers. sec-fetch-dest: 'document' is set by browsers
  // specifically for top-level navigations (loading an actual page).
  const isPageLoad = request.headers.get('sec-fetch-dest') === 'document';

  if (isPageLoad && env.VISITS) {
    const cf = request.cf || {};
    const country = cf.country || 'unknown';

    // Fire-and-forget via waitUntil — a KV hiccup should never slow down
    // or break the actual page response.
    if (country === 'US') {
      const state = cf.regionCode || cf.region || 'unknown';
      const city = cf.city || 'unknown';
      context.waitUntil(bumpCounter(env.VISITS, `state:${state}`));
      context.waitUntil(bumpCounter(env.VISITS, `city:${city}|${state}`));
    } else {
      context.waitUntil(bumpCounter(env.VISITS, `country:${country}`));
    }
  }

  return next();
}

async function bumpCounter(kv, key) {
  try {
    const current = parseInt((await kv.get(key)) || '0', 10);
    await kv.put(key, String(current + 1));
  } catch (e) {
    console.error('Visit counter KV error:', e);
  }
}
