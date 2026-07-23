# Fable Audit Handoff — Errors, Security, Scalability, Sign-in

**Written:** July 23, 2026, by Claude Sonnet, at Ronnie's request, to prep a dedicated audit session
**For:** Claude Fable 5, running in a new Cowork conversation in this same working folder
**Purpose:** Deep-dive audit only — find and document problems with severity/evidence. Do not implement fixes. Ronnie will bring your findings back to a Sonnet session for implementation.
**Read alongside:** `SAVETHEHIVES_SPEC.md` (architecture, schema, full changelog, §11 Known Issues/Backlog) and `PROJECT_HISTORY.md` (how the project got here, git state caveats)

---

## 1. What this app is, in one paragraph

SaveTheHives is a zero-budget, volunteer-run citizen-science PWA at **savethehives.org** for mapping non-managed ("feral") honey bee colonies. ~1,162 legacy records from 2008–2017 plus new user submissions live in Supabase (Postgres). No build step — plain `index.html` + `styles.css` + `app.js` + `pathfinder.js` + `sw.js`, loaded as ordinary `<script>` tags, everything in global scope (inline `onclick` handlers require this — don't suggest converting to ES modules). Stack: Leaflet (map), Supabase (DB + magic-link auth + storage), Cloudflare (hosting/DNS/Pages + Turnstile CAPTCHA), Resend (transactional email via SMTP). Full architecture diagram and infra details are in `SAVETHEHIVES_SPEC.md` §10.

The project just shipped a Facebook page and is about to send ~188 friend invites, so it's getting real outside traffic for the first time. This is the context for why sign-in reliability specifically matters right now — a broken auth flow in front of new visitors is a bad first impression, and Ronnie is holding off on the invite send until it's trusted.

---

## 2. Your assignment — four areas, in priority order

### Priority 1: Sign-in reliability (UNRESOLVED, actively recurring)

Read `SAVETHEHIVES_SPEC.md` §11's first entry in full ("UNRESOLVED — recurring 'Send Link' sign-in failure") before doing anything else — it has the complete timeline. Short version: magic-link sign-in (`submitSignIn()` in `app.js`, ~line 1372) intermittently fails. One cause (a client-side Turnstile timeout race) was found and fixed Jul 22 (v2.9.3). It recurred Jul 23 with a different signature — no client-side error, but the email never arrived. That points downstream of the client entirely: Supabase's OTP handling, Resend's actual delivery, or spam filtering.

**What you can't do that's needed here:** check the Resend dashboard (resend.com → Emails/Logs) or Supabase's Authentication → Logs. Those need Ronnie's login and he'll need to pull them himself and paste you the relevant entries, or grant you access if Cowork supports it in this session. Don't guess at what those logs show — ask Ronnie to fetch them if you need that evidence.

**What you can do:** full trace through `submitSignIn()`, `getTurnstileToken()`, the Supabase Auth config described in spec §10 (SMTP settings, Redirect URLs, Attack Protection settings), and the DNS/domain-verification requirements Resend has for `savethehives.org` (MX/TXT/DKIM records — described in spec §10, actual current DNS values need to be pulled from Cloudflare's dashboard, not assumed from the doc). Also worth checking: does the newly-added `?tab=` deep-link feature (shipped same day, v2.9.3) interact badly with `emailRedirectTo: window.location.href` if someone signs in from a URL that includes a `?tab=` query param not in Supabase's exact Redirect URLs allowlist? That's a real hypothesis, untested.

Also check: is there any client-side double-submit possible (rapid double-click on "Send Link") that could trigger Supabase's OTP rate-limit/cooldown behavior in a way that looks like silent failure rather than a visible error?

### Priority 2: Security review

Known/documented security posture is in spec §9 (Privacy & Security Considerations) and §10 (RLS policies, Turnstile config). Go beyond what's already written down:
- RLS policies on `hives` and `checkins` (spec §4) — verify the stated policies actually match reality, don't just trust the doc.
- Public data exposure: every hive record's `name` field (observer name) and free-text `notes` field are publicly readable with no auth — confirmed Jul 22 2026 that a number of the 1,162 legacy notes contain incidental PII (phone numbers, "email me" invitations) typed directly into free text back in 2008–2015, never scrubbed. Not asking you to fix this — just confirm scope (how many records, what kind of PII) if useful for Ronnie's decision-making.
- Look for any exposed secrets, API keys, or credentials that shouldn't be client-visible (the Supabase anon key being public is expected/normal — that's how Supabase works with RLS; but check nothing else leaked in).
- Turnstile/Attack Protection config correctness — spec §10 flags a known historical gotcha (Supabase's captcha provider dropdown defaults to hCaptcha and must be manually switched to Turnstile, or tokens are always rejected) — verify this is still set correctly.
- `submitted_by` / `user_id` FK integrity — spec mentions a past bug where these landed null; confirm it stays fixed.

### Priority 3: Scalability

Spec has a dedicated "Mapping at Scale (around 5,000 hives)" section — read it first, it already covers Leaflet/MarkerCluster's known ceiling. Current known issues already logged, don't rediscover: records list pagination missing (shows first 50 only), mating radius overlay may be slow on low-end devices with 1,000+ pins visible at once. Beyond what's already flagged: look at query patterns (any N+1-style repeated Supabase calls?), the IndexedDB delta-sync cache (`app.js`, "INDEXEDDB CACHE" section) for correctness at larger record counts, and whether the service worker's caching strategy (`sw.js`) will hold up as the app shell or tile cache grows.

### Priority 4: General error handling

Look for unhandled promise rejections, missing try/catch around Supabase calls, error states that fail silently instead of surfacing a toast, and any place a network failure would leave the UI in a stuck/ambiguous state (e.g., a button stuck on "Sending…" forever). The offline-queue gap is already known and logged (spec §11, "Shelved Jul 17 2026" section) — don't re-flag that one, just be aware of it as context for how the app currently behaves offline (badly, by design-deferral, not by accident).

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
