-- Per-user IANA timezone so the daily digest can convert digest_time (a local
-- time-of-day) to the right moment. Defaults to Europe/Paris; the client keeps
-- it in sync with the device timezone.
alter table public.profiles
  add column if not exists timezone text not null default 'Europe/Paris';
