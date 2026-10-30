import { ArrError, arrFetch, resolveTargets } from './api';
import type { ArrConfig } from './config';
import type { RequestResult } from './radarr';
import { aggregateState, NONE, stateFromQueueItem, type DownloadState, type QueueItem } from './state';

/** What to download: the whole series, one season, or one episode. */
export type SeriesScope =
  | { type: 'series' }
  | { type: 'season'; seasonNumber: number }
  | { type: 'episode'; seasonNumber: number; episodeNumber: number };

interface SonarrSeries {
  id: number;
}

interface SonarrEpisode {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  monitored: boolean;
  hasFile: boolean;
}

export const episodeStateKey = (seasonNumber: number, episodeNumber: number) =>
  `${seasonNumber}x${episodeNumber}`;

async function findSeries(config: ArrConfig, tvdbId: number): Promise<SonarrSeries | undefined> {
  const [series] = await arrFetch<SonarrSeries[]>(config, `/series?tvdbId=${tvdbId}`);
  return series;
}

/**
 * The series in Sonarr, added with nothing monitored if it is new — so that
 * asking for one episode does not make Sonarr go and fetch all the others.
 */
async function ensureSeries(
  config: ArrConfig,
  tvdbId: number,
  profileId?: number,
): Promise<SonarrSeries> {
  const { qualityProfileId, rootFolderPath } = resolveTargets(config, profileId);
  const existing = await findSeries(config, tvdbId);
  if (existing) {
    if (profileId !== undefined) {
      await arrFetch(config, '/series/editor', {
        method: 'PUT',
        body: { seriesIds: [existing.id], qualityProfileId },
      });
    }
    return existing;
  }

  const [found] = await arrFetch<object[]>(config, `/series/lookup?term=tvdb:${tvdbId}`);
  if (!found) throw new ArrError('http', 404);
  return arrFetch<SonarrSeries>(config, '/series', {
    method: 'POST',
    body: {
      ...found,
      qualityProfileId,
      rootFolderPath,
      monitored: true,
      seasonFolder: true,
      addOptions: {
        monitor: 'none',
        searchForMissingEpisodes: false,
        searchForCutoffUnmetEpisodes: false,
      },
    },
  });
}

const EPISODES_POLL_MS = 1_500;
const EPISODES_POLL_TRIES = 10;

/** A series just added has no episodes until Sonarr's first refresh finishes. */
async function waitForEpisodes(config: ArrConfig, seriesId: number): Promise<SonarrEpisode[]> {
  for (let attempt = 0; attempt < EPISODES_POLL_TRIES; attempt++) {
    const episodes = await arrFetch<SonarrEpisode[]>(config, `/episode?seriesId=${seriesId}`);
    if (episodes.length > 0) return episodes;
    await new Promise((resolve) => setTimeout(resolve, EPISODES_POLL_MS));
  }
  throw new ArrError('not-ready');
}

function inScope(episode: SonarrEpisode, scope: SeriesScope): boolean {
  switch (scope.type) {
    case 'series':
      return episode.seasonNumber > 0;
    case 'season':
      return episode.seasonNumber === scope.seasonNumber;
    case 'episode':
      return (
        episode.seasonNumber === scope.seasonNumber && episode.episodeNumber === scope.episodeNumber
      );
  }
}

/**
 * Ask Sonarr for a series, a season or an episode: make sure the series exists,
 * monitor what is asked for and search for it. Specials (season 0) are only
 * downloaded when asked for by episode.
 */
export async function requestSeries(
  config: ArrConfig,
  tvdbId: number,
  scope: SeriesScope,
  profileId?: number,
): Promise<RequestResult> {
  const series = await ensureSeries(config, tvdbId, profileId);
  const episodes = (await waitForEpisodes(config, series.id)).filter((e) => inScope(e, scope));
  if (episodes.length === 0) throw new ArrError('not-ready');

  const missing = episodes.filter((e) => !e.hasFile);
  if (missing.length === 0) return 'already-downloaded';

  await arrFetch(config, '/episode/monitor', {
    method: 'PUT',
    body: { episodeIds: missing.map((e) => e.id), monitored: true },
  });
  const command =
    scope.type === 'series'
      ? { name: 'SeriesSearch', seriesId: series.id }
      : scope.type === 'season'
        ? { name: 'SeasonSearch', seriesId: series.id, seasonNumber: scope.seasonNumber }
        : { name: 'EpisodeSearch', episodeIds: [missing[0].id] };
  await arrFetch(config, '/command', { method: 'POST', body: command });
  return 'requested';
}

/** Per-episode state, keyed by `episodeStateKey`; null when Sonarr does not know the series. */
export async function getSeriesStates(
  config: ArrConfig,
  tvdbId: number,
): Promise<Record<string, DownloadState> | null> {
  const series = await findSeries(config, tvdbId);
  if (!series) return null;

  const [episodes, queue] = await Promise.all([
    arrFetch<SonarrEpisode[]>(config, `/episode?seriesId=${series.id}`),
    arrFetch<(QueueItem & { episodeId?: number })[]>(config, `/queue/details?seriesId=${series.id}`),
  ]);
  const queued = new Map(queue.map((item) => [item.episodeId, item]));

  const states: Record<string, DownloadState> = {};
  for (const e of episodes) {
    const inQueue = queued.get(e.id);
    states[episodeStateKey(e.seasonNumber, e.episodeNumber)] = e.hasFile
      ? { kind: 'downloaded' }
      : inQueue
        ? stateFromQueueItem(inQueue)
        : e.monitored
          ? { kind: 'wanted' }
          : NONE;
  }
  return states;
}

/** The state of a group of episodes, read from `getSeriesStates`'s record. */
export function stateOfEpisodes(
  states: Record<string, DownloadState> | null | undefined,
  episodes: { seasonNumber: number; episodeNumber: number }[],
): DownloadState {
  if (!states) return NONE;
  return aggregateState(
    episodes.map((e) => states[episodeStateKey(e.seasonNumber, e.episodeNumber)] ?? NONE),
  );
}
