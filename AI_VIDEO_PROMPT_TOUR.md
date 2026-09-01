<!--
AI_VIDEO_PROMPT_TOUR.md — a self-contained creative brief/prompt for generating
the "what SaveTheHives is all about" mission/tour video, for use with an
AI video-generation or voiceover tool (Runway, Pika, Sora, HeyGen, ElevenLabs
+ a video editor, etc.), or for briefing a human editor.

Written so it can be pasted in whole, with no other context needed — the
tool or person using it doesn't need to have seen this repo or any prior
conversation.
-->

# SaveTheHives — "What We're All About" tour video: generation prompt

## 1. Project background (read this first — needed for accurate generation)

SaveTheHives (savethehives.org) is a free, volunteer-run citizen science
project that maps **non-managed honey bee colonies** — wild colonies living
with no beekeeper, no mite/disease treatment, and no human intervention —
across North America.

**Why it matters:** managed honey bee colonies lose roughly 30–50% of their
population most years, and mostly only survive because beekeepers treat
them constantly for Varroa mites and disease. Take the treatments away and
most managed colonies die within a couple of winters. But some wild
colonies persist on their own, year after year, with zero help. Those
survivors may be carrying natural genetic resistance to the exact problems
wiping out managed hives — a real, scientifically valuable lead. The
project calls these "Genetic Goldmines": not because the genetics are
proven yet, but because each surviving colony is a real candidate worth
studying.

**History:** the project started in 2008 as "The Feral Bee Project," when
Ronnie Bouchon (an active beekeeper at the time) met Dr. David Tarpy at an
NC State beekeepers meeting. Researchers needed known locations of wild
colonies for genetic sampling tied to Colony Collapse Disorder research, so
they built a simple web map for anyone to log what they found. It grew to
1,000+ records and even had an iPhone app before going dark around 2015.
Those original records never disappeared — SaveTheHives (relaunched 2026)
is that same map, revived, with over 1,150 legacy records already loaded
and growing. Dr. Tarpy is back on board as scientific advisor.

**What anyone can do on the site, in two ways:**
- **Add** — log a wild colony you've found (a pin, a few details — no
  equipment or experience needed).
- **Check In** — confirm whether a colony already on the map is still
  active. The app can auto-suggest the closest unconfirmed hive to you.

**Site structure:** `savethehives.org` (root) is a public landing page
introducing the mission. The actual interactive app — map, Add, Check In,
Learn — lives at `savethehives.org/app/`.

**Guardrails — do not violate these when generating:**
- Don't invent or imply statistics beyond what's stated above.
- Don't depict or caption any AI-generated or stock imagery as if it shows
  a real, specific, user-submitted hive record — keep nature/tree/bee
  visuals generic and illustrative, not tied to a real logged colony.
- Don't show or claim features that aren't live in the app (no "Genetic
  Goldmine badges," no "Guardian Network," no DCA mapping — those are
  future vision, not current functionality).
- Tone is warm and plainspoken, not corporate or academic. No hype-voice,
  no "unlock/leverage/empower" language, no exclamation points stacked up.

## 2. Objective

Produce one short vertical video that works as a **mission/tour piece** —
broader and more emotionally framed than a how-to demo — to run as a
Facebook Reel. It should make a stranger understand, in under 30 seconds,
why wild bee colonies matter and how easy it is to help find them.

## 3. Format specs (Facebook Reels)

- **Resolution:** 1080×1920 (9:16 vertical). 1080 wide is the FB-recommended
  width; do not go below 540×960.
- **Length:** 20–30 seconds ideal (hard range 3–90s allowed, but shorter
  performs better). Target ~25s for this piece.
- **Frame rate:** 30fps.
- **Codec/container:** MP4, H.264 video + AAC audio, 48kHz.
- **File size:** under 1GB (easily met at this length/resolution).
- **Captions:** burned-in captions are required, synced to the voiceover —
  most Facebook viewers watch with sound off. Keep caption text large,
  high-contrast, centered in the safe zone (see below).
- **Safe zones:** keep essential text/logo out of the bottom ~250px and top
  ~150px of the 1920-tall frame — Facebook's Reels UI (caption text,
  profile handle, like/comment/share icons) overlays those areas.
- **Audio:** this video *does* carry a voiceover + light ambient/music bed
  (unlike the silent How-To clips already produced) — mix voice clearly
  forward, music low enough that captions aren't needed to follow along
  but are still provided per above.

## 4. Assets to use

### Real screenshots to capture fresh (from the live site, not mockups)
Capture at 1080×1920 or crop/pad to fit:
1. Landing page hero section (`savethehives.org`) — the mission hook.
2. The "three ways to help" cards section on the landing page.
3. The Map view (`/app/`) zoomed to a real cluster of pins.
4. A single hive detail card (tap a pin) — use a record where
   `allow_contact`/contact info isn't exposed, and no personal submitter
   name is left visible on screen (blur it if one appears, same treatment
   already used in the Check In how-to video).
5. The Learn tab hub (cards view).
6. The About tab mission text.

### Existing real/generated assets already in the repo — reuse these, no need to regenerate
- `images/oak-tree-colony.jpg` — bees at a hollow in an oak trunk, forest
  setting. Directly usable as the opening "wild colony in a tree" visual.
- `images/meadow-hero.jpg` — wildflower meadow, useful as a transition/
  b-roll shot.
- `images/honeybee-on-comb.jpg` — macro bee-on-comb close-up.
- `images/teaser-bee.mp4` + `images/teaser-bee-poster.jpg` — an existing
  short animated bee asset already built for the landing page teaser;
  check if its motion/style fits before generating anything new.
- `logo.jpg` — for the end card.

### AI-generated supplemental assets (only if the above aren't enough coverage)
If additional b-roll is needed, generate images/short clips with prompts
like these (keep photorealistic, no on-image text, no people's faces):
- "A wild honeybee colony's entrance in a knot of a large oak tree trunk,
  dappled forest sunlight, shallow depth of field, photorealistic,
  documentary nature photography style."
- "Close-up macro shot of a single honey bee foraging on a wildflower,
  soft natural light, shallow depth of field, photorealistic."
- "Wide shot of a sunlit deciduous forest canopy from below, looking up,
  photorealistic, calm and warm color grade."
Avoid stylized/illustrated looks — match the photographic tone of the
existing real assets above so the video doesn't feel visually inconsistent.

## 5. Voiceover script (~25s at a natural pace)

> Somewhere near you, there's probably a wild honeybee colony living
> completely on its own — no beekeeper, no treatments, no help.
>
> Most managed hives don't survive that without constant care. But some
> wild ones do, year after year — and that might mean they're carrying
> natural resistance the whole industry needs.
>
> SaveTheHives is a free, volunteer-run project mapping these survivors
> across North America. Find one, log it, or check in on one already on
> the map — takes under a minute, no experience required.
>
> Every pin is real data. Every colony is a lead worth following.
>
> SaveTheHives dot org.

**Voice direction:** warm, conversational, unhurried — like someone
genuinely telling you about a project they care about, not an ad narrator.
American English, moderate pace (~150 words/min), minimal audio
processing/reverb — the DIY, volunteer-run authenticity is part of the
brand, not something to polish away.

## 6. Visual sequence (storyboard)

All assets below are already captured/extracted and live in this repo —
five fresh captures under `video-assets/` (pulled 2026-08-17 from the live
site and from the finished How-To Reels) plus four pre-existing repo
images. Order, timing, and exact voiceover text per shot:

| # | Time | File (relative to repo root) | Voiceover text |
|---|---|---|---|
| 1 | 0:00–0:04 | `images/oak-tree-colony.jpg` | "Somewhere near you, there's probably a wild honeybee colony living completely on its own — no beekeeper, no treatments, no help." |
| 2 | 0:04–0:07 | `images/honeybee-on-comb.jpg` | "Most managed hives don't survive that without constant care." |
| 3 | 0:07–0:13 | `images/meadow-hero.jpg` | "But some wild ones do, year after year — and that might mean they're carrying natural resistance the whole industry needs." |
| 4 | 0:13–0:18 | `video-assets/asset_landing_hero.jpg` (fresh capture, crop/pad to vertical) | "SaveTheHives is a free, volunteer-run project mapping these survivors across North America." |
| 5 | 0:18–0:22 | `video-assets/asset_map_cluster.jpg` | "Find one, log it, or check in on one already on the map —" |
| 6 | 0:22–0:23.5 | `video-assets/asset_add_nav_highlight.jpg` | "takes under a minute," |
| 7 | 0:23.5–0:25 | `video-assets/asset_checkin_nav_highlight.jpg` | "no experience required." |
| 8 | 0:25–0:27 | `video-assets/asset_hive_card_blurred.jpg` | "Every pin is real data." |
| 9 | 0:27–0:29.5 | `video-assets/asset_map_cluster.jpg` (reused, wide view) | "Every colony is a lead worth following." |
| 10 | 0:29.5–0:31 | `logo.jpg` | "SaveTheHives dot org." |

## 7. Output deliverable

- Single MP4 file, spec as in §3.
- Suggested filename: `savethehives-tour-video-v1.mp4`
- Deliver alongside a plain-text caption for the Facebook Reel post itself
  (separate from the burned-in captions) — short setup line + link, matching
  the established page voice (see `FACEBOOK_STARTER_PACK.md`).
