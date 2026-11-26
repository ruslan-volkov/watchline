-- A title recommended to a friend. One row per (sender, recipient, title): sending it
-- again is a nudge on the same row, not a second recommendation.
--
-- Rows are only written by the recommend-media Edge Function, which checks the
-- friendship and enforces the nudge limits. A client that could insert or update them
-- directly could step around both, so `authenticated` gets no insert, and only the
-- recipient's own column below as update.
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  message text check (char_length(message) <= 140),
  created_at timestamptz not null default now(),
  last_nudged_at timestamptz,
  nudge_count smallint not null default 0,
  -- Set when the recipient adds the title from the recommendation: a reply they chose
  -- to give, so it is the one thing the sender may learn, even with activity hidden.
  added_at timestamptz,
  unique (sender_id, recipient_id, media_id),
  check (sender_id <> recipient_id)
);

create index idx_recommendations_recipient on public.recommendations (recipient_id);
create index idx_recommendations_media on public.recommendations (media_id);

-- What the recipient did with it. Separate from `recommendations` because RLS filters
-- rows, not columns: on the same row, the sender could read "Pas pour moi" and read
-- receipts through the API, whatever the app chooses to display.
create table public.recommendation_inbox (
  recommendation_id uuid primary key references public.recommendations (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  seen_at timestamptz,
  dismissed_at timestamptz
);

create index idx_recommendation_inbox_recipient on public.recommendation_inbox (recipient_id);

-- Every recommendation has its inbox row, created in the same transaction.
create or replace function public.create_recommendation_inbox()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.recommendation_inbox (recommendation_id, recipient_id)
  values (new.id, new.recipient_id);
  return new;
end;
$$;

create trigger recommendations_create_inbox
after insert on public.recommendations
for each row execute function public.create_recommendation_inbox();

revoke execute on function public.create_recommendation_inbox() from public, anon, authenticated;

alter table public.recommendations enable row level security;
alter table public.recommendation_inbox enable row level security;

-- Unfriending hides recommendations from both sides; becoming friends again brings
-- them back.
create policy "recommendations_select_involved" on public.recommendations
  for select using (
    (sender_id = auth.uid() or recipient_id = auth.uid())
    and private.are_friends(sender_id, recipient_id)
  );
create policy "recommendations_update_recipient" on public.recommendations
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create policy "recommendation_inbox_select_recipient" on public.recommendation_inbox
  for select using (recipient_id = auth.uid());
create policy "recommendation_inbox_update_recipient" on public.recommendation_inbox
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Same reason for a separate switch as friend_requests_enabled (0012).
alter table public.profiles
  add column if not exists recommendations_enabled boolean not null default true;

-- Privileges mirror the policies (see 0010). Column-level updates keep the message and
-- the nudge counters out of the recipient's reach even on their own rows.
grant select on public.recommendations to authenticated;
grant update (added_at) on public.recommendations to authenticated;
grant select on public.recommendation_inbox to authenticated;
grant update (seen_at, dismissed_at) on public.recommendation_inbox to authenticated;

-- The Edge Function, which also reads friendships to check who is whose friend. The
-- insert on the inbox is what the trigger needs, as it runs as the function's role.
grant select, insert, update on public.recommendations to service_role;
grant select, insert, update on public.recommendation_inbox to service_role;
grant select on public.friendships to service_role;
