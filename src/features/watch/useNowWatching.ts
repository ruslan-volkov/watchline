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

/** Episode lists change when a season is announced or dated, not minute to
 *  minute. An hour of tolerance spares refetching every season of every series
 *  on each cold start; pull-to-refresh still forces it. */
const DETAILS_STALE_TIME = 60 * 60_000;

/** A finished series is only watched for a comeback — twice a day is plenty. */
const STATUS_STALE_TIME = 12 * 60 * 60_000;

/**
 * Enriches "watching" TV entries with episode totals + progress so the home and
 * watchlist rows can render bars and the "next episode" check.
 *
 * Completed series are watched too — not to display them, but to catch ones that
 * have gained a later season, so a returning show resurfaces instead of staying
 * hidden behind the "completed" status.
 */
export function useNowWatching(): { cards: NowWatchingCardData[]; isLoading: boolean } {
  const { data: entries } = useWatchEntries();
  const qc = useQueryClient();

  const tv = useMemo(
    () => (entries ?? []).filter((e) => e.media.media_type === 'tv' && !e.snoozed),
    [entries],
  );
  const watching = useMemo(() => tv.filter((e) => e.status === 'watching'), [tv]);
  const completed = useMemo(() => tv.filter((e) => e.status === 'completed'), [tv]);

  // Series in progress need their episode lists: the bars, the next episode and
  // the catch-up count are all episode-level.
  const detailQueries = useQueries({
    queries: watching.map((e) => ({
      queryKey: ['media_details', 'tv', e.media.tmdb_id],
      queryFn: () => mediaProvider.getDetails(e.media.tmdb_id, 'tv'),
      staleTime: DETAILS_STALE_TIME,
    })),
  });

  // Finished ones do not. The show's own status is one request and a kilobyte,
  // where its episode lists are one request per season and tens of kilobytes —
  // paid on every launch, forever, for series that rarely move again.
  const statusQueries = useQueries({
    queries: completed.map((e) => ({
      queryKey: ['show_status', 'tv', e.media.tmdb_id],
      queryFn: () => mediaProvider.getShowStatus(e.media.tmdb_id),
      staleTime: STATUS_STALE_TIME,
    })),
  });

  // Progress covers completed entries too: the seasons already watched are what
  // tells a comeback apart from an episode that was always there.
  const entryIds = useMemo(
    () => [...watching, ...completed].map((e) => e.id),
    [watching, completed],
  );
  const progressQuery = useQuery({
    queryKey: ['progress_all', entryIds],
    queryFn: () => fetchProgressForEntries(entryIds),
    enabled: entryIds.length > 0,
  });

  const watchedSeasonMax = (rows: { entry_id: string; season_number: number }[], id: string) =>
    rows.filter((r) => r.entry_id === id).reduce((max, r) => Math.max(max, r.season_number), 0);

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

  const returning = useMemo(() => {
    const rows = progressQuery.data ?? [];
    const now = todayIso();
    const ids: string[] = [];
    completed.forEach((entry, i) => {
      const probe = statusQueries[i]?.data;
      if (!probe) return;
      // The show endpoint only reports the episodes bracketing the run. For a
      // completed series anything in a later season is unwatched by definition,
      // so those two are enough to spot a comeback — same rule as hasReturned.
      const candidates = [probe.nextEpisodeToAir, probe.lastEpisodeToAir].filter(
        (e): e is EpisodeInfo => e != null,
      );
      const returned = hasReturned(candidates, {
        finishedAt: entry.finished_at,
        today: now,
        maxWatchedSeason: watchedSeasonMax(rows, entry.id),
      });
      if (returned) ids.push(entry.id);
    });
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed, statusQueries, progressQuery.data]);

  // Guarded by a ref so the write happens once per entry, not on every render.
  const reopening = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const id of returning) {
      if (reopening.current.has(id)) continue;
      reopening.current.add(id);
      updateEntry({ entryId: id, patch: { status: 'watching', finished_at: null } })
        .then(() => qc.invalidateQueries({ queryKey: entriesKey }))
        .catch(() => reopening.current.delete(id));
    }
  }, [returning, qc]);

  // Status probes never gate the UI — they only ever reopen a series later.
  const isLoading = progressQuery.isLoading || detailQueries.some((q) => q.isLoading);
  return { cards, isLoading };
}
