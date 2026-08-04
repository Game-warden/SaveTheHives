-- v2_13_1_security_advisor_fixes.sql — applied directly via Supabase MCP
-- 2026-07-30. Recorded here for the repo's own history, same convention as
-- v2_6_sync.sql / v2_9_checkin_security_fix.sql / add_year_column.sql.
--
-- Both fixes found via Supabase's own Security Advisor panel (Ronnie
-- spotted the CRITICAL one first; the hives_auth_insert gap was found
-- during a full RLS policy review prompted by that report).

-- Fix 1: feature_ideas_with_votes was SECURITY DEFINER (runs with the
-- view creator's permissions instead of the querying user's, silently
-- bypassing RLS). Verified both underlying tables (feature_ideas,
-- feature_idea_votes) already grant public SELECT via their own RLS
-- policies, so switching to invoker-rights is a safe, zero-functional-
-- impact fix. Flagged CRITICAL by Supabase's linter.
alter view public.feature_ideas_with_votes set (security_invoker = true);

-- Fix 2: hives_auth_insert had an unconditional with_check (true), so any
-- signed-in user could insert a hive row with an arbitrary submitted_by
-- value rather than their own. This directly undermined the
-- contact-submitter relay feature (v2.13), which trusts submitted_by to
-- mean "the person who actually agreed to be contacted" — the gap would
-- have let someone fabricate a hive, set allow_contact = true, and put a
-- stranger's real user ID in submitted_by, causing that stranger to
-- receive contact-relay emails for a hive they never touched. Tightened
-- to match the already-correct hives_auth_update policy. Not flagged by
-- the advisor panel itself — found by reading every RLS policy on every
-- public table directly, prompted by Ronnie's "make sure nothing
-- widespread is going on" ask.
drop policy "hives_auth_insert" on public.hives;
create policy "hives_auth_insert" on public.hives
  for insert to authenticated
  with check (submitted_by = auth.uid());

-- Verified after applying: re-ran Supabase's security advisor and
-- confirmed the CRITICAL finding is gone. Remaining WARN-level items
-- (mutable search_path on set_hives_updated_at, submit_checkin's
-- intentional SECURITY DEFINER, leaked-password-protection which doesn't
-- apply since this app has no password auth) were reviewed and are
-- either low-priority or already-understood deliberate design.
