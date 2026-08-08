<!--
MARKETING_STRATEGY.md — requested by Ronnie Jul 31 2026: "put on your
marketing hat... best approach to drive more people to visit and
understand savethehives.org... ideally validate the legacy hives we
already have."

This is a synthesis document, not a from-scratch plan — nearly every
channel below already has real work behind it (see the cross-references).
The job here is to name the single number that should drive every
decision, put it in front of every existing effort, and sequence what's
left. Pulled fresh from the live Supabase project (nsujmizdawyoictpawxt)
Jul 31 2026 — re-run the queries in §1 periodically to keep this current.
-->

# SaveTheHives — Marketing Strategy

## 1. The number that should drive everything

I pulled current stats directly from the database before writing this:

- **1,158 total hives** on the map. **1,156 are legacy** (2008–2017 imports); only **2** have been added since relaunch.
- **Only 9 hives have ever been validated. 1,149 (99.2%) have never been checked, ever.**
- Status breakdown: 2 active, 6 uncertain, 1 gone, **1,149 unverified** — "unverified" isn't a small bucket, it's essentially the entire dataset.
- **819 distinct named submitters** across those legacy records (102 of them logged more than one hive — that's the group already in `Legacy_Submitter_Outreach_Tracker.xlsx`; the other ~717 are one-time submitters not yet touched by any outreach).
- Geographic concentration: **NC (236 hives)** and **CA (101)** are the two real clusters; Puerto Rico (42), VA (35), OH (30), NY (29), FL (24), WA (18) trail well behind. Everything else is single digits to low teens.

This changes the framing for the whole marketing effort. **The story isn't "help us build a map" — the map is basically already built. The story is "help us find out if what's already on the map is still there."** That's a more honest pitch, it's a smaller ask (validating takes under a minute, per `CONTENT_LIBRARY_IDEAS.md` item #15), and it's the exact thing Dr. Tarpy told you directly he thinks should be the project's central focus (`MEETING_NOTES_2026-07-21_Tarpy.md`: "Validate over Add"). Every channel below should lead with some version of the "99% never checked" stat — it's a genuinely startling number and it's true.

## 2. Audience segments, ranked by leverage

**A. The 102 repeat legacy submitters** — already-engaged people who logged multiple hives, already have real contact info work done (`Legacy_Submitter_Outreach_Tracker.xlsx`), already have a proven email template, already have one real send (Tom Glenn) and one lesson learned (Joe Nicolay's email and phone both dead — expect real attrition on 15-20-year-old contact info, that's normal, not a signal to stop). Highest-leverage audience that exists: they already found a colony once, they just need to be told it's worth checking again. **This is mid-flight — see §4.**

**B. NC beekeeping community** — your home turf, the density center (236 hives), and where every existing relationship lives (Tarpy, NC State, the pending Wake County Beekeepers intro). This is the cheapest audience to reach in person, not just online — a single beekeeping-association meeting talk reaches more engaged people in one evening than weeks of cold Facebook posting.

**C. CA beekeeping community** — the second real cluster (101 hives) with zero relationship built yet. Worth a dedicated push once the NC playbook is proven, using the same legacy-submitter-reactivation approach (there will be a CA-heavy slice of the ~717 one-time submitters not yet in the tracker).

**D. The ~717 one-time legacy submitters** — lower priority than the 102 repeats (less proven engagement), but a real reserve audience once the repeat-submitter outreach is running smoothly. Same playbook, next batch.

**E. Active beekeeping Facebook groups (~15 and counting)** — good for broad awareness and finding new validators, less good for actually generating validations directly (a stranger scrolling Facebook doesn't have a specific hive to check on — the legacy submitters do). Best used to recruit *new* Add/Validate participants and build page following, not as the primary validate-the-backlog engine.

**F. Researchers & academic institutions** — the credibility layer (Tarpy confirmed, Delaney/Mahood contacted, 25 more queued in `University_Bee_Research_Contacts.xlsx`). Doesn't directly drive validations, but every researcher relationship is a distribution multiplier (their students, their extension audiences, their own social reach) and it's what makes press coverage plausible.

**G. General public / press / Scouts / schools** — long-term reach plays (`CONTENT_LIBRARY_IDEAS.md` Tiers 1–3), valuable but slower to pay off than A–C. Treat as the "later" tier, not the current push.

## 3. The core positioning shift

Nearly every existing piece of content — the Facebook Starter Pack, the landing page, the app's own onramp overlay — currently splits attention evenly between "log a new hive" and "confirm an old one." Given the 99.2% number above, that's backwards. `CONTENT_LIBRARY_IDEAS.md` item #15 ("Elevate Validate as the Primary On-Ramp") already scoped the fix and it's still unbuilt:

- The app's first-visit onramp overlay should lead with a stat-driven Validate hook, not "explore the map" generically.
- A persistent stale-hive-count nudge for returning visitors.
- Validate treated as its own funnel destination on the Learn hub, not folded into "log a hive."

This is the single highest-leverage unbuilt item on the table — it costs no new backend work, and it means every visitor from every channel below lands on a page already making the strongest possible ask.

**New headline stat to use everywhere going forward:** *"1,149 of the 1,158 wild colonies on our map haven't been checked on since they were first logged — some for over 15 years. A one-minute visit could tell us whether any of them are still alive."* This is more specific and more urgent than the "1,150+ historical records" line currently used in `FACEBOOK_STARTER_PACK.md` and the landing page — worth updating both.

## 4. Channel plan

### Already in motion — keep running, just re-point toward Validate

- **Legacy submitter outreach** (`Legacy_Submitter_Outreach_Tracker.xlsx`) — 102 people, Tom Glenn sent, Joe Nicolay bounced/dead-ended. Next: work down the list roughly in Hive Count order (already sorted that way) — the highest-hive-count people are both the best validation candidates and the most likely to still recognize the project. Budget for a real bounce/non-response rate; that's expected, not a sign the approach is wrong.
- **Facebook weekly rotation** (`FACEBOOK_POST_LOG.md`) — already running Mon/Wed/Sun. Keep it, but per `CONTENT_LIBRARY_IDEAS.md`'s own cross-cutting note, weight new copy more toward "here's a specific stale hive, go check it" rather than generic mission content.
- **Research post series** (`RESEARCH_POST_SERIES.md`) — good credibility content, keep to its own cadence (roughly every 2 weeks) so it doesn't crowd out direct Validate asks.
- **University/researcher outreach** (`University_Bee_Research_Contacts.xlsx`) — keep working the list; each new confirmed relationship is a distribution multiplier, not a direct validator source.

### Concrete next moves, roughly in priority order

1. **Ship the Validate-first onramp** (`CONTENT_LIBRARY_IDEAS.md` #15) — highest leverage, no new backend, makes every other channel more effective retroactively. Worth doing before investing more in traffic-driving, since right now new traffic lands on a split-focus pitch.
2. **List on SciStarter's Project Finder** (scistarter.org/finder) — flagged in `FACEBOOK_STARTER_PACK.md` §7 as a one-time, low-effort, durable-payoff move, still not done. Puts the project in front of people actively looking for a citizen-science project, which is a much warmer audience than a cold Facebook scroll.
3. **Submit the sitemap to Google Search Console** — flagged since the v2.11 landing-page restructure (`CLAUDE.md`), still needs your own Google account. Low effort, compounding SEO payoff, worth just doing.
4. **Send the Wake County Beekeepers intro** — blocked only on confirming the contact-name discrepancy (Chris vs. Stacy Hagwood, `KEY_PEOPLE_CONTACTS.md`). This is a live-person, in-person-adjacent channel in your highest-density state; disproportionately high leverage for the effort.
5. **A CA-specific push**, built the same way as the NC/legacy-submitter one, once the first round of legacy outreach has a few weeks of real results to learn from (response rate, which subject lines/asks land, etc.) — don't parallelize both cold until one is validated.
6. **The Researcher & Collaborator Brief** (`CONTENT_LIBRARY_IDEAS.md` #12) — makes the eventual press pitch and any new researcher conversation land better; worth building once Tarpy's bio synopsis is in hand so both can go out together.

### Deliberately lower priority right now

- Scout/classroom kit, landowner one-pager, bee-box printable plan (`CONTENT_LIBRARY_IDEAS.md` #1, #10, #11) — all genuinely good, all Add-side rather than Validate-side content. Worth building once the Validate push is running, not before — they recruit new hunters, which isn't this quarter's bottleneck (the bottleneck is confirming what's already found).
- Paid promotion of any kind — zero-budget project by design (`FACEBOOK_STARTER_PACK.md` §10), no reason to revisit that.

## 5. Measuring whether any of this is working

The one KPI that matters more than raw visits: **how many of the 1,149 never-validated hives get their first check-in.** Visit counts and Facebook engagement are proxies; this is the actual goal. A simple query against `hives.last_verified_at` (or a `checkins` count) run monthly would track this directly — worth adding as a recurring check now that there's a real campaign to measure against.

Secondary signals already in place: the Cloudflare KV state/city visit counter (worth the date-bucketing upgrade discussed earlier if this campaign ramps up — makes it possible to see whether a specific push moved a specific region), and Cloudflare Pages' built-in Analytics tab for overall traffic trend lines.

## 6. The 90-second version, if you want to just repeat this back to someone

*"Nine hundred and ninety-nine out of every thousand wild bee colonies on our map haven't been checked on in years — some since 2008. We're not asking people to go find new bees, mostly. We're asking them to spend one minute confirming whether the ones we already found are still alive. That's the whole campaign."*
