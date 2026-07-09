import { airDateLabel, bucketRank, daysFromToday, proximityBucket } from './timeGrouping';

/** Local ISO date `offset` days from today (noon avoids UTC/DST day flips). */
function iso(offset: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('timeGrouping', () => {
  it('daysFromToday counts whole days', () => {
    expect(daysFromToday(iso(0))).toBe(0);
    expect(daysFromToday(iso(1))).toBe(1);
    expect(daysFromToday(iso(-2))).toBe(-2);
  });

  it('proximityBucket labels near dates', () => {
    expect(proximityBucket(iso(0))).toBe("Aujourd'hui");
    expect(proximityBucket(iso(1))).toBe('Demain');
    expect(proximityBucket(iso(3))).toBe('Dans 3 jours');
  });

  it('airDateLabel reads as a countdown then a date', () => {
    expect(airDateLabel(iso(0))).toBe('Disponible');
    expect(airDateLabel(iso(1))).toBe('Demain');
    expect(airDateLabel(iso(4))).toBe('Dans 4 jours');
    // Far dates fall back to "day month" — assert the day number is present.
    expect(airDateLabel(iso(40))).toMatch(/^\d{1,2}\s/);
  });

  it('bucketRank orders buckets chronologically', () => {
    expect(bucketRank("Aujourd'hui")).toBeLessThan(bucketRank('Demain'));
    expect(bucketRank('Demain')).toBeLessThan(bucketRank('La semaine prochaine'));
  });
});
