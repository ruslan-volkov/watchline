import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

import { fetchProgressForEntries } from '@/features/episodes/api';
import { episodeKey, orderEpisodes } from '@/features/episodes/cascade';
import { mediaProvider } from '@/media/provider';
import type { EpisodeInfo, MediaDetails } from '@/media/types';
import { hasReturned } from './reopen';
import { entriesKey, useWatchEntries } from './useWatchEntries';
import { updateEntry, type EntryWithMedia } from './api';

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
 * Enriches "watching" TV entries with episode totals + progress so the home and
 * watchlist rows can render bars and the "next episode" check.
 *
 * Completed series are loaded too — not to display them, but to detect ones that
 * have since gained new episodes (a returning show) and reopen them, so a new
 * season resurfaces instead of staying hidden behind the "completed" status.
 */
export function useNowWatching(): { cards: NowWatchingCardData[]; isLoading: boolean } {
  const { data: entries } = useWatchEntries();
  const qc = useQueryClient();

  const tracked = useMemo(
    () =>
      (entries ?? []).filter(
        (e) =>
          e.media.media_type === 'tv' &&
          !e.snoozed &&
          (e.status === 'watching' || e.status === 'completed'),
      ),
    [entries],
  );

  const detailQueries = useQueries({
    queries: tracked.map((e) => ({
      queryKey: ['media_details', 'tv', e.media.tmdb_id],
      queryFn: () => mediaProvider.getDetails(e.media.tmdb_id, 'tv'),
      staleTime: 5 * 60_000,
    })),
  });

  const entryIds = useMemo(() => tracked.map((e) => e.id), [tracked]);
  const progressQuery = useQuery({
    queryKey: ['progress_all', entryIds],
    queryFn: () => fetchProgressForEntries(entryIds),
    enabled: entryIds.length > 0,
  });

  const computed = useMemo(() => {
    const rows = progressQuery.data ?? [];
    const now = todayIso();
    return tracked.map((entry, i) => {
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
      // Only meaningful once details actually loaded, otherwise an empty episode
      // list would look like "nothing new".
      const maxWatchedSeason = rows
        .filter((r) => r.entry_id === entry.id)
        .reduce((max, r) => Math.max(max, r.season_number), 0);
      const hasNewEpisodes =
        details != null &&
        hasReturned(unwatched, { finishedAt: entry.finished_at, today: now, maxWatchedSeason });
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
        hasNewEpisodes,
      };
    });
  }, [tracked, detailQueries, progressQuery.data]);

  // Reopen returning series that gained episodes since being completed. Guarded
  // by a ref so the write happens once per entry, not on every render.
  const reopening = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const c of computed) {
      if (c.entry.status !== 'completed' || !c.hasNewEpisodes) continue;
      if (reopening.current.has(c.entry.id)) continue;
      reopening.current.add(c.entry.id);
      updateEntry({ entryId: c.entry.id, patch: { status: 'watching', finished_at: null } })
        .then(() => qc.invalidateQueries({ queryKey: entriesKey }))
        .catch(() => reopening.current.delete(c.entry.id));
    }
  }, [computed, qc]);

  const cards = useMemo<NowWatchingCardData[]>(
    () =>
      computed
        .filter((c) => c.entry.status === 'watching')
        .map(({ hasNewEpisodes: _ignored, ...card }) => card),
    [computed],
  );

  const isLoading = progressQuery.isLoading || detailQueries.some((q) => q.isLoading);
  return { cards, isLoading };
}
