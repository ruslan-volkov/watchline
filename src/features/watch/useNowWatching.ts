import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchProgressForEntries } from '@/features/episodes/api';
import { episodeKey, orderEpisodes } from '@/features/episodes/cascade';
import { mediaProvider } from '@/media/provider';
import type { EpisodeInfo, MediaDetails } from '@/media/types';
import { useWatchEntries } from './useWatchEntries';
import type { EntryWithMedia } from './api';

export interface NowWatchingCardData {
  entry: EntryWithMedia;
  watched: number;
  total: number;
  progress: number;
  /** First unwatched episode, if any. */
  nextEpisode: EpisodeInfo | null;
  /** Unwatched episodes already aired (air date <= today) — the "catch up" backlog. */
  airedUnwatched: number;
  subtitle: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Enriches "watching" TV entries with episode totals + progress so the home
 * carousel can render bars and the "next episode" check.
 */
export function useNowWatching(): { cards: NowWatchingCardData[]; isLoading: boolean } {
  const { data: entries } = useWatchEntries();

  const watching = useMemo(
    () =>
      (entries ?? []).filter(
        (e) => e.status === 'watching' && e.media.media_type === 'tv' && !e.snoozed,
      ),
    [entries],
  );

  const detailQueries = useQueries({
    queries: watching.map((e) => ({
      queryKey: ['media_details', 'tv', e.media.tmdb_id],
      queryFn: () => mediaProvider.getDetails(e.media.tmdb_id, 'tv'),
      staleTime: 5 * 60_000,
    })),
  });

  const entryIds = useMemo(() => watching.map((e) => e.id), [watching]);
  const progressQuery = useQuery({
    queryKey: ['progress_all', entryIds],
    queryFn: () => fetchProgressForEntries(entryIds),
    enabled: entryIds.length > 0,
  });

  const cards = useMemo<NowWatchingCardData[]>(() => {
    const rows = progressQuery.data ?? [];
    const now = todayIso();
    return watching.map((entry, i) => {
      const details = detailQueries[i]?.data as MediaDetails | null | undefined;
      const seasons = details?.seasons ?? [];
      const all = orderEpisodes(seasons);
      const watchedKeys = new Set(
        rows
          .filter((r) => r.entry_id === entry.id)
          .map((r) => episodeKey(r.season_number, r.episode_number)),
      );
      const watched = watchedKeys.size;
      const total = all.length;
      const unwatched = all.filter(
        (ep) => !watchedKeys.has(episodeKey(ep.seasonNumber, ep.episodeNumber)),
      );
      const nextEpisode = unwatched[0] ?? null;
      const airedUnwatched = unwatched.filter((ep) => ep.airDate && ep.airDate <= now).length;
      const subtitle = nextEpisode
        ? `S${nextEpisode.seasonNumber}E${nextEpisode.episodeNumber} · ${watched}/${total || '?'}`
        : total
          ? `Terminé · ${watched}/${total}`
          : `${watched} vu${watched > 1 ? 's' : ''}`;
      return {
        entry,
        watched,
        total,
        progress: total ? watched / total : 0,
        nextEpisode,
        airedUnwatched,
        subtitle,
      };
    });
  }, [watching, detailQueries, progressQuery.data]);

  const isLoading = progressQuery.isLoading || detailQueries.some((q) => q.isLoading);
  return { cards, isLoading };
}
