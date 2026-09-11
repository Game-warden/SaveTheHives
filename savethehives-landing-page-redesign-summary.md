# SaveTheHives.org — Landing Page Redesign Summary

Handoff doc from a design-review conversation. **No live code has been changed** — this is all mockup/direction work so far. Mockup HTML files referenced below were created as visual references, not production code.

## Context / current live site
- Live site: `https://savethehives.org/`, volunteer app at `https://savethehives.org/app/`
- Current nav behavior (as of last check): the three action cards link to `/app/?onboard=validate|add|learn`; "Explore the map" links to `/app/`; the "Why do untreated colonies matter?" teaser is a same-page anchor scroll (`#why-it-matters`) to a fuller section further down the same landing page.
- Real hero copy currently on the site: subtitle "Feral Honeybee Mapping Network," headline "Could there be a wild bee colony within a mile of you?", stat line "1,149 of the 1,158 wild colonies we've found haven't been checked on in years," followed by CTA, three action cards, a short why-it-matters teaser, then the full "Genetic Goldmines" explanation (stats, oak-tree photo, researcher quote) further down.

## Agreed direction (confirmed by Ronnie)
1. **Keep the first page short.** Don't compress the full "why it matters" content onto the landing page — instead, treat it as a fourth clickable doorway leading to its own dedicated page, same pattern as the other three actions (which already route to `/app/`).
2. **Four doorways, in this order:**
   1. **Why it matters** (moved to *first* position — this was explicitly requested) → own dedicated page with the full stats (30–50% managed-colony loss rate, "3+ winters unaided = Genetic Goldmine"), the oak-tree photo, full narrative, and the researcher quote ("Every pin on the map is a lead...").
   2. Validate a honeybee colony → app
   3. Report a new honeybee colony → app
   4. Learn to find one → app
3. Secondary link below the doorways: "Explore the map →" → `/app/`
4. Tagline wording: **"long-surviving"**, not "longest-surviving."
5. Say **"honeybee colony"** instead of just "colony" wherever there's room (headline, impact stat, Validate/Report doorway titles, CTA button). Exception left as-is: "Learn to find one" — "one" there already refers back to the honeybee colony named just above it, so it wasn't changed.
6. Scientific-credibility line: keep it light, not overclaiming. Confirmed so far — **one paper explicitly cites SaveTheHives.com by name** (Youngsteadt et al. 2015, *Insects*/MDPI, "Within-Colony Variation in the Immunocompetency of Managed and Feral Honey Bees"). A second paper from the same NC State author group (Youngsteadt et al. 2015, *PLOS ONE*, "Urbanization Increases Pathogen Pressure on Feral and Managed Honey Bees") also explicitly cites SaveTheHives.com per a later search pass. A third, related paper (López-Uribe et al. 2017, *Conservation Genetics*) builds on the same dataset but its direct citation of SaveTheHives.com by name was **not confirmed**. Do not claim "three published articles" without further verification. Note: Tarpy + Delaney + Seeley's 2015 PLOS ONE mating-frequency paper is a **different, unrelated feral population** (Arnot Forest, NY) — not sourced from SaveTheHives.

## Open / unresolved decisions
- **Duplicate CTA issue (flagged by Ronnie, not yet resolved):** "Validate a honeybee colony" currently appears twice — once as a doorway, once as a persistent/sticky CTA button. Two options on the table:
  - (a) Keep all 4 doorways, drop the separate sticky CTA entirely.
  - (b) Keep one dominant sticky/primary CTA, drop "Validate" from the doorway list (leaving 3 doorways: Why it matters, Report, Learn).
- **Visual style direction toward iNaturalist.org** (requested, not yet detailed): Ronnie likes iNaturalist's look and feel. Not yet clarified which aspects — candidates discussed: clean white background + green accent color, card-based/photo-forward layout, minimal/quiet typography. Current mockups use an illustrated meadow background + cream card + orange CTA aesthetic, which is a different visual language than iNaturalist and would need deliberate reconciliation, not just a color swap.
- Whether the full "why it matters" page keeps the oak-tree photo and full narrative unabridged (intent is yes, not yet mocked up as its own page).

## Mockup files produced (for visual reference only, not final)
1. `savethehives-hero-mockup.html` — first pass, invented placeholder copy, why-card moved up.
2. `savethehives-full-mockup.html` — added impact strip, credibility line, sticky CTA, desktop side panel.
3. `savethehives-real-content-mockup.html` — rebuilt using actual site copy/stats/quote pulled from the live page.
4. `savethehives-four-doorways-mockup.html` (latest, v2) — current agreed structure: short first page, four doorways with "Why it matters" first, "honeybee colony" wording applied. **Still has the unresolved duplicate-CTA issue described above.**

## Suggested next steps in Claude Code
- Resolve the duplicate-CTA decision and the iNaturalist styling direction (colors, typography, card treatment) before touching production code.
- Build the actual "Why it matters" as a new route/page (e.g. `/why-it-matters/` or similar, consistent with the existing `/app/` pattern) rather than the current same-page anchor.
- Update hero copy: tagline, headline, and doorway labels per the wording decisions above.
