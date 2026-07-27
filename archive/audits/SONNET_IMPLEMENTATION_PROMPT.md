# SaveTheHives — Infrastructure & PWA Batch (v2.6)

You are implementing a pre-approved architectural plan for SaveTheHives, a single-file
Leaflet + Supabase PWA live at https://savethehives.org. Work through the phases below
**strictly in order**. Do not skip ahead, combine phases, or add improvements that are
not listed.

## Context

- Repo folder: `~/claude/SaveTheHives-pwa-claude`
- Canonical app file: `savethehives.html` (~4,064 lines, 389KB) — deployed as `index.html`
- Also deployed: `privacy.html`, `manifest.json`, `icon-192.png`, `icon-512.png`
- Hosting: Cloudflare Pages (currently manual zip upload — Phase 0 replaces this)
- Backend: Supabase (Postgres + magic-link auth + RLS). Config in `SAVETHEHIVES_SPEC.md`
- Read `SAVETHEHIVES_SPEC.md` before starting. Update its changelog when finished (v2.6)

## Global rules — read before every phase

**DO:**
- Make surgical, minimal edits. Cut-and-paste moves, not rewrites
- Commit after every numbered step: `git add -A && git commit -m "<step description>"`
  and remind the user to `git push` (you cannot push)
- Test the app boots and the map loads after every commit (`python3 -m http.server 8080`,
  open `http://localhost:8080/index.html`)
- Stop and report if anything unexpected appears (missing file, merge conflict, console error)

**DO NOT — these are hard rules:**
- Do NOT regenerate or rewrite any file wholesale. If an edit tool fails, retry with a
  smaller edit — never by rewriting the file
- Do NOT rename any function, variable, ID, or CSS class
- Do NOT reformat, re-indent, "clean up," or lint existing code
- Do NOT convert scripts to ES modules or add `type="module"` — the app uses inline
  `onclick="..."` handlers everywhere and requires global scope
- Do NOT add npm, bundlers, build steps, frameworks, or new libraries
- Do NOT upgrade CDN library versions (Leaflet 1.9.4, MarkerCluster 1.5.3, supabase-js v2)
- Do NOT touch any Pathfinder code (`#pathfinder-panel`, `PF.*`, `smoothPosition`,
  `pathIntersection`, `calculateIntersection`, walk/nav tracking, compass code, debug
  panel). That work is scoped to a separate session with a different model
- Do NOT change Supabase keys, RLS policies, or Turnstile config
- Do NOT delete `savethehives.html` until Phase 0 step 4 says so

---

## Phase 0 — Git + Cloudflare Pages integration

1. Run `git status` in the repo folder. If not a repo, `git init`. Commit everything
   as-is first: baseline commit before any change.
2. Guide the user through creating a GitHub repo (private is fine) and adding it as
   `origin`; user pushes `main`.
3. Guide the user through connecting Cloudflare Pages to the GitHub repo (dashboard:
   Workers & Pages → savethehives project → connect to Git, or create a new Pages
   project and repoint the DNS CNAMEs to the new `*.pages.dev`). Settings: production
   branch `main`, no build command, output directory `/`. **This is a dashboard task —
   give instructions, do not attempt it yourself.** The old zip-upload flow remains the
   documented fallback.
4. Make `index.html` the canonical file: `git mv savethehives.html index.html` (the two
   are currently identical copies). Update any docs/scripts that reference the old
   two-file `cp` workflow.
5. Verify: user pushes a trivial change (e.g., HTML comment) and confirms it goes live
   at savethehives.org automatically. Do not proceed to Phase 1 until this works.

## Phase 1 — Quick wins (Deploy A)

1. **Fix the manifest override bug.** In `index.html` (~lines 216–231) an inline
   `<script>` builds a placeholder manifest with a broken 1×1 base64 icon and overwrites
   the `<link rel="manifest" href="manifest.json">` href with a blob URL. Delete that
   entire script block. Keep the `<link>` tag. `manifest.json` with real icons already
   exists and deploys.
2. **De-duplicate embedded images.** The same ~40KB base64 logo is embedded three times:
   favicon (~line 232), apple-touch-icon (~line 233), header `<img class="logo">`
   (~line 1603). Decode one copy to `logo.png` in the repo (or reuse `icon-192.png` if
   visually identical) and point all three references at the file. Also extract the
   ~100KB base64 JPEG at ~line 1912 to `images/<descriptive-name>.jpg` and reference it.
3. Verify: `index.html` shrinks by roughly 220KB; app loads; logo, favicon, and the
   extracted JPEG render; PWA installs on iPhone with the correct icon (not blank).
4. Push and confirm live deploy. **Field-usable checkpoint — tag it `v2.6-a`.**

## Phase 2 — Few-files, no-build split (Deploy A½)

Extract in this exact order, **one extraction = one commit**, testing the app fully
between each:

1. `styles.css` — move everything inside the main `<style>` block. Replace with
   `<link rel="stylesheet" href="styles.css">` at the same document position.
2. `pathfinder.js` — move the Pathfinder JS (PF state object, compass/sensor code,
   walk/nav tracking, triangulation math ~lines 2850–3650, and `smoothPosition`) into
   the new file **unchanged, byte-for-byte**. Load with `<script src="pathfinder.js"></script>`
   placed AFTER the main app script (it references `map`, `haversine`, shared helpers).
   If a helper is used by both app and Pathfinder code (e.g., `haversine`), it stays in
   the app file.
3. `app.js` — move the remaining main `<script>` body. Load order in `index.html` must
   end up: CDN libs → `app.js` → `pathfinder.js`. Plain script tags, no `defer` changes,
   no modules.
4. Full regression test: map + clusters load, search/geocode, filter drawer, dark mode
   toggle, sign-in flow (Turnstile renders), add hive, check-in, About modal +
   Ideas & Voting, popups. Console must be free of new errors.
5. Push, confirm live, tag `v2.6-b`.

## Phase 3 — Sync & offline batch (Deploy B)

1. **SQL file** (`v2_6_sync.sql`, for the user to run once in the Supabase SQL editor —
   same pattern as `ideas_and_voting.sql`; do not attempt to run it yourself):
   - Add `updated_at timestamptz` to `hives` with a trigger setting it on INSERT/UPDATE;
     backfill from `last_verified_at`/`submitted_at`.
   - `submit_checkin(hive_id, status, notes)` Postgres function: inserts the checkin
     (with `user_id = auth.uid()`) and updates the hive's `status`/`last_verified_at`
     in one transaction. `SECURITY INVOKER` so RLS still applies.
2. **Delta sync in `app.js`:** cache hives in IndexedDB; on load, render from cache
   immediately, then fetch only `updated_at > lastSync` and upsert into cache + map.
   First-ever load keeps the existing paginated full fetch. Select only the columns
   `dbRowToHive()` actually uses, not `*`.
3. **Atomic check-in:** replace the two-step insert+update in `submitCheckin()` with a
   single `db.rpc('submit_checkin', ...)`. Keep the existing UI error handling.
4. **Service worker** (`sw.js` at repo root + registration in `app.js`):
   - Cache-first for the app shell (`index.html`, `styles.css`, `app.js`,
     `pathfinder.js`, `manifest.json`, icons, images) and the CDN libs
   - Versioned cache name (bump on deploy); delete old caches on `activate`
   - Never cache Supabase API/auth requests (`*.supabase.co`) — network only
   - Map tiles: network-first with a small capped cache (e.g., 200 entries), or skip
     tile caching entirely in this pass if capping is fiddly
5. Regression test everything in Phase 2 step 4 again, plus: offline reload shows the
   map with cached hives; check-in works and persists; second visit paints instantly.
6. Push, confirm live, tag `v2.6`. Update `SAVETHEHIVES_SPEC.md` changelog and the
   deployment section (git-based deploys, new file layout).

## Out of scope — do not do

- Anything Pathfinder (GPS smoothing, Kalman filter, triangulation, nav UX) — reserved
  for a separate session
- Offline write outbox / Background Sync — deferred until after field test
- MapLibre migration, coordinate fuzzing, photo re-enable, pagination — all later phases
