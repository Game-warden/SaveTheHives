# Pathfinder Handoff — Phase 5 Archive Document

**Written:** July 6, 2026, by Claude Fable at the close of the dedicated Pathfinder session
**For:** Claude Sonnet (or any future session) resuming this work with Ronnie
**Status:** ARCHIVED / PAUSED by Ronnie's decision — feature is safe in production (hidden), work is parked for "another crack at it at a later time"
**Read alongside:** `SAVETHEHIVES_SPEC.md` (Phase 5 section + Known Gotchas) and the TUNING guide comment block at the top of `pathfinder.js`

---

## 1. TL;DR — Where Things Stand

Pathfinder is a beelining triangulation tool: capture bee-flight bearings from two GPS-anchored points, intersect the rays, navigate to the candidate hive site. During this session it went from "buggy prototype" to "honest instrument at its physical accuracy limit" — and that limit (~±20m in good conditions, worse under canopy) is the reason it's parked, not any single bug.

**Production safety:** the Pathfinder tab and 🐞 debug button are hidden from normal visitors. Only `https://savethehives.org/?pf=1` reveals them (gate function at the bottom of `pathfinder.js`). Nothing needs to be disabled or reverted before leaving this alone indefinitely.

**Ronnie's stated next intent:** work with Sonnet on a *theory of beelining* — diagrams and explanations of how beelining works (an educational/content feature, not automation). The automation below waits for a later day.

---

## 2. Architecture Map

Plain-script PWA, no build step. Load order: `index.html` → `styles.css` → `app.js` → `pathfinder.js`. Everything global scope — do NOT convert to modules (inline `onclick` handlers require globals).

| Piece | Where | What |
|---|---|---|
| `PF_TUNE` + TUNING guide | top of `pathfinder.js` | Every field-adjustable constant, each documented with low/high failure symptoms. **Change behavior here first.** |
| `PF` state object | `pathfinder.js` | Step machine state: `idle → sensorsReady → pointA → walking → pointB → result → navigating`, plus `pointC` (leapfrog refinement, re-enterable from result/navigating) |
| `captureAnchorPoint()` | `pathfinder.js` | Stationary GPS averaging window: accuracy-gated fixes, inverse-variance weighted mean, timeout fallback. Locks Point A/B/C anchors. |
| `createGpsFilter()` / `gpsFilterSeed()` / `gpsFilterUpdate()` | `pathfinder.js` | Per-axis alpha-beta position filter (replaced the old `smoothPosition` moving average). Adaptive gain from `coords.accuracy`; seeded from anchors. |
| `circularMeanBearing()` / `circularStdDevDeg()` / `lockedBearingStd()` | `pathfinder.js` | Bearing averaging + measured spread (wrap-safe), floored by compass hardware floor and the OS compass-error estimate. |
| `stationPairEstimate()` / `calculateIntersection()` | `pathfinder.js` | Pairwise great-circle ray intersection with per-pair error radius (bearing spread × range ÷ sin(crossing angle) ⊕ anchor error); multi-station fusion = inverse-variance weighted mean of pair intersections, radius = best pair's (deliberately conservative). |
| `startRefinePoint()` | `pathfinder.js` | Leapfrog entry ("Refine from Here" button): capture a fresh bearing station closer to the hive. |
| `drawPathfinderPoint()` | `pathfinder.js` | Station markers — **draggable**; drag re-runs triangulation (canopy-multipath countermeasure). |
| Arrival handover | inside `startNavTracking()` | Within `ARRIVAL_RADIUS_M` (with hysteresis) navigation stops steering and says "search this area". |
| Debug panel | `index.html` rows + `updateDebugPanel()` map in `app.js` | Live: heading, GPS accuracy, filter α/σ, anchor quality, ray geometry (γ, εA, εB), compass self-reported error. |
| Field-test gate | bottom of `pathfinder.js` | `?pf=1` unhides tab + debug button. |

**The only non-Pathfinder files touched this session:** `sw.js` (CACHE_VERSION bumps — mandatory), `index.html` (Pathfinder panel/debug rows/tab id), `app.js` (two entries in the debug-panel id map). Everything else untouched per the isolation rule.

---

## 3. What Shipped (CACHE_VERSION v2.6.6 → v2.6.11)

| Version | Change |
|---|---|
| v2.6.6 | Anchor capture (step 1), alpha-beta filter (step 2), `?pf=1` gate |
| v2.6.7 | Filter seeded from anchors, process noise 1.8→3.0, per-fix walk distance, arrival handover |
| v2.6.8 | Geometry-aware confidence radius (step 4), arrival hysteresis |
| v2.6.9 | Draggable anchors, compass-health tracking (`webkitCompassAccuracy`), anchor error in radius |
| v2.6.10 | Leapfrog refinement stations (C, D, …) with weighted ray fusion; drag hint moved into anchor toast |
| v2.6.11 | `MAX_CANDIDATE_RANGE_M` sanity guard for the "Africa bug" — **written but never field-tested** |

---

## 4. Field Test Log (5 tests, Jul 6 2026, suburban yard, heavy tree canopy, iPhone Chrome)

1. **Lag + endless circling at target.** Walk path curved, distance readout lagged, needle led the tester in circles near the candidate. → Fixed: anchor-seeded filter, faster velocity gain, per-fix readout, arrival handover.
2. **12m baseline, dishonest circle.** Confidence circle looked as tight as a 50m baseline's; arrival fired early on one jittery fix. → Fixed: measured-spread × crossing-angle radius, hysteresis. **Lesson: baseline ANGLE matters as much as length** (12m perpendicular ≈ ±20m at 45m; 12m parallel ≈ ±100m).
3. **Anchor A ~18m off under canopy.** Correlated multipath — all averaged fixes shared the same bias, so the average was tight AND wrong; intersection landed at half the true distance. Compass bias also suspected (ray B clean, ray A rotated). → Fixed: draggable anchors, compass-health tracking, anchor error in radius.
4. **Fixes verified working, but:** drag-correction only works where the user can see landmarks (house corners). **In a forest — the actual use case — there are no landmarks and no known target, so drag-correction is a suburban crutch.** Intersection still 15-20 yards off (matches the ±20m theoretical floor exactly). This prompted the diminishing-returns discussion and the leapfrog build.
5. **Leapfrog test → "Africa bug."** The multi-station fusion accepted a degenerate pair intersection on the great-circle far side, poisoning the weighted mean and `fitBounds` (map zoomed out to another continent). v2.6.11 adds a range guard (discard pair intersections >2km from either station) — **plausible fix, never field-verified.** Session archived here.

**Also burned one test on stale code:** see the "service worker two-load" gotcha in `SAVETHEHIVES_SPEC.md` — the first page load after a deploy still runs the previous version. Reload twice / close-and-reopen, and verify via a UI string known to be new in the build under test.

---

## 5. The Physics (read this before writing any code)

Two-point triangulation error ≈ **(bearing error ε) × (range D) ÷ sin(ray-crossing angle γ)**, plus anchor position error amplified by the same 1/sin(γ).

Realistic field values: ε = 5–10° (compass hardware ~5° floor even calibrated, plus human "which way did it fly" estimation; the 3-tap spread check cannot detect *systematic* bias since all taps share it). Anchors: 3–5m open sky, 10–20m under canopy with **correlated** multipath (averaging doesn't help; reported accuracy is optimistic). Baselines: real sites rarely allow >20m walks, and γ is what matters, not length.

Plug in: ε=5°, D=50m, 12–18m perpendicular baseline → **±15–25m best case.** That is the floor. No filter, no averaging window, no UX polish changes it. The tool's honest job is converting "somewhere in these woods" into "search this circle" — it will never put a pin on the tree.

**The only approach that beats the physics is shortening D:** re-release bees closer (leapfrogging — how human beeliners have always done it). That's what the multi-station refinement implements. Simulation says one spare bee released ~15m from the hive pulls a 17m-off estimate to ~6m. The field test of that feature is what hit the Africa bug, so the concept is validated only in simulation.

---

## 6. Known Bugs & First Tasks on Resume

1. **Verify or revert the Africa fix.** `MAX_CANDIDATE_RANGE_M` guard (v2.6.11) discards far-side pair intersections. First field session should re-run a leapfrog refine. If fusion still misbehaves, fallback option: use ONLY the newest station's ray × the best previous ray (drop full pairwise fusion) — simpler and probably good enough. If it's still flaky, revert to two-station only: set `MAX_STATIONS: 2` in `PF_TUNE` (hides nothing, just blocks refinement) — one-line rollback.
2. **UX debt from this session's additions** (Ronnie's parting feedback: changes were making it "more difficult and less easy to use"). Candidates for simplification on resume: too many toasts, refine flow adds a second lock step, result-screen text is long. Consider a simplification pass before adding anything.
3. Minor: `startCompass()` can register duplicate `deviceorientation` listeners (pre-existing; `startRefinePoint` guards against it, `startNavTracking` doesn't). Harmless (same handler logic), but tidy someday.
4. Minor: marker drag tooltips are invisible on touch (hint moved to toasts instead — keep it that way or find a better affordance).

---

## 7. Backlog / Ideas (in rough priority for a future session)

1. **Theory of Beelining content** — Ronnie's explicit next intent: diagrams + explanations of the beelining method (capture, feed, release, bearings, leapfrog) as educational content in the app. Not automation. Likely lives in the How-To box or About panel. **Start here when he returns.**
2. Leapfrog verification/simplification (see §6.1).
3. "Search the zone" UX — arrival handover exists; a full version would give search-pattern guidance (flight-line watching, listening, sunny-side cavity checks) inside the circle.
4. Douglas-Peucker path simplification (original step 5) — cosmetic only, genuinely low value.
5. SW "update available" toast — would prevent the stale-code field-test trap. NOT Pathfinder code (`app.js`/`sw.js`) — needs its own go-ahead.
6. Urban mode / routing around buildings — Ronnie's own "rabbit hole for another day." Noted, not planned.

---

## 8. Non-Negotiable Rules for Any Future Pathfinder Work

1. **`CACHE_VERSION` in `sw.js` must be bumped in the SAME commit as any change to `pathfinder.js`, `app.js`, `styles.css`, `index.html`, or `manifest.json`.** Current value: `v2.6.11`. Miss this and fixes silently never reach savethehives.org (works on .pages.dev, Cloudflare purge won't help — client-side Cache Storage).
2. **Two-load rule when field testing:** first page load after a deploy runs the OLD code. Reload twice or close-and-reopen; verify with a known-new UI string before walking anywhere in 99° heat.
3. **Don't touch non-Pathfinder code without asking Ronnie.** The isolation has held all session; keep it that way.
4. **Every constant goes in `PF_TUNE` with a TUNING-guide entry** (what it controls, symptom-if-low, symptom-if-high). No magic numbers. This document + that guide are what make the code serviceable without Fable.
5. **Field-test one change at a time.** Batching changes was avoided all session for a reason: each test isolated one cause (lag → geometry → multipath → fusion). Keep that discipline.
6. Deploy = Ronnie runs `git add -A && git commit && git push` in his own Terminal (Cloudflare Pages auto-deploys from `main`). Claude cannot push.

---

## 9. Test Procedure (the one that worked)

1. Open `savethehives.org/?pf=1` on iPhone (Incognito avoids all cache traps).
2. Enable sensors → figure-8 the compass → watch "Compass self-reported error" in the 🐞 panel.
3. Aim all bearings at a KNOWN visible target (light pole, trash can) — ground truth is the whole point.
4. Lock A (check the pin against your real position — drag if off) → walk perpendicular to the bee line, as far as practical → lock B (same check).
5. Compare candidate + circle to the known target. The popup reports baseline, crossing angle γ, and radius.
6. If testing leapfrog: walk toward the zone, "Refine from Here," release one more bearing 10–20m to the SIDE of the bee line, confirm the circle shrinks and the candidate moves toward truth — and that the map does not fly to Africa.
