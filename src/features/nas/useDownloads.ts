import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from 'react-native';

import { track } from '@/lib/analytics';
import { mediaProvider } from '@/media/provider';
import type { MediaType } from '@/media/types';
import { ArrError, describeArrError, fetchQualityProfiles } from './api';
import { useNasConfig } from './NasConfigContext';
import { getMovieState, requestMovie, type RequestResult } from './radarr';
import { getSeriesStates, requestSeries, stateOfEpisodes, type SeriesScope } from './sonarr';
import { isInFlight, NONE, type DownloadState } from './state';

export type DownloadScope = { type: 'movie' } | SeriesScope;

/** What the screen shows afterwards: a toast on success, an alert on failure. */
export type DownloadOutcome = { ok: boolean; message: string };

/** How often a title still in flight is re-read, while its screen is open. */
const POLL_MS = 10_000;

/**
 * Download requests and states for one title, against Radarr (movies) or Sonarr
 * (series). `enabled` is false when that service is not configured, in which
 * case nothing is fetched and the screen offers no download.
 */
export function useDownloads(tmdbId: number, mediaType: MediaType) {
  const { config } = useNasConfig();
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);

  const isMovie = mediaType === 'movie';
  const service = isMovie ? 'radarr' : 'sonarr';
  const serviceConfig = config[service];
  const enabled = !!serviceConfig;

  // Sonarr knows shows by TVDB id, which TMDB maps for us.
  const tvdb = useQuery({
    queryKey: ['tvdb_id', tmdbId],
    queryFn: () => mediaProvider.getTvdbId(tmdbId),
    enabled: enabled && !isMovie,
    staleTime: Infinity,
  });
  const tvdbId = tvdb.data ?? null;

  // A NAS out of reach (away from home) fails once and shows no state, rather
  // than retrying a request that takes seconds to time out.
  const movieState = useQuery({
    queryKey: ['nas', 'movie', tmdbId],
    queryFn: () => getMovieState(serviceConfig!, tmdbId),
    enabled: enabled && isMovie,
    retry: false,
    staleTime: 5_000,
    refetchInterval: (query) => (isInFlight(query.state.data) ? POLL_MS : false),
  });
  const seriesStates = useQuery({
    queryKey: ['nas', 'series', tvdbId],
    queryFn: () => getSeriesStates(serviceConfig!, tvdbId!),
    enabled: enabled && !isMovie && tvdbId !== null,
    retry: false,
    staleTime: 5_000,
    refetchInterval: (query) =>
      Object.values(query.state.data ?? {}).some(isInFlight) ? POLL_MS : false,
  });

  /** State of the movie, or of any group of episodes. */
  const stateOf = (episodes?: { seasonNumber: number; episodeNumber: number }[]): DownloadState =>
    isMovie ? (movieState.data ?? NONE) : stateOfEpisodes(seriesStates.data, episodes ?? []);

  /** The whole series' state, for the series-level row. */
  const seriesState = (): DownloadState =>
    stateOfEpisodes(
      seriesStates.data,
      Object.keys(seriesStates.data ?? {})
        .filter((key) => !key.startsWith('0x'))
        .map((key) => {
          const [seasonNumber, episodeNumber] = key.split('x').map(Number);
          return { seasonNumber, episodeNumber };
        }),
    );

  /**
   * Lets the user pick a quality profile for this download. Resolves with the
   * profile id, `undefined` for "the default one", or null if they backed out.
   */
  const chooseProfile = async (): Promise<number | undefined | null> => {
    if (!serviceConfig) return null;
    let profiles;
    try {
      profiles = await fetchQualityProfiles(serviceConfig);
    } catch (e) {
      Alert.alert('Profils indisponibles', describeArrError(e, service));
      return null;
    }
    return new Promise((resolve) => {
      Alert.alert('Profil de qualité', 'Pour ce téléchargement uniquement.', [
        ...profiles.map((p) => ({
          text: p.id === serviceConfig.qualityProfileId ? `${p.name} (défaut)` : p.name,
          onPress: () => resolve(p.id === serviceConfig.qualityProfileId ? undefined : p.id),
        })),
        { text: 'Annuler', style: 'cancel' as const, onPress: () => resolve(null) },
      ], { cancelable: true, onDismiss: () => resolve(null) });
    });
  };

  const request = async (scope: DownloadScope, profileId?: number): Promise<DownloadOutcome> => {
    if (!serviceConfig) return { ok: false, message: 'Le NAS n’est pas configuré.' };
    setPending(true);
    try {
      let result: RequestResult;
      if (scope.type === 'movie') {
        result = await requestMovie(serviceConfig, tmdbId, profileId);
      } else {
        // Usually cached by now; a show TMDB cannot map to TVDB cannot be fetched.
        const id = tvdbId ?? (await mediaProvider.getTvdbId(tmdbId));
        if (id === null) {
          return { ok: false, message: 'Cette série n’a pas d’identifiant TVDB, Sonarr ne peut pas la trouver.' };
        }
        result = await requestSeries(serviceConfig, id, scope, profileId);
      }
      track('download_requested', {
        media_type: mediaType,
        scope: scope.type,
        tmdb_id: tmdbId,
        result: result === 'requested' ? 'requested' : 'already_downloaded',
        custom_profile: profileId !== undefined,
      });
      void qc.invalidateQueries({ queryKey: ['nas'] });
      return {
        ok: true,
        message: result === 'requested' ? 'Demandé au NAS' : 'Déjà sur le NAS',
      };
    } catch (e) {
      track('download_failed', {
        media_type: mediaType,
        scope: scope.type,
        reason: e instanceof ArrError ? e.kind : 'other',
      });
      return { ok: false, message: describeArrError(e, service) };
    } finally {
      setPending(false);
    }
  };

  return { enabled, pending, stateOf, seriesState, chooseProfile, request };
}
