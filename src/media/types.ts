import type { Enums } from '@/types/db';

export type MediaType = Enums<'media_type'>;
export type WatchStatus = Enums<'watch_status'>;

/** A single searchable / addable title from the media source (TMDB, mocked for now). */
export interface MediaSummary {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  /** Real poster URL once TMDB is wired; null uses a deterministic placeholder. */
  posterPath: string | null;
  /** Wide backdrop image URL, used as a faded hero background. Optional. */
  backdropPath?: string | null;
  /** ISO date (YYYY-MM-DD) or null when unknown. */
  releaseDate: string | null;
  /** Short line shown under the title in search results. */
  overview?: string;
}

export interface EpisodeInfo {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  /** ISO date the episode airs / aired; null when unknown. */
  airDate: string | null;
}

export interface SeasonInfo {
  seasonNumber: number;
  name: string;
  episodes: EpisodeInfo[];
}

export interface MediaDetails extends MediaSummary {
  /** Only present for tv. */
  seasons?: SeasonInfo[];
  genres?: string[];
  /** Movie runtime in minutes. */
  runtimeMinutes?: number | null;
  /** tv season count. */
  seasonCount?: number | null;
  /** Raw TMDB production status — "Released", "Ended", "Canceled",
   *  "Returning Series", "In Production", "Planned". Always English, whatever
   *  the request language. */
  status?: string | null;
  /** tv: date the most recent episode aired. */
  lastAirDate?: string | null;
  /** tv: next scheduled episode, when TMDB has dated one. */
  nextEpisodeToAir?: EpisodeInfo | null;
  /** tv: most recent episode that aired. */
  lastEpisodeToAir?: EpisodeInfo | null;
}

/**
 * The single seam between the app and the media source. The mock implements it
 * today; a real TMDB client will implement the same interface later with zero
 * UI changes.
 */
export interface MediaProvider {
  search(query: string): Promise<MediaSummary[]>;
  getDetails(tmdbId: number, mediaType: MediaType): Promise<MediaDetails | null>;
  /** Popular titles this week, for the empty search state. */
  trending(): Promise<MediaSummary[]>;
}
