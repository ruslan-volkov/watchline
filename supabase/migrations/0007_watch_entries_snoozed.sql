-- "En pause": set an entry aside from active surfaces without deleting it.
alter table public.watch_entries
  add column snoozed boolean not null default false;

create index idx_watch_entries_snoozed on public.watch_entries (user_id, snoozed);
