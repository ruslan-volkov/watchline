const MONTHS_FR = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

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

/** Proximity bucket label — never a raw calendar date. */
export function proximityBucket(isoDate: string): string {
  const d = daysFromToday(isoDate);
  if (d <= 0) return "Aujourd'hui";
  if (d === 1) return 'Demain';
  if (d < 7) return `Dans ${d} jours`;
  if (d < 14) return 'La semaine prochaine';
  if (d < 31) return `Dans ${Math.round(d / 7)} semaines`;
  return 'Plus tard';
}

/** Contextual one-liner for a title's upcoming release. */
export function releaseSubtitle(isoDate: string, kind: 'movie' | 'episode', label?: string): string {
  const d = daysFromToday(isoDate);
  const when =
    d <= 0 ? "aujourd'hui" : d === 1 ? 'demain' : d < 7 ? `dans ${d} jours` : `dans ${Math.round(d / 7)} sem.`;
  if (kind === 'movie') return d <= 0 ? 'Sort aujourd’hui' : `Sort ${when}`;
  const ep = label ? `${label} ` : '';
  return d <= 0 ? `${ep}disponible` : `${ep}${when}`;
}

const BUCKET_ORDER = [
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
