import { hasReturned } from './reopen';
import type { EpisodeInfo } from '@/media/types';

const ep = (seasonNumber: number, episodeNumber: number, airDate: string | null): EpisodeInfo => ({
  seasonNumber,
  episodeNumber,
  title: `E${episodeNumber}`,
  airDate,
});

const TODAY = '2026-09-04';
const opts = (over: Partial<Parameters<typeof hasReturned>[1]> = {}) => ({
  finishedAt: '2026-08-20',
  today: TODAY,
  maxWatchedSeason: 1,
  ...over,
});

describe('hasReturned', () => {
  it('reopens when a later season is announced with a future date', () => {
    expect(hasReturned([ep(2, 1, '2026-10-01')], opts())).toBe(true);
  });

  it('reopens when a later season already started airing since the finish', () => {
    expect(hasReturned([ep(2, 1, '2026-08-25')], opts())).toBe(true);
  });

  it('leaves a series dropped mid-season alone, even with episodes to come', () => {
    expect(hasReturned([ep(1, 7, '2026-10-01')], opts())).toBe(false);
  });

  it('ignores a later season that already existed when the user finished', () => {
    expect(hasReturned([ep(2, 1, '2026-01-10')], opts())).toBe(false);
  });

  it('ignores an announced but unscheduled season', () => {
    expect(hasReturned([ep(2, 1, null)], opts())).toBe(false);
  });

  it('stays closed when nothing is unwatched', () => {
    expect(hasReturned([], opts())).toBe(false);
  });

  it('without a finish date, requires the new season to be genuinely upcoming', () => {
    expect(hasReturned([ep(2, 1, '2026-08-01')], opts({ finishedAt: null }))).toBe(false);
    expect(hasReturned([ep(2, 1, '2026-10-01')], opts({ finishedAt: null }))).toBe(true);
  });
});
