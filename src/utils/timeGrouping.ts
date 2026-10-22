const MONTHS_FR = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

const MONTHS_FULL = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/** "Juillet 2026" from an ISO date, for calendar month headers. */
export function monthYearLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

/** "12 juil." — compact day + month, for calendar date pills. */
export function dayMonthLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

const MONTHS_LOWER = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** "9 juillet 2025" / "1er mars 2026" — full date, for a title's release line. */
export function longDateLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  const day = d.getDate() === 1 ? '1er' : String(d.getDate());
  return `${day} ${MONTHS_LOWER[d.getMonth()]} ${d.getFullYear()}`;
}

/** Short French label for a future air date ("Demain", "Dans 4 jours", "12 août"). */
export function airDateLabel(isoDate: string): string {
  const d = daysFromToday(isoDate);
  if (d <= 0) return 'Disponible';
  if (d === 1) return 'Demain';
  if (d < 7) return `Dans ${d} jours`;
  const dt = new Date(`${isoDate}T00:00:00`);
  return `${dt.getDate()} ${MONTHS_FR[dt.getMonth()]}`;
}

/** Whole-day difference between an ISO date (YYYY-MM-DD) and today. */
export function daysFromToday(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${isoDate}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** How far back a release still counts as "just out" and stays in the timeline
 *  instead of dropping into "À rattraper". */
export const RECENT_WINDOW_DAYS = 14;

export const RECENT = 'Sortis récemment';

/** Proximity bucket label — never a raw calendar date. Releases up to
 *  RECENT_WINDOW_DAYS old share one bucket, ahead of "Aujourd'hui"; each row's
 *  subtitle carries the precise "il y a X jours". */
export function proximityBucket(isoDate: string): string {
  const d = daysFromToday(isoDate);
  if (d < -RECENT_WINDOW_DAYS) return 'Plus ancien';
  if (d < 0) return RECENT;
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return 'Demain';
  if (d < 7) return `Dans ${d} jours`;
  if (d < 14) return 'La semaine prochaine';
  if (d < 31) return `Dans ${Math.round(d / 7)} semaines`;
  return 'Plus tard';
}

/**
 * Out long enough to count as a real backlog item. An undated title is not
 * late — it is unannounced, and belongs nowhere until TMDB schedules it.
 */
export function isOverdue(isoDate: string | null | undefined): boolean {
  return !!isoDate && daysFromToday(isoDate) < -RECENT_WINDOW_DAYS;
}

/** Contextual one-liner for a title's upcoming release. */
export function releaseSubtitle(isoDate: string, kind: 'movie' | 'episode', label?: string): string {
  const d = daysFromToday(isoDate);
  const ep = label ? `${label} ` : '';
  // Already out: say how long it's been waiting rather than "disponible", which
  // reads the same on day 0 and day 12.
  if (d < 0) {
    const since = d === -1 ? 'hier' : `il y a ${-d} jours`;
    return kind === 'movie' ? `Sorti ${since}` : `${ep}dispo ${since}`;
  }
  const when =
    d === 0 ? "aujourd'hui" : d === 1 ? 'demain' : d < 7 ? `dans ${d} jours` : `dans ${Math.round(d / 7)} sem.`;
  if (kind === 'movie') return d === 0 ? 'Sort aujourd’hui' : `Sort ${when}`;
  return d === 0 ? `${ep}disponible` : `${ep}${when}`;
}

const BUCKET_ORDER = [
  RECENT,
  "Aujourd'hui",
  'Demain',
  'Dans 2 jours',
  'Dans 3 jours',
  'Dans 4 jours',
  'Dans 5 jours',
  'Dans 6 jours',
  'La semaine prochaine',
];

/** Sort helper so buckets render in chronological order. */
export function bucketRank(bucket: string): number {
  const idx = BUCKET_ORDER.indexOf(bucket);
  if (idx >= 0) return idx;
  if (bucket.startsWith('Dans') && bucket.includes('semaine')) return 100;
  return 200;
}
