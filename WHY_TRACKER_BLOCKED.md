<!--
WHY_TRACKER_BLOCKED.md — quick reference, added Jul 29 2026.

Answers a specific question Ronnie ran into: DuckDuckGo's iOS browser
showed "1 Tracker Blocked" while visiting savethehives.org/app/. Keeping
this as a standalone doc (not buried in SAVETHEHIVES_SPEC.md) since it's
a one-off FAQ answer he wanted to be able to find again quickly, e.g. if
a visitor or reporter asks the same thing.
-->

# "1 Tracker Blocked" in DuckDuckGo — what that means

**Short answer:** SaveTheHives has no analytics, ad tracking, or tracking
pixels of its own. The badge is DuckDuckGo's browser doing its normal
job — it checks every third-party request a page makes against its own
tracker-classification list (Tracker Radar) and flags/blocks anything it
recognizes, regardless of what the site is actually for.

## What the app actually loads (checked directly, Jul 29 2026)

No analytics, no ad network, no tracking pixel anywhere in the code.
Third-party requests the app makes, and why each exists:

| Service | Domain | Purpose |
|---|---|---|
| Google Fonts | fonts.googleapis.com / fonts.gstatic.com | The "Outfit" typeface |
| Cloudflare CDN | cdnjs.cloudflare.com | Leaflet map library |
| jsDelivr CDN | cdn.jsdelivr.net | Supabase JS client library |
| Cloudflare Turnstile | challenges.cloudflare.com | Invisible CAPTCHA on sign-in |
| CARTO | basemaps.cartocdn.com | Map tile images |
| Supabase | supabase.co | The app's own database backend |

## Most likely culprit

**Google Fonts** is the most likely single request DuckDuckGo flagged.
Google is broadly categorized as a tracking company in DDG's blocklist,
and DDG is known to flag Google-owned domains fairly aggressively even
for low-risk requests like font files that carry no tracking identifiers.

**Cloudflare Turnstile** (the invisible CAPTCHA) is a secondary
possibility — anti-bot/CAPTCHA services sometimes get flagged for the
device-signal checks (screen size, timezone, etc.) they use to tell
humans from bots, which some blocklists categorize under fingerprinting.

## If someone asks

It's a third-party library doing its job — most likely the Google Fonts
request — not anything SaveTheHives itself is tracking. The site has zero
analytics or ad tracking of its own.
