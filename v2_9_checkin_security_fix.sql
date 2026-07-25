-- v2.9 check-in security fix — run this once in Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)
-- Claude has no direct DB credential access, so this must be run manually.
--
-- Why this file exists: v2_6_sync.sql (as checked into the repo) declared
-- submit_checkin(p_hive_id uuid, ...) with SECURITY INVOKER and granted
-- EXECUTE to anon+authenticated. Two problems, found during the 2026-07-23
-- Fable audit's 2b review and fixed live in the SQL Editor that same day:
--
--   1. hives.id is bigint, not uuid. A bigint like 885 can never parse as a
--      uuid, so EVERY call to submit_checkin() failed with
--      "invalid input syntax for type uuid" — every check-in, by any user,
--      had been silently failing since the v2.6 rollout.
--   2. The `hives` UPDATE policy was `using (true) with check (true)` —
--      any signed-in user could overwrite any hive. Tightening it to
--      `submitted_by = auth.uid()` is correct, but submit_checkin() ran
--      SECURITY INVOKER, so its internal `update hives` would then run
--      under the *caller's* RLS — silently failing (0 rows matched, no
--      error) whenever someone checked in on a hive they didn't submit,
--      i.e. nearly all of them. Converting submit_checkin() to SECURITY
--      DEFINER fixes that, but a DEFINER function bypasses RLS for its
--      entire body, so it needs its own auth.uid() guard to avoid
--      reopening the anonymous-checkin hole v2.9.1 had closed.
--
-- This file is idempotent — safe to re-run. It reflects what is already
-- live in production as of 2026-07-25 (verified via pg_get_functiondef,
-- pg_policies, and information_schema.role_routine_grants), plus one
-- additional hardening step below (the PUBLIC/anon grant) that was not
-- yet live as of that verification.

-- ── 1. hives UPDATE policy — owner-scoped ───────────────────────────────
-- Legacy rows have submitted_by = null, so this correctly locks them to
-- no one via direct UPDATE. submit_checkin() (below) still handles status
-- updates on any hive via SECURITY DEFINER.
drop policy if exists "hives_auth_update" on public.hives;
create policy "hives_auth_update"
on public.hives
for update
to authenticated
using (submitted_by = auth.uid())
with check (submitted_by = auth.uid());

-- ── 2. submit_checkin() — bigint param, SECURITY DEFINER, guarded ───────
-- Drop the old mistyped overload first (uuid param can never match a
-- bigint hives.id, so this overload was permanently broken).
drop function if exists public.submit_checkin(uuid, text, text);

create or replace function public.submit_checkin(
  p_hive_id bigint,
  p_status text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- SECURITY DEFINER bypasses RLS for this entire function body, so this
  -- explicit guard replaces what RLS would otherwise enforce. Without it,
  -- the anon key could call this and log a checkin as anon (the exact
  -- hole v2.9.1 closed on the client-side insert path).
  if auth.uid() is null then
    raise exception 'Must be signed in to check in on a hive';
  end if;

  insert into public.checkins (hive_id, user_id, status, notes)
  values (p_hive_id, auth.uid(), p_status, p_notes);

  update public.hives
  set status = p_status,
      last_verified_at = now()
  where id = p_hive_id;
end;
$$;

-- ── 3. Grant hardening ───────────────────────────────────────────────────
-- New functions get EXECUTE granted to PUBLIC by default in Postgres,
-- which anon inherits regardless of whether anon has its own explicit
-- grant. The auth.uid() guard above already blocks anon calls, but
-- relying solely on an in-body check is one layer — if this function is
-- ever edited and the guard is dropped, the loose PUBLIC grant would
-- silently reopen the hole with no other signal. Belt-and-suspenders:
-- revoke from PUBLIC, grant only to authenticated.
revoke execute on function public.submit_checkin(bigint, text, text) from public;
revoke execute on function public.submit_checkin(bigint, text, text) from anon;
grant execute on function public.submit_checkin(bigint, text, text) to authenticated;
