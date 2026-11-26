import { daysFromToday, longDateLabel } from '@/utils/timeGrouping';
import type { MediaDetails } from '@/media/types';

export interface ReleaseLine {
  text: string;
  /** Still to come — worth drawing the eye. Past and finished titles stay quiet. */
  upcoming: boolean;
}

/** TMDB ships these in English whatever the request language. */
const ENDED = new Set(['Ended', 'Canceled']);
const UNRELEASED = new Set(['Planned', 'In Production', 'Post Production', 'Rumored', 'Pilot']);

/** True when TMDB considers the series finished — over, not merely paused. */
export function isFinishedSeries(status: string | null | undefined): boolean {
  return ENDED.has(status ?? '');
}

function on(isoDate: string): string {
  return longDateLabel(isoDate);
}

/**
 * One line about where a title stands in its release life: when a movie came or
 * is coming out, when a series returns, and whether it is over for good.
 * Returns null when TMDB tells us nothing useful.
 */
export function releaseLine(details: MediaDetails): ReleaseLine | null {
  if (details.mediaType === 'movie') return movieLine(details);
  return tvLine(details);
}

function movieLine(details: MediaDetails): ReleaseLine | null {
  const date = details.releaseDate;
  if (!date) {
    // Announced but unscheduled — say so rather than showing nothing.
    return UNRELEASED.has(details.status ?? '')
      ? { text: 'Date de sortie non annoncée', upcoming: true }
      : null;
  }
  const d = daysFromToday(date);
  if (d > 0) return { text: `Sortie le ${on(date)}`, upcoming: true };
  if (d === 0) return { text: "Sort aujourd'hui", upcoming: true };
  return { text: `Sorti le ${on(date)}`, upcoming: false };
}

function tvLine(details: MediaDetails): ReleaseLine | null {
  const next = details.nextEpisodeToAir;
  const last = details.lastEpisodeToAir;
  const lastDate = last?.airDate ?? details.lastAirDate ?? null;
  const status = details.status ?? '';

  // A dated next episode is the most useful thing we can say.
  if (next?.airDate) {
    // Nothing aired yet: this is the series' own premiere, not a comeback.
    if (!last) return { text: `Première le ${on(next.airDate)}`, upcoming: true };
    // A jump in season number means it is coming back, not merely continuing.
    if (next.seasonNumber > last.seasonNumber) {
      return {
        text: `Reprise le ${on(next.airDate)} · saison ${next.seasonNumber}`,
        upcoming: true,
      };
    }
    return {
      text: `Prochain épisode le ${on(next.airDate)} · S${next.seasonNumber}E${next.episodeNumber}`,
      upcoming: true,
    };
  }

  if (ENDED.has(status)) {
    const word = status === 'Canceled' ? 'Annulée' : 'Terminée';
    return {
      text: lastDate ? `${word} · dernier épisode le ${on(lastDate)}` : word,
      upcoming: false,
    };
  }

  // Still running but nothing scheduled yet: the useful fact is how long it has
  // been quiet, so lead with the last episode.
  if (status === 'Returning Series') {
    return {
      text: lastDate ? `Suite non datée · dernier épisode le ${on(lastDate)}` : 'Suite non datée',
      upcoming: false,
    };
  }

  if (UNRELEASED.has(status)) {
    const premiere = details.releaseDate;
    if (premiere && daysFromToday(premiere) > 0) {
      return { text: `Première le ${on(premiere)}`, upcoming: true };
    }
    return { text: 'Pas encore datée', upcoming: true };
  }

  return lastDate ? { text: `Dernier épisode le ${on(lastDate)}`, upcoming: false } : null;
}
