-- One random token per user, put in the webhook address that Radarr / Sonarr call
-- when a download finishes. The NAS has no Supabase session, so the address itself
-- is the credential: the Edge Function looks the token up to find whose devices to
-- push to. The app creates the row on first view of the NAS screen (insert is
-- RLS-limited to the caller's own id; the token comes from the column default).
create table public.nas_webhook_tokens (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.nas_webhook_tokens enable row level security;

create policy "nas_webhook_tokens_select_own" on public.nas_webhook_tokens
  for select using (user_id = auth.uid());
create policy "nas_webhook_tokens_insert_own" on public.nas_webhook_tokens
  for insert with check (user_id = auth.uid());

-- Privileges mirror the policies (see 0010). The Edge Function reads the table
-- with service_role to resolve a token to its user.
grant select, insert on public.nas_webhook_tokens to authenticated;
grant select on public.nas_webhook_tokens to service_role;
