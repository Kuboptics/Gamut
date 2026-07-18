-- Adds remote push support: a device's Expo push token, and a per-user
-- on/off preference for the "a friend just submitted" nudge.
alter table profiles
  add column expo_push_token text,
  add column notifications_enabled boolean not null default true;

-- profiles almost certainly has a broad SELECT policy today (see
-- lib/friends.ts's lookupUserIdByCode, which looks up a stranger's id by
-- friend_code before any friendship exists — that only works if SELECT
-- isn't friend-scoped). That same broad policy would let any signed-in
-- client read expo_push_token and push-spam arbitrary users directly via
-- Expo's unauthenticated push API, bypassing every friend/already-played
-- check this feature relies on. Row-level RLS can't fix that — only a
-- column-level REVOKE closes it. The notify-friends Edge Function reads
-- this column with the service_role key, which bypasses grants entirely,
-- so it's unaffected by this REVOKE.
revoke select (expo_push_token) on public.profiles from authenticated, anon;

-- Before running this migration, confirm in the Supabase dashboard's
-- Policies view for `profiles`:
--   (a) an UPDATE policy scoped to auth.uid() = id exists, so a user can
--       write their own token/preference (updateDisplayName in
--       lib/friends.ts already depends on one, so this is very likely
--       already true) — nothing here adds one.
--   (b) what the current SELECT policy actually allows, so the REVOKE
--       above is known to be necessary and sufficient, not assumed.
