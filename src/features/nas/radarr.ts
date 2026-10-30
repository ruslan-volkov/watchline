import { ArrError, arrFetch, resolveTargets } from './api';
import type { ArrConfig } from './config';
import { NONE, stateFromQueueItem, type DownloadState, type QueueItem } from './state';

export type RequestResult = 'requested' | 'already-downloaded';

interface RadarrMovie {
  id: number;
  hasFile: boolean;
  monitored: boolean;
}

async function findMovie(config: ArrConfig, tmdbId: number): Promise<RadarrMovie | undefined> {
  const [movie] = await arrFetch<RadarrMovie[]>(config, `/movie?tmdbId=${tmdbId}`);
  return movie;
}

/**
 * Ask Radarr to get a movie: add it if it is new, then search. A movie already
 * on the NAS is left alone. `profileId` overrides the default quality profile,
 * for this movie from now on.
 */
export async function requestMovie(
  config: ArrConfig,
  tmdbId: number,
  profileId?: number,
): Promise<RequestResult> {
  const { qualityProfileId, rootFolderPath } = resolveTargets(config, profileId);
  const existing = await findMovie(config, tmdbId);

  if (existing) {
    if (existing.hasFile) return 'already-downloaded';
    await arrFetch(config, '/movie/editor', {
      method: 'PUT',
      body: {
        movieIds: [existing.id],
        monitored: true,
        ...(profileId !== undefined ? { qualityProfileId } : null),
      },
    });
    await arrFetch(config, '/command', {
      method: 'POST',
      body: { name: 'MoviesSearch', movieIds: [existing.id] },
    });
    return 'requested';
  }

  // Add the way the Radarr UI does: take what its own lookup returns and fill in
  // where it goes. Radarr starts the search itself once it is added.
  const [found] = await arrFetch<object[]>(config, `/movie/lookup?term=tmdb:${tmdbId}`);
  if (!found) throw new ArrError('http', 404);
  await arrFetch(config, '/movie', {
    method: 'POST',
    body: {
      ...found,
      qualityProfileId,
      rootFolderPath,
      monitored: true,
      minimumAvailability: 'released',
      addOptions: { searchForMovie: true },
    },
  });
  return 'requested';
}

export async function getMovieState(config: ArrConfig, tmdbId: number): Promise<DownloadState> {
  const movie = await findMovie(config, tmdbId);
  if (!movie) return NONE;
  if (movie.hasFile) return { kind: 'downloaded' };
  const [queued] = await arrFetch<QueueItem[]>(config, `/queue/details?movieId=${movie.id}`);
  if (queued) return stateFromQueueItem(queued);
  return movie.monitored ? { kind: 'wanted' } : NONE;
}
