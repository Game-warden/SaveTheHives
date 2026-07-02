# SaveTheHives — Project History & Continuity Doc

**Purpose:** Reconstructed dev history so any future Claude session can pick this project up cold. Written after a 3-day Cowork session (Jun 27–30, 2026) that finished and deployed v2.4, prompted by concern that the session itself wouldn't be saved anywhere.

**For current architecture, schema, design system, and roadmap, see [`SAVETHEHIVES_SPEC.md`](./SAVETHEHIVES_SPEC.md) — it's the living spec and is already thorough and current as of today. This doc is the *narrative history* that explains how the project got here, since that context isn't in the spec or fully in git.**

---

## The short version

SaveTheHives has been rebuilt from scratch twice. It's now live at **savethehives.org**: a single-file HTML PWA (`index.html` = `savethehives.html`) using Leaflet + Supabase, with ~1,162 legacy feral-hive records loaded. Most of the last three days of work (the Supabase backend, security hardening, production deploy) happened **outside git** — it exists only as files in this folder. That's the gap worth knowing about.

---

## Era 1 — React + Leaflet PWA (Feb 23–24, 2026)

Original build. React/Vite app, `react-leaflet`, marker clustering, ZIP search via Nominatim, iOS PWA polish. This is `git log`'s earliest history (`3ee1349 Initial commit` through `00f3804 Final UI Polish`). Lives only in git history now — the actual React source files (`src/App.jsx`, `src/components/MapComponent.jsx`, etc.) were deleted from the working tree at some point and only survive as git blobs plus copies under `archive/`.

## Era 2 — "SaveTheHives_2": React + MapLibre GL JS rebuild (Feb 24–26, 2026)

A full rebuild documented in `archive/README.md` and `archive/MANIFEST.md`. Switched the map engine from Leaflet to **MapLibre GL JS** for WebGL/GPU rendering of 1,000+ markers. This era produced the long run of versioned commits **V33 through V118** (`git log` — e.g. `V109 Manual Override Write`, `V114 DCA Engine Deployment`, `V118 DCA Logic Transparency & Heatmap Refinement`, the last commit on `2026-02-26`). Notable features built here, per `archive/MANIFEST.md`:

- DCA (drone congregation area) heatmap engine — predicts honeybee mating hubs from overlapping 3-mile/1,500m foraging radii, weighted toward "survivor" hives
- Beelining tools — time-based and vector/triangulation methods for tracking bees back to a hive
- A "Do No Harm" ethics framework (fuzzy public coordinates, privacy-by-default, biosecurity prompts) — mostly aspirational/unbuilt per the manifest's own checkmarks
- A console-based audit/export system (`audit()`, `exportAudit()`) for diffing data mutations
- Unified Science Portal referencing NC State's Tarpy Lab research

This era's full chronological detail is in `archive/Historical_Manifest.md` (110KB — don't read it whole, grep for a version number if you need specifics) and raw export dumps (`SaveTheHives_2_*_Export.txt`) in the same folder. **This MapLibre/React version is not what's live today** — it was superseded.

## Era 3 — Single-file HTML PWA + Supabase (current, live)

At some point after V118, the project pivoted away from the React/Vite/MapLibre stack entirely, back to a **single-file HTML PWA** (`savethehives.html`) using Leaflet again, now backed by **Supabase** (Postgres + auth + storage) instead of static data. This is the architecture documented in `SAVETHEHIVES_SPEC.md` and the one currently live at savethehives.org.

Evidence of how this happened, since none of it is in git:

- `claudcode_savethehives/` folder (files dated Jun 25, 2026) holds numbered iterations — `savethehives (13).html`, `savethehives (14).html` — and an earlier copy of the spec doc, suggesting prior Claude Code/Cowork sessions before the one being documented here.
- `migrate_to_v2.py` (Jun 29) is the actual migration script: a Python regex-patcher that reads `savethehives.html` and writes `savethehives_v2.html`, injecting the Supabase client, magic-link auth, photo upload, and check-in system. This is the **v2.0 milestone** from the spec's changelog.
- `privacy.html` (Jun 30) — privacy policy written to cover email collection, location data, and the Cloudflare Turnstile addendum, required once Turnstile bot protection was added.
- `tarpy-email-draft.md` (Jun 30) — a drafted (not yet sent) outreach email to Dr. David Tarpy at NC State, who helped get press coverage for the original SaveTheHives and runs Varroa-resistance research the project's "survivor genetics" framing is built around. This is a loose thread — worth asking whether it was ever sent.
- `Archive.zip` (Jun 30, 20:06) — the actual Cloudflare Pages deployment package (`index.html`, `savethehives.html`, `privacy.html`, `manifest.json`, `migrate_to_v2.py`, the spec, the Tarpy draft). Despite the name, this is a deploy artifact, not a historical archive.

The spec's own changelog (section 6) covers the v2.0 → v2.4 progression in detail: Supabase backend → UX polish → production launch on Cloudflare Pages with Resend SMTP → UI redesign (light mode default, single smart search bar) → security hardening (RLS, Turnstile) and privacy policy. **v2.4, deployed today (Jun 30, 2026), is the live version at savethehives.org.**

---

## Git repository state — read this before doing anything destructive

```
On branch pwa-deployment
Your branch is ahead of 'origin/pwa-deployment' by 130 commits.
```

Two things worth knowing:

1. **130 local commits have never been pushed to origin.** If this clone is lost, that history goes with it.
2. **The entire Era 3 rebuild (everything described above) is uncommitted.** `git status` shows the old React/Vite source tree (`src/`, `package.json`, `vite.config.js`, etc.) as locally deleted-but-not-staged, and all the current single-file-PWA files (`index.html`, `privacy.html`, `manifest.json`, `migrate_to_v2.py`, `SAVETHEHIVES_SPEC.md`, `savethehives.html`, `savethehives_v2.html`, `tarpy-email-draft.md`, `Archive.zip`, `archive/`) as untracked or modified.

In other words: the actual live, deployed app — the thing that took 3 days and is now serving real traffic at savethehives.org — exists nowhere in version control. It's just files sitting in this folder. **If continuing this project, committing the current state (and deciding what to do about the deleted React era — keep in `archive/` or drop it) should be one of the first things done,** before any further edits risk losing it.

---

## Key files in this folder, decoded

| File/folder | What it actually is |
|---|---|
| `index.html` / `savethehives.html` | Identical — the live single-file PWA. `index.html` is what Cloudflare Pages serves. |
| `savethehives_v2.html` | Intermediate output of `migrate_to_v2.py` — superseded by `savethehives.html` once changes were merged in by hand. |
| `privacy.html` | Live privacy policy, linked from the in-app About modal. |
| `manifest.json` | PWA manifest (name, theme color, icons — icons array is currently empty). |
| `SAVETHEHIVES_SPEC.md` | **Authoritative living spec.** Architecture, design system, DB schema, infra, full feature changelog, known issues, roadmap. |
| `migrate_to_v2.py` | One-time historical migration script (Era 2→3, Supabase injection). Not needed for future edits unless replicating that migration elsewhere. |
| `tarpy-email-draft.md` | Unsent outreach email draft to Dr. David Tarpy (NC State). |
| `Archive.zip` | The exact zip last uploaded to Cloudflare Pages for deployment — not a historical archive despite the name. |
| `archive/` | Era 1/2 (React + Leaflet, then React + MapLibre) source code and historical manifests. Useful only if reviving old features (DCA heatmap, beelining tools) that didn't carry over to the Era 3 rebuild. |
| `claudcode_savethehives/` | Earlier numbered drafts of the Era 3 single-file HTML, from a Jun 25 session that predates this one. |

---

## Open threads (updated Jul 2, 2026)

- ~~Tarpy outreach email drafted but not sent.~~ **Resolved Jul 2, 2026** — email was sent and a meeting with Dr. Tarpy is now scheduled.
- ~~"Ideas & Voting" feature flagged as a v2.4 candidate — not yet built.~~ **Resolved Jul 2, 2026** — built as v2.5; see `SAVETHEHIVES_SPEC.md` Phase 2.5 and `ideas_and_voting.sql` for the table schema to run in Supabase.
- ~~PWA manifest icons array is empty.~~ **Resolved Jul 2, 2026** — `icon-192.png` / `icon-512.png` added, `manifest.json` updated.
- Phase 3+ (survivor tagging, DCA heatmap, ghost/collapse reporting, Guardian Network) are planned but not built in the Era 3 rebuild — the DCA engine from Era 2 (`archive/`) could potentially be ported over rather than rebuilt.
- Git history doesn't reflect any of the last several days of work — see the section above. **Deferred to a second housekeeping round** (per Jul 2, 2026 discussion) — 130 unpushed local commits and the entire Era 3 rebuild remain uncommitted to git.
- Cloudflare has two Turnstile widgets; only "SaveTheHives Auth" is wired to the app. Deleting the unused one requires manual action in the Cloudflare dashboard — not something a code change can do.

---

## If you're picking this back up

1. Read `SAVETHEHIVES_SPEC.md` first for current architecture/state.
2. Check savethehives.org directly to confirm what's actually live matches `index.html` locally (in case further unsaved edits happened after this doc).
3. Consider committing the current working tree to git (and pushing) before making changes, given the gap described above.
4. Cross-reference `archive/` only if reviving Era 2 features (DCA heatmap, beelining) — don't treat it as current.
