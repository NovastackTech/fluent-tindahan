import { describe, expect, it } from 'vitest';
import { toLocalDateKey } from './date';

describe('toLocalDateKey', () => {
  it('uses local calendar components for Date values and ISO strings', () => {
    const localDate = new Date(2026, 9, 12, 0, 30);
    const isoDate = '2026-10-12T00:30:00+14:00';
    const parsedIsoDate = new Date(isoDate);
    const expectedIsoKey = [
      parsedIsoDate.getFullYear(),
      String(parsedIsoDate.getMonth() + 1).padStart(2, '0'),
      String(parsedIsoDate.getDate()).padStart(2, '0')
    ].join('-');

    expect(toLocalDateKey(localDate)).toBe('2026-10-12');
    expect(toLocalDateKey(isoDate)).toBe(expectedIsoKey);
  });

  it('rolls over at local midnight', () => {
    const beforeMidnight = new Date(2026, 9, 12, 23, 59, 59, 999);
    const afterMidnight = new Date(beforeMidnight.getTime() + 1);

    expect(toLocalDateKey(beforeMidnight)).toBe('2026-10-12');
    expect(toLocalDateKey(afterMidnight)).toBe('2026-10-13');
  });

  it('returns an empty key for invalid dates', () => {
    expect(toLocalDateKey('not-a-date')).toBe('');
    expect(toLocalDateKey(new Date(Number.NaN))).toBe('');
  });
});