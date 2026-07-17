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
