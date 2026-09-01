// functions/_middleware.js — Cloudflare Pages Function
//
// Lightweight, first-party, aggregate-only visit counter by US state and
// city (plus a country-only counter for non-US visitors). No cookies, no
// IP storage, no per-visitor record, no client-side script at all — just
// a running daily tally per location, incremented on real page loads (not
// the dozens of sub-resource requests — images, CSS, JS, map tiles — that
// a single visit also triggers).
//
// Added 2026-07-29 per Ronnie's request for a state/city breakdown of
// visitors, after finding Cloudflare's free-tier dashboard only shows
// country-level geo data. Deliberately NOT a JS analytics beacon (like
// Plausible/Umami) — this runs entirely at Cloudflare's edge, before any
// response reaches the visitor's browser, so it keeps privacy.html's
// existing "no tracking pixels" promise fully intact. See
// WHY_TRACKER_BLOCKED.md for why that distinction matters here.
//
// Migrated from Workers KV to D1 on 2026-08-31: KV's free tier caps out
// at 1,000 writes/day, which a burst of automated/scraper traffic blew
// through in a single evening (investigated in chat — not AI crawlers,
// not search engines, looked like generic bot noise from cloud-hosted
// IPs). KV's get-then-put was also non-atomic, so concurrent requests
// could silently lose an increment. D1's free tier is 100,000
// row-writes/day and a single UPSERT is atomic, fixing both problems.
// See d1_visit_counter_schema.sql for the table definition and
// SAVETHEHIVES_SPEC.md's Visit Counter section for setup steps.
//
// Requires a D1 database bound to this Pages project as `VISITS_DB`.

// Coarse User-Agent filter — skips the obvious, unsophisticated scripts
// (missing UA entirely, or a well-known HTTP client / scraper library
// signature) so they don't burn through the daily write budget. This is
// NOT a security control and won't catch a bot that spoofs a normal
// browser UA — it's just cheap noise reduction for a "how many visitors"
// stat, not a bot-blocking mechanism (Bot Fight Mode / Managed Rules
// already handle actual blocking at the edge, before this function runs).
const BOT_UA_PATTERN = /bot|crawler|spider|scrapy|curl|wget|python-requests|go-http-client|headlesschrome|phantomjs|axios\/|node-fetch|okhttp|libwww-perl|httpclient/i;

function looksLikeBot(request) {
  const ua = request.headers.get('user-agent');
  return !ua || BOT_UA_PATTERN.test(ua);
}

export async function onRequest(context) {
  const { request, next, env } = context;

  // Only count real page loads, not every sub-resource request a single
  // visit triggers. sec-fetch-dest: 'document' is set by browsers
  // specifically for top-level navigations (loading an actual page).
  const isPageLoad = request.headers.get('sec-fetch-dest') === 'document';

  if (isPageLoad && env.VISITS_DB && !looksLikeBot(request)) {
    const cf = request.cf || {};
    const country = cf.country || 'unknown';
    const day = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD' UTC

    // Fire-and-forget via waitUntil — a D1 hiccup should never slow down
    // or break the actual page response.
    if (country === 'US') {
      const state = cf.regionCode || cf.region || 'unknown';
      const city = cf.city || 'unknown';
      context.waitUntil(bumpCounter(env.VISITS_DB, 'state', state, day));
      context.waitUntil(bumpCounter(env.VISITS_DB, 'city', `${city}|${state}`, day));
    } else {
      context.waitUntil(bumpCounter(env.VISITS_DB, 'country', country, day));
    }
  }

  return next();
}

async function bumpCounter(db, scope, key, day) {
  try {
    await db
      .prepare(
        `INSERT INTO visit_counts (scope, key, day, count) VALUES (?, ?, ?, 1)
         ON CONFLICT(scope, key, day) DO UPDATE SET count = count + 1`
      )
      .bind(scope, key, day)
      .run();
  } catch (e) {
    console.error('Visit counter D1 error:', e);
  }
}
