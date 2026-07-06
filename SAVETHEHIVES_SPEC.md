# SaveTheHives — Project Specification & Status Document

**Author:** Ronnie Bouchon  
**Document Version:** v2.6  
**Last Updated:** July 2026  
**Live URL:** https://savethehives.org  
**Purpose:** Living reference for the SaveTheHives PWA — feature set, design system, tech stack, and roadmap.

> **How to keep this current:** Ask Claude to "update the spec doc" at any milestone and a fresh version will be generated.

---

## 1. Project Overview

SaveTheHives is a citizen science Progressive Web App for mapping feral honeybee colonies worldwide. It serves field researchers, beekeepers, Scout troops, and the general public — allowing anyone to log, find, photograph, and study wild hive locations.

The core scientific purpose is tracking **colony resilience**: feral hives that survive 3+ winters without treatment are genetic goldmines for Varroa-resistance research.

**1,162 legacy hive records** from 2008–2017 are live in the app, seeded from a MySQL archive into Supabase.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| App shell | Few-files HTML PWA (as of v2.6) | No build step, no bundler; `index.html` + `styles.css` + `app.js` + `pathfinder.js` + `sw.js`, plain `<script>`/`<link>` tags |
| Map engine | Leaflet 1.9.4 | Handles 1,000+ markers smoothly |
| Tile layer | CartoDB Positron → Voyager (zoom-adaptive) | Muted overview below zoom 15, more street-level reference detail (buildings, road color) above it. Two-tier CARTO family only — raw OSM Standard tiles were considered but skipped in production per tile.openstreetmap.org's heavy-traffic usage policy. |
| Clustering | Leaflet.MarkerCluster 1.5.3 | Auto-clusters dense areas |
| Geocoding | photon.komoot.io (primary) | CORS-safe, worldwide, no API key |
| Geocoding fallback | Nominatim / OSM | Used if photon fails |
| Database | Supabase (PostgreSQL) | Cloud-hosted, RLS enabled |
| Auth | Supabase magic-link (OTP) | No password — email link only |
| Bot protection | Cloudflare Turnstile (Invisible) | Attached to sign-in form; secret key in Supabase Attack Protection |
| Photo storage | Supabase Storage `hive-photos` | Public read, auth upload |
| Font | Outfit (Google Fonts) | Variable weight, modern sans-serif |
| Icons | Inline SVG | No external dependency |
| Dev tunneling | ngrok | HTTPS to iPhone for local testing |

---

## 3. Design System

### Color Palette
| Token | Value | Usage |
|---|---|---|
| `--honey` | `#f5a623` | Primary accent, active states, headings |
| `--honey-dark` | `#c8821a` | Hover states |
| `--honey-light` | `#ffd166` | Highlight |
| `--bg` | `#0f0d07` | Page background |
| `--surface` | `rgba(28,26,16,0.92)` | Card/panel backgrounds |
| `--text` | `#f0e8d0` | Primary text |
| `--text-muted` | `#9a8d6a` | Secondary text, labels |

### Pin Colors by Type
| Type | Color |
|---|---|
| Live Tree | `#4caf50` (green) |
| Dead Tree | `#795548` (brown) |
| Man Made | `#2196f3` (blue) |
| Ground | `#ff9800` (orange) |

### Glassmorphism Surfaces
Applied to: header, bottom nav, modals, map popups, FABs, toasts.  
Pattern: `backdrop-filter: blur(16px)` + semi-transparent background + shadow instead of borders.

### Border Radius
- `--radius-sm` — 10px (inputs, small cards)
- `--radius-md` — 14px (cards, modals, popups)
- `--radius-lg` — 20px (bottom sheet rounded top)
- `--radius-pill` — 999px (pills, FABs, toasts)

### Bottom Sheet Pattern
Used for all user-action modals (sign-in, check-in, add hive). Slides up from bottom, dark overlay behind, blurred backdrop. Consistent `open` class toggles opacity + pointer-events.

### PWA / Mobile Standards
- **Safe area insets:** `env(safe-area-inset-top/bottom)` on header and bottom nav
- **Touch targets:** 44×44px minimum on all interactive elements
- **Viewport:** `viewport-fit=cover` for edge-to-edge on iPhone

---

## 4. Database Schema (Supabase)

### `public.hives`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| legacy_id | int | Original MySQL ID (1,162 records) |
| submitted_at | timestamptz | When logged |
| name | text | Observer name |
| latitude / longitude | float8 | Hive coords |
| hivetype | text | Live Tree / Dead Tree / Man Made / Ground |
| status | text | unverified / active / gone / uncertain |
| photo_url | text | Supabase Storage public URL |
| last_verified_at | timestamptz | Updated on each check-in |
| user_added | bool | false = legacy record |
| submitted_by | uuid | FK to auth.users (nullable) |

### `public.checkins`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| hive_id | uuid | FK to hives |
| user_id | uuid | FK to auth.users (nullable) |
| status | text | active / gone / uncertain |
| photo_url | text | Optional photo |
| notes | text | Observer notes |
| created_at | timestamptz | Auto |

### RLS Policies (hardened v2.4)
- `hives`: public SELECT; INSERT and UPDATE require `auth.uid() IS NOT NULL`
- `checkins`: public SELECT; INSERT requires `auth.uid() IS NOT NULL`
- `submitted_by` field on hive insert set to `currentUser.id` (was null)

---

## 5. Feature Set

### Phase 1 — Core Map ✅ Complete
| Feature | Status |
|---|---|
| PWA shell (installable) | ✅ |
| Interactive map + clustering | ✅ |
| 1,162 legacy hive records | ✅ Seeded from SQL into Supabase |
| Color-coded pin markers by type | ✅ |
| Filter pills by type | ✅ |
| 3-mile mating radius overlay | ✅ Global toggle + per-pin |
| Geographic search | ✅ Worldwide, city/landmark/address |
| Notes/keyword full-text search | ✅ |
| Map crosshair + live coordinates | ✅ Auto-fills Add Hive coords |
| Add Hive form | ✅ Crosshair/GPS → type → details → photo |
| About panel + legend | ✅ |

### Phase 2 — Supabase Backend ✅ Complete (v2.0)
| Feature | Status |
|---|---|
| Supabase database | ✅ All 1,162 hives migrated |
| Magic-link authentication | ✅ Bottom-sheet sign-in modal |
| Photo upload to Supabase Storage | ✅ Auth-gated; sign-in CTA shown to logged-out users |
| Add Hive saves to Supabase | ✅ |
| Check-in / re-verification | ✅ 3-button bottom sheet (Active / Gone / Uncertain) |
| Check-in notes | ✅ Saved to checkins table, lazy-loaded in popup |
| Hive status persists across devices | ✅ Written to hives table, read on load |
| Last verified date in popup | ✅ Friendly date format (Jun 29, 2026) |

### Phase 2.4 — Security Hardening & Privacy ✅ Complete (this release)
| Change | Status |
|---|---|
| Supabase RLS hardened — INSERT/UPDATE on hives and checkins require auth | ✅ |
| `submitted_by` now populated with `currentUser.id` on hive insert | ✅ |
| Cloudflare Turnstile (Invisible) added to sign-in form | ✅ Site key + secret key configured |
| Privacy policy created (`privacy.html`) — covers email, location, Turnstile | ✅ |
| Privacy Policy link added to About modal | ✅ |
| Search bar geocode-only (removed live keyword filter from top bar) | ✅ |
| Notes keyword filter moved into Filter drawer | ✅ |
| Filter button badge + ✕ clear button when filters active | ✅ |
| Coordinate fallback in hive popups (lat/lon shown if city unknown) | ✅ |
| "Unknown" city strings filtered from popup location display | ✅ |
| Year First Observed field added to Add Hive form | ✅ |
| Crosshair instruction text fixed (accurate + readable) | ✅ |

### Phase 2.3 — UI Redesign ✅ Complete
| Change | Status |
|---|---|
| Light mode as default (dark mode toggle stays in About) | ✅ |
| Header cleaned up — Sign In and +Hive buttons removed | ✅ Auth contextual only |
| Single smart search bar — live keyword filter on type, geocode on Go | ✅ Replaced two bars |
| Slide-up filter drawer — type filters + Mating Radius toggle; badge when active | ✅ Replaced filter pills |
| Map centers on user's GPS location on first load | ✅ Falls back to US overview if denied |
| Photo feature removed — deferred to v3 | ✅ Sign-in requirement eliminated |

### Phase 2.1 — UX Polish ✅ Complete
| Fix | Status |
|---|---|
| Sign-in uses bottom-sheet modal (was `prompt()`) | ✅ |
| Photo input hidden for logged-out users | ✅ Shows "Sign in to add a photo" CTA instead |
| GPS button label fixed ("Use My GPS Location", not "iPhone") | ✅ |
| Add Hive form: crosshair is now primary, raw coords secondary | ✅ |
| Empty-state toast when search returns 0 hives | ✅ |
| Empty-state toast when keyword search returns 0 matches | ✅ |
| Verified date: friendly format instead of raw ISO timestamp | ✅ |
| Crosshair + Mating Radius hidden when hive popup is open | ✅ |
| Crosshair + Mating Radius hidden when check-in sheet is open | ✅ |
| Pathfinder panel fully hidden (display:none, not just translated off-screen) | ✅ |
| Debug panel hidden in production | ✅ |
| Records and Pathfinder tab buttons hidden until v3 | ✅ |

### Phase 2.5 — Housekeeping & Community Feedback ✅ Complete (this release)
| Change | Status |
|---|---|
| Zoom-adaptive basemap — Positron below zoom 15, Voyager above it | ✅ |
| Coordinate display reverted to 2 decimal places (poaching-risk mitigation) | ✅ |
| PWA manifest icons added (192×192, 512×512) — installable icon was missing | ✅ |
| Hive popup clipping on narrow phones fixed (autoPanPadding, responsive max-width) | ✅ |
| Ideas & Voting feature built — `feature_ideas` / `feature_idea_votes` tables, seeded with 6 proposals, upvote/downvote UI in About modal | ✅ SQL in `ideas_and_voting.sql` — run once in Supabase SQL Editor |

### Phase 3 — Resilience & Research Layer ⬜ Planned
| Feature | Description |
|---|---|
| Survivor tagging | Hives confirmed active 3+ winters → "Genetic Goldmine" badge |
| DCA heatmap | Overlapping 3-mile radii → predicted drone congregation areas |
| Ghost/collapse reporting | Log dead hives for early warning |
| Year filter | Slider to show hives by observation year |
| Outreach campaign | Reddit, SciStarter, researcher contacts, press |

### Phase 4 — Guardian Network ⬜ Planned
| Feature | Description |
|---|---|
| Managed yard hex-masking | 1-mile hexagon obfuscation for commercial apiary privacy |
| Mite-bomb risk perimeter | Alert when feral collapse logged near managed yards |
| Guardian accounts | Commercial beekeepers register protected zones |

### Phase 5 — Pathfinder Polish ⬜ Planned — reserved for a dedicated session

**Do not touch `pathfinder.js`, `#pathfinder-panel`, `PF.*`, `smoothPosition`, `pathIntersection`, `calculateIntersection`, walk/nav tracking, compass code, or the debug panel outside of this dedicated session.** This code is intentionally isolated from the rest of the app (see Phase 2 in the Changelog).

**Critical gotcha carried over from the v2.6 bug-fix round:** `pathfinder.js` is listed in `sw.js`'s `SHELL_ASSETS` precache array. Any commit that changes `pathfinder.js` must bump `CACHE_VERSION` in `sw.js` in the *same* commit, or the fix will silently fail to reach `savethehives.org` (it'll work fine on `savethehives.pages.dev`, and a Cloudflare cache purge won't help — this is a client-side Service Worker cache, a completely different layer). See the `CACHE_VERSION` entry under Known Gotchas above for the full recovery steps if this is missed. Current value going into this phase: `v2.6.5`.

**Planned technical work, in attack order** (do each step, field-test, then move to the next — don't batch them):

1. **Anchor points A/B** — add `enableHighAccuracy: true` plus a stationary averaging window with accuracy gating, so the two reference points used for triangulation are captured from a stable, high-confidence GPS fix rather than a single noisy reading.
2. **Replace `smoothPosition`'s moving average with a per-axis alpha-beta/Kalman filter**, using `coords.accuracy` as the measurement noise input. The current moving-average approach (buffer=5, 8m threshold) is what caused the v1.7/v1.8 "path curves when it shouldn't" problem — it lags behind real position changes. A proper filter should track sharper turns without the lag.
3. **Field test** after steps 1-2 before touching anything else — confirm the anchor + filter combination actually behaves better on a real walk before adding more complexity on top.
4. **Propagate circular standard deviation of bee-flight bearings into `confidenceRadius`**, replacing the current fixed 10° assumption, so the displayed confidence zone reflects actual bearing spread rather than a constant.
5. **Douglas-Peucker simplification for the displayed path**, replacing the current fixed 8m move-threshold approach, for cleaner on-map path rendering.
6. **"Search the zone" navigation UX** inside the confidence circle — lowest priority, only worth doing once the above is solid.

**Constraint for all Pathfinder code written in this phase:** it must remain Sonnet-serviceable afterward (Fable's access ends shortly after this phase, per the original reason this work was split out) — use named tuning constants (not magic numbers), heavy inline comments explaining *why* a constant has its value, and maintain a short TUNING guide (comment block or separate doc) listing each constant, what it controls, and what symptom to look for when adjusting it.

| Feature | Description | Priority |
|---|---|---|
| Anchor point capture (step 1) | `enableHighAccuracy` + stationary averaging + accuracy gating | 1st |
| Alpha-beta/Kalman filter (step 2) | Replaces moving-average `smoothPosition`, fixes v1.7/v1.8 lag-induced path curving | 1st |
| Field test | Validate 1+2 on a real walk before continuing | 2nd |
| Confidence radius from bearing std-dev (step 4) | Replaces fixed 10° assumption | 3rd |
| Douglas-Peucker path simplification (step 5) | Replaces fixed 8m move threshold | 4th |
| "Search the zone" nav UX (step 6) | Lowest priority | 5th |
| Debug panel re-enable | Restore 🐞 button for field testing sessions | as needed |

---

## 6. Changelog

| Version | Date | Summary |
|---|---|---|
| v0.1–v0.9 | 2024–early 2026 | Core map, Leaflet, legacy data, design system, search, filters |
| v1.0 | 2026 | Pathfinder beelining tool — compass, triangulation, navigation |
| v1.7–v1.8 | 2026 | GPS path smoothing (5-position avg, 8m threshold), debug panel improvements |
| v2.0 | Jun 2026 | **Supabase backend** — 1,162 hives migrated, magic-link auth, photo storage, check-in system with 3-button modal, cross-device persistence |
| v2.1 | Jun 2026 | **UX Polish** — sign-in bottom sheet, photo gate for logged-out users, GPS label fix, form hierarchy, empty states, date formatting, map overlay conflicts fixed, hidden features properly disabled |
| v2.2 | Jun 2026 | **Production launch** — deployed to savethehives.org via Cloudflare Pages; Resend SMTP configured for magic-link email from noreply@savethehives.org; end-to-end sign-in verified on iPhone and Mac |
| v2.3 | Jun 2026 | **UI Redesign** — light mode default; header decluttered; single smart search bar (geocode + live keyword filter); slide-up filter drawer; map auto-centers on user location; photos deferred to v3 (removes sign-in requirement) |
| v2.4 | Jun 2026 | **Security & Privacy** — Supabase RLS hardened (auth required for INSERT/UPDATE); Cloudflare Turnstile invisible CAPTCHA on sign-in; `submitted_by` tied to auth UID; privacy policy (`privacy.html`) published covering email, location, Turnstile; search/filter architecture split (top bar = geocode only; drawer = type + notes keyword + radius) |
| v2.4 | Jun 30 2026 | **Deployed to production** at savethehives.org — v2.4 is the live version. Includes all security hardening, privacy policy, About modal expanded (How to Contribute, Data & Research, contact), coordinates always visible in popups, light/dark mode fixed throughout all modals and bars, `hello@savethehives.org` email routing active. |
| v2.5 | Jul 2 2026 | **Housekeeping & community feedback** — zoom-adaptive basemap (Positron → Voyager), coordinate display reverted to 2 decimals for poaching-risk mitigation, PWA manifest icons added, popup clipping fixed on narrow phones, Ideas & Voting feature built (see `ideas_and_voting.sql`). |
| v2.6 | Jul 5-6 2026 | **Infrastructure & PWA batch.** Phase 0: repo connected to GitHub (`Game-warden/SaveTheHives`), Cloudflare Pages switched from manual zip upload to automatic Git-based deploys on push to `main`; `savethehives.html` retired, `index.html` is the single canonical source. Phase 1: fixed the placeholder-manifest override bug that silently broke PWA installability; de-duplicated ~220KB of embedded base64 images into `logo.jpg` and `images/honeybee-on-comb.jpg`. Phase 2: split the former single-file `index.html` into `styles.css`, `app.js`, and `pathfinder.js` (plain scripts, no bundler, no ES modules — inline `onclick` handlers still need global scope). Phase 3: added `updated_at` tracking + delta sync (hives cache in IndexedDB, only rows changed since last visit are re-fetched, first-ever load still does the full paginated fetch); replaced the two-step check-in insert+update with an atomic `submit_checkin()` Postgres RPC (also fixed check-ins always logging `user_id = null`); added a service worker (`sw.js`) for offline app-shell caching (cache-first for app shell/CDN libs, network-first capped cache for map tiles, network-only for Supabase/Turnstile/geocoding). Tags: `v2.6-a` (Phase 1 checkpoint), `v2.6-b` (Phase 2 checkpoint), `v2.6` (full release). |
| v2.6 bug-fix + UX round | Jul 6 2026 | **Five backlog bugs fixed, About panel reorganized, housekeeping closed out.** (1) Missing `hives.year` column — added via `add_year_column.sql`, backfilled from `submitted_at`. (2) Zip/postal search resolving to the wrong country — `doSmartSearch()` now declines bare-numeric queries with a toast pointing to city/landmark search instead of silently geocoding worldwide. (3) Unreadable light-mode status messages — `#toast` background was hardcoded to a near-black value instead of `var(--surface)`; fixed to follow the theme. (4) Ideas & Voting 404 — root cause was `ideas_and_voting.sql` never having been run in Supabase (not a missing-apikey code bug as originally suspected); running it once fixed it. (5) Intermittent sign-in double `#access_token` redirect — `submitSignIn()`'s `emailRedirectTo: window.location.href` could capture a stale token hash still sitting in the address bar; fixed by stripping the hash via `history.replaceState()` once `SIGNED_IN` fires. **About panel reorganized:** sign-in status/button and dark mode toggle promoted to the top (previously buried near the bottom); hero photo banner removed; globe emoji in the title replaced with the app's own `logo.jpg`; platform description trimmed to one paragraph; a one-line caption added under the sign-in row explaining what it unlocks; dark mode toggle label now correctly reflects the active theme ("🌙 Dark Mode" vs "☀️ Light Mode") instead of always reading "Dark Mode." **Housekeeping:** stray `fresh-start` branch deleted (redundant, already an ancestor of `main`); `pwa-deployment` branch kept intentionally (unrelated abandoned React/Vite rebuild, possibly useful later for its DCA-heatmap reference code — see Phase 3 Resilience & Research Layer below); confirmed only one Cloudflare Turnstile widget exists (no duplicate to delete); Browser Cache TTL setting ("Respect Existing Headers") made a permanent decision rather than a temporary workaround. **Also discovered and documented:** the root cause of a multi-hour "fix works on .pages.dev but not on .org" mystery was `sw.js`'s `CACHE_VERSION` not being bumped when shell files changed — see Known Gotchas above. `CACHE_VERSION` was bumped five times this round (`v2.6.0` → `v2.6.5`) as commits touched shell files; this is a separate, more granular internal counter from the app's own displayed version badge and is not meant to track 1:1 with it. |

---

## 6.5 Mapping at Scale (around 5,000 hives)

Discussed Jul 2 2026, not yet acted on — captured here so the reasoning isn't lost.

**Current setup:** Leaflet 1.9.4 + Leaflet.MarkerCluster, rendering each hive as a DOM element. This is what's handled ~1,162 legacy records smoothly, and is expected to keep working reasonably well into the low thousands.

**Where it starts to strain:** Leaflet's per-marker DOM approach is the reason MarkerCluster exists at all — clustering is a workaround to keep DOM node count down. Past roughly 5,000–10,000 points it typically needs real tuning (chunked loading, disabled clustering at zoom, etc.) to stay smooth, especially on older phones in the field.

**The alternative:** MapLibre GL JS renders point data as a GPU-accelerated WebGL layer instead of DOM nodes, with clustering powered by `supercluster` (spatially indexed, can run off the main thread). This is the same approach used by GBIF's base map tiles and iNaturalist's Mapbox GL point rendering — both established citizen-science/biodiversity platforms at far larger scale than this project. It comfortably handles tens of thousands to hundreds of thousands of points.

**Important context:** this project already tried this once. Era 2 (Feb 2026, see `archive/`) migrated the whole app to MapLibre GL JS specifically for WebGL rendering of 1,000+ markers, and even built a DCA heatmap engine on top of it. That version was abandoned in favor of the current single-file Leaflet + Supabase rebuild sometime between Feb 26 and Jun 25, 2026 — a gap with no git history and no written record of why. The commit log from that era shows a long tail of urgent-sounding stability hotfixes ("White Screen Crash," "Nuclear Tile Reset," "Bulletproof LngLat Sanitization"), suggesting chronic rendering instability, but nothing documents a specific root cause. Worth knowing before revisiting MapLibre: whatever went wrong last time either needs to be understood first, or the rebuild needs to happen carefully enough not to repeat it.

**Recommendation:** no action needed at ~1,162 hives. Revisit this once hive count approaches the low thousands and starts showing real slowdown — treat it as a deliberate migration project (bigger than a basemap swap), not a quick patch.

## 7. Known Gotchas

- **Supabase Attack Protection provider dropdown defaults to hCaptcha** — must manually switch to "Turnstile by Cloudflare" or Turnstile tokens will always be rejected with `invalid-input-response`
- **Turnstile widget domains** — `localhost` must be in the allowed hostnames list on the SaveTheHives Auth widget in Cloudflare for local testing to work
- **Toast z-index** — sign-in modal is z-index 9100; toast must be ≥ 9100 to be visible while modal is open (currently 9999)
- **Service worker (`sw.js`) precaches shell files by `CACHE_VERSION`** — any commit that changes `app.js`, `styles.css`, `pathfinder.js`, `index.html`, `manifest.json`, or any precached image MUST bump `CACHE_VERSION` in the same commit, or returning visitors keep getting the old cached file indefinitely (a Cloudflare cache purge does not fix this — it's client-side Cache Storage, a separate layer). Symptom if missed: "the fix works on savethehives.pages.dev but not on savethehives.org." Current value: `v2.6.5`. Full manual recovery steps if this happens anyway: DevTools → Application → Service Workers → Unregister, then Storage → Clear site data, close the tab, reopen fresh, hard reload.

## 9. Privacy Decisions & Rationale

| Decision | Choice | Rationale |
|---|---|---|
| Show lat/lon in hive popups | ✅ Yes | The pin is already on the public map — coordinates add no new exposure, only convenience for re-finding legacy hives with no city data |
| Coordinate precision | 2 decimal places (~1.1km) | Reverted from 4 decimals (v2.4) to reduce the chance the popup could be used to pinpoint and raid a wild hive; still enough to orient a field visit alongside the pin itself |
| Disclosure on submission | ✅ Yes | "📍 This location will be publicly visible on the SaveTheHives map" shown above Submit button |
| Email visibility | 🔒 Admins only | Never shown publicly; used only for magic-link auth |
| Coordinate fuzzing for public | ❌ Deferred | Could be added in v3 if privacy concerns arise with scale |

---

## 11. Known Issues / Backlog

- Records list (hidden) shows first 50 only — needs pagination for v3
- Mating radius with 1,000+ visible pins may be slow on low-end devices — see [Mapping at Scale](#mapping-at-scale-around-5000-hives) below
- Magic link: savethehives.org and www.savethehives.org both working; ensure both in Supabase Redirect URLs
- Photos deferred to v3 — existing `photo_url` values in DB still display in popups (read-only); upload UI removed
- `images/honeybee-on-comb.jpg` is no longer referenced anywhere in `index.html` (removed from the About panel Jul 6 2026) — still listed in `sw.js`'s precache list, harmless but could be cleaned up
- **Cloudflare Browser Cache TTL** — permanent decision made 2026-07-06: kept at "Respect Existing Headers." Not a placeholder, don't flag this as pending — see Changelog.

All five bugs previously tracked here (missing `hives.year` column, zip search resolving to the wrong country, unreadable light-mode status messages, Ideas & Voting 404, intermittent sign-in double-hash redirect) were fixed and verified cross-device on 2026-07-06 — see Changelog below for root causes and fixes. The Cloudflare Turnstile "duplicate widget" item was also checked and turned out to be stale — only one widget (`SaveTheHives Auth`) exists on the account; nothing to delete.

---

## 10. Infrastructure — How It All Works Together

SaveTheHives is a zero-server-cost stack. Four cloud services handle everything — no VPS, no backend code to maintain.

```
User's Browser / iPhone
        │
        ▼
┌─────────────────────┐
│   Cloudflare        │  DNS + CDN + Hosting
│   savethehives.org  │  (serves the HTML file)
└────────┬────────────┘
         │  loads app
         ▼
┌─────────────────────┐
│   index.html +      │  Few-files PWA (v2.6+)
│   styles.css +      │  index.html loads styles.css, then app.js,
│   app.js +          │  then pathfinder.js (in that order) — plain
│   pathfinder.js     │  <link>/<script> tags, no bundler/modules.
│   (+ sw.js for       │  sw.js is a service worker registered by
│    offline caching) │  app.js for offline app-shell caching.
└────────┬────────────┘
         │  API calls
         ▼
┌─────────────────────┐
│   Supabase          │  Database + Auth + Storage
│   (PostgreSQL)      │  hives table, checkins table,
│                     │  hive-photos bucket
└────────┬────────────┘
         │  sends email via
         ▼
┌─────────────────────┐
│   Resend            │  Transactional email
│   (SMTP)            │  Magic-link sign-in emails
└─────────────────────┘
```

---

### Cloudflare — Domain, DNS & Hosting

**What it does:** Owns the `savethehives.org` domain, manages all DNS records, and hosts the app via Cloudflare Pages (free static file hosting with global CDN).

**How the app is deployed (as of v2.6):**
1. Edit `index.html` (or `styles.css`/`app.js`/`pathfinder.js` post-Phase-2) locally
2. `git add -A && git commit -m "..." && git push`
3. Cloudflare Pages is Git-connected to `Game-warden/SaveTheHives` (production branch `main`,
   automatic deployments enabled) — the push alone triggers a new build and deploy, live within
   seconds, no manual zip upload
4. Confirm at `https://savethehives.org` (hard-refresh to bypass cache)

> The old manual zip-upload flow (`cp savethehives.html index.html` → zip → dashboard upload) is
> retired as of Phase 0 of the v2.6 rollout, but remains a documented fallback if Git integration
> ever needs to be bypassed. `privacy.html`, `manifest.json`, and icons deploy automatically as
> part of the repo — no separate zip contents to track.

**Key DNS records:**

| Name | Type | Content | Proxy |
|---|---|---|---|
| `savethehives.org` | CNAME | `savethehives.pages.dev` | 🟠 Proxied |
| `www` | CNAME | `savethehives.pages.dev` | 🟠 Proxied |
| `send` | MX | Resend mail server | ⚪ DNS only |
| `resend._domainkey` | TXT | Resend DKIM key | ⚪ DNS only |
| `_dmarc` | TXT | DMARC policy | ⚪ DNS only |
| `send` | TXT | SPF record | ⚪ DNS only |

> Mail records (MX, TXT) must be DNS-only (grey cloud) — proxying breaks email delivery.

---

### Supabase — Database, Auth & File Storage

**What it does:** Three jobs in one platform:
1. **PostgreSQL database** — stores all hive records and check-ins with Row Level Security (RLS)
2. **Magic-link authentication** — sends a one-time sign-in link to the user's email; no passwords
3. **File storage** — `hive-photos` bucket stores photos uploaded during Add Hive or check-in

**How auth works:**
1. User taps Sign In → enters email
2. App calls `db.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } })`
3. Supabase hands the email to Resend (via SMTP) to send the magic link
4. User clicks link → browser opens `savethehives.org#access_token=...`
5. Supabase JS client detects the token in the URL hash and signs the user in automatically
6. `onAuthStateChange` fires → `updateAuthUI()` updates the header and unlocks photo features

**Key configuration:**
- **Project URL:** `https://nsujmizdawyoictpawxt.supabase.co`
- **Dashboard:** supabase.com → Authentication → URL Configuration
- **Site URL:** `https://savethehives.org`
- **Redirect URLs:** `https://savethehives.org`, `https://www.savethehives.org`, `http://localhost:8080`

**RLS policies (what's public vs. protected):**
| Table | SELECT | INSERT | UPDATE |
|---|---|---|---|
| `hives` | Anyone | Signed-in only | Signed-in only |
| `checkins` | Anyone | Signed-in only | — |
| `hive-photos` bucket | Anyone (read) | Signed-in only | — |

**Attack Protection (Supabase → Authentication → Attack Protection):**
- Captcha enabled: ✅
- Captcha provider: **Turnstile by Cloudflare** (not hCaptcha — dropdown must be set correctly)
- Secret key: **not reproduced here** — stored only in Supabase dashboard (Authentication → Attack Protection). If it ever needs rotating, generate a new one in Cloudflare → Turnstile and update it there.
- Site key: `0x4AAAAAADtgqmkUZOmib37k` (public, used in app JS)
- Widget name in Cloudflare: **SaveTheHives Auth**
- Widget mode: Invisible
- Allowed hostnames: `savethehives.org`, `localhost`

---

### Resend — Transactional Email

**What it does:** Sends the magic-link sign-in emails on behalf of Supabase. Supabase free tier rate-limits emails (~3/hour); Resend bypasses this with higher limits and a proper sender address (`noreply@savethehives.org`).

**How it connects to Supabase:**
Supabase Authentication → SMTP Settings points to Resend's SMTP server. When Supabase needs to send a magic link, it hands it off to Resend instead of using its own mailer.

**SMTP credentials in Supabase** (Authentication → SMTP Settings):
| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | *(Resend API key — stored only in Supabase dashboard)* |
| Sender email | `noreply@savethehives.org` |
| Sender name | `SaveTheHives` |

**Domain verification:** Resend requires DNS records in Cloudflare to prove ownership of `savethehives.org` before it will send email from that domain. These are the MX/TXT records in the DNS table above.

**Setup steps (already done — for reference):**
1. Create account at resend.com
2. Add domain `savethehives.org` → Resend provides DNS records
3. Add those records in Cloudflare DNS (grey cloud / DNS-only)
4. Wait for "Verified" status in Resend
5. Create API key at resend.com/api-keys
6. Paste API key into Supabase SMTP settings as the password

---

### Cloudflare Turnstile — Bot Protection

**What it does:** Invisible CAPTCHA that runs silently when the sign-in modal opens. Blocks bot-driven OTP abuse on the auth endpoint without user friction.

**How it works:**
1. When sign-in modal opens, app calls `turnstile.render()` with the Site Key
2. Turnstile runs its challenge invisibly in the background
3. On success, calls back with a short-lived token
4. When user taps "Send Link", token is passed as `captchaToken` in `signInWithOtp()`
5. Supabase verifies the token with Cloudflare server-side using the Secret Key before processing the OTP request

**Configuration:**
| Setting | Value |
|---|---|
| Widget type | Invisible |
| Site Key | `0x4AAAAAADtgqmkUZOmib37k` (in app JS) |
| Secret Key | Stored in Supabase Attack Protection only |
| Cloudflare widget location | Account → Turnstile → SaveTheHives widget |

**Privacy requirement:** Cloudflare requires referencing their [Turnstile Privacy Addendum](https://www.cloudflare.com/en-gb/turnstile-privacy-policy/) in your privacy policy. ✅ Done in `privacy.html`.

---

### Local Development

- **Run server:** `cd ~/claude/SaveTheHives-pwa-claude && python3 -m http.server 8080`
- **URL:** `http://localhost:8080/index.html`
- **If port 8080 busy:** `lsof -ti :8080 | xargs kill -9` then restart
- **iPhone testing (local):** Start ngrok (`ngrok http 8080`), open the ngrok URL on iPhone, sign in from there. Add ngrok URL to Supabase Redirect URLs. Note: ngrok URL changes each session on free tier.
- **iPhone testing (production):** Just use `https://savethehives.org` — no ngrok needed.

---

### Deploying an Update (as of v2.6)

1. Edit `~/claude/SaveTheHives-pwa-claude/index.html` (or the split-out `styles.css`/`app.js`/
   `pathfinder.js` once Phase 2 lands)
2. In Terminal: `git add -A && git commit -m "..." && git push`
3. Cloudflare Pages (Git-connected to `Game-warden/SaveTheHives`, production branch `main`,
   automatic deployments enabled) builds and deploys automatically on push
4. Live in ~10-30 seconds worldwide — check the Deployments tab in the Cloudflare dashboard,
   or just hard-refresh `https://savethehives.org`

> Fallback only: the old manual zip-upload flow (edit `savethehives.html` → `cp` to `index.html`
> → zip the folder → dashboard upload) is retired now that Git integration is live, but Cloudflare
> Pages still accepts a manual "Create deployment" zip upload if the Git connection ever breaks.

---

## 12. Collaboration & Outreach Notes

- **Scout integration (proposed):** Troops as field data collectors — beelining combines biology and geometry for STEM merit badge
- **Commercial beekeeper angle:** Guardian Network = theft protection + mite-bomb research — win-win positioning
- **Media hook:** "Pokémon GO for bee conservation" — Wired, NatGeo, local news
- **Research value:** Feral bees are the untreated control group for CCD research — this app maps the baseline
- **SciStarter:** List project for citizen science discovery
