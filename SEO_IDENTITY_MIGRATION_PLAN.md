# SEO / Identity Migration Plan

Living doc, started 2026-08-15. Tracks a proposed architecture change aimed
at improving SEO without a framework/build-step rework. Update this file as
each phase ships or a decision changes — don't let it go stale.

Origin: Ronnie proposed two linked ideas in chat, framed explicitly as
"throwing ideas around" — nothing here was implemented at proposal time,
only critiqued and scoped.

- **Part 1** — Cloudflare Pages Functions as a lightweight SSR layer:
  server-rendered `/hive/<id>` pages, sitemap.xml, RSS/Atom feed, a
  research API. Zero framework, zero build step, $0/month, existing PWA
  under `/app/` untouched.
- **Part 2** — identity/role management on top of Part 1: a `profiles`
  table, newsletter subscribers, a researcher tier, RLS policies, and
  Cloudflare Functions for newsletter signup + researcher export.

## Verdict (2026-08-15)

- **Part 1: yes, no added risk** — conditional only on fixing coordinate
  precision first (see Phase 0). Everything else is additive and doesn't
  touch `/app/`.
- **Part 2: conditional yes, piece by piece.** Newsletter signup,
  contributor-gating, and the research portal are sound. Two real bugs
  need fixing before any of it ships (see Phase 4). The anonymous-auth
  idea is cut outright — conflicts with the v2.13.1 anti-fraud RLS
  tightening (`hives_auth_insert`, `submitted_by = auth.uid()`) and isn't
  needed for the SEO goal.
- **Part 2 is not required for the SEO goal.** It can be deferred
  indefinitely without weakening Part 1's payoff.
- **Soro (trysoro.com) — shelved 2026-08-15**, pending Phase 3 results
  below. See "Soro" section at the bottom for the technical notes so this
  doesn't need to be re-researched later.

## Rollout phases

Each phase ships on its own branch, tested against Cloudflare Pages'
automatic preview URL, merged to `main` individually — never batched. This
keeps every phase independently revertible: `git revert` the merge commit,
or Cloudflare Pages dashboard → Deployments → pick the last known-good
deployment → "Rollback to this deployment." Same pattern already used for
the v2.11 landing-page restructure.

### Phase 0 — coordinate precision fix (precondition)
**Status:** shipped 2026-08-15, at the new-surface level only
**Risk:** low, self-contained
**What:** every new Function in `functions/_lib/hives.js` rounds
coordinates to 2 decimals before they ever render (HTML, XML, or JSON) —
see the Phase 0 note in that file. This is NOT the full DB/API-layer fix
originally scoped here — the underlying gap (the public anon key can still
fetch full-precision lat/long directly, since RLS is row-level not
column-level) is unchanged and still open. What shipped closes the risk
that mattered most: these new surfaces are permanent and indexable, so
they can't be allowed to leak precise coordinates the way a transient UI
call could. A real DB/RLS-level fix is still a separate, not-yet-scoped
piece of work if it's wanted later.

### Phase 1 — `/hive/<id>` SSR pages
**Status:** shipped 2026-08-15 (commit `11b9ded`, branch `seo-part1-ssr` → `main`)
**Risk:** low — additive, doesn't touch `/app/`
**What:** Cloudflare Pages Function rendering a static-equivalent HTML page
per hive, real content in the initial response (not client-JS-injected).
**Checkpoint before merging:** spot-check several hive pages on the preview
URL, confirm rounded coordinates render, basic HTML validity/Lighthouse
pass.

### Phase 2 — sitemap.xml + RSS/Atom feed
**Status:** shipped 2026-08-15, same commit as Phase 1 (`11b9ded`)
**Risk:** low, same branch/rollback path as Phase 1
**What:** `functions/sitemap.xml.js` (replaces the static `sitemap.xml`,
one `<url>` per non-`gone` hive) and `functions/rss.xml.js` (last 50
hives). Also shipped in this same batch, not originally broken out as its
own phase above: `functions/api/hives.js`, the paginated JSON "research
API" mentioned in Part 1's original scope — `GET /api/hives?state=&status=&limit=&offset=`.
**Checkpoint before merging:** done — tested against the Cloudflare
preview URL (`4be2e174.savethehives.pages.dev`) before merge: `/hive/1176`,
`/sitemap.xml` (spot-checked, well-formed), `/rss.xml`, and
`/api/hives?limit=5` all returned correct output. Sitemap validation via
Search Console URL inspection and feed validation via the W3C validator
still worth doing now that it's live, just not done yet.

### Phase 3 — merge, then wait (the real cadence gate)
**Status:** in progress — merged to `main` 2026-08-15 (fast-forward
`5d9e7ac..11b9ded`), waiting period starts now. Do not start Phase 4 or
revisit Soro before ~early-to-mid September 2026.
**What:** merge Phases 1-2 to `main`. Then **do nothing new for 2-4
weeks** — give Google Search Console time to actually crawl and index the
new pages.
**Watch:** Search Console Coverage + Performance reports, Cloudflare Web
Analytics traffic to `/hive/<id>` pages.
**Why this gate matters:** this is the checkpoint for whether the whole
SEO thesis is working. No point layering Part 2 or reconsidering Soro on
top of something unproven.
**Sitemap resubmitted and confirmed 2026-08-15** — the property already
had the old static sitemap on file (submitted Aug 8, last read Aug 11,
"Discovered pages: 3" — that's the pre-Function static file's 3 static
URLs, read before this shipped). Resubmitted
`https://savethehives.org/sitemap.xml` via Search Console → Sitemaps;
Google re-read it same-day and "Discovered pages" jumped to **1,137**
(3 static + 1,134 non-`gone` hives — exact match, confirms the dynamic
sitemap is fully discovered, not just partially picked up). Discovery is
not the same as indexing — these 1,137 are now known to Google and
eligible to be crawled/indexed, but Coverage/Performance reports are the
next thing to watch, over the 2-4 week wait period above, to see how many
actually get indexed and start showing impressions.

### Phase 4 — Part 2, one piece at a time (only after Phase 3 shows results)
**Status:** not started
1. Newsletter subscribers table + signup Function — low risk, isolated
   table, no auth changes.
2. **Fix before building anything on top:** two concrete bugs found in the
   proposed SQL —
   - missing a self-read RLS policy on `profiles` (users couldn't read
     their own row without one)
   - an invalid `CREATE POLICY` targeting a view — Postgres RLS policies
     only attach to tables, not views, and even if fixed the underlying
     `hives` table is already fully public so the view wasn't restricting
     anything. Same failure class as the `feature_ideas_with_votes`
     SECURITY DEFINER view bug fixed in v2.13.1 — same fix pattern
     applies.
3. Research portal / export endpoint, gated by the corrected researcher
   tier.
4. **Cut, not deferred:** the anonymous-auth idea. Do not revisit without
   an explicit reason — it conflicts with existing anti-fraud RLS.

## Interaction with future Photos / beelining (Pathfinder) work

Flagged during the Part 2 review, not yet deeply scoped: any new
`profiles`/role table needs to stay compatible with the existing
Pathfinder isolation convention (`?pf=1` gate, "don't touch outside a
dedicated Pathfinder session") and with a future Photos feature that will
also need its own storage/RLS shape. Revisit this section once Phase 4
design actually starts — don't pre-design it now.

## Soro (trysoro.com) — shelved 2026-08-15

Third-party AI SEO content tool (Digimeri OÜ). Researched via its site and
an existing "Re: Soro looked at SaveTheHives" email thread (Ben/Matt from
Soro). Findings, kept here so this doesn't need re-research later:

- Two integration paths for a custom/PWA site, no webhook dev required:
  - **Blog Widget** — JS embed snippet, pulls articles in client-side.
    Weak fit regardless of Part 1: client-rendered content is a slower,
    less-reliable indexing path and undercuts the static-HTML SEO gain
    Part 1 is built around.
  - **RSS feed** — Soro exposes a feed, "you or whoever maintains the
    site" pulls and renders it. This is the option Part 1 actually
    enables: a Cloudflare Function could poll the feed and render each
    article as a real static-equivalent page (same SSR pattern as
    `/hive/<id>`), landing in the sitemap with real Article JSON-LD.
- Open items if this gets picked back up: Soro's actual pricing was never
  confirmed (Ben's outreach email mentioned "50% off from the quiz," no
  number seen). Any RSS-sourced content should be treated as a draft for
  review, not auto-published — generic AI blog content risks reading as
  off-brand on a small citizen-science nonprofit site.
- **Decision:** shelved until Phase 3 above shows the core SEO work is
  actually moving the needle. No point paying for a content pipeline into
  pages that aren't proven to rank yet.
