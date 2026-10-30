import { config, fakeArr, type Call } from './fakeFetch';
import { getSeriesStates, requestSeries, stateOfEpisodes } from './sonarr';

const ep = (id: number, seasonNumber: number, episodeNumber: number, hasFile = false) => ({
  id,
  seasonNumber,
  episodeNumber,
  hasFile,
  monitored: false,
});

const episodes = [ep(1, 0, 1), ep(2, 1, 1, true), ep(3, 1, 2), ep(4, 2, 1)];

/** A Sonarr that already knows series 10. */
const known = ({ path }: Call) => {
  if (path.startsWith('/series?tvdbId=')) return [{ id: 10 }];
  if (path.startsWith('/episode?')) return episodes;
  return undefined;
};

describe('requestSeries', () => {
  it('adds a new series with nothing monitored, then asks for the one episode', async () => {
    const calls = fakeArr(({ path, method }) => {
      if (path.startsWith('/series?tvdbId=')) return [];
      if (path.startsWith('/series/lookup')) return [{ title: 'Severance', tvdbId: 371980 }];
      if (method === 'POST' && path === '/series') return { id: 10 };
      if (path.startsWith('/episode?')) return episodes;
      return undefined;
    });

    const result = await requestSeries(config, 371980, {
      type: 'episode',
      seasonNumber: 1,
      episodeNumber: 2,
    });

    expect(result).toBe('requested');
    const add = calls.find((c) => c.method === 'POST' && c.path === '/series')!;
    expect(add.body).toMatchObject({
      qualityProfileId: 4,
      rootFolderPath: '/data/media',
      addOptions: { monitor: 'none', searchForMissingEpisodes: false },
    });
    expect(calls.find((c) => c.path === '/episode/monitor')!.body).toEqual({
      episodeIds: [3],
      monitored: true,
    });
    expect(calls.at(-1)).toMatchObject({
      path: '/command',
      body: { name: 'EpisodeSearch', episodeIds: [3] },
    });
  });

  it('monitors only the missing episodes of a season', async () => {
    const calls = fakeArr(known);
    await requestSeries(config, 1, { type: 'season', seasonNumber: 1 });
    expect(calls.find((c) => c.path === '/episode/monitor')!.body.episodeIds).toEqual([3]);
    expect(calls.at(-1)!.body).toEqual({ name: 'SeasonSearch', seriesId: 10, seasonNumber: 1 });
  });

  it('skips specials when asking for the whole series', async () => {
    const calls = fakeArr(known);
    await requestSeries(config, 1, { type: 'series' });
    expect(calls.find((c) => c.path === '/episode/monitor')!.body.episodeIds).toEqual([3, 4]);
    expect(calls.at(-1)!.body).toEqual({ name: 'SeriesSearch', seriesId: 10 });
  });

  it('does nothing for an episode already on the NAS', async () => {
    const calls = fakeArr(known);
    expect(await requestSeries(config, 1, { type: 'episode', seasonNumber: 1, episodeNumber: 1 })).toBe(
      'already-downloaded',
    );
    expect(calls.some((c) => c.method !== 'GET')).toBe(false);
  });

  it('changes the series profile only when one is picked', async () => {
    const calls = fakeArr(known);
    await requestSeries(config, 1, { type: 'season', seasonNumber: 2 }, 9);
    expect(calls.find((c) => c.path === '/series/editor')!.body).toEqual({
      seriesIds: [10],
      qualityProfileId: 9,
    });
  });

  it('waits for the episodes of a series that was just added', async () => {
    jest.useFakeTimers();
    try {
      let polls = 0;
      fakeArr(({ path }) => {
        if (path.startsWith('/series?tvdbId=')) return [{ id: 10 }];
        if (path.startsWith('/episode?')) return ++polls < 3 ? [] : episodes;
        return undefined;
      });
      const pending = requestSeries(config, 1, { type: 'season', seasonNumber: 2 });
      await jest.advanceTimersByTimeAsync(3_000);
      expect(await pending).toBe('requested');
      expect(polls).toBe(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it('says so when the episode is not in Sonarr', async () => {
    fakeArr(known);
    await expect(
      requestSeries(config, 1, { type: 'episode', seasonNumber: 9, episodeNumber: 9 }),
    ).rejects.toMatchObject({ kind: 'not-ready' });
  });
});

describe('getSeriesStates', () => {
  it('is null for a series Sonarr does not know', async () => {
    fakeArr(() => []);
    expect(await getSeriesStates(config, 1)).toBeNull();
  });

  it('combines files, queue and monitoring per episode', async () => {
    fakeArr(({ path }) => {
      if (path.startsWith('/series?')) return [{ id: 10 }];
      if (path.startsWith('/episode?'))
        return [
          { ...ep(2, 1, 1, true) },
          { ...ep(3, 1, 2), monitored: true },
          { ...ep(4, 1, 3), monitored: true },
          ep(5, 1, 4),
        ];
      return [{ episodeId: 3, status: 'downloading', size: 100, sizeleft: 50 }];
    });

    const states = (await getSeriesStates(config, 1))!;

    expect(states).toEqual({
      '1x1': { kind: 'downloaded' },
      '1x2': { kind: 'downloading', progress: 0.5 },
      '1x3': { kind: 'wanted' },
      '1x4': { kind: 'none' },
    });
    expect(stateOfEpisodes(states, [{ seasonNumber: 1, episodeNumber: 1 }, { seasonNumber: 1, episodeNumber: 4 }])).toEqual({
      kind: 'partial',
      done: 1,
      total: 2,
    });
  });
});
