-- Applied manually in dashboard on 2026-07-29, committed for reproducibility.

-- 1. Lookup function backing lib/friends.ts's lookupUserIdByCode. Runs as
-- the function owner (security definer) so it can read profiles.friend_code
-- to resolve a code to an id without granting broad table SELECT to callers.
create or replace function public.lookup_profile_id_by_code(lookup_code text)
returns uuid language sql security definer set search_path = public as $$
  select id from public.profiles where friend_code = upper(trim(lookup_code)) limit 1;
$$;
revoke all on function public.lookup_profile_id_by_code(text) from public;
grant execute on function public.lookup_profile_id_by_code(text) to authenticated;

-- 2. Narrowed profiles SELECT policy: replaces the old "any authenticated
-- user can look up any profile by code" policy (no longer needed now that
-- by-code lookups go through the security-definer function above) with one
-- scoped to the caller's own row and rows they have a pending or accepted
-- friend_requests connection with.
drop policy if exists "Authenticated users can look up any profile by code" on public.profiles;
create policy "Read own and connected profiles" on public.profiles
for select to authenticated using (
  id = (select auth.uid())
  or exists (
    select 1 from public.friend_requests fr
    where fr.status in ('pending','accepted')
      and ((fr.sender_id = (select auth.uid()) and fr.receiver_id = profiles.id)
        or (fr.receiver_id = (select auth.uid()) and fr.sender_id = profiles.id))
  )
);

-- 3. Column grant swap that locks down the push token: removes the blanket
-- table-level SELECT grant and replaces it with an explicit column list
-- that excludes expo_push_token (already covered by the 0001 migration's
-- REVOKE, this is the corresponding GRANT-side column restriction).
revoke select on public.profiles from authenticated, anon;
grant select (id, friend_code, created_at, display_name, notifications_enabled) on public.profiles to authenticated;
