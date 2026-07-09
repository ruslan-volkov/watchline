-- Fix mutable search_path on set_updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- handle_new_user is only invoked by the auth trigger; remove RPC exposure entirely
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- are_friends is referenced by RLS policies (needs authenticated EXECUTE) but should
-- not be reachable by anonymous callers via RPC
revoke execute on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
