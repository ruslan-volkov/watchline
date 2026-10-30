import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export type ArrService = 'radarr' | 'sonarr';

export const SERVICES: ArrService[] = ['radarr', 'sonarr'];

export const serviceLabels: Record<ArrService, string> = { radarr: 'Radarr', sonarr: 'Sonarr' };

export interface ArrConfig {
  url: string;
  apiKey: string;
  /** Quality profile new downloads are requested with; null until one is picked. */
  qualityProfileId: number | null;
  /** Root folder new titles are added under; null until one is picked. */
  rootFolderPath: string | null;
}

export type NasConfig = Partial<Record<ArrService, ArrConfig>>;

// The API key goes to the keychain; everything else is plain AsyncStorage. It
// must never sit in React Query: the query cache is persisted to AsyncStorage
// in clear (see queryPersist.ts). One storage entry per service, so saving one
// can't overwrite the other.
const settingsKey = (service: ArrService) => `watchline-nas-${service}`;
const secretKey = (service: ArrService) => `watchline-nas-${service}-key`;

type StoredSettings = Omit<ArrConfig, 'apiKey'>;

/**
 * Accepts what people type or paste (`192.168.1.20:7878`, `nas.local/radarr/`)
 * and returns `scheme://host[:port][/base]` without a trailing slash, or null
 * when it isn't an address. A missing scheme means plain http: that is what a
 * box on the home network answers.
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname) return null;
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

async function loadService(service: ArrService): Promise<ArrConfig | null> {
  const [raw, apiKey] = await Promise.all([
    AsyncStorage.getItem(settingsKey(service)),
    SecureStore.getItemAsync(secretKey(service)),
  ]);
  // Half a config (settings without key, or the reverse) is as good as none.
  if (!raw || !apiKey) return null;
  try {
    const settings = JSON.parse(raw) as StoredSettings;
    return { ...settings, apiKey };
  } catch {
    return null;
  }
}

export async function loadNasConfig(): Promise<NasConfig> {
  const entries = await Promise.all(
    SERVICES.map(async (service) => [service, await loadService(service)] as const),
  );
  const config: NasConfig = {};
  for (const [service, value] of entries) if (value) config[service] = value;
  return config;
}

export async function saveArrConfig(service: ArrService, config: ArrConfig): Promise<void> {
  const { apiKey, ...settings } = config;
  await SecureStore.setItemAsync(secretKey(service), apiKey);
  await AsyncStorage.setItem(settingsKey(service), JSON.stringify(settings));
}

export async function clearArrConfig(service: ArrService): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(secretKey(service)),
    AsyncStorage.removeItem(settingsKey(service)),
  ]);
}
