// Shared by the Edge Function, which enforces these rules, and the app, which uses them
// to show why "Relancer" is unavailable. No imports, so that both runtimes can load it.

/** Same limit as the `recommendations.message` check constraint. */
export const MESSAGE_MAX_LENGTH = 140;
export const MAX_NUDGES = 3;
export const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type NudgeBlock = 'cooldown' | 'limit';

/** Why this recommendation can't be nudged right now, or `null` if it can. */
export function nudgeBlock(
  rec: { nudge_count: number; last_nudged_at: string | null },
  now: number,
): NudgeBlock | null {
  if (rec.nudge_count >= MAX_NUDGES) return 'limit';
  if (rec.last_nudged_at && now - Date.parse(rec.last_nudged_at) < NUDGE_COOLDOWN_MS) {
    return 'cooldown';
  }
  return null;
}

/** A message from the request body: trimmed, capped, and `null` when there is none. */
export function cleanMessage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  return raw.trim().slice(0, MESSAGE_MAX_LENGTH).trim() || null;
}

export interface PushCopy {
  title: string;
  body: string;
}

export function recommendationCopy(
  username: string | null,
  mediaTitle: string,
  message: string | null,
): PushCopy {
  return {
    title: `${who(username)} te recommande ${mediaTitle}`,
    body: message ?? 'Un titre à ajouter à ta liste ?',
  };
}

export function nudgeCopy(
  username: string | null,
  mediaTitle: string,
  message: string | null,
): PushCopy {
  return {
    title: `${who(username)} te relance pour ${mediaTitle}`,
    body: message ?? 'Tu y as jeté un œil ?',
  };
}

function who(username: string | null): string {
  return username ? `@${username}` : 'Quelqu’un';
}
