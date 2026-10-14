<!--
ASSET_INDEX.md — single source of truth for every image/video asset in this
repo: what it is, whether the live app depends on it, its Facebook-ready
crop (if any), and when it was last used in a Facebook post.

Why this exists: the weekly savethehives-fb-weekly-digest task (and anyone
picking up FB content work) used to have to re-derive "is this image
already used, is it low-res, is it app-critical" from `ls` output plus old
FACEBOOK_POST_LOG.md entries every single run. This file replaces that.

MAINTENANCE RULE: whenever a Facebook post uses an image/video, update that
asset's "Last used in FB post" column here. Whenever a new asset is added
to the repo, add a row here in the same run. Treat this file as load-bearing
for the weekly digest process, not optional bookkeeping.

Built during the Sep 26 2026 asset-reorg pass. "Last used" dates below are
reconstructed from FACEBOOK_POST_LOG.md history as of that date — treat
anything after Sep 26 2026 as needing a fresh update by whoever schedules
that post.
-->

# SaveTheHives — Asset Index

## How to read this

- **App-critical** = referenced by exact path in `app/app.js`, `index.html`, `app/index.html`, `manifest.json`, or `app/sw.js`'s `SHELL_ASSETS`. **Do not move, rename, or delete without also updating that code reference and bumping `CACHE_VERSION` in `app/sw.js`.**
- **Marketing-only** = not referenced anywhere in the live app. Safe to reorganize freely; only used for Facebook/social content.
- **FB crop** = the Facebook-optimized square (1080x1080) / portrait (1080x1350) version in `marketing/facebook/`, if one exists.

## App-critical assets (do not relocate without a code change)

| File | Used by | Purpose |
|---|---|---|
| `/logo.jpg` | `index.html`, `app/index.html`, `app/sw.js` SHELL_ASSETS, `functions/hive/[id].js` | Favicon, apple-touch-icon, in-app header logo |
| `/manifest.json` | root + app | PWA manifest |
| `/icon-192.png`, `/icon-512.png` | `manifest.json`, `app/sw.js` SHELL_ASSETS | PWA install icons |
| `/images/meadow-hero.jpg` | root `index.html` | Landing page hero background |
| `/images/teaser-bee.mp4` | root `index.html` | Landing page animated bee teaser (video) |
| `/images/teaser-bee-poster.jpg` | root `index.html` (`<video poster>`) | Poster frame for the teaser video — small/low-res is fine, it's a poster frame, not a full photo post |
| `/images/oak-tree-colony.jpg` | root `index.html` | Landing page "why non-managed colonies matter" section |
| `/images/honeybee-on-comb.jpg` | `app/sw.js` SHELL_ASSETS, `app/index.html` | About panel image |
| `/images/learn-hero.jpg` | `app/app.js` | Learn tab: Beeline module hero |
| `/images/learn-triangulation.jpg` | `app/app.js` | Learn tab: Triangulation module |
| `/images/learn-terrain-a.jpg` | `app/app.js` | Learn tab: terrain method A (open hayfield) |
| `/images/learn-terrain-b.jpg` | `app/app.js` | Learn tab: terrain method B (river/triangulation) |
| `/images/learn-terrain-c.jpg` | `app/app.js` | Learn tab: terrain method C (hilltop) |
| `/images/learn-terrain-woods.jpg` | `app/app.js` | Learn tab: combined method (dense woods) |
| `/images/learn-bee-box.jpg` | `app/app.js` | Learn tab: bee-box equipment illustration |
| `/images/learn-waggle-decoder.jpg` | `app/app.js` | Learn tab: waggle dance module |
| `/facebook_cover_photo.jpg` | `index.html`, `app/index.html`, `functions/hive/[id].js` (all three: `og:image` / `twitter:image`) | **Site-wide social share image** — every link to savethehives.org (including per-hive share links) resolves to this as its preview image. Caught late in this reorg pass by an offhand changelog mention in `SAVETHEHIVES_SPEC.md` — an early draft of this plan almost moved it into `marketing/misc/` as "unused," which would have silently broken link previews sitewide. Left in place. |

These all stay exactly where they are. They also double as Facebook post images (see table below) — that's fine and intentional, just don't move the file itself.

## Marketing-only assets (post-reorg locations)

| File (new path) | What it is | FB crop | Last used in FB post |
|---|---|---|---|
| `marketing/screenshots/map-overview.jpg` | Post-redesign (Oct 11 2026) map hero: new OSM Bright basemap, white filter chips, search bar, black clusters, continental zoom | `marketing/facebook/map-overview_fb-square-1080x1080.jpg` / `_fb-portrait-1080x1350.jpg` | Not yet used — captured Oct 14 2026 |
| `marketing/screenshots/map-near-you.jpg` | The REAL "Check In" flow, not a staged map view: the "N hives within about an hour of you" banner, the dashed ~50-mile radius, and the nearest hive's story auto-opened (#467, Jan Weems NCMNS — a walnut-tree hive tied to the NC Museum of Natural Sciences). Replaces an earlier staged version (archived) once the overzoom bug below was fixed | `marketing/facebook/map-near-you_fb-square-1080x1080.jpg` / `_fb-portrait-1080x1350.jpg` | Not yet used — recaptured Oct 14 2026 |
| `marketing/screenshots/map-story-bryan.jpg` | A single real hive's detail panel open (#466, Bryan A., Raleigh NC — huge hive under a back porch, swarms 2-3x/year) — narrative/story framing instead of a flat pin field. Replaces the earlier Charles E. Wallace version (archived — its description mentioned a beekeeper trying to remove the hive, which Ronnie didn't want to lead with) | `marketing/facebook/map-story-bryan_fb-square-1080x1080.jpg` / `_fb-portrait-1080x1350.jpg` | Not yet used — recaptured Oct 14 2026 |
| `marketing/screenshots/map-story-patrick.jpg` | A second hive-story shot (#19, San Francisco Zoo — 10+ year colony in the Pachyderm building's hollow wall, Active status, recent check-in shown). Submitter name (Patrick Schlemmer) is CSS-blurred in the screenshot at Ronnie's request | `marketing/facebook/map-story-patrick_fb-square-1080x1080.jpg` / `_fb-portrait-1080x1350.jpg` | Not yet used — recaptured Oct 14 2026 |
| `marketing/screenshots/map-mating-radius.jpg` | Mating-radius circles toggled on across ~12 Triangle-area hives, overlapping rings — visual for the Genetic Goldmine/connectivity science angle | `marketing/facebook/map-mating-radius_fb-square-1080x1080.jpg` / `_fb-portrait-1080x1350.jpg` | Not yet used — captured Oct 14 2026 |
| `marketing/screenshots/map-filter-live-tree.jpg` | Live Tree filter chip active (green, selected state), reduced pin set + live count — demonstrates the new multi-select filter UI | `marketing/facebook/map-filter-live-tree_fb-square-1080x1080.jpg` (square only) | Not yet used — captured Oct 14 2026 |
| `marketing/video/savethehives-tour-v3.mp4` | 31.5s mission/tour video, no voiceover (burned-in captions only, by design — see `AI_VIDEO_PROMPT_TOUR.md`) | — | Attempted Oct 6 2026 as a Reel; **Metricool couldn't fetch this file as of this date — verify it's actually reachable at `https://savethehives.org/marketing/video/savethehives-tour-v3.mp4` (or wherever it lands) before relying on it again** |
| `marketing/hero-art/1. Hero — "The Beeline" (Module 1 + hub landing).png` | Large illustrated hero art, bee flying a line to a hollow tree | `marketing/facebook/beeline-hero_fb-square-1080x1080.jpg` / `_fb-portrait-1080x1350.jpg` | Jul 22 2026 (Post 2) |
| `marketing/hero-art/2. Triangulation — "Two Lines, One Answer" (Module 3).png` | Large illustrated hero art, two flight lines crossing | `marketing/facebook/triangulation-hero_fb-square-1080x1080.jpg` / `_fb-portrait-1080x1350.jpg` | Oct 21 2026 (first use) |
| `marketing/misc/STH_logo_small.jpg` | Small logo crop — not referenced anywhere in app code or docs by filename | — | Never used in a FB post. **Likely redundant with `/logo.jpg` — candidate for deletion once confirmed unneeded; not deleted in this pass since it wasn't clearly disposable at the time.** |
| `marketing/build-stills/*.jpg` (5 files) | Leftover still-frame references used to *build* the How-To Reels via ffmpeg (highlight overlays, nav highlights, blurred sample card) | — | Not post-ready content themselves. **The finished Reels they were built into (`howto-add-hive-fb-ready.mp4`, `howto-checkin-fb-ready-v3.mp4`) are referenced in FACEBOOK_STARTER_PACK.md §4 but do not exist anywhere in this repo as of Sep 26 2026 — either locate them (phone/other machine) and add them properly, or stop citing them as "already produced" until they do.** |

## `marketing/facebook/` — Facebook-ready crops (moved as a block, contents unchanged)

Every asset below is a pre-cropped square (1080x1080) + portrait (1080x1350) pair, one per source image. Full history of which was used when lives in `FACEBOOK_POST_LOG.md` — this table is the quick-reference version; update it, don't replace the log.

| Source asset | FB crop base name | Last used in FB post |
|---|---|---|
| `images/honeybee-on-comb.jpg` | `honeybee-on-comb_fb-*` | Aug 31, Sep 14, Sep 25 (test), Oct 12 2026 |
| `images/learn-hero.jpg` | `learn-hero_fb-*` | Jul 22 2026 (raw, pre-crop) |
| `images/learn-bee-box.jpg` | `learn-bee-box_fb-*` | Aug 5 2026 |
| `images/learn-terrain-a.jpg` | `learn-terrain-a_fb-*` | Oct 14 2026 (first use) |
| `images/learn-terrain-b.jpg` | `learn-terrain-b_fb-*` | Sep 16 2026 |
| `images/learn-terrain-c.jpg` | `learn-terrain-c_fb-*` | Sep 30 2026 (first use, image not visually verified before scheduling — glance at it) |
| `images/learn-terrain-woods.jpg` | `learn-terrain-woods_fb-*` | Aug 26 2026 |
| `images/learn-triangulation.jpg` | `learn-triangulation_fb-*` | Jul 29 2026 (raw, pre-crop) |
| `images/learn-waggle-decoder.jpg` | `learn-waggle-decoder_fb-*` | Sep 2 2026 |
| `images/meadow-hero.jpg` | `meadow-hero_fb-*` | Sep 9, Oct 12 2026 |
| `images/oak-tree-colony.jpg` | `oak-tree-colony_fb-*` | Aug 26, Sep 7, Sep 20, Oct 5, Oct 18 2026 |
| `/logo.jpg` | `logo_fb-*` | Aug 2, Aug 16, Oct 11 2026 |
| `map-overview.jpg` | `map-overview_fb-*` | Not yet used |
| `map-near-you.jpg` | `map-near-you_fb-*` | Not yet used |
| `map-story-bryan.jpg` | `map-story-bryan_fb-*` | Not yet used |
| `map-story-patrick.jpg` | `map-story-patrick_fb-*` | Not yet used |
| `map-mating-radius.jpg` | `map-mating-radius_fb-*` | Not yet used |
| `map-filter-live-tree.jpg` | `map-filter-live-tree_fb-square-1080x1080.jpg` only | Not yet used |
| `1. Hero — The Beeline...png` | `beeline-hero_fb-*` | not yet used via this crop (raw PNG used instead, Jul 22) |
| `2. Triangulation...png` | `triangulation-hero_fb-*` | not yet used via this crop (raw PNG used instead, Oct 21) |

## `marketing/archive/` — retired, kept for history (do not schedule)

The Oct 11 2026 map redesign (new OSM Bright basemap, white filter chips/search
bar, black clusters — see `CLAUDE.md`) made the old map screenshots visibly
inaccurate: anyone clicking through from a FB post using them would land on a
very different-looking app. Moved here rather than deleted, Oct 14 2026, and
replaced by the `map-*` rows above:

| File | Was |
|---|---|
| `SaveTheHives_map_screenshot.jpg` | Pre-redesign raw map screenshot (actually pre-dates even the Jul/Aug filter-drawer era — shows `v2.9` version badge, orange clusters, no search bar, no filter chips at all) |
| `SaveTheHives_map_screenshot_cropped.jpg` | Cropped version of the above |
| `map-screenshot-full_fb-square-1080x1080.jpg` / `_fb-portrait-1080x1350.jpg` | FB crop of the raw screenshot |
| `map-screenshot-cropped_fb-square-1080x1080.jpg` / `_fb-portrait-1080x1350.jpg` | FB crop of the cropped screenshot |
| `map-near-you-synthetic.jpg` / `_fb-square-1080x1080.jpg` / `_fb-portrait-1080x1350.jpg` | First "near you" shot — a manually staged map.setView() at the Triangle, no real UI flow. Archived Oct 14 2026 same day as capture, replaced by a screenshot of the actual Check-In/Validate flow once its overzoom bug (see `app/app.js` `showHiveNotePanel`/`runValidateFilter`, fixed same day) stopped it from landing on the right view on its own |
| `map-hive-story.jpg` / `map-hive-story_fb-square-1080x1080.jpg` / `_fb-portrait-1080x1350.jpg` | First hive-story shot (Charles E. Wallace, #474) — archived Oct 14 2026, same day as capture, because Ronnie didn't want to lead with its "a local beekeeper tried to use a vaccum contraption to get them out" line. Replaced by `map-story-bryan.jpg` and `map-story-patrick.jpg` above |
| `map-story-bryan-no-pin.jpg` / `map-story-patrick-no-pin.jpg` (+ FB crops) | First versions of the Bryan/Patrick story shots — Ronnie noticed the hive's own marker pin wasn't visible on the map in either one. Root cause: `showHiveNotePanel()`'s flyTo centered the hive's coordinates exactly under `#hive-note-panel` itself (a fixed card docked over the lower-left of the map), so the pin landed directly behind its own panel. Fixed in `app/app.js` same day (now biases the fly-to target up-and-right, clear of the panel, sized off the panel's actual rendered box) and these were recaptured against the fix |

## Known gaps as of this reorg (Sep 26 2026)

- **Missing Reels:** `howto-add-hive-fb-ready.mp4` and `howto-checkin-fb-ready-v3.mp4` are documented in `FACEBOOK_STARTER_PACK.md` §4 as already produced but don't exist in this repo. Resolve before promising them in another digest.
- **teaser-bee.mp4 as a Reel:** works fine as the landing page's inline video, but scheduling it as a standalone Facebook Reel (attempted Oct 20 2026) failed the same way the tour video did — Metricool couldn't fetch it. Root-cause not yet confirmed (Cloudflare video-serving behavior vs. Metricool's fetcher vs. something else) — verify manually before trying again.
- **`STH_logo_small.jpg`** — likely a redundant duplicate of `/logo.jpg`, never actually used in a post or referenced in code. Worth confirming with Ronnie and deleting (his Terminal, not Claude — see `feedback_workspace_no_delete_rename.md`).
