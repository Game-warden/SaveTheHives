# Don't-Forget Bucket

Running list of ideas/issues that came up but aren't worth acting on yet —
revisit each when its trigger condition is met, not on a schedule.

---

### SciStarter Affiliate Program (Participation API)
**Added:** 2026-08-08
**Trigger to revisit:** Once the SciStarter listing is actually published
(editor review pending as of today) *and* it's driving some real traffic/
volunteers worth tracking.

Free (confirmed via scistarter.org/api — "3 free tools," no pricing tier),
but not free effort: requires implementing SciStarter's Participation API —
a webhook/API call from the check-in/add flow reporting contributions back
to SciStarter — so it's a real dev task, not a toggle. Payoff: participant-
level analytics on the SciStarter side, plus eligibility for curated
programming with partners like Girl Scouts, PBS, Discover, schools, and
libraries. Not worth building speculatively before the listing has any
traffic to track.

### Cloudflare KV visit counter — noisy signal
**Added:** 2026-08-08 (issue first raised ~2026-08-07)
**Trigger to revisit:** If the counter climbs a lot further and Ronnie wants
a cleaner read on real vs. bot/self traffic, or before using the KV numbers
in any external-facing report.

`functions/_middleware.js` counts any request with `sec-fetch-dest: document`
— filters out sub-resource requests and simple non-browser bots, but has no
exclusion for Ronnie's own visits or real browser-engine crawlers (Googlebot's
renderer, now more active post sitemap-submission). Root `/`, `/app/`, and
`/privacy.html` each count separately too. Not necessarily bad traffic, just
not a reliable engagement signal on its own — cross-check against Cloudflare
Web Analytics (Top Paths/User Agents) or Supabase hive/checkin counts instead
of reading the KV number alone.

---

*Add new entries above this line, newest on top.*
