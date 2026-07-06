-- Bug fix: add missing 'year' column to hives — run this once in Supabase
-- SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Same pattern as ideas_and_voting.sql / v2_6_sync.sql: Claude has no
-- direct DB credential access, so this must be run manually.
--
-- Context: the Add Hive form has always had a "Year" field (letting
-- someone log a hive they actually first saw in a past year, distinct
-- from when they got around to entering it in the app), and app.js's
-- dbRowToHive() has always read row.year — but the hives table never
-- actually had this column, so every Add Hive submission has been
-- failing with "Could not find the year column of 'hives' in the schema
-- cache." This adds the column for real and backfills existing rows.

alter table public.hives add column if not exists year int;

-- Backfill existing rows that don't have a year yet, using the year
-- portion of submitted_at as the best available estimate.
update public.hives
set year = extract(year from submitted_at)::int
where year is null and submitted_at is not null;
