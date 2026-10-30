/**
 * Where a title (or episode) stands on the NAS.
 * - `wanted`: monitored, nothing found yet (not released, or no source).
 * - `partial`: some of several episodes are on the NAS, the rest is not.
 */
export type DownloadState =
  | { kind: 'none' }
  | { kind: 'wanted' }
  | { kind: 'queued' }
  | { kind: 'downloading'; progress: number }
  | { kind: 'downloaded' }
  | { kind: 'partial'; done: number; total: number };

export const NONE: DownloadState = { kind: 'none' };

/** The bits of a Radarr/Sonarr queue entry that matter here. */
export interface QueueItem {
  status?: string;
  size?: number;
  sizeleft?: number;
}

const WAITING = ['queued', 'paused', 'delay'];

export function stateFromQueueItem(item: QueueItem): DownloadState {
  if (item.status && WAITING.includes(item.status)) return { kind: 'queued' };
  const size = item.size ?? 0;
  const progress = size > 0 ? Math.min(1, Math.max(0, (size - (item.sizeleft ?? size)) / size)) : 0;
  return { kind: 'downloading', progress };
}

/** One state for a group of episodes (a season, a series). */
export function aggregateState(states: DownloadState[]): DownloadState {
  if (states.length === 0) return NONE;
  const done = states.filter((s) => s.kind === 'downloaded').length;
  if (done === states.length) return { kind: 'downloaded' };

  const downloading = states.filter(
    (s): s is Extract<DownloadState, { kind: 'downloading' }> => s.kind === 'downloading',
  );
  if (downloading.length > 0) {
    const progress = downloading.reduce((sum, s) => sum + s.progress, 0) / downloading.length;
    return { kind: 'downloading', progress };
  }
  if (states.some((s) => s.kind === 'queued')) return { kind: 'queued' };
  if (done > 0) return { kind: 'partial', done, total: states.length };
  if (states.some((s) => s.kind === 'wanted')) return { kind: 'wanted' };
  return NONE;
}

/** True while something is still moving, i.e. worth polling for. */
export function isInFlight(state: DownloadState | undefined): boolean {
  return state?.kind === 'downloading' || state?.kind === 'queued';
}

export function stateLabel(state: DownloadState, idle: string): string {
  switch (state.kind) {
    case 'none':
      return idle;
    case 'wanted':
      return 'En attente d’une source sur le NAS';
    case 'queued':
      return 'En file d’attente';
    case 'downloading':
      return `Téléchargement · ${Math.round(state.progress * 100)} %`;
    case 'downloaded':
      return 'Sur le NAS';
    case 'partial':
      return `${state.done}/${state.total} sur le NAS`;
  }
}
