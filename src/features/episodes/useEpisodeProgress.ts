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

  const invalidate = (id: string | undefined) => {
    if (id) qc.invalidateQueries({ queryKey: progressKey(id) });
    qc.invalidateQueries({ queryKey: entriesKey });
    // Home aggregates progress across entries under this key — refresh it too.
    qc.invalidateQueries({ queryKey: ['progress_all'] });
  };

  /** Sync parent entry status from a projected watched count. */
  const syncStatus = async (id: string, projectedWatched: number) => {
    if (totalCount === 0) return;
    if (projectedWatched >= totalCount) {
      await updateEntry({ entryId: id, patch: { status: 'completed', finished_at: today() } });
    } else if (projectedWatched > 0) {
      await updateEntry({
        entryId: id,
        patch: { status: 'watching', started_at: today(), finished_at: null },
      });
    }
  };

  // `forEntryId` lets a caller act on an entry it just created, before the
  // entries query has refetched and bound `entryId` here.
  interface Vars {
    episodes: EpisodeRef[];
    forEntryId?: string;
  }

  const mark = useMutation({
    mutationFn: async ({ episodes, forEntryId }: Vars) => {
      const id = forEntryId ?? entryId;
      if (!id) return;
      await markEpisodes(id, episodes);
      await syncStatus(id, watchedCount + episodes.length);
    },
    onSuccess: (_data, vars) => invalidate(vars.forEntryId ?? entryId),
  });

  const unmark = useMutation({
    mutationFn: async ({ episodes, forEntryId }: Vars) => {
      const id = forEntryId ?? entryId;
      if (!id) return;
      await unmarkEpisodes(id, episodes);
      await syncStatus(id, Math.max(0, watchedCount - episodes.length));
    },
    onSuccess: (_data, vars) => invalidate(vars.forEntryId ?? entryId),
  });

  return {
    isLoading: query.isLoading,
    watchedKeys,
    watchedCount,
    totalCount,
    isWatched: (season: number, episode: number) => watchedKeys.has(episodeKey(season, episode)),
    mark: (episodes: EpisodeRef[], forEntryId?: string) =>
      mark.mutateAsync({ episodes, forEntryId }),
    unmark: (episodes: EpisodeRef[], forEntryId?: string) =>
      unmark.mutateAsync({ episodes, forEntryId }),
  };
}
