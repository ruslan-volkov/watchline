import type { EpisodeInfo } from '@/media/types';

interface Options {
  /** When the user called the series done; null if never recorded. */
  finishedAt: string | null;
  /** Today, ISO (YYYY-MM-DD). */
  today: string;
  /** Highest season the user has any progress in. */
  maxWatchedSeason: number;
}

/**
 * True when a completed series has actually returned — a *later season* than the
 * user ever watched has appeared, dated after they finished.
 *
 * The season check is what keeps this from fighting the user: marking a series
 * done mid-run (dropping it) leaves unwatched episodes in the season they were
 * already on, which must not drag it back to "watching". The date check excludes
 * seasons that already existed when they finished, and undated episodes (a season
 * TMDB announced but hasn't scheduled — nothing to resurface yet).
 */
export function hasReturned(
  unwatched: EpisodeInfo[],
  { finishedAt, today, maxWatchedSeason }: Options,
): boolean {
  return unwatched.some(
    (ep) =>
      !!ep.airDate &&
      ep.seasonNumber > maxWatchedSeason &&
      (finishedAt != null ? ep.airDate > finishedAt : ep.airDate > today),
  );
}
