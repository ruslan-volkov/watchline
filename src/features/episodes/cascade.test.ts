import type { SeasonInfo } from '@/media/types';
import { episodeKey, episodesToMark, orderEpisodes, planCascade } from './cascade';

function ep(s: number, e: number) {
  return { seasonNumber: s, episodeNumber: e, title: `S${s}E${e}`, airDate: null };
}

const seasons: SeasonInfo[] = [
  { seasonNumber: 1, name: 'S1', episodes: [ep(1, 1), ep(1, 2), ep(1, 3)] },
  { seasonNumber: 2, name: 'S2', episodes: [ep(2, 1), ep(2, 2), ep(2, 3)] },
];

const keys = (list: { seasonNumber: number; episodeNumber: number }[]) =>
  list.map((e) => episodeKey(e.seasonNumber, e.episodeNumber));

describe('cascade', () => {
  it('orders episodes by season then episode number', () => {
    const shuffled: SeasonInfo[] = [
      { seasonNumber: 2, name: '', episodes: [ep(2, 2), ep(2, 1)] },
      { seasonNumber: 1, name: '', episodes: [ep(1, 2), ep(1, 1)] },
    ];
    expect(keys(orderEpisodes(shuffled))).toEqual(['1-1', '1-2', '2-1', '2-2']);
  });

  it('marks the target plus every earlier unwatched episode', () => {
    const plan = planCascade(seasons, { seasonNumber: 2, episodeNumber: 1 }, new Set());
    expect(keys(plan.toMark)).toEqual(['1-1', '1-2', '1-3', '2-1']);
    expect(plan.extra).toBe(3);
    expect(plan.needsConfirm).toBe(false);
  });

  it('skips already-watched episodes in the cascade', () => {
    const watched = new Set(['1-1', '1-2']);
    const list = episodesToMark(seasons, { seasonNumber: 1, episodeNumber: 3 }, watched);
    expect(keys(list)).toEqual(['1-3']);
  });

  it('needs confirmation when more than 5 extra episodes cascade', () => {
    const big: SeasonInfo[] = [
      { seasonNumber: 1, name: '', episodes: Array.from({ length: 8 }, (_, i) => ep(1, i + 1)) },
    ];
    const plan = planCascade(big, { seasonNumber: 1, episodeNumber: 8 }, new Set());
    expect(plan.toMark).toHaveLength(8);
    expect(plan.extra).toBe(7);
    expect(plan.needsConfirm).toBe(true);
  });

  it('does not confirm at exactly 5 extra episodes', () => {
    const big: SeasonInfo[] = [
      { seasonNumber: 1, name: '', episodes: Array.from({ length: 6 }, (_, i) => ep(1, i + 1)) },
    ];
    const plan = planCascade(big, { seasonNumber: 1, episodeNumber: 6 }, new Set());
    expect(plan.extra).toBe(5);
    expect(plan.needsConfirm).toBe(false);
  });
});
