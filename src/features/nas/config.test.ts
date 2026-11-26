import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearArrConfig, loadNasConfig, normalizeUrl, saveArrConfig } from './config';

// The keychain is native; this stands in for it.
const mockKeychain = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockKeychain.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockKeychain.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockKeychain.delete(key);
  },
}));

const radarr = {
  url: 'http://192.168.1.20:7878',
  apiKey: 'radarr-secret-key',
  qualityProfileId: 4,
  rootFolderPath: '/data/media/movies',
};

beforeEach(async () => {
  mockKeychain.clear();
  await AsyncStorage.clear();
});

describe('normalizeUrl', () => {
  it('assumes http when no scheme is typed', () => {
    expect(normalizeUrl('192.168.1.20:7878')).toBe('http://192.168.1.20:7878');
  });

  it('keeps https and drops trailing slashes', () => {
    expect(normalizeUrl(' https://nas.tailnet.ts.net:7878/ ')).toBe(
      'https://nas.tailnet.ts.net:7878',
    );
  });

  it('keeps a base path used behind a reverse proxy', () => {
    expect(normalizeUrl('nas.local/radarr/')).toBe('http://nas.local/radarr');
  });

  it('rejects input that is not an address', () => {
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('   ')).toBeNull();
    expect(normalizeUrl('pas une adresse')).toBeNull();
  });
});

describe('stored NAS config', () => {
  it('round-trips a service', async () => {
    await saveArrConfig('radarr', radarr);
    expect(await loadNasConfig()).toEqual({ radarr });
  });

  it('keeps the API key out of AsyncStorage', async () => {
    await saveArrConfig('radarr', radarr);
    const stored = await AsyncStorage.multiGet(await AsyncStorage.getAllKeys());
    expect(JSON.stringify(stored)).not.toContain(radarr.apiKey);
  });

  it('saving one service leaves the other alone', async () => {
    await saveArrConfig('radarr', radarr);
    await saveArrConfig('sonarr', {
      ...radarr,
      url: 'http://192.168.1.20:8989',
      apiKey: 'sonarr-key',
    });
    await clearArrConfig('sonarr');
    expect(await loadNasConfig()).toEqual({ radarr });
  });

  it('ignores a service whose key is gone from the keychain', async () => {
    await saveArrConfig('radarr', radarr);
    mockKeychain.clear();
    expect(await loadNasConfig()).toEqual({});
  });

  it('ignores corrupted settings', async () => {
    await saveArrConfig('radarr', radarr);
    await AsyncStorage.setItem('watchline-nas-radarr', '{not json');
    expect(await loadNasConfig()).toEqual({});
  });
});
