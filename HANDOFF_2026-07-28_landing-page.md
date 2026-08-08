<!--
HANDOFF_2026-07-28_landing-page.md — paste the block below into a new chat
to continue. Not a permanent project doc — safe to archive or delete once
the punch list here is cleared.
-->

# Handoff prompt — paste into new chat

Continuing work on SaveTheHives (plain-script PWA at savethehives.org, repo
folder SaveTheHives-pwa-claude, deployed via Cloudflare Pages). Before we
start, read CLAUDE.md and SAVETHEHIVES_SPEC.md, and check saved memory for
this project.

Current state: v2.11 shipped today (2026-07-28) — root `/` is now a static
landing page (mission hook, three ways to help with Validate first, an
animated-bee teaser into an on-page "why non-managed colonies matter"
section). The actual app (map/Validate/Add/Learn) moved to `/app/`.
`sw.js` moved with it so its cache scope is `/app/*` only, never touching
the landing page. `manifest.json` start_url/scope now point at `/app/`.
Built and tested on a branch (Cloudflare preview deploy), merged to `main`,
pushed — should be live now.

Outstanding from that work, roughly in priority order:

1. **Confirm it's actually live** — reload savethehives.org twice (or
   close/reopen the tab) before trusting what you see, per the usual
   service-worker two-load gotcha. Hasn't been explicitly confirmed yet
   this session.
2. **Reinstall the PWA** if you'd installed the old version to your home
   screen before today — `start_url` changed, so the old install won't
   auto-migrate to `/app/`.
3. **Decide on the duplicate onramp overlay** — the app's own first-visit
   overlay (v2.8, still inside `app/index.html`) says almost the same
   thing the new landing page's hero now says. Retire it or trim it so a
   first-time visitor isn't seeing the same hook twice in a row. Not
   urgent, but flagged and not yet decided.
4. **Submit the updated sitemap to Google Search Console** — manual, needs
   Ronnie's Google account, not done yet.
5. Longer-term, not urgent: give "why non-managed colonies matter" its own
   dedicated URL instead of the on-page `#why-it-matters` anchor; keep
   leaning on university outreach + Facebook posting for discoverability,
   which matters more than any further on-page SEO work at current traffic.

Also still open from before the landing-page work (check KEY_PEOPLE_CONTACTS.md
and University_Bee_Research_Contacts.xlsx for current status): personalized
outreach sentences for contacts beyond the first six, the Wake County
Beekeepers email (drafted, never sent), and the recurring magic-link
sign-in email delivery bug (SAVETHEHIVES_SPEC.md §11 Known Issues —
unresolved as of Jul 23, top-priority whenever there's time to check the
Resend/Supabase dashboards).

Let me know what you want to pick up first.
