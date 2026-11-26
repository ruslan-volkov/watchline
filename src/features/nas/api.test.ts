import {
  ArrError,
  describeArrError,
  fetchQualityProfiles,
  fetchRootFolders,
  testConnection,
} from './api';

const target = { url: 'http://192.168.1.20:7878', apiKey: 'key' };

function reply(init: { ok?: boolean; status?: number; body?: unknown; badJson?: boolean }) {
  const { ok = true, status = 200, body, badJson = false } = init;
  const fetchMock = jest.fn().mockResolvedValue({
    ok,
    status,
    text: async () => {
      if (badJson) return '<html>Please sign in</html>';
      return body === undefined ? '' : JSON.stringify(body);
    },
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('testConnection', () => {
  it('calls /system/status with the API key and returns the version', async () => {
    const fetchMock = reply({ body: { appName: 'Radarr', version: '5.14.0.9383' } });
    expect(await testConnection('radarr', target)).toBe('5.14.0.9383');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://192.168.1.20:7878/api/v3/system/status');
    expect(init.headers['X-Api-Key']).toBe('key');
  });

  it('reports a refused key as unauthorized', async () => {
    reply({ ok: false, status: 401 });
    await expect(testConnection('radarr', target)).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('reports a network failure as unreachable', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
    await expect(testConnection('radarr', target)).rejects.toMatchObject({ kind: 'unreachable' });
  });

  it('catches Sonarr’s address pasted into the Radarr form', async () => {
    reply({ body: { appName: 'Sonarr', version: '4.0.0.0' } });
    await expect(testConnection('radarr', target)).rejects.toMatchObject({
      kind: 'wrong-app',
      detail: 'Sonarr',
    });
  });

  it('treats a non-JSON reply (a proxy login page) as an unexpected response', async () => {
    reply({ badJson: true });
    await expect(testConnection('radarr', target)).rejects.toMatchObject({
      kind: 'http',
      detail: 200,
    });
  });

  it('reports a server error with its status', async () => {
    reply({ ok: false, status: 502 });
    await expect(testConnection('sonarr', target)).rejects.toMatchObject({
      kind: 'http',
      detail: 502,
    });
  });
});

describe('lookups', () => {
  it('keeps only id and name of quality profiles', async () => {
    reply({ body: [{ id: 4, name: 'HD-1080p', cutoff: 7, items: [] }] });
    expect(await fetchQualityProfiles(target)).toEqual([{ id: 4, name: 'HD-1080p' }]);
  });

  it('keeps only the path of root folders', async () => {
    reply({ body: [{ id: 1, path: '/data/media/movies', freeSpace: 123 }] });
    expect(await fetchRootFolders(target)).toEqual([{ path: '/data/media/movies' }]);
  });
});

describe('describeArrError', () => {
  it('names the service and says what to do', () => {
    expect(describeArrError(new ArrError('unauthorized'), 'sonarr')).toContain('Sonarr');
    expect(describeArrError(new ArrError('wrong-app', 'Sonarr'), 'radarr')).toBe(
      'Cette adresse répond comme Sonarr, pas comme Radarr.',
    );
  });

  it('does not leak a foreign error’s message', () => {
    expect(describeArrError(new Error('secret'), 'radarr')).not.toContain('secret');
  });
});
