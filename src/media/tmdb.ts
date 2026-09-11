import type {
  EpisodeInfo,
  MediaDetails,
  MediaProvider,
  MediaSummary,
  MediaType,
  SeasonInfo,
} from './types';

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';
const BACKDROP = 'https://image.tmdb.org/t/p/w780';
const LANG = 'fr-FR';

const token = process.env.EXPO_PUBLIC_TMDB_ACCESS_TOKEN;

export const hasTmdbToken = !!token;

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('language', LANG);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

function posterUrl(path: string | null | undefined): string | null {
  return path ? `${IMG}${path}` : null;
}

interface TmdbSearchItem {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
}

function toSummary(item: TmdbSearchItem, forced?: MediaType): MediaSummary | null {
  const mediaType = (forced ?? item.media_type) as MediaType | undefined;
  if (mediaType !== 'movie' && mediaType !== 'tv') return null;
  return {
    tmdbId: item.id,
    mediaType,
    title: (mediaType === 'movie' ? item.title : item.name) ?? item.title ?? item.name ?? 'Sans titre',
    posterPath: posterUrl(item.poster_path),
    backdropPath: item.backdrop_path ? `${BACKDROP}${item.backdrop_path}` : null,
    // TMDB sends "" (not null) for unannounced dates, and "" is not a valid
    // Postgres date — collapse it to null.
    releaseDate: item.release_date || item.first_air_date || null,
    overview: item.overview || undefined,
  };
}

interface TmdbSeasonSummary {
  season_number: number;
  name: string;
  episode_count: number;
}

interface TmdbEpisode {
  season_number: number;
  episode_number: number;
  name: string;
  air_date: string | null;
}

/** Real TMDB implementation of the app's MediaProvider seam. */
export const tmdbMediaProvider: MediaProvider = {
  async search(query: string): Promise<MediaSummary[]> {
    const q = query.trim();
    if (!q) return [];
    const data = await tmdb<{ results: TmdbSearchItem[] }>('/search/multi', {
      query: q,
      include_adult: 'false',
      page: '1',
    });
    return data.results
      .map((r) => toSummary(r))
      .filter((s): s is MediaSummary => s !== null);
  },

  async trending(): Promise<MediaSummary[]> {
    const data = await tmdb<{ results: TmdbSearchItem[] }>('/trending/all/week');
    return data.results
      .map((r) => toSummary(r))
      .filter((s): s is MediaSummary => s !== null);
  },

  async getDetails(tmdbId: number, mediaType: MediaType): Promise<MediaDetails | null> {
    if (mediaType === 'movie') {
      const m = await tmdb<TmdbSearchItem & { runtime?: number; genres?: { name: string }[] }>(
        `/movie/${tmdbId}`,
      );
      const summary = toSummary(m, 'movie');
      if (!summary) return null;
      return {
        ...summary,
        genres: (m.genres ?? []).map((g) => g.name),
        runtimeMinutes: m.runtime ?? null,
      };
    }

    const show = await tmdb<
      TmdbSearchItem & {
        seasons?: TmdbSeasonSummary[];
        genres?: { name: string }[];
        number_of_seasons?: number;
      }
    >(`/tv/${tmdbId}`);
    const summary = toSummary(show, 'tv');
    if (!summary) return null;

    // Fetch episodes for real seasons (skip specials, season 0) in parallel.
    const seasonSummaries = (show.seasons ?? []).filter((s) => s.season_number >= 1);
    const seasons: SeasonInfo[] = await Promise.all(
      seasonSummaries.map(async (s) => {
        try {
          const data = await tmdb<{ episodes: TmdbEpisode[] }>(
            `/tv/${tmdbId}/season/${s.season_number}`,
          );
          const episodes: EpisodeInfo[] = data.episodes.map((e) => ({
            seasonNumber: e.season_number,
            episodeNumber: e.episode_number,
            title: e.name || `Épisode ${e.episode_number}`,
            airDate: e.air_date || null,
          }));
          return { seasonNumber: s.season_number, name: s.name, episodes };
        } catch {
          return { seasonNumber: s.season_number, name: s.name, episodes: [] };
        }
      }),
    );

    return {
      ...summary,
      seasons: seasons.filter((s) => s.episodes.length > 0),
      genres: (show.genres ?? []).map((g) => g.name),
      seasonCount: show.number_of_seasons ?? seasons.length,
    };
  },
};
