<!--
HANDOFF_2026-08-09_outreach-continued_1.md — paste the block below into a new
chat titled "Save the Hives outreach strategy-continued_1" to continue with
minimal context loss. Not a permanent project doc — safe to archive or delete
once the punch list here is cleared. Supersedes
HANDOFF_2026-07-30_outreach-focus.md (that one's items are folded in below
where still relevant; safe to delete once you confirm this one has what you
need).
-->

# Handoff prompt — paste into new chat

Continuing work on SaveTheHives (plain-script PWA at savethehives.org, repo
folder SaveTheHives-pwa-claude, deployed via Cloudflare Pages, backend on
Supabase). Before we start, read CLAUDE.md and SAVETHEHIVES_SPEC.md, and
check saved memory for this project. Also skim `KEY_PEOPLE_CONTACTS.md` and
`DONT_FORGET.md` — both were substantially updated in the last session and
are the source of truth for contacts/leads and deferred items.

**Current state, as of 2026-08-09** — everything below is done and verified
this session unless flagged otherwise:

## Shipped / resolved this session

- **SciStarter Project Finder listing** — submitted, live pending editorial
  review at scistarter.org/savethehives. **Still open:** never got Ronnie's
  confirmation on whether to trim "College, Graduate students" back out of
  the "Who should participate?" field — it currently shows "College,
  Graduate students, Families, Adults." Worth a direct yes/no before or
  after the listing gets approved.
- **Google Search Console** — Domain property verified (Cloudflare OAuth),
  sitemap submitted successfully (fix was: Domain properties need the full
  absolute URL, not a relative path). Page-indexing issues reviewed:
  "Page with redirect" confirmed as expected/no-action (non-canonical
  www/http variants correctly redirecting); "Duplicate without
  user-selected canonical" fixed via a `<link rel="canonical">` tag added
  to `app/index.html` (commit `734491f`, SW cache bumped to v2.13.4),
  deployed and live. **Worth checking:** whether GSC's "Validate Fix" for
  the canonical-tag issue has finished processing (was "Pending" as of last
  check).
- **Wake County Beekeepers intro email** — finalized (`wake-county-beekeepers-email.html`),
  scheduled for Wed Aug 12, 9:00 AM, no attachment. **Confirm it actually
  sent** if this session starts after that date.
- **Tarpy follow-up email** — rewritten as a reply within the existing
  "SaveTheHives outreach" thread (not a new email), scheduled Tue Aug 11,
  9:00 AM (`tarpy-followup-email.html`). Content: thanks for the new
  contacts + bio, asks about the NC State Citizen Science Campus
  connection, and one still-open ask (a beekeeping contact near Uwharrie
  National Forest). **Confirm it sent** if this session starts after Aug 11.
- **Dr. Tarpy's bio** — received (`BioSketch-Research_DRTarpy.docx`, also
  saved to repo root), full text now in `KEY_PEOPLE_CONTACTS.md`. Decision:
  use as-is, no follow-up ask to shorten/customize it. Not yet placed
  anywhere on the actual site — that's a still-open next step if Ronnie
  wants it live.
- **New contacts/leads resolved via the "FUP from our meeting" (Jul 28-29)
  email thread**, all now in `KEY_PEOPLE_CONTACTS.md`:
  - **Devin Gentry** (Cradle of Forestry in America) — confirms the Pisgah
    NF Heritage Site lead, not yet contacted.
  - **Boris Baer** (UC Riverside, CIBER founder) — SoCal Africanized-bee
    contact. Also surfaced independently: a directly on-thesis April 2026
    *Scientific Reports* study (his co-authorship) showing SoCal
    feral/hybrid honeybees have ~68% fewer Varroa mites than commercial
    queens — added to both `KEY_PEOPLE_CONTACTS.md` and
    `University_Bee_Research_Contacts.xlsx` (row 31). Not yet contacted;
    worth a personally-written email citing that study.
  - **Ryan Ross & Jenifer Tucker** (Holly Shelter Gameland, NC — corrects
    an earlier "Great Dismal Swamp" mix-up) — active NC Wildlife
    Commission-permitted feral-colony research project, 90,000 acres,
    already connected to both Tarpy and Seeley. Outreach email drafted
    (`ryan-ross-email.html`) — **Ronnie is scheduling/sending this himself
    this week, not yet confirmed sent.**
  - **NC State Extension** — closed out; David confirmed there's no good
    individual contact through the county extension office.
- **University_Bee_Research_Contacts.xlsx merge** — Ronnie's own in-progress
  edits (real Date Emailed / Status updates for Grozinger, vanEngelsdorp,
  Dolezal, Christman, Tashakkori, Delaney, Mahood) were merged back into the
  canonical file without losing anything; Seeley/Spivak/Delaplane correctly
  stayed "No Longer Pursuing" per Tarpy's retirement flag.
- **Google Sheets ↔ local file sync, fixed for good** — this was a real mess:
  six-plus disconnected duplicate Sheets had silently accumulated in
  Ronnie's Drive over the life of the project (each "Open With Google
  Sheets" or auto-upload created a new copy instead of updating one file).
  Root cause traced to Chrome's "Google Docs Offline" / "Office Editing for
  Docs, Sheets & Slides" extensions muddying the link. Ronnie uninstalled
  them, relinked, and it's now a confirmed **live, working bidirectional
  link** — verified end-to-end with a real edit-and-read-back test in both
  directions. All stray duplicate Sheets have been manually cleaned up on
  Ronnie's end. **Going forward: the xlsx file in the repo folder is the
  single source of truth; Ronnie edits via the one linked Google Sheet tab
  he keeps open, refreshing manually to see updates from this side.**
- **DONT_FORGET.md created** — running list with explicit revisit triggers.
  Currently two entries: SciStarter Affiliate/Participation API (revisit
  once the listing is live and getting real traffic) and the Cloudflare KV
  visit-counter noise caveat (revisit before using those numbers externally,
  or if the count climbs a lot further).

## Carried forward from before (still open, lower priority unless raised)

- **~188 pending friend invites** — Ronnie wants reminders to send these
  gradually, timed to land after fresh content goes live. Not touched this
  session.
- **Facebook weekly digest** — was running on schedule as of Jul 30; not
  checked this session, worth a status glance if it's been a while.
- **Recurring "Send Link" sign-in failure** — unresolved root cause
  (email-never-arrives path, Resend/Supabase dashboards never actually
  checked). Hasn't recurred in recent testing but not confirmed fixed.
- **Duplicate onramp overlay, "Why non-managed colonies matter" dedicated
  URL, Validated-hive visual credit + filter** — all still undecided/not
  built, see `SAVETHEHIVES_SPEC.md` §11 for detail.

Let me know what you want to pick up first — my instinct is confirming
whether the two scheduled emails (Wake County Aug 12, Tarpy Aug 11) actually
sent, then the Ryan Ross email once Ronnie's ready to schedule it.
