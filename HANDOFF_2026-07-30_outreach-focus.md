<!--
HANDOFF_2026-07-30_outreach-focus.md — paste the block below into a new chat
to continue. Not a permanent project doc — safe to archive or delete once
the punch list here is cleared. Supersedes HANDOFF_2026-07-28_landing-page.md
(deleted — its still-open items are folded in below).
-->

# Handoff prompt — paste into new chat

Continuing work on SaveTheHives (plain-script PWA at savethehives.org, repo
folder SaveTheHives-pwa-claude, deployed via Cloudflare Pages, backend on
Supabase). Before we start, read CLAUDE.md and SAVETHEHIVES_SPEC.md, and
check saved memory for this project.

**Current state, as of 2026-07-30:** everything below is shipped, merged to
`main`, and verified live. No uncommitted or unpushed work.

- v2.13 shipped: submitter contact-relay (opt-in checkbox on Add, "📬
  Contact Submitter" popup button, `contact-submitter` Supabase Edge
  Function that relays messages without ever exposing either party's
  email) — tested end to end with two real accounts, confirmed working.
- A first-party visit counter (`functions/_middleware.js`, Cloudflare Pages
  Function + Workers KV) tallying visits by US state/city with zero
  client-side script — confirmed incrementing correctly on production.
- `privacy.html` updated to disclose both of the above.
- `SQL_HOUSEKEEPING_CHEATSHEET.md` and `INSTALL_APP_GUIDE.md` added as
  quick-reference docs (view/delete hives & check-ins by ID or keyword,
  find-a-hive-by-ID via the `?hive=<id>` deep link, Cloudflare install
  troubleshooting).
- Housekeeping done this session: merged branches (`feature/contact-optin-ui`,
  `feature/visit-counter`, and several older already-merged branches) were
  deleted both locally and on GitHub to keep the branch list clean. One
  branch, `pwa-deployment`, was deliberately left alone — it has commits not
  in `main` and was previously noted as an intentionally-kept abandoned
  React/Vite rebuild with possibly-useful DCA-heatmap reference code; don't
  delete it without checking with Ronnie first.

**Ronnie's stated focus for the next session: outreach — getting more
people to know about savethehives.org.** Concrete levers already in place,
ready to pick up:

1. **~188 pending friend invites** (per `CLAUDE.md`) — Ronnie wants
   reminders to send these out gradually rather than all at once, timed to
   land right after fresh content goes live (a launch post or the weekly
   Facebook digest). Check `FACEBOOK_POST_LOG.md`'s "Posted" table for
   what's freshest before nudging.
2. **University outreach — `University_Bee_Research_Contacts.xlsx`** (repo
   root) — 25+ contacts, faculty PI/program-director level, almost none
   contacted yet as of the last status check. `KEY_PEOPLE_CONTACTS.md` has
   the full picture in prose form (Tarpy = confirmed advisor, Delaney and
   Julia Mahood = emailed, awaiting reply as of Jul 25). Next stage
   (not started): draft personalized boilerplate emails per contact using
   the spreadsheet's "Email Template" tab, then send. **Read the "Before
   every edit, re-sync from the repo folder first" note in `CLAUDE.md`
   before touching this file** — Ronnie edits his own copy directly between
   sessions.
3. **Wake County Beekeepers Association** — drafted intro never sent,
   blocked on a name discrepancy (public records list "Chris Hagwood" as
   Principal Officer, not "Stacy Hagwood" as recalled from a lunch
   conversation) — verify via their site or education@wakecountybeekeepers.org
   before sending.
4. **Facebook posting** — automated weekly digest already running,
   scheduled through mid-August as of the last run (see
   `FACEBOOK_POST_LOG.md` §Status). Probably just needs monitoring/nudging
   rather than new work, unless Ronnie wants to extend the content well
   past Aug 9.
5. **Google Search Console sitemap submission** — flagged since the v2.11
   landing-page restructure, still not done. Needs Ronnie's own Google
   account, can't be done from here — worth just asking if he's gotten to
   it, or walking him through it live if not.
6. **Now that there's a real visit counter** (state/city breakdown in
   Cloudflare KV, `savethehives-visits` namespace), outreach effectiveness
   can actually be measured going forward — e.g. checking whether a
   university-outreach push or a Facebook post produces a visible bump in
   visits from that region. Worth referencing this when reviewing outreach
   results.

**Genuinely open, non-outreach items still on the books (lower priority
unless Ronnie raises them):**

- **UNRESOLVED — recurring "Send Link" sign-in failure**, first reported
  Jul 22-23 2026 (see `SAVETHEHIVES_SPEC.md` §11 Known Issues for full
  detail). One cause (Turnstile timeout race) was fixed in v2.9.3; a
  different downstream cause (email never arriving, no client-side error)
  was NOT resolved and nobody has checked the Resend or Supabase dashboards
  for it yet — that's still the single highest-value diagnostic step if
  this recurs. Note: this session's extensive sign-in testing (multiple
  accounts, multiple deploys) didn't reproduce it, which is weak evidence
  it may be less frequent than feared, but not confirmation it's fixed.
- **Duplicate onramp overlay** — the app's first-visit overlay (`app/index.html`,
  v2.8) still says almost the same thing as the landing page's hero now
  says. Not yet decided whether to retire or trim it.
- **"Why non-managed colonies matter" dedicated URL** — currently just an
  on-page anchor (`#why-it-matters`) on the landing page; could graduate to
  its own URL later without breaking the anchor link. Not urgent.
- **Validated-hive visual credit + filter** — design mostly decided
  (checkmark badge, any check-in status counts as validation) but not
  built; see `SAVETHEHIVES_SPEC.md` §11 for the full open questions
  (proximity/anti-fraud tie-in especially).

Let me know what you want to pick up first — my instinct is the
university-contact emails, since that list has been sitting mostly
untouched the longest and has the clearest next action (personalize +
send).
