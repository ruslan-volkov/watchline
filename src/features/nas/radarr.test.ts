import { config, fakeArr } from './fakeFetch';
import { getMovieState, requestMovie } from './radarr';

describe('requestMovie', () => {
  it('adds a new movie with the default profile and folder, and searches on add', async () => {
    const calls = fakeArr(({ path }) => {
      if (path.startsWith('/movie?tmdbId=')) return [];
      if (path.startsWith('/movie/lookup')) return [{ title: 'Dune', tmdbId: 438631, id: 0 }];
      return {};
    });

    expect(await requestMovie(config, 438631)).toBe('requested');

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /movie?tmdbId=438631',
      'GET /movie/lookup?term=tmdb:438631',
      'POST /movie',
    ]);
    expect(calls[2].body).toMatchObject({
      title: 'Dune',
      qualityProfileId: 4,
      rootFolderPath: '/data/media',
      monitored: true,
      addOptions: { searchForMovie: true },
    });
  });

  it('leaves a movie that is already on the NAS alone', async () => {
    const calls = fakeArr(() => [{ id: 7, hasFile: true, monitored: true }]);
    expect(await requestMovie(config, 1)).toBe('already-downloaded');
    expect(calls).toHaveLength(1);
  });

  it('searches again for a known movie without a file, with another profile if asked', async () => {
    const calls = fakeArr(({ path }) =>
      path.startsWith('/movie?tmdbId=') ? [{ id: 7, hasFile: false, monitored: false }] : undefined,
    );

    expect(await requestMovie(config, 1, 9)).toBe('requested');

    expect(calls[1]).toMatchObject({
      method: 'PUT',
      path: '/movie/editor',
      body: { movieIds: [7], monitored: true, qualityProfileId: 9 },
    });
    expect(calls[2]).toMatchObject({
      method: 'POST',
      path: '/command',
      body: { name: 'MoviesSearch', movieIds: [7] },
    });
  });

  it('keeps the profile when none is picked', async () => {
    const calls = fakeArr(({ path }) =>
      path.startsWith('/movie?tmdbId=') ? [{ id: 7, hasFile: false, monitored: true }] : undefined,
    );
    await requestMovie(config, 1);
    expect(calls[1].body).not.toHaveProperty('qualityProfileId');
  });

  it('refuses before talking to the NAS when no profile or folder is picked', async () => {
    const calls = fakeArr(() => []);
    await expect(
      requestMovie({ ...config, qualityProfileId: null }, 1),
    ).rejects.toMatchObject({ kind: 'not-configured' });
    expect(calls).toHaveLength(0);
  });
});

describe('getMovieState', () => {
  it('is none for an unknown movie', async () => {
    fakeArr(() => []);
    expect(await getMovieState(config, 1)).toEqual({ kind: 'none' });
  });

  it('is downloaded once Radarr has the file', async () => {
    fakeArr(() => [{ id: 7, hasFile: true, monitored: true }]);
    expect(await getMovieState(config, 1)).toEqual({ kind: 'downloaded' });
  });

  it('reads progress from the queue', async () => {
    fakeArr(({ path }) =>
      path.startsWith('/movie?')
        ? [{ id: 7, hasFile: false, monitored: true }]
        : [{ status: 'downloading', size: 100, sizeleft: 40 }],
    );
    expect(await getMovieState(config, 1)).toEqual({ kind: 'downloading', progress: 0.6 });
  });

  it('is wanted when monitored with nothing queued', async () => {
    fakeArr(({ path }) => (path.startsWith('/movie?') ? [{ id: 7, hasFile: false, monitored: true }] : []));
    expect(await getMovieState(config, 1)).toEqual({ kind: 'wanted' });
  });
});
