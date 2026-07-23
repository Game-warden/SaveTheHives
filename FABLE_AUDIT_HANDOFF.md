# Fable Audit Handoff — Errors, Security, Scalability, Sign-in

**Written:** July 23, 2026, by Claude Sonnet, at Ronnie's request, to prep a dedicated audit session
**For:** Claude Fable 5, running in a new Cowork conversation in this same working folder
**Purpose:** Deep-dive audit only — find and document problems with severity/evidence. Do not implement fixes. Ronnie will bring your findings back to a Sonnet session for implementation.
**Read alongside:** `SAVETHEHIVES_SPEC.md` (architecture, schema, full changelog, §11 Known Issues/Backlog) and `PROJECT_HISTORY.md` (how the project got here, git state caveats)

---

## 1. What this app is, in one paragraph

SaveTheHives is a zero-budget, volunteer-run citizen-science PWA at **savethehives.org** for mapping non-managed ("feral") honey bee colonies. ~1,162 legacy records from 2008–2017 plus new user submissions live in Supabase (Postgres). No build step — plain `index.html` + `styles.css` + `app.js` + `pathfinder.js` + `sw.js`, loaded as ordinary `<script>` tags, everything in global scope (inline `onclick` handlers require this — don't suggest converting to ES modules). Stack: Leaflet (map), Supabase (DB + magic-link auth + storage), Cloudflare (hosting/DNS/Pages + Turnstile CAPTCHA), Resend (transactional email via SMTP). Full architecture diagram and infra details are in `SAVETHEHIVES_SPEC.md` §10.

The project just shipped a Facebook page and is about to send ~188 friend invites, so it's getting real outside traffic for the first time. This is the context for why sign-in reliability specifically matters right now — a broken auth flow in front of new visitors is a bad first impression, and Ronnie is holding off on the invite send until it's trusted.

**Current version: v2.9.4** (check `sw.js`'s `CACHE_VERSION` to confirm you're looking at the latest before reporting anything as missing). v2.9.4 just added Open Graph + Twitter Card meta tags to `index.html` (previously there were none at all, and no page `<title>`/meta description either) — don't re-flag "missing OG tags" as a new finding, it's done. What IS still a real gap, worth keeping in mind for priority 3/4: this is one static, site-wide share card only — there's no server-side rendering or edge function, so if a per-hive share link (`?hiveId=...`) ever gets built, it can't get its own dynamic preview without adding a rendering layer that doesn't exist today. Not asking you to build that — just don't be surprised by it if you go looking for per-hive OG support.

---

## 2. Your assignment — four areas, in priority order

### Priority 1: Sign-in reliability (UNRESOLVED, actively recurring)

Read `SAVETHEHIVES_SPEC.md` §11's first entry in full ("UNRESOLVED — recurring 'Send Link' sign-in failure") before doing anything else — it has the complete timeline. Short version: magic-link sign-in (`submitSignIn()` in `app.js`, ~line 1372) intermittently fails. One cause (a client-side Turnstile timeout race) was found and fixed Jul 22 (v2.9.3). It recurred Jul 23 with a different signature — no client-side error, but the email never arrived. That points downstream of the client entirely: Supabase's OTP handling, Resend's actual delivery, or spam filtering.

**What you can't do that's needed here:** check the Resend dashboard (resend.com → Emails/Logs) or Supabase's Authentication → Logs. Those need Ronnie's login and he'll need to pull them himself and paste you the relevant entries, or grant you access if Cowork supports it in this session. Don't guess at what those logs show — ask Ronnie to fetch them if you need that evidence.

**What you can do:** full trace through `submitSignIn()`, `getTurnstileToken()`, the Supabase Auth config described in spec §10 (SMTP settings, Redirect URLs, Attack Protection settings), and the DNS/domain-verification requirements Resend has for `savethehives.org` (MX/TXT/DKIM records — described in spec §10, actual current DNS values need to be pulled from Cloudflare's dashboard, not assumed from the doc). Also worth checking: does the newly-added `?tab=` deep-link feature (shipped same day, v2.9.3) interact badly with `emailRedirectTo: window.location.href` if someone signs in from a URL that includes a `?tab=` query param not in Supabase's exact Redirect URLs allowlist? That's a real hypothesis, untested.

Also check: is there any client-side double-submit possible (rapid double-click on "Send Link") that could trigger Supabase's OTP rate-limit/cooldown behavior in a way that looks like silent failure rather than a visible error?

**New lead, Jul 23 2026, likely the real cause:** Ronnie had multiple old/stale browser tabs open to savethehives.org. Closing them made sign-in start working again. This points strongly at cross-tab interference rather than anything network- or Resend-related, and it fits the "no error shown, no email arrived" symptom exactly. Investigate:
- Supabase's JS client (GoTrue) manages its session via `localStorage` and uses a cross-tab lock/coordination mechanism (historically `navigator.locks` or a `BroadcastChannel`/storage-event-based lock, depending on SDK version) to avoid concurrent token refresh races across tabs of the same origin. If a stale tab is sitting on an expired/invalid session, it may be silently retrying token refresh in the background, holding that lock, or otherwise interfering with a fresh `signInWithOtp()` call from a different tab.
- Check whether repeated background refresh attempts from stale tabs could be consuming Supabase's OTP/email rate-limit allowance for that account — this would produce exactly the observed symptom: the active tab's request "succeeds" (no client-side error) but no email actually goes out, because a stale tab already used up the request budget moments earlier, invisibly.
- Check the Supabase client init in `app.js` for any config around `persistSession`, `autoRefreshToken`, `multiTab`, or storage key — and whether `sw.js`'s service worker (registered per-tab but shared per-origin) plays any role in keeping stale tabs "alive" enough to matter.
- If this is confirmed as the mechanism, think about whether a fix belongs in the app (e.g., detecting/warning about multiple open tabs, or being more deliberate about `autoRefreshToken`/session handling) versus this just being expected behavior users need to be aware of (closing old tabs). Report your assessment either way — this is exactly the kind of thing worth a recommendation even if the "fix" is just documentation/UX (e.g., a toast warning if another tab is detected).

### Priority 2: Security review

Known/documented security posture is in spec §9 (Privacy & Security Considerations) and §10 (RLS policies, Turnstile config). Go beyond what's already written down:
- RLS policies on `hives` and `checkins` (spec §4) — verify the stated policies actually match reality, don't just trust the doc.
- Public data exposure: every hive record's `name` field (observer name) and free-text `notes` field are publicly readable with no auth — confirmed Jul 22 2026 that a number of the 1,162 legacy notes contain incidental PII (phone numbers, "email me" invitations) typed directly into free text back in 2008–2015, never scrubbed. Not asking you to fix this — just confirm scope (how many records, what kind of PII) if useful for Ronnie's decision-making.
- Look for any exposed secrets, API keys, or credentials that shouldn't be client-visible (the Supabase anon key being public is expected/normal — that's how Supabase works with RLS; but check nothing else leaked in).
- Turnstile/Attack Protection config correctness — spec §10 flags a known historical gotcha (Supabase's captcha provider dropdown defaults to hCaptcha and must be manually switched to Turnstile, or tokens are always rejected) — verify this is still set correctly.
- `submitted_by` / `user_id` FK integrity — spec mentions a past bug where these landed null; confirm it stays fixed.
- **Already found, needs your verification/scoping, not rediscovery: likely stored XSS.** `app.js` builds hive popups (`marker.bindPopup(...)`, ~line 426) and the records list (`list.innerHTML = ...`, ~line 802) by interpolating user-submitted `hive.name`, `hive.description`, and check-in notes directly into HTML template literals. Grepped the whole file for `DOMPurify`/`escapeHtml`/`sanitize` — none exist anywhere. Since Add Hive requires only sign-in (an email magic link, no identity verification), any signed-in user could submit a `name` or `description` containing an executable payload (e.g. an `<img onerror=...>` tag — `<script>` tags don't execute via `innerHTML`, but event-handler attributes do) that would run in every other visitor's browser who views that hive. The sensitive thing at risk isn't the Supabase anon key (that's meant to be public) — it's each visitor's session token sitting in `localStorage`. Please confirm this reproduces, scope how many render paths are affected (popup, records list, anywhere else `hive.name`/`description`/`notes` gets rendered), and recommend the fix (likely: switch to `textContent` where no HTML is actually needed, or run user-submitted fields through an escaping function before interpolation).

### Priority 3: Scalability

Spec has a dedicated "Mapping at Scale (around 5,000 hives)" section — read it first, it already covers Leaflet/MarkerCluster's known ceiling. Current known issues already logged, don't rediscover: records list pagination missing (shows first 50 only), mating radius overlay may be slow on low-end devices with 1,000+ pins visible at once. Beyond what's already flagged: look at query patterns (any N+1-style repeated Supabase calls?), the IndexedDB delta-sync cache (`app.js`, "INDEXEDDB CACHE" section) for correctness at larger record counts, and whether the service worker's caching strategy (`sw.js`) will hold up as the app shell or tile cache grows.

### Priority 4: General error handling

Look for unhandled promise rejections, missing try/catch around Supabase calls, error states that fail silently instead of surfacing a toast, and any place a network failure would leave the UI in a stuck/ambiguous state (e.g., a button stuck on "Sending…" forever). The offline-queue gap is already known and logged (spec §11, "Shelved Jul 17 2026" section) — don't re-flag that one, just be aware of it as context for how the app currently behaves offline (badly, by design-deferral, not by accident).

### Priority 5: Live UX walkthrough (Chrome-assisted)

This part needs the Claude in Chrome browser tools, not just code review — go actually use the live app the way a first-time visitor would, and flag anything that feels broken, confusing, or worth improving. Code review catches bugs; it doesn't catch "this is technically working but a real person would get stuck here."

**Before you start:** hard-refresh or close/reopen the tab at least twice. `CACHE_VERSION` was just bumped to v2.9.4 — the two-load gotcha (§3 ground rules) means a normal load will show you the *previous* cached version and everything you observe will be about stale code, not current.

**Walk through, as a new visitor would:**
- Land on the map cold — does anything feel slow, janky, or unclear in the first few seconds? Is the on-ramp overlay (first-visit card) clear about what the app does?
- Open a few hive popups — check the popup content, the "Update / Check In" and "Share This Hive" buttons.
- Try Add Hive and Validate — including triggering the sign-in modal (you don't need to actually complete a magic-link sign-in unless you want to test priority 1's flow — but do check the modal itself, the Turnstile widget loading, and what happens if you close it partway through).
- Open the filter drawer, try the notes-keyword search, toggle the mating radius.
- Check the Learn tab — hub screen, opening a module, the back button.
- Check the About modal, including the install-nudge and dark mode toggle.
- Resize/emulate a phone viewport if the tool supports it — this app is built mobile-first and most real usage will be on iPhone Safari specifically (a documented weak spot elsewhere in the spec).
- **Check the browser console for errors** on each of the above — this directly feeds priority 4 (general error handling); a console error you catch here is worth more than one inferred from reading the code.
- **Verify the new Open Graph tags actually work**: run `https://savethehives.org/` through Facebook's Sharing Debugger (developers.facebook.com/tools/debug/) and confirm the card shows the right title, description, and image now that v2.9.4 added them.

Report UX friction and enhancement ideas alongside the bug findings, but keep them clearly labeled as suggestions (not bugs) so Ronnie can triage them separately when this comes back to Sonnet for implementation.

---

## 3. Ground rules

1. **This is an audit, not an implementation session.** Produce a findings report, don't fix things live. Ronnie is taking your findings back to a Sonnet session for implementation.
2. **Don't rediscover what's already logged.** `SAVETHEHIVES_SPEC.md` §11 (Known Issues/Backlog) is long and current as of today — read it fully before reporting something as new. Several open items already exist there (validated-hive filter, submitter contact info, the sign-in issue itself) with context on why they're not built yet.
3. **If you touch code to test a theory, `CACHE_VERSION` in `sw.js` must be bumped in the same commit as any change to `index.html`/`styles.css`/`app.js`/`pathfinder.js`/`manifest.json`** — miss this and changes silently never reach real visitors (client-side Cache Storage, not a Cloudflare purge issue).
4. **Claude cannot push to git.** Deploys happen when Ronnie runs `git add -A && git commit && git push` himself. If you make changes, tell him the exact commands, don't assume they ran.
5. **Two-load rule:** after any deploy, the first page load still serves the old cached version (old service worker serves from cache while the new one installs). Always tell Ronnie to reload twice / close-reopen the tab before trusting what he sees.
6. **Output format:** please write your findings to a new file, e.g. `FABLE_AUDIT_FINDINGS_2026-07-23.md`, structured by the four priority areas above, each finding tagged with a severity (critical/high/medium/low) and enough detail (file, line, reproduction steps if applicable) that a Sonnet session can act on it directly without re-deriving your reasoning. This mirrors how `PATHFINDER_HANDOFF.md` was written for a similar handoff — that file is a good style reference if you want one.

---

## 4. Files worth reading before you start

- `SAVETHEHIVES_SPEC.md` — full architecture, schema, changelog, known issues (read §9, §10, §11 closely; skim the rest)
- `PROJECT_HISTORY.md` — narrative history, and an important caveat: as of its last update there was a note about 130 unpushed local commits and an uncommitted rebuild era; confirm current `git status`/`git log` yourself rather than trusting that doc's snapshot, since time has passed
- `app.js`, `sw.js`, `index.html`, `pathfinder.js`, `styles.css` — the actual app
- `privacy.html` — current privacy policy scope, relevant to the security review
