import { releaseLine } from './releaseLine';
import type { EpisodeInfo, MediaDetails } from '@/media/types';

/** Local ISO date `offset` days from today (noon avoids UTC/DST day flips). */
function iso(offset: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ep = (s: number, e: number, airDate: string | null): EpisodeInfo => ({
  seasonNumber: s,
  episodeNumber: e,
  title: `Épisode ${e}`,
  airDate,
});

const base: MediaDetails = {
  tmdbId: 1,
  mediaType: 'tv',
  title: 'Show',
  posterPath: null,
  releaseDate: null,
};

describe('releaseLine — movies', () => {
  const movie = (over: Partial<MediaDetails>): MediaDetails => ({
    ...base,
    mediaType: 'movie',
    ...over,
  });

  it('dates a past and a future release', () => {
    expect(releaseLine(movie({ releaseDate: '2025-07-09', status: 'Released' }))).toEqual({
      text: 'Sorti le 9 juillet 2025',
      upcoming: false,
    });
    expect(releaseLine(movie({ releaseDate: iso(30), status: 'Post Production' }))?.upcoming).toBe(
      true,
    );
    expect(releaseLine(movie({ releaseDate: iso(30) }))?.text).toMatch(/^Sortie le /);
  });

  it('marks an announced movie with no date', () => {
    expect(releaseLine(movie({ status: 'Planned' }))).toEqual({
      text: 'Date de sortie non annoncée',
      upcoming: true,
    });
    expect(releaseLine(movie({}))).toBeNull();
  });

  it('says "1er" for the first of the month', () => {
    expect(releaseLine(movie({ releaseDate: '2026-03-01' }))?.text).toContain('1er mars 2026');
  });
});

describe('releaseLine — series', () => {
  it('reports a finished series with its last episode', () => {
    expect(
      releaseLine({
        ...base,
        status: 'Ended',
        lastEpisodeToAir: ep(5, 16, '2013-09-29'),
        lastAirDate: '2013-09-29',
      }),
    ).toEqual({ text: 'Terminée · dernier épisode le 29 septembre 2013', upcoming: false });
  });

  it('distinguishes a cancellation', () => {
    expect(
      releaseLine({ ...base, status: 'Canceled', lastAirDate: '2024-05-02' })?.text,
    ).toBe('Annulée · dernier épisode le 2 mai 2024');
  });

  it('calls a new season a return, and a same-season episode the next one', () => {
    const returning = releaseLine({
      ...base,
      status: 'Returning Series',
      lastEpisodeToAir: ep(1, 8, iso(-60)),
      nextEpisodeToAir: ep(2, 1, iso(20)),
    });
    expect(returning?.text).toMatch(/^Reprise le /);
    expect(returning?.text).toContain('saison 2');
    expect(returning?.upcoming).toBe(true);

    const next = releaseLine({
      ...base,
      status: 'Returning Series',
      lastEpisodeToAir: ep(2, 3, iso(-7)),
      nextEpisodeToAir: ep(2, 4, iso(1)),
    });
    expect(next?.text).toMatch(/^Prochain épisode le /);
    expect(next?.text).toContain('S2E4');
  });

  it('calls a never-aired series a premiere, not a comeback', () => {
    const line = releaseLine({
      ...base,
      status: 'Returning Series',
      nextEpisodeToAir: ep(1, 1, iso(14)),
    });
    expect(line?.text).toMatch(/^Première le /);
    expect(line?.text).not.toContain('Reprise');
    expect(line?.upcoming).toBe(true);
  });

  it('admits when a running series has nothing scheduled', () => {
    expect(
      releaseLine({
        ...base,
        status: 'Returning Series',
        lastEpisodeToAir: ep(1, 8, '2025-09-23'),
      }),
    ).toEqual({ text: 'Suite non datée · dernier épisode le 23 septembre 2025', upcoming: false });
  });

  it('handles a series that has never aired', () => {
    expect(releaseLine({ ...base, status: 'In Production' })).toEqual({
      text: 'Pas encore datée',
      upcoming: true,
    });
    expect(
      releaseLine({ ...base, status: 'Planned', releaseDate: iso(45) })?.text,
    ).toMatch(/^Première le /);
  });
});
