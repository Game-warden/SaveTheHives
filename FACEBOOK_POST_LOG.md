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

- **Launch sequence (FACEBOOK_STARTER_PACK.md §3):** All 5 posts suggested/assigned (as of Jul 21 2026 run) and now fully scheduled through Aug 2 (as of Jul 26 2026 run). The Pinned Post (§2) was already published and pinned manually on Jul 20–21 2026, before this log/task existed.
- **Ongoing Mon/Wed/Sun rotation:** started with the Jul 26 2026 run. First ongoing Wednesday post (Jul 29, Triangulation) and second (Aug 5, bee ID) are new content, not pre-written in the starter pack. First ongoing Sunday post proper is Aug 9 ("How this started," pulled from the §4 ready post).
- **Reserved for Monday Aug 3 2026 (first ongoing-rotation Monday):** the ready, pre-verified research-hook post from `FACEBOOK_STARTER_PACK.md` §4 — "Why do queens mate so much?" (Tarpy/Delaney/Seeley 2015, PLOS ONE) — was used as-is per the standing note below; both authors already confirmed in `KEY_PEOPLE_CONTACTS.md`, no new search needed.
- **Aug 3–16 2026 now fully scheduled (as of Aug 2 2026 run):** Mon Aug 3 (queen-mating research hook, above) · Wed Aug 5 (bee ID) · Sun Aug 9 (How this started) · Mon Aug 10 (fresh research hook — Baer et al. 2026 CA hybrid-bee Varroa resistance, UC Riverside CIBER; possible new contact lead flagged, not yet added to `KEY_PEOPLE_CONTACTS.md`) · Wed Aug 12 (The whole toolkit fits in a box — needs Ronnie's own photo attached) · Sun Aug 16 (About this project full post, used as a fill-in judgment call — swap out if a found-colony spotlight or Tarpy's bio synopsis arrives first).
- **Next up:** resume fresh Monday research-hook searching starting Aug 17 2026. Next ongoing Wed/Sun slots to fill after Aug 16.

## Log

(Entries will be appended here by each scheduled run — format: date, which post(s) were included in that week's digest, and category used.)

- **Jul 20 2026** — Manually delivered in-chat (Ronnie wanted to get ahead of the first scheduled Sunday run so he'd have posts up before sending 188 friend invites). Posts 1, 2, and 3 from the launch sequence assigned to Mon Jul 20 / Wed Jul 22 / Sun Jul 26. Posts 4 and 5 remain queued — the automated digest should pick up with those on its next run (Sun Jul 26, 6pm) for the following week (Jul 27 onward).
- **Jul 21 2026** (ad-hoc/off-cycle run, not a Sunday) — Digest queued the two remaining launch-sequence posts: Post 4 (The bigger why / research framing) assigned Mon Jul 27, Post 5 (Call for founding contributors) assigned Sun Aug 2. No research hook needed this run (launch sequence, not yet in ongoing rotation). Rebuilt SaveTheHives_FB_Posts.ics to cover Jul 21–Aug 4 (today + 2 weeks): includes Posts 2 (Jul 22), 3 (Jul 26), 4 (Jul 27), and 5 (Aug 2) — Post 1 (Jul 20) excluded as already past.
- **Jul 28 2026** (ad-hoc, not a scheduled run) — Ronnie supplied a real photo of a bee-lining box in a wildflower field; drafted a new ready post around it, "The whole toolkit fits in a box" (see `FACEBOOK_STARTER_PACK.md` §4), suggested for the next open Wednesday practical slot (Aug 12 2026). Deliberately kept separate from the Aug 5 bee-box post, which uses the app's watercolor illustration instead — same subject, different image, so they don't compete for the same slot or feel repetitive back-to-back.
- **Jul 26 2026** (scheduled Sunday run) — Launch sequence now fully queued (Post 5 was already assigned Aug 2 as of the Jul 21 run), so this run started the ongoing Mon/Wed/Sun rotation for the first time. Digest covered the coming week (Jul 27–Aug 2): Post 4 (Mon Jul 27, launch sequence, unchanged) · new Wednesday practical/recruiting post "Triangulation — you caught the line, now what?" (Wed Jul 29, first ongoing-rotation Wednesday, no ready post existed for this slot so new copy was generated using the real `images/learn-triangulation.jpg` asset) · Post 5 (Sun Aug 2, launch sequence, unchanged). No Monday research hook needed this week — Jul 27's Monday slot is still launch-sequence Post 4, not the ongoing rotation. Rebuilt SaveTheHives_FB_Posts.ics to cover Jul 27–Aug 9 (today + 2 weeks, Post 3/Jul 26 excluded as already past by evening). Beyond the digest week, the .ics also had to be populated further out: the reserved "Why do queens mate so much?" research hook (Mon Aug 3 — expert-authorship match already found and confirmed pre-existing: Tarpy + Delaney both in KEY_PEOPLE_CONTACTS.md, no new search needed this week), a new second Wednesday practical post "Not every nest is a honey bee colony" (bee ID/logging-accuracy angle, Wed Aug 5, uses `images/learn-bee-box.jpg`), and the ready "How this started" origin post (Sun Aug 9, no dedicated image asset exists — flagged for Ronnie, falls back to the already-used map screenshot). Next run should resume fresh Monday research-hook searching starting Aug 10 (per the standing note above) and pick up the next ongoing Wed/Sun slots after Aug 9.
- **Aug 2 2026** (scheduled Sunday run) — Digest covered the coming week (Aug 3–9): the reserved "Why do queens mate so much?" post ran as-is (Mon Aug 3, expert-authorship match already confirmed pre-existing — no new search needed) · "Not every nest is a honey bee colony" ran as-is (Wed Aug 5) · "How this started" origin post ran as-is (Sun Aug 9). Resumed fresh Monday research-hook searching as scheduled: found Baer et al. (2026), *Scientific Reports* 16:10952, "Varroa mite resistance in a hybrid honey bee (Apis mellifera) population in Southern California" (UC Riverside CIBER) for the Mon Aug 10 slot — directly on-thesis (hybrid population that "survives and persist without human intervention" shows lower Varroa burden). Expert-authorship check: no direct name match in `KEY_PEOPLE_CONTACTS.md`, but flagged lead author Boris Baer / UC Riverside CIBER as a likely match for the existing "Southern California Africanized bee research group" Unconfirmed Lead (Tarpy's SoCal collaborator group) — suggested addition, not made automatically, needs Ronnie/Tarpy to confirm. Also discovered a new `images/facebook/` subfolder (FB-optimized square 1080x1080 + portrait 1080x1350 crops of nearly every existing asset, plus `logo_fb-*` filling the gap where `logo.jpg` doesn't actually exist in the repo) — not documented anywhere yet, used these going forward in place of raw source images/`logo.jpg` references. Rebuilt SaveTheHives_FB_Posts.ics to cover Aug 3–16 (today + 2 weeks, Aug 2/Post 5 excluded as already past). Beyond the digest week, the .ics also picked up: the Aug 10 research-hook post above, the ready "The whole toolkit fits in a box" post (Wed Aug 12, per §4 — still needs Ronnie's own local bee-box photo attached manually, not in repo), and — since no found-colony spotlight or Tarpy bio synopsis has arrived yet to fill the Sunday slot — used the ready "About this project" full post (§8) for Sun Aug 16 as a judgment call, flagged for Ronnie to swap out if better content arrives first. Next run should resume fresh Monday research-hook searching starting Aug 17 and pick up the next ongoing Wed/Sun slots after Aug 16.

## Posted (actual publish record, confirmed by Ronnie)

| Post | Title | Suggested date | Actually posted (date/time) | Notes |
|---|---|---|---|---|
| Pinned | Pinned post (§2) | — | Jul 20–21 2026 | Published and pinned manually, before this log existed |
| 1 | The hook | Jul 20 2026 | *unconfirmed* | |
| 2 | Beelining | Jul 22 2026 | *unconfirmed* | |
| 3 | Validate/Map screenshot | Jul 26 2026 | *unconfirmed* | |
| 4 | The bigger why | Jul 27 2026 | *unconfirmed* | |
| 5 | Call for founding contributors | Aug 2 2026 | *unconfirmed* | |
