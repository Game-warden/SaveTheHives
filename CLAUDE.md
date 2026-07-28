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

## Site structure (as of v2.11, 2026-07-28): root is now a landing page, the app moved to /app/

Root `/` used to BE the PWA. As of this restructure, `/` is a new static
landing page (`index.html` at repo root — plain HTML, self-contained
`<style>` block, no build step, same convention as `privacy.html`) aimed
at first-time visitors: mission hook, three ways to help (Validate listed
first, per Dr. Tarpy's own "Validate over Add" advice — see
`MEETING_NOTES_2026-07-21_Tarpy.md`), an animated-bee teaser linking to an
on-page "why non-managed colonies matter" section, then "Explore the map."

**The actual app (map, Validate, Add, Learn) now lives entirely under
`/app/`** — `index.html`, `app.js`, `pathfinder.js`, `sw.js` all moved
there. If you're editing map/Validate/Learn/Pathfinder behavior, edit the
files under `app/`, not the root `index.html` — root is the landing page
now, a completely different file with its own tiny inline stylesheet.

**Why `sw.js` moved too, not just the app files:** its `fetch` handler
cache-firsts any same-origin request it sees by default. Left at `/sw.js`,
it would have silently swept the new landing page into the same
stale-cache risk the app already has (documented in the "reload twice"
section above). Moving it to `/app/sw.js` gives it a default scope of
`/app/*`, so it never controls the root landing page at all — solved by
placement, no new exclusion logic needed. `SHELL_ASSETS` inside it points
at the new `/app/...` paths; shared root-level assets (`styles.css`,
`manifest.json`, icons, `logo.jpg`) didn't move and are referenced by
root-absolute path (`/styles.css` etc.) from both the landing page and the
app, so there's exactly one copy of each, not two.

`manifest.json` stayed at root (icons resolve relative to its own location
regardless of who links it) but `start_url` and `scope` now both point at
`/app/` — installed users open straight to the map, never the landing page.

**Cleanup done:** the pre-move `app.js` and `pathfinder.js` orphans at repo
root were removed via `git rm` before the restructure shipped. Root `sw.js`
still exists, but it's not an orphan anymore — it's now an intentional
"killer" script (see the Orphaned Service Worker entry in
`SAVETHEHIVES_SPEC.md` §7) that unregisters any pre-v2.11 service worker
still lurking at scope `/` and clears its caches. Leave it in place
permanently; it's doing a real job, not leftover cruft.

**Fallback if something goes wrong after this ships:** this whole
restructure was built and should be committed on its own branch first
(not directly to `main`) — Cloudflare Pages is Git-connected with
automatic deployments, which by default also builds a preview URL for any
non-production branch/PR, so the whole flow (landing page, `/app/`, install
behavior) can be tested live with zero risk to `savethehives.org` before
merging. If something's still wrong *after* merging to `main`: `git revert`
the merge commit and push (redeploys the previous good state in the same
~10-30s window as any other push), or use Cloudflare Pages' own dashboard
— Deployments tab → pick the last known-good deployment → "Rollback to
this deployment," which needs no git operations at all and is the fastest
option if you're not near a terminal. The old manual zip-upload path also
still works as a last resort (see `SAVETHEHIVES_SPEC.md` §Cloudflare).

**SEO status:** `sitemap.xml` now lists `/` and `/app/`; `robots.txt`
already allowed everything (`Allow: /`), no change needed there. The
landing page ships with real static text in the light DOM (not hidden
behind a modal like the old About panel), which is the main structural
SEO gain from this move. **Not done yet, explicitly next steps:** a
dedicated "Why Non-Managed Colonies Matter" page (currently just a
same-page section, `#why-it-matters`, condensed from
`GENETIC_GOLDMINE_EXPLAINER.md` — could graduate to its own URL later
without breaking the anchor link); submitting the updated sitemap to
Google Search Console (needs Ronnie's Google account, can't be done from
here); backlinks from the university outreach and Facebook effort, which
will move discoverability more than any on-page change at this traffic
stage.

## About panel is a full view now, not a modal — and shares patterns with Learn

As of v2.11.3-2.11.4 (2026-07-28), the About tab (`#about-view` in
`app/index.html`) was converted from a `.modal-overlay` bottom sheet into a
full view — same architecture as `#learn-view`, toggled the same way in
`setTab()` (`app/app.js`). This was a deliberate fix for a real
inconsistency Ronnie spotted: the persistent `#app-header` and the floating
`#bottom-tabs` pill were both dimming/blurring behind About's old modal
backdrop but not behind Map or Learn. If you're touching About again:

- The hub menu rows reuse Learn's `.lv-card` / `.lv-card-icon` /
  `.lv-card-body` / `.lv-card-chevron` classes directly — don't recreate a
  parallel `.about-menu-row` style, add new rows as `.lv-card`s grouped
  under an `.about-card-group` with an `.about-group-label` header, same as
  the existing App / Map reference / Community / About the project groups.
- Sub-panels use a `.about-panel-header` "← About" back row (destination-
  labeled, matching Learn's "← Learn") plus a separate `.about-panel-name`
  heading — not the old `.about-panel-title` combined into the back row.
- **Width cap gotcha:** `#about-view` needed to be added explicitly to
  `#learn-view`'s `max-width:560px; margin:0 auto` CSS rule
  (`#learn-view, #about-view { ... }` in `styles.css`) — it did NOT inherit
  this just from using the same `.learn-screen` child class, since the cap
  is written as an id-scoped rule on the parent. See the CSS id-scoping
  entry in `SAVETHEHIVES_SPEC.md` §7 if this pattern gets reused again
  (e.g. converting another modal into a full view later).
- Add and Sign In are staying as `.modal-overlay` bottom sheets on
  purpose — this is a considered choice (see chat 2026-07-28), not an
  inconsistency to "fix" later. Add is a quick task-focused form tied to
  the map crosshair behind it; About/Learn/Map are browsable destinations.
  Don't convert Add to a full view without Ronnie explicitly asking again.

## Landing page ↔ app connection: `?onboard=` params + nav callout bubbles

Each "way to help" card on the root landing page links to `/app/` with
`?onboard=validate|add|learn`. On arrival, `maybeShowOnboardCallout()` in
`app/app.js` reads that param and shows a one-time floating speech-bubble
callout (`.onboard-callout` CSS, `.nav-highlight` ring) pointing at the
matching bottom-nav button (`#nav-btn-validate`/`#nav-btn-add`/
`#nav-btn-learn`), instead of the generic first-visit onramp overlay
(`maybeShowOnramp()` skips itself when `?onboard=` is present). Auto-
dismisses after 4s or on next click. If new landing-page cards get added
that should route somewhere specific in the app, follow this same param
pattern rather than inventing a new one-off mechanism.

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
