<!--
SQL_HOUSEKEEPING_CHEATSHEET.md — quick reference, added Jul 29 2026.

Reusable SQL snippets for Ronnie to run in the Supabase SQL editor when
cleaning up test data, spam, or bad entries. Covers the `hives` and
`checkins` tables — the two most likely to need manual housekeeping.

RULE OF THUMB: always run the matching SELECT first and read the results
before running any DELETE. Every DELETE below has a SELECT right above it
for exactly this reason — swap one for the other, don't skip straight to
delete.
-->

# SQL Housekeeping Cheat Sheet

Run these in the Supabase dashboard → SQL Editor. Replace anything in
`<angle brackets>` with a real value — don't leave the brackets in.

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

## General safety habits

Always run the SELECT version of a query first and actually read the
results — don't assume. Match on `id` (exact) rather than a loose text
field whenever you're deleting a single record, so you can't accidentally
catch more than one row. Never run a bare `delete from hives` or
`delete from checkins` with no `WHERE` clause at all. If you're batch
deleting by keyword, double check the SELECT results don't include
anything you didn't expect before switching to DELETE.
