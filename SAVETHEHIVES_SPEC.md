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

### Phase 2.9 — Validate ✅ Complete (this release)
| Change | Status |
|---|---|
| Validate tab added to bottom nav, next to Add | ✅ |
| `openValidate()` geolocates the visitor and narrows the map to a 50-mile radius (straight-line approximation of "about an hour's drive") | ✅ Falls back to current map center if location is denied/unavailable/times out |
| Floating banner reports total hives in range and how many haven't been checked in 5+ years | ✅ |
| Validate never mutates `activeFilter`/`activeNotesQuery` — leaving it restores whatever filter state existed before | ✅ |
| Validate and check-in both require sign-in, matching Add's gate/resume pattern (`pendingAction`) | ✅ v2.9.1 — closed a gap where anonymous check-ins could reach the server unattributed |
| Positioned in the product as the **low-friction on-ramp**: confirming a hive that's already logged is a much smaller ask than finding and logging a new one. See `CONTENT_LIBRARY_IDEAS.md` item 15 for the plan to surface this to new visitors. | 📝 Strategy documented, UI work not yet started |

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

### Phase 5 — Pathfinder Polish 📦 ARCHIVED Jul 6 2026 (steps 1, 2, 4 + leapfrog shipped; paused at the physical accuracy limit)

> **Ronnie's decision at session close:** the tool reached its honest physical accuracy floor (~±20m) and further automation was adding complexity faster than usability. Work is parked, NOT abandoned — the feature is safe in production (hidden behind `?pf=1`). **The complete handoff for resuming this work is `PATHFINDER_HANDOFF.md` in the repo root** — architecture map, field test log (including the unverified "Africa bug" fix in v2.6.11), physics analysis, known bugs, and the resume-priority backlog. Next intended Pathfinder-adjacent work is *educational*: a "theory of beelining" section with diagrams — see the handoff doc §7.

The section below is the state as of archiving:

**Do not touch Pathfinder code (`pathfinder.js`, `#pathfinder-panel`, `PF.*`, walk/nav tracking, compass code, the debug panel) outside a dedicated Pathfinder session.** This code is intentionally isolated from the rest of the app.

**Field-test access:** the Pathfinder tab and 🐞 debug button are hidden in production. Visiting `https://savethehives.org/?pf=1` unhides both for that visit only (gate function at the bottom of `pathfinder.js`). Regular visitors see nothing.

**All tuning constants live in `PF_TUNE` at the top of `pathfinder.js`**, under a TUNING guide comment block that documents, for every constant: what it controls, the symptom if set too low, and the symptom if set too high. Tune there, nowhere else. Key functions: `captureAnchorPoint()` (A/B GPS lock), `createGpsFilter()`/`gpsFilterSeed()`/`gpsFilterUpdate()` (position filter), `lockedBearingStd()`/`circularStdDevDeg()` (bearing quality), `calculateIntersection()` (triangulation + confidence radius).

**Cache rule still applies:** `pathfinder.js` is in `sw.js`'s precache — any commit touching it must bump `CACHE_VERSION` in the same commit. Current value: `v2.6.11`. Also see the "service worker two-load update" gotcha in Known Gotchas before field testing a fresh deploy.

**Shipped this session** (original steps 1, 2, 4 plus field-test-driven additions):

| Change | Notes |
|---|---|
| Anchor capture (step 1) ✅ | A/B locked from a stationary averaging window: `enableHighAccuracy`, fixes gated ≤12m accuracy, inverse-variance weighted average, 20s timeout fallback to best-N fixes. Toast reports fix count and ±effective accuracy. |
| Alpha-beta GPS filter (step 2) ✅ | Replaced `smoothPosition()` 5-fix moving average (cause of the v1.7/v1.8 lag/curving bug). Predict + correct with adaptive gain from `coords.accuracy`; velocity clamp; gap reset; seeded from the anchor at walk/nav start. |
| Honest confidence radius (step 4) ✅ | Radius from measured circular std-dev of the 3 bee bearings (÷√3, floored at 5° compass hardware floor, maxed with the OS compass-error estimate), propagated through the ray-crossing angle γ, plus each anchor's position error. Replaces the fixed-10° formula that ignored geometry and lied small on short baselines. Weak-triangulation toast >75m. |
| Arrival handover + hysteresis | Within 12m (3 consecutive fixes; 5m exit margin) navigation switches to "search this area" — inside GPS noise the bearing-to-target spins and walked testers in circles. |
| Draggable A/B anchors | Canopy multipath put anchor A ~18m from the tester's true position with a confident accuracy claim (correlated error — averaging can't remove it). Anchors drag; rays redraw; intersection + circle recompute automatically, even mid-navigation. |
| Compass health | iOS `webkitCompassAccuracy` surfaced: per-tap warning toasts when >15°, worst value folded into the point's bearing std, figure-8 calibration step added to Point A instructions. Catches systematic bias that the 3-tap spread cannot see (all taps share it). |
| Debug panel additions | Filter α/σ, last anchor quality, ray geometry (γ, εA, εB), live compass self-reported error. |

**Field test log (Jul 6 2026, three walks, suburban yard with heavy tree canopy):**

1. **Test 1:** walk path lagged and curved; distance readout lagged; needle circled the tester endlessly near the target. → Filter seeding from anchors, process noise 1.8→3.0, per-fix distance updates, arrival handover.
2. **Test 2:** 12m baseline produced a confident-looking circle; arrival fired early off one jittery fix. → Geometry-aware radius (step 4), arrival hysteresis. **Key lesson: baseline angle matters as much as length** — 12m perpendicular to the bee line ≈ ±20m at 45m range; 12m parallel ≈ ±100m. Real sites often won't allow 20m+ walks, so honesty about this is the feature.
3. **Test 3:** anchor A landed ~18m from where the tester stood (canopy multipath; reported accuracy was optimistic), skewing the intersection to half the true distance; compass bias at A also suspected (ray B clean, ray A rotated). → Draggable anchors, compass health tracking, anchor error in radius. **Not yet re-validated** — the tester's next run accidentally used the previous cached version (see two-load gotcha).

**Remaining work, in priority order:**

| Item | Notes | Priority |
|---|---|---|
| Re-validate test #3 fixes | Real walk with current code (check: Point A instructions start with the figure-8 step). Drag anchor A to true position if off; confirm corrected intersection lands on target. | 1st |
| Douglas-Peucker path simplification (step 5) | Replaces the fixed 8m move threshold for the drawn path — display-only cleanup. | 2nd |
| "Search the zone" nav UX (step 6) | Arrival handover covers the minimum; full version = search-pattern guidance inside the confidence circle. | 3rd |
| Point C refinement (new, from field tests) | Optional third bearing point to shrink the circle when baselines are short. Likely the highest-value future feature given the 20m-walk constraint. | Backlog |
| SW "update available" toast (new) | Would prevent the stale-code field-test trap. NOT Pathfinder code (`app.js`/`sw.js`) — needs its own decision. | Backlog |

**Constraint for all Pathfinder code: remain Sonnet-serviceable** — named tuning constants in `PF_TUNE` (no magic numbers), heavy inline comments explaining *why*, TUNING guide kept current with every constant added.

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
| v2.6 Pathfinder Phase 5 session | Jul 6 2026 | **Pathfinder steps 1, 2, 4 shipped + field-test-driven additions** (dedicated Fable session; four SW cache bumps `v2.6.6`→`v2.6.9`). Anchor capture via stationary accuracy-gated averaging; alpha-beta GPS filter replaces `smoothPosition` moving average (v1.7/v1.8 lag bug); geometry-aware confidence radius from measured bearing spread + ray-crossing angle + anchor error; arrival handover with hysteresis; draggable A/B anchors with live re-triangulation (canopy multipath countermeasure); iOS compass-error tracking with calibration warnings; `?pf=1` field-test gate; debug panel expanded. Three field tests logged — findings, tuning rationale, and remaining work in the Phase 5 section. All constants in `PF_TUNE` with a TUNING guide (Sonnet-serviceable). |
| v2.7–v2.8 | Jul 7-8 2026 | **Learn tab (Tier A)** — data-driven hub, module reader, and three guided "Follow the Dance" tracks built from `BEELINING_GUIDE.md` (see `LEARN_TAB_BUILD_BRIEF.md`); commissioned watercolor illustrations; per-module Sources list. **Floating UI redesign** — search bar replaced with a floating magnifying-glass FAB that expands in place; bottom nav floats as a pill over the map instead of a fixed bar; first-visit on-ramp overlay (dismissible, shown once via `localStorage`). |
| v2.9 | Jul 2026 | **Validate tab** — geolocated 50-mile radius view of existing hives with a stale-record banner (count of hives unchecked in 5+ years), positioned as a lower-barrier alternative to logging brand-new hives. |
| v2.9.1 | Jul 17 2026 | **Auth parity fix** — Validate and check-in now require sign-in before opening, using the same `pendingAction` gate/resume pattern as Add (previously neither had a client-side gate, and an anonymous check-in could reach `submit_checkin()` and be inserted with a null `user_id`). |
| v2.9.2 | Jul 20 2026 | **Live UX audit fixes**, found via an actual Chrome walkthrough (not just code review). Fixed `.hive-popup .popup-type` inheriting `var(--text)` with no override — nearly invisible in light mode against the popup's permanently-dark background, since every sibling line already had an explicit color and this one didn't. Softened the About modal's "Genetic Goldmines" line from present-tense ("are flagged as") to future framing, since survivor tagging is still Phase 3 planned, not built — also added it to the "Coming soon" line for consistency. Added Share (`shareApp()`/`shareHive()`/`doShare()` in app.js) — Web Share API with a clipboard-copy fallback — on the app itself (About modal) and per hive (popup); no URL-based hive deep-linking exists yet, so hive shares carry descriptive text but link to the app root, not that specific pin. Added a platform-aware install nudge (`updateInstallUI()`) inside the About modal — iOS Safari gets manual Share→Add-to-Home-Screen instructions since Apple never implemented `beforeinstallprompt`; browsers that do support it get a real one-tap Install button. Deliberately placed in-modal rather than as a new floating map overlay, to avoid the same class of collision bug the floating map UI has had before (search FAB vs. zoom control, safe-area-inset misses). |
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
- **Service worker (`sw.js`) precaches shell files by `CACHE_VERSION`** — any commit that changes `app.js`, `styles.css`, `pathfinder.js`, `index.html`, `manifest.json`, or any precached image MUST bump `CACHE_VERSION` in the same commit, or returning visitors keep getting the old cached file indefinitely (a Cloudflare cache purge does not fix this — it's client-side Cache Storage, a separate layer). Symptom if missed: "the fix works on savethehives.pages.dev but not on savethehives.org." Current value: `v2.6.11`. Full manual recovery steps if this happens anyway: DevTools → Application → Service Workers → Unregister, then Storage → Clear site data, close the tab, reopen fresh, hard reload.
- **Service worker two-load update behavior** — even with `CACHE_VERSION` bumped correctly (and `skipWaiting`/`clients.claim` enabled), the FIRST visit after a deploy still runs the previous version: the old SW serves the cached shell instantly while the new SW installs and precaches in the background; the SECOND load gets the new code. Symptom: "I pushed, but my phone doesn't show the new feature" (burned a Pathfinder field test on Jul 6 2026). Before field testing a fresh deploy: open the site, close the tab, reopen (or reload twice). Verification tokens beat assumptions — check for a UI string known to be new in the build under test.
- **Photon (`photon.komoot.io`) mis-geocodes bare numeric queries internationally** — the same digits can match a real place in an entirely different country with no way to disambiguate without country context. Concrete example surfaced from an earlier iteration of this project's search bar: a Raleigh, NC ZIP code (27613) resolved to a location in the Middle East. Current fix, live since the Jul 6 2026 bug-fix round: `doSmartSearch()` declines any bare-numeric query before it reaches Photon and shows a toast pointing to city/landmark search instead — this sidesteps the bug rather than fixing Photon's geocoding, so don't remove that guard without a real replacement.
- **Service workers only register in a "secure context"** — HTTPS, or the one carved-out exception: `http://localhost` (or `127.0.0.1`) on the same machine. A plain-HTTP request to a LAN IP address (e.g. testing from a phone at `http://192.168.1.x:8000` against a Mac running `python3 -m http.server`) does NOT qualify, so the service worker never registers there at all. Practical effect: **local-network phone testing never exercises the SW or its cache** — every request goes straight to the network, always fresh — while `localhost` testing on the host machine does register a SW and IS subject to the two-load gotcha above. This produced a real false-positive on Jul 8 2026: images looked broken/cropped on Mac `localhost` (stale cached CSS from an old SW) but looked fine on iPhone over LAN IP (no SW ever ran, so nothing was ever stale). Fix when this happens: DevTools → Application → Service Workers → Unregister, then Application → Clear storage → "Clear site data," then hard-reload. Takeaway: a clean result from LAN-IP phone testing does not confirm the caching/SW layer is correct — only `localhost` or the real deployed HTTPS origin exercises that code path.

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
- **Dead code: `doSearch()` in app.js** — a Nominatim-based search function referencing `zip-input`/`radius-select` DOM element IDs that no longer exist anywhere in `index.html`, left over from before the v2.3 redesign consolidated two search bars into one (`doSmartSearch()`/`smart-search-input` is the live path today). Unreachable, harmless, safe to delete whenever someone's doing cleanup — found 2026-07-20 while cross-checking geocoding history against an older project iteration.
- **Sibling project "SaveTheHives" retired (2026-07-20)** — a separate Claude Project Ronnie had (self-described as recreating "the SaveTheHives iOS app from ~10 years ago") was audited and confirmed to actually be an earlier, independent iteration of this same PWA build (its own `savethehives.html` + spec, versioned v1.6→v1.7), not a native app. Everything genuinely salvageable from it — the anti-poaching coordinate-precision rationale (already matches what's live), the Photon ZIP bug (see Known Gotchas above), confirmation the zoom-adaptive basemap idea is already shipped — has been folded in here. Project is retired; don't re-investigate it. One loose thread if it ever matters: that project's chat history contains a reference to an abandoned "macOS era" native-mapping approach (possibly MapKit-based) that predates the Leaflet/PWA direction — the source chat had already scrolled out of context when found, so it's only findable via Cmd+F for `macOS`/`MapKit`/`native app` in that specific chat, if Ronnie ever wants to chase it. Not actionable otherwise.
- **Admin user activity table (deferred, raised Jul 17 2026)** — no dedicated table today linking a user's email to the actions they've taken for admin follow-up. Emails already live only in Supabase's `auth.users` (never exposed via RLS to the app, so already admin-only), and `hives.submitted_by` / `checkins.user_id` already FK to it — but there's no single admin view joining email + action + hive + timestamp, and no place to attach follow-up notes (e.g. "emailed 7/20, no response"). Proposed: a lightweight `activity_log` table, RLS-locked to a specific admin user ID, auto-populated by `submit_checkin` and the hive-insert path, with a free-text `notes` column. Not built — todo for a future session.
- **Photo-on-check-in / data-integrity anti-fraud measures — SHELVED Jul 17 2026, see below.**

### Shelved Jul 17 2026 — Validate photo + offline queue + proximity check

**Decision:** shelved for now. Ronnie needs Validate in front of researchers next week; the current self-report check-in (no photo, no location proximity check) ships as-is. The concern that prompted this thread — someone falsely validating a hive without actually being there — is real, but the fix is a multi-part feature, not a quick add, so it's parked rather than rushed. Encouraging adoption of the existing form is judged better than nothing for the near-term goal. Revisit if false/low-quality validations actually show up in the data, or before a bigger public push on Validate (see item #15 in `CONTENT_LIBRARY_IDEAS.md`).

**Current state of photos in the app, for whoever picks this up:** more alive than it looks. The `hive-photos` Supabase Storage bucket still exists (public read, auth upload), `photo_url` columns still exist on both `hives` and `checkins`, legacy photos still display read-only in popups, and a working `uploadPhoto(file)` function still exists in `app.js` (line ~388) — it's just not called by anything. All the file-input UI was removed from `index.html` in v2.3, and `submitHive()` hardcodes `photo_url: null`. The v2.3 rationale (removing photos let Add Hive skip a sign-in requirement) no longer applies — Add already requires sign-in again, and Validate/check-in now do too (v2.9.1).

**Why check-in photos are a bigger lift than Add-hive photos:** `submitCheckin()` calls the atomic `submit_checkin()` Postgres RPC (`v2_6_sync.sql`), which only takes `p_hive_id`, `p_status`, `p_notes` — no photo param. That RPC was deliberately made atomic to avoid an earlier two-step insert/update failure mode, so adding a photo means either extending its signature (backward-compatible, `default null`) or accepting a small two-step window again.

**The offline barrier (the specific thing Ronnie asked about):** confirmed gap, already called out as explicitly out-of-scope in the original v2.6 implementation plan ("Offline write outbox / Background Sync — deferred until after field test") and never built. Today `sw.js` treats all Supabase traffic as network-only — no signal means Add/check-in/photo submissions just fail with an error toast, nothing queues or retries. Building this properly needs: (1) an IndexedDB-backed outbox for pending writes, since photos are multi-MB blobs and storage quota varies by device (iOS Safari is the tightest and most eviction-happy); (2) custom app-level retry logic, because the proper browser mechanism (Background Sync API) **is not implemented in Safari/WebKit at all**, and this project explicitly targets iPhone field use, so it can't be relied on — retry has to be driven by listening for the `online` event or re-checking on app foreground; (3) idempotency on retry (a client-generated ID) to avoid duplicate hive records if a submission partially succeeds and gets retried; (4) a "pending sync" UI state, since submissions today are either an immediate success or an immediate error, nothing in between.

**The anti-fraud / proximity idea, if this gets picked back up:** don't trust the photo file's EXIF GPS as the primary signal — it's unreliable (depends on camera-app location permission at capture time, gets stripped by most share flows) and actively conflicted with the offline work, since client-side photo compression (needed to keep field uploads small) draws to a canvas and re-exports, which strips all metadata including EXIF. The more reliable design: capture live device coordinates via `navigator.geolocation` (same API Validate already uses) at the moment of the check-in/photo, store them alongside the submission, and compare against the hive's stored coordinates with the existing `haversine()` helper. GPS works fully offline (satellite-based, no wifi/cell needed), so it fits the offline-queue flow naturally — capture photo + coordinates + notes locally while offline, sync when back in range. Two open sub-decisions for later: (a) how generous the distance threshold should be — Pathfinder's own field testing found a real GPS accuracy floor around ±20m even with careful averaging under tree canopy, so a tight radius will false-flag honest people; think in the 100+ yard range, not tight; (b) whether the distance check is just a friendly client-side nudge ("you're 400 yards away") or also enforced server-side in the Postgres function — client-only is fine for UX but isn't real fraud prevention against someone editing the page's JS, so real enforcement needs the check to live in the RPC too.

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
