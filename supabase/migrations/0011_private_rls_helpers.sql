-- The two friendship helpers exist only to be called from RLS policies, but living in
-- `public` also made them reachable over REST as /rest/v1/rpc/are_friends. Since
-- search_profiles hands out profile ids, any signed-in caller could probe arbitrary
-- uuid pairs and rebuild the friendship graph — exactly what activity_visible is
-- there to prevent.
--
-- They cannot simply lose their EXECUTE grant: a policy expression is evaluated as the
-- querying role, so `authenticated` still has to be allowed to call them (see the note
-- in 0002). SECURITY DEFINER only changes the context inside the function. Moving them
-- to a schema PostgREST does not serve keeps the grant and removes the RPC surface.
--
-- search_profiles stays in `public` on purpose: friend discovery calls it directly.

create schema if not exists private;

-- A new schema carries no default grants, and these run as the caller, so
-- `authenticated` needs USAGE. PostgREST only routes the schemas it is configured
-- with, so granting this does not re-expose them.
grant usage on schema private to authenticated, service_role;

-- ============ Helpers, bodies unchanged from 0001 / 0003 ============

create or replace function private.are_friends(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.user_id = a and f.friend_id = b) or (f.user_id = b and f.friend_id = a))
  );
$$;

revoke execute on function private.are_friends(uuid, uuid) from public, anon;
grant execute on function private.are_friends(uuid, uuid) to authenticated, service_role;

-- Any-status friendship link (accepted OR pending, either direction), so incoming and
-- outgoing requests can still show the other person's username and avatar.
create or replace function private.has_friend_link(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.friendships f
    where (f.user_id = a and f.friend_id = b) or (f.user_id = b and f.friend_id = a)
  );
$$;

revoke execute on function private.has_friend_link(uuid, uuid) from public, anon;
grant execute on function private.has_friend_link(uuid, uuid) to authenticated, service_role;

-- ============ Repoint the policies ============
-- Identical predicates; only the helper's schema changes.

drop policy if exists "profiles_select_self_or_linked" on public.profiles;
create policy "profiles_select_self_or_linked" on public.profiles
  for select using (id = auth.uid() or private.has_friend_link(auth.uid(), id));

drop policy if exists "watch_entries_select_own_or_visible_friend" on public.watch_entries;
create policy "watch_entries_select_own_or_visible_friend" on public.watch_entries
  for select using (
    user_id = auth.uid()
    or (
      private.are_friends(auth.uid(), user_id)
      and exists (select 1 from public.profiles p where p.id = user_id and p.activity_visible)
    )
  );

drop policy if exists "episode_progress_select_own_or_visible_friend" on public.episode_progress;
create policy "episode_progress_select_own_or_visible_friend" on public.episode_progress
  for select using (
    exists (
      select 1 from public.watch_entries e
      where e.id = entry_id
        and (
          e.user_id = auth.uid()
          or (
            private.are_friends(auth.uid(), e.user_id)
            and exists (select 1 from public.profiles p where p.id = e.user_id and p.activity_visible)
          )
        )
    )
  );

-- ============ Drop the exposed copies ============
-- Only safe once no policy references them any more.

drop function if exists public.are_friends(uuid, uuid);
drop function if exists public.has_friend_link(uuid, uuid);
