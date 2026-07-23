# Sonnet 5 — Implement the Fable Audit Findings

Paste this as your opening message in a fresh Cowork session in the `SaveTheHives-pwa-claude` folder.

---

You're picking up implementation of a security/reliability audit that Claude Fable 5 completed on July 23, 2026. **This is an implementation session — you fix things, unlike the audit session which only documented them.**

## Read first, in this order
1. **`FABLE_AUDIT_FINDINGS_2026-07-23.md`** — the audit. Every finding has a severity, file/line refs, and a recommended fix. This is your work order.
2. **`CLAUDE.md`** — session reminders (the SW two-load rule; when to nudge me on friend invites).
3. **`SAVETHEHIVES_SPEC.md`** §9/§10/§11 — architecture, RLS, known issues. Don't re-solve anything already logged there.

Don't re-derive the audit's reasoning — trust the findings doc and implement against it. If you disagree with a recommended fix, say so before writing code.

## Ground rules
- **No build step, everything in global scope.** Plain `<script>` tags; inline `onclick` handlers depend on globals — do **not** convert to ES modules.
- **`CACHE_VERSION` bump is mandatory.** Any commit touching `app.js` / `index.html` / `styles.css` / `sw.js` / `pathfinder.js` / `manifest.json` must bump `CACHE_VERSION` in `sw.js` in the *same* commit, or returning visitors serve stale code forever. Bump it once per deploy (e.g. v2.9.5), and update the comment.
- **You cannot push to git.** When changes are ready, give me the exact `git add -A && git commit -m "..." && git push` command to run myself. Don't assume it ran.
- **Two-load rule.** After I push, remind me to reload twice / close-reopen the tab before checking whether the change is live.
- **Some fixes are dashboard-only (Supabase/Resend), not code.** I have to make those. Tell me exactly what to click; don't try to reach them yourself.

## What I still owe you (paste these in when you ask)
The audit's dashboard checklist (bottom of the findings doc). I'll fetch and paste: Resend logs + domain verification status, Supabase Auth logs, and the current `hives` UPDATE policy. **Ask me for these before finalizing the sign-in (P1) and RLS (2b) work** — they change the diagnosis.

## Suggested order (from the audit; do the pre-invite items first)
I'm holding ~188 Facebook friend invites until sign-in is trusted and the site is safe for outside traffic, so front-load the ones that protect first impressions:

1. **🔴 2a — Stored XSS.** Add a small `escapeHtml()` helper; apply to `name`/`description`/`city`/`state`/`zip` in the popup (`app.js:426`) and records list (`app.js:802`); add `maxlength` to `form-name` and `form-desc`. Do **not** pull in a heavy sanitizer library. (The most-recent-checkin note is already safe via `textContent` — leave it.)
2. **🟠 2b — `hives` UPDATE policy.** Dashboard verify with me; if it's not owner-scoped, tighten it (mind the legacy `submitted_by = null` rows and the `submit_checkin` RPC path).
3. **🟠 1b — `emailRedirectTo` + Redirect URLs.** Strip query/hash in code (`app.js:1410`); have me add the `/**` wildcard entries in Supabase.
4. **🟠 1a — Sign-in reliability.** Pin `supabase-js` (drop the floating `@2` in `index.html:299`); add a `BroadcastChannel` multi-tab warning toast. Decide the lock/`autoRefreshToken` approach *after* seeing my Auth logs.
5. **🟡 1c — Re-entrancy guard** on `submitSignIn()`.
6. **🟡 4a — Cold-load error toast**, then **🟡 5a — `resize`/`orientationchange` → `map.invalidateSize()`**, then the remaining ⚪ low items as time allows.

## How I like to work
- Give me **numbered lists** for any multi-option decision — I'll reply with the numbers I pick (e.g. "1,3,4").
- Make changes in focused commits with clear messages; after each, hand me the git commands.
- Verify your own work before declaring done (diff review, and ideally load the change locally). For the XSS fix specifically, show me a before/after of what a malicious `name` renders as.

Start by reading the three docs above, then confirm your plan for item 1 (the XSS fix) before writing any code.
