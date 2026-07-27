# SaveTheHives — Session Reminders

Read this before doing deploy-related work in this repo.

## Always remind Ronnie after a push: reload twice

Every deploy that bumps `CACHE_VERSION` in `sw.js` (see the cache rule in
`SAVETHEHIVES_SPEC.md` §7 Known Gotchas) has a "two-load" quirk: the first
page load after a fresh deploy still serves the *old* cached version — the
old service worker serves instantly from cache while the new one installs
quietly in the background. Only the **second** load gets the new code.

**After confirming a push succeeded, always tell Ronnie:** open the site,
close the tab, reopen it (or just reload twice) before checking whether the
new change is actually live. Only fall back to the manual DevTools route
(Application → Service Workers → Unregister, then Storage → Clear site
data, then reload) if a double-reload still doesn't show the update.

For full context on this and other gotchas (Turnstile/hCaptcha dropdown,
localhost-vs-LAN-IP secure-context quirks, etc.), see
`SAVETHEHIVES_SPEC.md` §7.

## Remind Ronnie when it's time to send friend invites / ask for follows

Ronnie has a backlog of friend invites (188 as of Jul 2026) and wants
prompts for when to send them out and ask people to visit/follow the
Facebook page — rather than dumping them all at once. Good moments to
remind him:

- Right after a launch-sequence or weekly post is confirmed live (see
  `FACEBOOK_POST_LOG.md` "Posted" table) — invites land better pointing
  at fresh content than an empty page.
- In the weekly `savethehives-fb-weekly-digest` output, as a one-line
  nudge alongside that week's posts.

Keep it brief — one line, not a lecture — and tie it to whatever post is
freshest so the ask has something concrete to point to.

## University Contacts spreadsheet — it's a local .xlsx, not a Google Sheet

`University_Bee_Research_Contacts.xlsx` (repo root) tracks outreach to
university honey bee/apiculture research programs. **No Google Sheets/Drive
connector is set up for this project** — this is a plain local Excel file.
Ronnie may open it with Google Sheets, Excel, or Numbers on his end, but from
Claude's side it's just a file on disk, read and written with Python
(`openpyxl`) inside the sandboxed shell (`mcp__workspace__bash`), same as the
`xlsx` skill describes. Do not assume a Sheets API/connector exists — if
Ronnie ever wants a *live* Google Sheet instead (multiple editors, no
re-upload step), that requires explicitly connecting a Google Sheets
connector first; ask before assuming that's in place.

**Editing workflow:** build/edit the file with an `openpyxl` script in the
scratchpad `outputs` directory first (never edit the repo copy directly —
`.xlsx` is a binary/zip format, not safe for the text-based `Edit` tool),
verify column/row output with a quick `python3` read-back, then `cp` the
finished file over the copy in the repo folder so Ronnie can access it.
`Read` cannot parse `.xlsx` content directly — always go through
`openpyxl`/`pandas`/`markitdown` in the shell.

**Before every edit, re-sync from the repo folder first — never trust a
locally-cached scratchpad copy as the starting point.** Ronnie edits his
copy directly (updating Status, Date Emailed, adding columns like "Career
Stage / Timing Rationale" — first seen Jul 25 2026). If a session starts
from an old scratchpad version and copies over the repo file at the end, it
silently destroys whatever Ronnie changed in between sessions. Always run
`cp` from the repo-folder copy *into* the scratchpad first, confirm the
column/row count matches what's expected, and only then start editing.
Treat the repo-folder copy as the single source of truth, never the
scratchpad.

**Structure (as of Jul 26 2026), 3 sheets:**
- **"University Contacts"** — the main tracker. Columns: Name, Title,
  Institution, Department / Lab Link (clickable), US Region (dropdown),
  Email, Phone, Research Focus, Why Relevant to SaveTheHives, SAS Software
  Connection, Status (dropdown), Planned Send Date (conditional-formatted:
  red=due/overdue, green=next 14 days, blue=further out), Date Emailed,
  Follow-up Date, Notes, Career Stage / Timing Rationale. Rows 2-5
  (tan-highlighted) are Seeley/Tarpy/Delaney/Mahood — contacts already in
  motion, kept separate from the two cold-outreach batches below them.
- **"Email Template"** — boilerplate outreach email with bracketed
  placeholders ([FIRST NAME], [LAST NAME], [INSTITUTION], [SAS CONNECTION
  SENTENCE], [RELEVANCE SENTENCE]) to personalize per contact before sending.
- **"How to Use"** — plain-language instructions for Ronnie, kept in sync
  with whatever the sheet actually does.

Cross-reference: `KEY_PEOPLE_CONTACTS.md` tracks the same people/orgs in
prose form and should get a status update whenever the spreadsheet does, so
the two don't drift apart.
