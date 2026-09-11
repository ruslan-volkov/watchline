import { tmdbMediaProvider } from './tmdb';

function mockResults(results: object[]) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ results }),
  }) as unknown as typeof fetch;
}

describe('tmdb release dates', () => {
  it('maps an unannounced show ("" first_air_date) to null, not ""', async () => {
    mockResults([{ id: 306568, media_type: 'tv', name: 'Far Cry', first_air_date: '' }]);
    const [show] = await tmdbMediaProvider.search('Far Cry');
    expect(show.releaseDate).toBeNull();
  });

  it('maps an empty movie release_date to null', async () => {
    mockResults([{ id: 1, media_type: 'movie', title: 'Untitled', release_date: '' }]);
    const [movie] = await tmdbMediaProvider.search('Untitled');
    expect(movie.releaseDate).toBeNull();
  });

  it('keeps real dates', async () => {
    mockResults([
      { id: 2, media_type: 'tv', name: 'Show', first_air_date: '2026-10-01' },
      { id: 3, media_type: 'movie', title: 'Film', release_date: '2026-11-15' },
    ]);
    const [show, movie] = await tmdbMediaProvider.search('x');
    expect(show.releaseDate).toBe('2026-10-01');
    expect(movie.releaseDate).toBe('2026-11-15');
  });
});
