-- v2.6 sync & offline support — run this once in Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)
-- Same pattern as ideas_and_voting.sql: Claude has no direct DB credential
-- access, so this must be run manually.
--
-- Two things:
--   1. updated_at tracking on hives, so the app can fetch only rows changed
--      since last sync instead of re-downloading the whole table every load.
--   2. submit_checkin(): one atomic RPC that logs a check-in AND updates the
--      hive's status/last_verified_at, replacing the old two-step
--      insert-then-update in submitCheckin() (which could partially fail —
--      e.g. checkin logged but hive status update fails, leaving them out
--      of sync).

-- ── 1. updated_at column + trigger ──────────────────────────────────────
alter table public.hives add column if not exists updated_at timestamptz;

-- Backfill existing rows from whichever timestamp we already have, so
-- nothing looks "never synced" after this migration runs.
update public.hives
set updated_at = coalesce(last_verified_at, submitted_at, now())
where updated_at is null;

alter table public.hives alter column updated_at set default now();
alter table public.hives alter column updated_at set not null;

create or replace function public.set_hives_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_hives_updated_at on public.hives;
create trigger trg_hives_updated_at
  before insert or update on public.hives
  for each row
  execute function public.set_hives_updated_at();

-- ── 2. Atomic check-in RPC ───────────────────────────────────────────────
-- SECURITY INVOKER (the default, stated explicitly here) means this runs
-- as the calling user, so the existing RLS policies on hives/checkins
-- still apply exactly as before — signed-out calls still fail the same
-- way a direct insert/update would. This does NOT loosen any permissions;
-- it just bundles two existing operations into one round trip and fixes
-- user_id being hardcoded to null in the old client-side insert.
create or replace function public.submit_checkin(
  p_hive_id uuid,
  p_status text,
  p_notes text default null
)
returns void
language plpgsql
security invoker
as $$
begin
  insert into public.checkins (hive_id, user_id, status, notes)
  values (p_hive_id, auth.uid(), p_status, p_notes);

  update public.hives
  set status = p_status,
      last_verified_at = now()
  where id = p_hive_id;
end;
$$;

grant execute on function public.submit_checkin(uuid, text, text) to anon, authenticated;
