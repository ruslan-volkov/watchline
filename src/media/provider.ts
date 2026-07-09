import { mockMediaProvider } from './mock';
import { hasTmdbToken, tmdbMediaProvider } from './tmdb';
import type { MediaProvider } from './types';

/**
 * The active media source: real TMDB when EXPO_PUBLIC_TMDB_ACCESS_TOKEN is set,
 * otherwise the mock. Both implement the same interface, so nothing else changes.
 */
export const mediaProvider: MediaProvider = hasTmdbToken ? tmdbMediaProvider : mockMediaProvider;
