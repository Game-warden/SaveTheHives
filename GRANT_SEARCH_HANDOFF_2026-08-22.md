<!--
GRANT_SEARCH_HANDOFF.md — paste this into a new chat to kick off a grant
search for SaveTheHives. Written to be self-contained; the new chat won't
have seen any prior conversation.
-->

# SaveTheHives — Grant Search Handoff (2026-08-22)

## What SaveTheHives is

SaveTheHives (savethehives.org) is a free, volunteer-run citizen science
Progressive Web App that maps **non-managed (feral/wild) honeybee
colonies** — living with no beekeeper, no mite/disease treatment, no
human intervention — across North America, with some international
interest developing too.

**Core scientific angle:** colonies that survive 3+ winters untreated are
candidates for real, heritable Varroa-mite resistance — the project calls
these "Genetic Goldmines." This framing has been reviewed and approved by
the project's scientific advisor, **Dr. David Tarpy** (University Faculty
Scholar Professor & Extension Apiculturist, NC State University,
Department of Applied Ecology).

**History:** started 2008 as "The Feral Bee Project" out of NC State
(Tarpy was involved from the beginning), went dark around 2015-2018,
relaunched in 2026 by founder Ronnie Bouchon with the original ~1,150+
legacy records intact and growing, plus a fully rebuilt app.

**What people do on it:** two core actions — **Add** (log a newly found
wild colony) and **Check In / Validate** (confirm whether a previously
logged colony is still active). No equipment or experience needed.

**Tech stack / cost structure (relevant to any "sustainability" or
infrastructure grant questions):** Cloudflare Pages (static hosting,
free tier), Supabase (Postgres database + auth + photo storage, free
tier), Leaflet.js mapping with CartoDB/Stadia Maps tiles (free/metered
free tier). No paid staff, no ad revenue, no current monetization —
genuinely a spare-time volunteer project with near-zero running cost
today. That could change if it scales (e.g. Stadia Maps tile overage,
Supabase storage/row limits).

## Current traction (as of Aug 2026)

- Just listed on **SciStarter's Project Finder** (their citizen-science
  project directory) — approved Aug 10, 2026.
- Active outreach in progress to ~30 university bee/pollinator
  researchers nationwide (tracked in `University_Bee_Research_Contacts.xlsx`),
  several already "Emailed - Awaiting Reply," a few genuine warm
  connections in motion (see below).
- Active outreach to 100+ "legacy" hive submitters from the original
  2008-2017 dataset, asking them to re-validate old records or log new
  ones — good early response rate, several real leads already surfaced
  (e.g. a submitter in Washington state who just logged multiple new
  hives from a single re-engagement email).
- A warm introduction chain in progress at NC State: Tarpy → his
  colleague Rob Dunn → **Dr. Caren Cooper**, the university affiliate
  for SciStarter's "Citizen Science Campus" program at NC State — intro
  email scheduled to send this week. If that connects, it opens a
  pipeline to NC State course-credit projects, undergrad research
  credit, and an annual "Wolfpack Citizen Science Challenge."
  Citizen Science Campus program page: citizenscience.ncsu.edu
- Reaching out to international "kindred" citizen-science projects doing
  the same core thing for wild/feral bees: **Honey Bee Watch** (COLOSS
  Survivors Task Force, int'l), **BeeWild** (Edmund Mach Foundation,
  Italy/Europe), **BEEtree-Monitor** (Germany) — early friendly contact
  made with BEEtree-Monitor's founder.
- A permitted research partnership lead: **Ryan Ross / Jenifer Tucker**
  hold an active NC Wildlife Resources Commission scientific research
  permit to trap feral honeybees across 90,000 acres of Holly Shelter
  Gameland (coastal NC) — outreach sent, awaiting reply. This is a
  potential model for state-wildlife-agency-adjacent partnerships.
- Local beekeeping association relationship building underway (Wake
  County Beekeepers Association) — invited to speak at a meeting,
  date still being worked out.

Full detail on all of the above lives in `KEY_PEOPLE_CONTACTS.md`,
`University_Bee_Research_Contacts.xlsx`, `Legacy_Submitter_Outreach_Tracker.xlsx`,
and `Kindred_Bee_Projects.xlsx` in the project repo, if the new chat has
repo access and wants specifics.

## Open question the new chat should raise early, not assume

**Legal/organizational status is unclear from the repo** — I found no
evidence of 501(c)(3) incorporation, fiscal sponsorship, or any formal
entity. The project currently reads as an individual-run, informal
volunteer effort. This matters a lot for grant eligibility: many
foundation and government grants require a 501(c)(3) or a fiscal
sponsor to receive funds; others (fellowships, small "seed" or
individual-innovator grants, some citizen-science-specific funds) don't.
**Ask Ronnie directly, early in the new chat, what SaveTheHives'
current legal/tax status is** (informal project / sole proprietor /
applied for nonprofit status / has a fiscal sponsor / open to getting
one) before spending time on grants that require an EIN or 501(c)(3)
letter — that answer should shape which grant categories are even worth
surfacing.

## What kind of grants would be genuinely symbiotic (starting angles for research)

- **Citizen science / public participation in science** funders (e.g.
  the kind of programs SciStarter itself surfaces, NSF's Advancing
  Informal STEM Learning program, Cornell Lab of Ornithology-adjacent
  citizen-science funds, National Geographic Society explorer/early
  career grants) — SaveTheHives is a clean fit on mission alone.
- **Pollinator conservation / biodiversity** funders (state wildlife
  grant programs, USDA pollinator health initiatives, private
  foundations focused on pollinator decline) — the Varroa-resistance
  angle and the Holly Shelter Gameland state-permit partnership are
  strong, concrete talking points here.
- **University/extension partnership or seed-funding programs** tied to
  NC State specifically, given the Tarpy relationship and (pending)
  Caren Cooper / Citizen Science Campus connection — sometimes these
  come with small internal seed grants for community-science
  collaborations.
- **Open data / civic tech / small nonprofit tech infrastructure**
  grants (e.g. programs that fund hosting/scaling costs for public-good
  data projects) — relevant given the project is entirely
  volunteer-built with no paid infrastructure budget today.
- **Environmental education / youth STEM** angles — the existing NC 4-H
  beekeeping education programs and Scout-troop-friendly design of the
  app (mentioned in the spec doc) could support a proposal aimed at
  youth engagement rather than pure research.

These are starting hypotheses, not a researched shortlist — that's the
actual task for the new chat.

## The actual ask for the new chat

Research **currently open, real grant opportunities** (not just funder
categories) that would be a good mission fit for SaveTheHives, given the
above. For each one found, note: funder name, program name, typical
award size, deadline (or "rolling"), eligibility requirements (especially
whether 501(c)(3)/fiscal sponsorship is required), and a one-line note on
why it fits. Flag anything time-sensitive. Start broad, but prioritize
opportunities realistically reachable for an early-stage, currently
informal, volunteer-run project rather than large institutional grants
that would require university or nonprofit backing SaveTheHives doesn't
have yet.
