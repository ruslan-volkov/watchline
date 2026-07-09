import type { ColorScheme } from './tokens';

/**
 * Deterministic placeholder poster color, keyed off a stable string (media id or
 * tmdb id). Same input -> same hue, so a title keeps its color across lists.
 */
const HUES = [255, 210, 160, 20, 340, 45, 130, 285, 195, 5];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function hue(seed: string): number {
  return HUES[hash(seed) % HUES.length];
}

/** Soft pastel fill for a placeholder poster. */
export function posterColor(seed: string, scheme: ColorScheme): string {
  const h = hue(seed);
  return scheme === 'light' ? `hsl(${h}, 55%, 82%)` : `hsl(${h}, 40%, 32%)`;
}

/** A more saturated tint of the same hue — used for progress bars. */
export function posterAccentColor(seed: string, scheme: ColorScheme): string {
  const h = hue(seed);
  return scheme === 'light' ? `hsl(${h}, 62%, 52%)` : `hsl(${h}, 60%, 62%)`;
}

/** Readable text/initial color drawn on top of the placeholder fill. */
export function posterTextColor(seed: string, scheme: ColorScheme): string {
  const h = hue(seed);
  return scheme === 'light' ? `hsl(${h}, 55%, 30%)` : `hsl(${h}, 45%, 85%)`;
}
