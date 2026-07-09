-- ============ Enums ============
create type media_type as enum ('movie', 'tv');
create type watch_status as enum ('plan_to_watch', 'watching', 'completed');
create type theme_pref as enum ('system', 'light', 'dark');
create type density_pref as enum ('comfortable', 'compact');
create type friendship_status as enum ('pending', 'accepted');

-- ============ Tables ============
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  avatar_url text,
  activity_visible boolean not null default true,
  theme_preference theme_pref not null default 'system',
  density_preference density_pref not null default 'comfortable',
  digest_enabled boolean not null default true,
  digest_time time not null default '09:00',
  created_at timestamptz not null default now()
);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  status friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer not null,
  media_type media_type not null,
  title text not null,
  poster_path text,
  release_date date,
  created_at timestamptz not null default now(),
  unique (tmdb_id, media_type)
);

create table public.watch_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  status watch_status not null default 'plan_to_watch',
  rating smallint check (rating between 1 and 5),
  notes text,
  started_at date,
  finished_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, media_id)
);

create table public.episode_progress (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.watch_entries (id) on delete cascade,
  season_number integer not null,
  episode_number integer not null,
  watched_at date not null default current_date,
  unique (entry_id, season_number, episode_number)
);

create index idx_watch_entries_user on public.watch_entries (user_id);
create index idx_watch_entries_media on public.watch_entries (media_id);
create index idx_episode_progress_entry on public.episode_progress (entry_id);
create index idx_friendships_friend on public.friendships (friend_id);

-- ============ Helper: are_friends (SECURITY DEFINER avoids RLS recursion) ============
create or replace function public.are_friends(a uuid, b uuid)
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

-- ============ New user -> profile ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ updated_at maintenance ============
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger watch_entries_set_updated_at
before update on public.watch_entries
for each row execute function public.set_updated_at();

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.media enable row level security;
alter table public.watch_entries enable row level security;
alter table public.episode_progress enable row level security;

-- profiles
create policy "profiles_select_self_or_friends" on public.profiles
  for select using (id = auth.uid() or public.are_friends(auth.uid(), id));
create policy "profiles_insert_self" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- media (shared cache for authenticated users)
create policy "media_select_authenticated" on public.media
  for select to authenticated using (true);
create policy "media_insert_authenticated" on public.media
  for insert to authenticated with check (true);

-- watch_entries
create policy "watch_entries_select_own_or_visible_friend" on public.watch_entries
  for select using (
    user_id = auth.uid()
    or (
      public.are_friends(auth.uid(), user_id)
      and exists (select 1 from public.profiles p where p.id = user_id and p.activity_visible)
    )
  );
create policy "watch_entries_insert_own" on public.watch_entries
  for insert with check (user_id = auth.uid());
create policy "watch_entries_update_own" on public.watch_entries
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "watch_entries_delete_own" on public.watch_entries
  for delete using (user_id = auth.uid());

-- episode_progress (via parent entry)
create policy "episode_progress_select_own_or_visible_friend" on public.episode_progress
  for select using (
    exists (
      select 1 from public.watch_entries e
      where e.id = entry_id
        and (
          e.user_id = auth.uid()
          or (
            public.are_friends(auth.uid(), e.user_id)
            and exists (select 1 from public.profiles p where p.id = e.user_id and p.activity_visible)
          )
        )
    )
  );
create policy "episode_progress_insert_own" on public.episode_progress
  for insert with check (
    exists (select 1 from public.watch_entries e where e.id = entry_id and e.user_id = auth.uid())
  );
create policy "episode_progress_delete_own" on public.episode_progress
  for delete using (
    exists (select 1 from public.watch_entries e where e.id = entry_id and e.user_id = auth.uid())
  );

-- friendships
create policy "friendships_select_involved" on public.friendships
  for select using (user_id = auth.uid() or friend_id = auth.uid());
create policy "friendships_insert_requester" on public.friendships
  for insert with check (user_id = auth.uid());
create policy "friendships_update_involved" on public.friendships
  for update using (user_id = auth.uid() or friend_id = auth.uid())
  with check (user_id = auth.uid() or friend_id = auth.uid());
create policy "friendships_delete_involved" on public.friendships
  for delete using (user_id = auth.uid() or friend_id = auth.uid());
