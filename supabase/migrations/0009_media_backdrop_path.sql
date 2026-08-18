-- Wide landscape image (TMDB backdrop), used by the banner-style list rows.
-- Nullable: rows fall back to the poster / colored placeholder when absent.
alter table public.media
  add column if not exists backdrop_path text;
