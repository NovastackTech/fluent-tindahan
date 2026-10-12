import { describe, expect, it } from 'vitest';
import { normalizePhilippineMobile } from './philippineMobile';

describe('normalizePhilippineMobile', () => {
  it('keeps local PH mobile numbers in canonical form', () => {
    expect(normalizePhilippineMobile('09171234567')).toBe('09171234567');
  });

  it('normalizes formatted international PH numbers to local form', () => {
    expect(normalizePhilippineMobile('+63 917-123-4567')).toBe('09171234567');
  });

  it('allows an empty optional phone and rejects malformed values', () => {
    expect(normalizePhilippineMobile('  ')).toBe('');
    expect(normalizePhilippineMobile('abc123')).toBeNull();
    expect(normalizePhilippineMobile('12345678901')).toBeNull();
  });
});
