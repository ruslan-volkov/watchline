-- Extensions for scheduling HTTP calls to the digest Edge Function.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Expo push tokens per user/device (insert + delete only; no updates needed).
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  platform text,
  created_at timestamptz not null default now(),
  unique (user_id, token)
);
create index idx_push_tokens_user on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "push_tokens_select_own" on public.push_tokens
  for select using (user_id = auth.uid());
create policy "push_tokens_insert_own" on public.push_tokens
  for insert with check (user_id = auth.uid());
create policy "push_tokens_delete_own" on public.push_tokens
  for delete using (user_id = auth.uid());

-- Daily digest schedule (08:00 UTC). Applied out-of-band because it embeds the
-- CRON_SECRET; replace <CRON_SECRET> when re-applying to a fresh project:
--
-- select cron.schedule(
--   'watchline-daily-digest', '0 8 * * *',
--   $$ select net.http_post(
--        url := 'https://<project-ref>.supabase.co/functions/v1/daily-digest',
--        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
--        body := '{}'::jsonb
--   ); $$
-- );
