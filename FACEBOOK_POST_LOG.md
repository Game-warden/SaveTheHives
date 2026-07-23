<!--
FACEBOOK_POST_LOG.md — running log for the weekly SaveTheHives Facebook
content digest (scheduled task: savethehives-fb-weekly-digest).

Purpose: the scheduled task that generates each week's post package runs
stateless (no memory of past runs or conversations). This file is how it
tracks what's already been suggested, so it doesn't repeat itself and
knows where to pick up next. The task reads this file at the start of
every run and appends a new entry at the end after generating that
week's content.

Format: reverse-chronological is NOT required — just append new entries
at the bottom under "## Log". Keep entries short.

"## Posted" is a separate table for actual publish confirmation
(posterity record). The automated Sunday task cannot see Facebook itself,
so it only ever logs what was SUGGESTED, not what actually went live.
Ronnie confirms actual posting in any chat ("Post 4 is live") and Claude
adds/updates the row then — not part of the automated weekly run.
-->

# SaveTheHives — Facebook Content Log

## Status

- **Launch sequence (FACEBOOK_STARTER_PACK.md §3):** All 5 posts now suggested/assigned as of this run (Jul 21 2026). The Pinned Post (§2) was already published and pinned manually on Jul 20–21 2026, before this log/task existed.
- **Next up:** Launch sequence complete after Post 5 (Aug 2). Next scheduled run should switch to the ongoing Mon/Wed/Sun rotation (§4/§5) — mixing fixed categories with a fresh research hook for the Monday science slot.
- **Reserved for Monday Aug 3 2026 (first ongoing-rotation Monday):** a ready, pre-verified research-hook post is already written and waiting in `FACEBOOK_STARTER_PACK.md` §4 — "Why do queens mate so much?", covering Tarpy/Delaney/Seeley (2015, PLOS ONE) on queen mating frequency in feral colonies. Both authors are already in `KEY_PEOPLE_CONTACTS.md`, so this is exactly the kind of match the expert-authorship check (Part A step 2 of the scheduled task) is meant to catch — but it's already been found, verified against primary sources, and written, so the Jul 26/Aug 2 run should use this directly for Aug 3 rather than searching for a new hook that week. Resume normal fresh-hook searching the Monday after (Aug 10).
- **Ongoing-category rotation pointer:** not yet started — begins with the run after this one.

## Log

(Entries will be appended here by each scheduled run — format: date, which post(s) were included in that week's digest, and category used.)

- **Jul 20 2026** — Manually delivered in-chat (Ronnie wanted to get ahead of the first scheduled Sunday run so he'd have posts up before sending 188 friend invites). Posts 1, 2, and 3 from the launch sequence assigned to Mon Jul 20 / Wed Jul 22 / Sun Jul 26. Posts 4 and 5 remain queued — the automated digest should pick up with those on its next run (Sun Jul 26, 6pm) for the following week (Jul 27 onward).
- **Jul 21 2026** (ad-hoc/off-cycle run, not a Sunday) — Digest queued the two remaining launch-sequence posts: Post 4 (The bigger why / research framing) assigned Mon Jul 27, Post 5 (Call for founding contributors) assigned Sun Aug 2. No research hook needed this run (launch sequence, not yet in ongoing rotation). Rebuilt SaveTheHives_FB_Posts.ics to cover Jul 21–Aug 4 (today + 2 weeks): includes Posts 2 (Jul 22), 3 (Jul 26), 4 (Jul 27), and 5 (Aug 2) — Post 1 (Jul 20) excluded as already past.

## Posted (actual publish record, confirmed by Ronnie)

| Post | Title | Suggested date | Actually posted (date/time) | Notes |
|---|---|---|---|---|
| Pinned | Pinned post (§2) | — | Jul 20–21 2026 | Published and pinned manually, before this log existed |
| 1 | The hook | Jul 20 2026 | *unconfirmed* | |
| 2 | Beelining | Jul 22 2026 | *unconfirmed* | |
| 3 | Validate/Map screenshot | Jul 26 2026 | *unconfirmed* | |
| 4 | The bigger why | Jul 27 2026 | *unconfirmed* | |
| 5 | Call for founding contributors | Aug 2 2026 | *unconfirmed* | |
