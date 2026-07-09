-- Allow half-star ratings (0.5 increments, 0.5..5.0).
alter table public.watch_entries
  alter column rating type numeric(2, 1) using rating::numeric;

alter table public.watch_entries
  drop constraint if exists watch_entries_rating_check;

alter table public.watch_entries
  add constraint watch_entries_rating_check
  check (rating >= 0.5 and rating <= 5 and (rating * 2) = round(rating * 2));
