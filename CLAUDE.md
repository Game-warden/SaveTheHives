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
