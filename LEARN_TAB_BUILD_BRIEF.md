<!--
LEARN_TAB_BUILD_BRIEF.md — implementation brief for the SaveTheHives "Learn" feature
Written July 2026 by Claude Fable, at the end of the Pathfinder session, for a
future Sonnet build session with Ronnie.
Reviewed with Ronnie as interactive mockups before writing this down.
Companion docs: BEELINING_GUIDE.md (the content), CONTENT_LIBRARY_IDEAS.md (roadmap).
-->

# Build Brief — The "Learn" Tab & the Waggle-Dance Wayfinding Concept

This is a spec-and-rationale for turning `BEELINING_GUIDE.md` into an in-app
learning experience. It was reviewed with Ronnie via mockups before being
written down. Nothing here is coded yet.

**Guiding principle:** this feature is a *recruiting funnel*, not a manual. Its
job is to turn a curious visitor into an active contributor who logs a wild
colony. Every screen should move someone one step closer to "I want to try
this," and every path should end at a call to action (log a hive, build a box,
share this).

---

## 1. Placement — DECIDED

**A dedicated `Learn` tab in the bottom navigation.** Ronnie chose this over
burying it in the About modal, because the content is outreach-first and
deserves top-level discoverability.

- Bottom nav becomes: **Map · Add · Learn · About** (four items).
- Reuse one of the currently-hidden nav slots (Records or Pathfinder) for
  Learn rather than adding a fifth item — four is the comfortable max on a
  phone tab bar. Records/Pathfinder stay reachable via `setTab()` / `?pf=1`.
- Icon: a compass or open-book outline glyph in the honey accent.
- Also drop a small cross-link card in the About modal ("New: Learn to
  beeline →") so people who explore About still find it.

---

## 2. Information Architecture

Three levels, matching the mockups:

**Level 1 — The Hub (`Learn` tab landing)**
- Dark hero (thematic: the dance happens in the dark hive) with the hook
  headline "There's a wild bee colony within a mile of you right now." and a
  bee-line illustration.
- Three "path" cards mapping to the guide's reading tracks:
  Curious (`ti-eye`) · Try it (`ti-compass`, marked Popular) · Maker (`ti-tools`).
  Tapping a path starts a sequenced walk (see §4, Follow the Dance).
- The 8+ modules as a checklist below, each row showing: number + title, an
  icon, read-time + level chips, and state (done ✓ / current ▶ / locked).
  "Locked" is soft — everything is browsable; the lock is a *suggestion* of
  order, not a gate. Don't hard-block content.

**Level 2 — The Module Reader**
- One module per screen. Top: progress bar + "Module N of M" + read-time chip.
- Body: the module's prose from BEELINING_GUIDE.md, broken into short blocks,
  with its illustration (see §5 shot-list).
- Bottom: prev / next buttons. Next is honey-filled (primary), prev is ghost.
- The reader should be pleasant to read on a phone in the field: 16px body,
  generous line-height, no walls of text.

**Level 3 — Cross-links & CTAs**
- Modules end by pointing forward (Module 3 → "Methods", etc.).
- Safety (Module 5) must appear before any "go try it" CTA in every path.
- The Try-it path ends on a CTA to log a hive (jumps to the Add flow) or to
  build a box (opens the future bee-box plan, content-library item #1).

**Content source of truth:** `BEELINING_GUIDE.md`. Each `## MODULE n` is one
reader screen. Its metadata line (audience/level/read/prereq) drives the chips
and the ordering. Don't re-author facts in code — pull from the guide so the
two never drift. When the guide changes, the app should reflect it (ideally
the module content is data, not hardcoded markup).

---

## 3. The Modules (from BEELINING_GUIDE.md)

1. What beelining is · 2 min · beginner
2. A short history · 3 min · beginner
3. Why a fed bee points home (theory) · 4 min · beginner–intermediate
4. Choose your method (by terrain) · 6 min · intermediate
5. Safety, ethics & law · 4 min · all — **surface before fieldwork CTAs**
6. The bee box & your kit · 6 min · intermediate
7. Step by step: first hunt · 7 min · intermediate
8. Beelining meets modern tech (Pathfinder tie-in) · 3 min · intermediate
9. The waggle dance · 3 min · beginner — **also the basis for §4 navigation**

---

## 4. The Waggle-Dance Wayfinding Concept ("Follow the Dance")

Ronnie's idea, developed and reviewed via mockup: use the waggle dance not
just as a *lesson* (Module 9) but as the *organizing metaphor* for navigating
the Learn content. This works because it's honest — a real waggle dance
encodes exactly three things, and we map content onto those same three axes:

| Dance encodes… | …maps to a content axis |
|---|---|
| **Direction** (angle of the waggle run vs. vertical/sun) | **Topic / track** — which of the three paths a module belongs to (angle around a dial) |
| **Distance** (duration of the waggle; ~1 s per km) | **Depth** — beginner modules sit near the hive, advanced ones farther out. (Bees' own round-dance = "close", waggle-dance = "far" mirrors this exactly.) |
| **Quality / vigor** (waggle speed + repetitions) | **Recommendation strength** — the app plays scout and "dances hardest" toward the single best next module for this reader |

### Two ways to express it (build the simple one first)

**Tier A — "Follow the Dance" guided path (CORE, build this).**
A linear guided tour that sequences modules for the chosen track. The app acts
as the scout bee: it decodes a path and leads the reader module to module,
one "next" tap at a time, with a friendly line of framing between steps. This
is really just the reader (§2) with a predefined sequence and a progress
sense. Low risk, high payoff. Sequences:

- **Curious path:** 1 → 2 → 9 → 3. *(what it is → its story → the wonder of the
  dance → the "aha" of why it works). Ends on wonder + a soft "want to try?"*
- **Try-it path:** 1 → 3 → 4 → 5 → 6 → 7 → (CTA: log a hive / build a box).
  *(hook → theory → pick a method → SAFETY before you go → gear → do it → act).*
- **Maker path:** 3 → 9 → 4 → 6 → 8. *(theory → the science of the dance →
  method rigor → build the kit → the tech/Pathfinder limits + invite to help).*

Note Module 9 (the dance) sits in Curious and Maker but not Try-it — a first-
timer doesn't need it to succeed, while the curious and the makers love it.

**Tier B — "Waggle Compass" dial (STRETCH, optional, only if Tier A lands).**
A radial "dance floor" view (mocked up): the hive at center, modules arranged
by topic-angle and depth-radius, and the recommended next module *pulsing and
waggling* — its little dashed run literally pointing outward from the hive like
a real waggle run. "Follow the dance" from here launches the Tier-A tour.
Delightful, on-theme, and memorable for social clips — but it's decorative
navigation over the same underlying sequence, so it earns its place only after
the guided path exists and works. Do not build B before A.

### Honest caveats for whoever builds this
- Keep the metaphor legible without requiring the reader to have read Module 9.
  A newcomer should understand "the glowing one is what to read next" at a
  glance; the dance meaning is a delightful bonus, not a prerequisite.
- The "recommendation" logic can start dumb: next-unread-in-track. It does NOT
  need real personalization to feel good. Resist over-engineering the "vigor."
- Don't let the animation get busy. One subtle pulse on ONE node. The mockup's
  shimmy is intentionally gentle; a floor full of wiggling dots is noise.

---

## 5. Graphics Shot-List (SVG, honey palette, light + dark aware)

All illustrations should be clean flat SVGs in the app's palette (honey
`#f5a623`, dark `#141310`, cream surfaces, greens/browns for nature). Reusable
set, drawn once:

1. **Bee-line hero** — bee flying a dashed straight line from flowers to a
   distant tree. (Hub hero + Module 1.)
2. **A/B triangulation** — two lettered points, two bearing lines crossing at a
   bee tree. "Two lines, one answer." (Module 3/4.)
3. **Terrain chooser** — 2×2 grid (open field / blocked-by-river /
   single-vantage / dense woods) each with its recommended-method icon.
   (Module 4.)
4. **Bee-box cutaway** — two-compartment box: catch chamber, feed chamber with
   comb, sliding lid; plus a kit flat-lay (compass, marking pen, syrup,
   stopwatch). (Module 6.)
5. **Waggle-dance decoder** — bee on vertical comb mid-run, run angled from
   vertical, sun icon, equal-angle marks; labels angle=direction,
   length=distance, vigor=quality. Interactive: drag the sun, dance rotates.
   (Module 9 + the hook for the whole navigation motif.)
6. **Waggle Compass dial** — radial dance-floor: hive center, modules by
   angle+radius, recommended node pulsing/waggling. (Tier-B navigation, if built.)
7. **Round-trip timing strip** — a simple visual of the "under 3 min = close,
   20 min = a couple miles" odometer idea. (Module 3, optional.)

Interactive pieces (#5's drag-the-sun, any animation) are post-load JS — fine,
but keep them subtle and battery-cheap; people use this outdoors.

---

## 6. Build Order (suggested)

1. `Learn` tab + hub landing (static hero + path cards + module list).
2. Module reader pulling content from the guide; prev/next.
3. "Follow the Dance" guided sequences (Tier A) — just predefined orderings
   through the reader.
4. Graphics shot-list, drawn progressively (hero + Module 3 diagram first —
   they carry the most weight).
5. Module 9 interactive decoder (#5).
6. STRETCH: Waggle Compass dial (Tier B) — only if everything above is solid.

**Do not forget the cache rule:** any commit touching `app.js`, `styles.css`,
`index.html`, or a precached asset must bump `CACHE_VERSION` in `sw.js` in the
same commit (see SAVETHEHIVES_SPEC.md Known Gotchas). A Learn feature will
touch several of these.

---

## 7. Why this is worth building

The project's hardest problem isn't technology — it's recruiting people to go
outside and log wild colonies. Beelining is the activity that does that, and
almost nobody knows it exists. A warm, well-illustrated, honestly-scientific
Learn experience — with a hook ("a colony is near you right now"), a clear
"here's how," and a memorable motif (the bees have been beelining to each other
all along) — is the single best on-ramp from "curious visitor" to "citizen
scientist with a bee box." That's the whole game.
