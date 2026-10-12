import { describe, expect, it } from 'vitest';
import { formatPeso } from './currency';

describe('formatPeso', () => {
  it('groups thousands and always shows two decimals', () => {
    expect(formatPeso(1700)).toBe('₱1,700.00');
    expect(formatPeso(78887)).toBe('₱78,887.00');
    expect(formatPeso(1200.5)).toBe('₱1,200.50');
  });

  it('places the negative sign before the peso symbol', () => {
    expect(formatPeso(-50)).toBe('-₱50.00');
  });
});
