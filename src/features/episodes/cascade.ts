import type { EpisodeInfo, SeasonInfo } from '@/media/types';

export interface EpisodeRef {
  seasonNumber: number;
  episodeNumber: number;
}

/** Stable key for an episode within an entry. */
export function episodeKey(season: number, episode: number): string {
  return `${season}-${episode}`;
}

/** All episodes flattened and ordered by season, then episode number. */
export function orderEpisodes(seasons: SeasonInfo[]): EpisodeInfo[] {
  return seasons
    .flatMap((s) => s.episodes)
    .sort((a, b) =>
      a.seasonNumber === b.seasonNumber
        ? a.episodeNumber - b.episodeNumber
        : a.seasonNumber - b.seasonNumber,
    );
}

function isBeforeOrEqual(a: EpisodeRef, b: EpisodeRef): boolean {
  if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber < b.seasonNumber;
  return a.episodeNumber <= b.episodeNumber;
}

/**
 * The cascade set: every unwatched episode at or before `target`, in order.
 * The last element is always the tapped target. Marking these implements
 * "marking an episode also marks all earlier unwatched episodes".
 */
export function episodesToMark(
  seasons: SeasonInfo[],
  target: EpisodeRef,
  watchedKeys: Set<string>,
): EpisodeInfo[] {
  return orderEpisodes(seasons).filter(
    (ep) =>
      isBeforeOrEqual(ep, target) &&
      !watchedKeys.has(episodeKey(ep.seasonNumber, ep.episodeNumber)),
  );
}

export interface CascadePlan {
  /** Episodes that would be marked (includes the tapped target). */
  toMark: EpisodeInfo[];
  /** Count of *extra* episodes beyond the tapped one. */
  extra: number;
  /** Extra > 5 → likely a mis-tap, needs a blocking confirmation. */
  needsConfirm: boolean;
}

const CONFIRM_THRESHOLD = 5;

export function planCascade(
  seasons: SeasonInfo[],
  target: EpisodeRef,
  watchedKeys: Set<string>,
): CascadePlan {
  const toMark = episodesToMark(seasons, target, watchedKeys);
  const extra = Math.max(0, toMark.length - 1);
  return { toMark, extra, needsConfirm: extra > CONFIRM_THRESHOLD };
}
