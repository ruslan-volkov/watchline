import { serviceLabels, type ArrConfig, type ArrService } from './config';

/**
 * - `unreachable`: no answer (wrong address, NAS off, other network, timeout).
 * - `unauthorized`: the NAS answered but refused the API key.
 * - `wrong-app`: the address belongs to another service; `detail` is its name.
 * - `http`: anything else, including a reply that isn't Radarr/Sonarr JSON at
 *   all (a reverse proxy's login page, say); `detail` is the status code.
 * - `not-configured`: no quality profile or root folder picked yet.
 * - `not-ready`: Sonarr hasn't loaded the series' episodes (yet).
 */
export type ArrErrorKind =
  | 'unreachable'
  | 'unauthorized'
  | 'wrong-app'
  | 'http'
  | 'not-configured'
  | 'not-ready';

export class ArrError extends Error {
  constructor(
    readonly kind: ArrErrorKind,
    readonly detail?: string | number,
  ) {
    super(`Arr ${kind}${detail !== undefined ? ` ${detail}` : ''}`);
  }
}

/** A box that doesn't answer should fail in seconds, not at the OS TCP timeout. */
const READ_TIMEOUT_MS = 8_000;
/** Adding a title makes Radarr/Sonarr query their metadata servers first. */
const WRITE_TIMEOUT_MS = 30_000;

export type Target = Pick<ArrConfig, 'url' | 'apiKey'>;

// Radarr v5 and Sonarr v4 both serve their API under /api/v3.
export async function arrFetch<T>(
  { url, apiKey }: Target,
  path: string,
  write?: { method: 'POST' | 'PUT'; body: unknown },
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), write ? WRITE_TIMEOUT_MS : READ_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${url}/api/v3${path}`, {
      method: write?.method,
      headers: {
        'X-Api-Key': apiKey,
        accept: 'application/json',
        ...(write ? { 'Content-Type': 'application/json' } : null),
      },
      body: write ? JSON.stringify(write.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ArrError('unreachable');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401) throw new ArrError('unauthorized');
  if (!res.ok) throw new ArrError('http', res.status);
  // Some writes (monitoring episodes, say) answer with an empty body.
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ArrError('http', res.status);
  }
}

/** The profile and folder a new title goes to; `profileId` overrides the default. */
export function resolveTargets(config: ArrConfig, profileId?: number) {
  const qualityProfileId = profileId ?? config.qualityProfileId;
  if (qualityProfileId == null || config.rootFolderPath == null) {
    throw new ArrError('not-configured');
  }
  return { qualityProfileId, rootFolderPath: config.rootFolderPath };
}

/** Checks the address and key, and that the address really is `service`. */
export async function testConnection(service: ArrService, target: Target): Promise<string> {
  const status = await arrFetch<{ appName?: string; version?: string }>(target, '/system/status');
  const appName = status.appName ?? '';
  if (appName.toLowerCase() !== service) throw new ArrError('wrong-app', appName || '?');
  return status.version ?? '';
}

export interface QualityProfile {
  id: number;
  name: string;
}

export async function fetchQualityProfiles(target: Target): Promise<QualityProfile[]> {
  const profiles = await arrFetch<QualityProfile[]>(target, '/qualityprofile');
  return profiles.map(({ id, name }) => ({ id, name }));
}

export interface RootFolder {
  path: string;
}

export async function fetchRootFolders(target: Target): Promise<RootFolder[]> {
  const folders = await arrFetch<RootFolder[]>(target, '/rootfolder');
  return folders.map(({ path }) => ({ path }));
}

/** What to tell the user when talking to the NAS failed. */
export function describeArrError(error: unknown, service: ArrService): string {
  const label = serviceLabels[service];
  // Not ours, so the keychain or storage refused the write.
  if (!(error instanceof ArrError))
    return 'Impossible d’enregistrer la configuration sur cet appareil.';
  switch (error.kind) {
    case 'unreachable':
      return `${label} ne répond pas. Vérifie l’adresse, que le NAS est allumé et que tu es sur le bon réseau.`;
    case 'unauthorized':
      return `Clé API refusée par ${label}. Elle se trouve dans Réglages → Général.`;
    case 'wrong-app':
      return `Cette adresse répond comme ${error.detail}, pas comme ${label}.`;
    case 'http':
      return `Réponse inattendue (${error.detail}). Vérifie que l’adresse est bien celle de ${label}.`;
    case 'not-configured':
      return `Choisis un profil de qualité et un dossier pour ${label} dans Profil → NAS.`;
    case 'not-ready':
      return `${label} n’a pas encore chargé cette série. Réessaie dans un instant.`;
  }
}
