-- d1_visit_counter_schema.sql — Cloudflare D1 (SQLite at the edge), NOT Supabase.
-- Added 2026-08-31, replacing the KV-based visit counter (v2.14, 2026-07-29).
--
-- Why: the KV counter hit Cloudflare's free-tier daily write cap (1,000
-- puts/day) from a burst of automated/scraper traffic (see chat 2026-08-31
-- for the traffic investigation — ruled out AI crawlers and legitimate
-- search engines; looked like generic bot/scraper noise from cloud-hosted
-- IPs). KV's get-then-write pattern was also non-atomic (documented as a
-- known limitation in SAVETHEHIVES_SPEC.md), so concurrent requests could
-- silently lose an increment. D1's free tier is 100,000 row-writes/day
-- (100x KV's cap) and a single UPSERT is atomic — fixes both problems.
--
-- Bonus: adding a `day` column (instead of one all-time cumulative KV key
-- per state/city) unlocks real trend queries — daily/weekly breakdowns,
-- growth over time — that the flat KV counter could never do, while
-- staying fully aggregate. No per-visitor row, no cookie, no IP stored —
-- same privacy posture as before, just with a time dimension added.
--
-- Run this once in the Cloudflare dashboard → Workers & Pages → D1 →
-- (new database) → Console, after creating the `savethehives-visits` D1
-- database and binding it to the Pages project as `VISITS_DB` (see
-- SAVETHEHIVES_SPEC.md's Visit Counter section for the full one-time
-- setup steps).

CREATE TABLE IF NOT EXISTS visit_counts (
  scope TEXT NOT NULL,   -- 'state' | 'city' | 'country'
  key   TEXT NOT NULL,   -- e.g. 'NC', 'Raleigh|NC', 'CA' (non-US country code)
  day   TEXT NOT NULL,   -- 'YYYY-MM-DD', UTC
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, key, day)
);

-- Example queries for the D1 Console (same spirit as
-- SQL_HOUSEKEEPING_CHEATSHEET.md's Supabase queries, just a different
-- database):

-- All-time total per state (mirrors what the old KV `state:NC` key showed):
-- select key as state, sum(count) as total
-- from visit_counts where scope = 'state' group by key order by total desc;

-- Trend over the last 30 days for one state:
-- select day, count from visit_counts
-- where scope = 'state' and key = 'NC' order by day;

-- Busiest day site-wide in the last 30 days:
-- select day, sum(count) as total from visit_counts
-- where day >= date('now', '-30 days') group by day order by total desc;
