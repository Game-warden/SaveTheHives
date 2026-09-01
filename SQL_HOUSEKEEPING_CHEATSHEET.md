<!--
SQL_HOUSEKEEPING_CHEATSHEET.md — quick reference, added Jul 29 2026.
Visit Counter (D1) section added 2026-09-01.

Reusable SQL snippets for Ronnie to run when cleaning up test data, spam,
bad entries, or checking visit-counter stats. Covers the `hives` and
`checkins` tables (Supabase) plus the `visit_counts` table (Cloudflare
D1) — two entirely separate databases, run in two different dashboards.
See each section header for which one applies.

RULE OF THUMB: always run the matching SELECT first and read the results
before running any DELETE. Every DELETE below has a SELECT right above it
for exactly this reason — swap one for the other, don't skip straight to
delete.
-->

# SQL Housekeeping Cheat Sheet

The Hives and Check-ins sections below run in the Supabase dashboard →
SQL Editor. The Visit Counter section near the end runs somewhere
different — the Cloudflare dashboard's D1 console — since it's a
separate database; don't paste those queries into Supabase. Replace
anything in `<angle brackets>` with a real value — don't leave the
brackets in.

## Hives

### View a hive by ID
```sql
select * from hives where id = <1166>;
```

### Find a hive by ID on the live map (not SQL)
The map's search field only geocodes locations — it doesn't look up hives
by ID. To jump straight to a specific hive and open its popup, use the
app's deep-link URL instead:
```
https://savethehives.org/app/?hive=<1166>
```
Paste that directly into the browser address bar. Same mechanism the
app's own "Share This Hive" button uses.

### View recent submissions (spot new test entries)
```sql
select id, name, description, city, state, submitted_at, submitted_by
from hives
order by submitted_at desc
limit 20;
```

### "Conversions" — daily count of hive adds + check-ins combined
Ronnie's own term for engagement events: any new hive submission OR any
check-in counts as one "conversion" (someone taking an action on the map,
not just browsing). Quick daily rollup:
```sql
select day, count(*) as conversions from (
  select submitted_at::date as day from hives
  union all
  select created_at::date as day from checkins
) t
group by day
order by day desc;
```

### "Conversions" — expanded, one row per event (hive number, who, what)
Same union, but row-level detail instead of a daily count — added
2026-08-15 after Ronnie asked to see hive number and more context per
event, not just a per-day total. Shows event type (Hive Added vs
Check-in), the hive's id/name/city/state, the status or hive type as
`detail`, the submitter's email (via `auth.users`, admin-only join — works
in the Supabase SQL Editor since it runs with elevated privileges, same
reason the app itself never exposes emails client-side), and a ready-to-click
deep link to that hive's popup on the live map.
```sql
select
  event_type,
  event_at,
  hive_id,
  hive_name,
  city,
  state,
  detail,
  u.email as submitter_email,
  'https://savethehives.org/app/?hive=' || hive_id as hive_link
from (
  select 'Hive Added' as event_type, h.submitted_at as event_at, h.id as hive_id,
         h.name as hive_name, h.city, h.state, h.hivetype as detail,
         h.submitted_by as auth_id
  from hives h
  union all
  select 'Check-in' as event_type, c.created_at as event_at, c.hive_id,
         h.name as hive_name, h.city, h.state, c.status as detail,
         c.user_id as auth_id
  from checkins c
  join hives h on h.id = c.hive_id
) t
left join auth.users u on u.id = t.auth_id
order by event_at desc
limit 20;
```
`submitter_email` will be null for anonymous/legacy rows (no `auth_id` —
most pre-2026 legacy hives and a few early test check-ins were logged
without a signed-in user). Adjust `limit 20` or add `where event_at >=
now() - interval '7 days'` to scope it to a specific window.

### Search hives by keyword (name or description)
```sql
select id, name, description, city, state, submitted_at
from hives
where name ilike '%<keyword>%' or description ilike '%<keyword>%';
```
`ilike` is case-insensitive. The `%` wildcards match anything before/after
the keyword.

### Search hives by keyword in notes
```sql
select id, name, notes, submitted_at
from hives
where notes ilike '%<keyword>%';
```

### View hives from a specific submitter (by their auth user id)
```sql
select id, name, submitted_at
from hives
where submitted_by = '<user-uuid>';
```
Find a user's id via Supabase dashboard → Authentication → Users, or from
any hive row's `submitted_by` column.

### View hives with the contact opt-in enabled
```sql
select id, name, city, state, submitted_at
from hives
where allow_contact = true;
```

### Delete a hive by ID
Always check for related check-ins first — deleting the hive does **not**
automatically delete its check-ins.
```sql
select * from checkins where hive_id = <1166>;
-- if that returns rows and you want a clean delete:
delete from checkins where hive_id = <1166>;
delete from hives where id = <1166>;
```

### Delete hives matching a keyword (batch cleanup)
Run the SELECT first, read every row, confirm it's really junk before
switching to DELETE. Never skip straight to the DELETE version.
```sql
select id, name, description from hives where description ilike '%<keyword>%';
-- once confirmed:
delete from checkins where hive_id in (
  select id from hives where description ilike '%<keyword>%'
);
delete from hives where description ilike '%<keyword>%';
```

### Find test hives vs. test check-ins on a real hive (important distinction)
When hunting for "testing" junk, don't assume every hit is a fake hive —
sometimes the *hive* is completely real (a genuine legacy submission with a
real name/description) and only a *check-in* on it was a test. Deleting the
whole hive in that case would destroy real data. Always join hives and
check-ins together first and eyeball which is which before deciding what to
delete:
```sql
select h.id, h.name, h.description, h.city, h.state, h.submitted_at,
       c.id as checkin_id, c.notes as checkin_notes
from hives h
left join checkins c on c.hive_id = h.id
where h.name in ('Field Observer', 'Tester', 'Tester Dude')  -- known placeholder/test names
   or c.notes ilike '%test%'
order by h.submitted_at desc;
```
Then split the results into two groups before deleting:
- **Fully fake hives** (placeholder name, empty description, e.g. "Field
  Observer"/"Tester"/"Tester Dude" with no real content) — delete the hive
  and its check-in(s):
  ```sql
  delete from checkins where hive_id in (<id1>, <id2>, ...);
  delete from hives where id in (<id1>, <id2>, ...);
  ```
- **Real hives with a stray test check-in** (real name/description/city,
  but a check-in with notes like "Testing" or "Testing again") — delete
  only the check-in, leave the hive alone:
  ```sql
  delete from checkins where id in (<checkin_id1>, <checkin_id2>, ...);
  ```
Example from Jul 31 2026: hives 1163/1167/1168/1169/1170/1172/1173 were
fully fake ("Field Observer"/"Tester"/"Tester Dude") and got deleted
outright; check-ins 29/31/32 were "testing again" notes left on real
legacy hives (455, 885, 459 — the last one is Ronnie's own hive) and only
the check-ins were removed, hives kept.

## Check-ins (comments/status updates on a hive)

### View all check-ins for a hive
```sql
select id, status, notes, created_at, user_id
from checkins
where hive_id = <1166>
order by created_at desc;
```

### Search check-in notes by keyword
```sql
select id, hive_id, status, notes, created_at
from checkins
where notes ilike '%<keyword>%';
```

### Delete a single check-in by its own ID
```sql
select * from checkins where id = <checkin-id>;
delete from checkins where id = <checkin-id>;
```
Note: deleting a check-in does **not** revert the hive's `status` or
`last_verified_at` fields — those were already updated by `submit_checkin()`
at the time the check-in was made. If you need those reverted too, update
the hive row manually:
```sql
update hives set status = 'unverified', last_verified_at = null where id = <1166>;
```

### Delete all check-ins for a hive (without deleting the hive itself)
```sql
select * from checkins where hive_id = <1166>;
delete from checkins where hive_id = <1166>;
```

## Visit Counter (Cloudflare D1 — different dashboard, not Supabase)

Added 2026-09-01, when the visit counter migrated from Workers KV to D1
(see `SAVETHEHIVES_SPEC.md`'s Visit Counter section for the why). **Run
these in the Cloudflare dashboard, not the Supabase SQL Editor:** Workers
& Pages → D1 SQLite Database → `savethehives-visits` → either the
**Console** tab (simple one-line queries) or **Explore Data → Studio**
tab (full editor, better for anything longer). This is a completely
separate database from everything above — nothing here touches `hives`
or `checkins`, and none of the Supabase housekeeping habits below apply
to it (there's nothing to accidentally mass-delete; it's just counters).

Single table, `visit_counts`:
```sql
CREATE TABLE visit_counts (
  scope TEXT NOT NULL,   -- 'state' | 'city' | 'country'
  key   TEXT NOT NULL,   -- e.g. 'NC', 'Raleigh|NC', 'CA'
  day   TEXT NOT NULL,   -- 'YYYY-MM-DD', UTC
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, key, day)
);
```

### All-time total per state
```sql
select key as state, sum(count) as total
from visit_counts where scope = 'state'
group by key order by total desc;
```

### All-time total per city
```sql
select key as city, sum(count) as total
from visit_counts where scope = 'city'
group by key order by total desc;
```

### Daily trend for one state
```sql
select day, count from visit_counts
where scope = 'state' and key = 'NC'
order by day;
```

### Busiest day site-wide, last 30 days
```sql
select day, sum(count) as total from visit_counts
where day >= date('now', '-30 days')
group by day order by total desc;
```

### Non-US visitors by country
```sql
select key as country, sum(count) as total
from visit_counts where scope = 'country'
group by key order by total desc;
```

**Old KV data — still around, not yet ported.** Visit counts from
2026-07-29 through 2026-08-31 live in the old `savethehives-visits`
Workers KV namespace, left in place but disconnected — the middleware no
longer writes to it, and D1 started from zero on 2026-09-01. Ronnie
hasn't decided yet whether to do a one-time backfill of those KV totals
into D1 (they'd need to land under some placeholder date, since KV never
tracked per-day numbers). Until that decision is made, D1's numbers are
the complete picture only from 2026-09-01 forward — for the full
all-time total, the old KV values still need to be checked separately:
Cloudflare dashboard → Workers & Pages → KV → `savethehives-visits` →
browse keys directly (`state:NC`, `city:Raleigh|NC`, `country:CA`).

## General safety habits

Always run the SELECT version of a query first and actually read the
results — don't assume. Match on `id` (exact) rather than a loose text
field whenever you're deleting a single record, so you can't accidentally
catch more than one row. Never run a bare `delete from hives` or
`delete from checkins` with no `WHERE` clause at all. If you're batch
deleting by keyword, double check the SELECT results don't include
anything you didn't expect before switching to DELETE.
