<!--
SONNET_KICKOFF.md — paste the block below into a NEW chat running Claude Sonnet 5.
Written at the end of the Opus build-planning session with Ronnie, July 7 2026.
The approved visual reference is learn-module3-sample.html (same folder).
-->

# Kickoff message for the Sonnet build session

Copy everything between the lines into the first message of a new Sonnet 5 chat,
with this project folder connected.

---

You're picking up the **SaveTheHives "Learn" tab** build. Everything you need is
in this project folder. Read these three docs in this order before writing code:

1. **`LEARN_TAB_BUILD_BRIEF.md`** — how to build it. Read this first, especially
   **§1–2** (the settled decisions: placement, information architecture, and the
   data-driven content model) and **§6** (build order). Note the DECIDED items —
   don't relitigate them.
2. **`BEELINING_GUIDE.md`** — the content to load into the `MODULES` array. Each
   `## MODULE n` becomes one reader screen. Pull prose from here; don't
   re-author facts in code, so the two never drift.
3. **`CONTENT_LIBRARY_IDEAS.md`** — what comes after, for context on where this
   is heading. Not part of this build.

## What to build now — Tier A only

Build **Tier A: the "Follow the Dance" guided path** (brief §4) and the pieces it
needs, per the build order in §6:

1. The `Learn` tab + hub landing (hero, three path cards, module checklist).
2. The data-driven Module Reader (`renderModule()` from a `MODULES` array +
   `TRACKS` map — brief §2, "Content model — DECIDED").
3. The guided sequences (the three `TRACKS`: curious / tryit / maker).
4. Graphics progressively — hero + the Module 3 triangulation diagram first.

**Do NOT build the Waggle Compass dial (Tier B) yet.** Get Tier A solid first;
the dial is an explicit stretch that only earns its place once the guided path
works (brief §4, "Do not build B before A").

## Approved visual reference

`learn-module3-sample.html` in this folder is an **approved** full-fidelity
mockup of one Module Reader screen (Module 3), reviewed and signed off. Match its
look and feel — palette, chips, progress bar, numbered-fact cards, the round-trip
table, the SVG diagram treatment, ghost-Prev / honey-Next footer, light + dark.
It's a standalone preview; your job is to reproduce that treatment inside the app
via `renderModule()`, driven by data rather than hardcoded per-module HTML.

## Don't-forget rules from the brief

- **Nav slot:** reuse the hidden **Records** slot for Learn — keeps Pathfinder's
  `?pf=1` field-test wiring untouched (brief §1).
- **Soft locks only:** everything is browsable; the "lock" is a suggestion of
  order, not a gate (brief §2).
- **Safety first:** Module 5 (safety/ethics) must appear before any "go try it"
  CTA in every path (brief §3).
- **Cache rule:** any commit touching `app.js`, `styles.css`, `index.html`, or a
  precached asset MUST bump `CACHE_VERSION` in `sw.js` in the same commit
  (brief §6 / SAVETHEHIVES_SPEC.md Known Gotchas). This feature touches several.

Start by reading the three docs, then propose your file-level plan before writing.
