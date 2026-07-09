import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { SeasonInfo } from '@/media/types';
import { updateEntry } from '@/features/watch/api';
import { entriesKey } from '@/features/watch/useWatchEntries';
import { fetchProgress, markEpisodes, unmarkEpisodes } from './api';
import { episodeKey, orderEpisodes, type EpisodeRef } from './cascade';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function progressKey(entryId: string) {
  return ['episode_progress', entryId] as const;
}

/**
 * Episode watched-state for one entry, plus mark/unmark that keep the parent
 * entry's status in sync (all episodes watched -> completed, else watching).
 */
export function useEpisodeProgress(entryId: string | undefined, seasons: SeasonInfo[]) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: progressKey(entryId ?? 'none'),
    queryFn: () => fetchProgress(entryId as string),
    enabled: !!entryId,
  });

  const watchedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const row of query.data ?? []) {
      set.add(episodeKey(row.season_number, row.episode_number));
    }
    return set;
  }, [query.data]);

  const totalCount = useMemo(() => orderEpisodes(seasons).length, [seasons]);
  const watchedCount = watchedKeys.size;

  const invalidate = () => {
    if (entryId) qc.invalidateQueries({ queryKey: progressKey(entryId) });
    qc.invalidateQueries({ queryKey: entriesKey });
    // Home aggregates progress across entries under this key — refresh it too.
    qc.invalidateQueries({ queryKey: ['progress_all'] });
  };

  /** Sync parent entry status from a projected watched count. */
  const syncStatus = async (projectedWatched: number) => {
    if (!entryId || totalCount === 0) return;
    if (projectedWatched >= totalCount) {
      await updateEntry({ entryId, patch: { status: 'completed', finished_at: today() } });
    } else if (projectedWatched > 0) {
      await updateEntry({
        entryId,
        patch: { status: 'watching', started_at: today(), finished_at: null },
      });
    }
  };

  const mark = useMutation({
    mutationFn: async (episodes: EpisodeRef[]) => {
      if (!entryId) return;
      await markEpisodes(entryId, episodes);
      await syncStatus(watchedCount + episodes.length);
    },
    onSuccess: invalidate,
  });

  const unmark = useMutation({
    mutationFn: async (episodes: EpisodeRef[]) => {
      if (!entryId) return;
      await unmarkEpisodes(entryId, episodes);
      await syncStatus(Math.max(0, watchedCount - episodes.length));
    },
    onSuccess: invalidate,
  });

  return {
    isLoading: query.isLoading,
    watchedKeys,
    watchedCount,
    totalCount,
    isWatched: (season: number, episode: number) => watchedKeys.has(episodeKey(season, episode)),
    mark: (episodes: EpisodeRef[]) => mark.mutateAsync(episodes),
    unmark: (episodes: EpisodeRef[]) => unmark.mutateAsync(episodes),
  };
}
