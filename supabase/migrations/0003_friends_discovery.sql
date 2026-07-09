-- Any-status friendship link (accepted OR pending, either direction).
-- SECURITY DEFINER so it can be referenced from the profiles RLS policy.
create or replace function public.has_friend_link(a uuid, b uuid)
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

revoke execute on function public.has_friend_link(uuid, uuid) from public, anon;
grant execute on function public.has_friend_link(uuid, uuid) to authenticated;

-- Broaden profile visibility to anyone linked by a friendship (pending included),
-- so incoming/outgoing requests can show the other person's username/avatar.
-- Activity (watch_entries) stays gated on ACCEPTED via are_friends — unchanged.
drop policy if exists "profiles_select_self_or_friends" on public.profiles;
create policy "profiles_select_self_or_linked" on public.profiles
  for select using (id = auth.uid() or public.has_friend_link(auth.uid(), id));

-- Discovery: find users by username without exposing the whole profiles table.
create or replace function public.search_profiles(q text)
returns table (id uuid, username text, avatar_url text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.username, p.avatar_url
  from public.profiles p
  where p.username is not null
    and p.id <> auth.uid()
    and p.username ilike '%' || q || '%'
  order by p.username
  limit 20;
$$;

revoke execute on function public.search_profiles(text) from public, anon;
grant execute on function public.search_profiles(text) to authenticated;
