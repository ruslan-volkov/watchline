-- A friend request interrupts you for a different reason than the daily release
-- digest, so it gets its own switch instead of riding on digest_enabled.
alter table public.profiles
  add column if not exists friend_requests_enabled boolean not null default true;
