import { describe, expect, it } from 'vitest';
import { formatPeso, formatMarginPercent } from './currency';

describe('formatPeso', () => {
  it('groups thousands and always shows two decimals', () => {
    expect(formatPeso(1700)).toBe('₱1,700.00');
    expect(formatPeso(78887)).toBe('₱78,887.00');
    expect(formatPeso(1200.5)).toBe('₱1,200.50');
  });

  it('places the negative sign before the peso symbol', () => {
    expect(formatPeso(-50)).toBe('-₱50.00');
  });

  it('does not display a negative sign when a negative amount rounds to zero', () => {
    expect(formatPeso(-0.001)).toBe('₱0.00');
  });
});

describe('formatMarginPercent', () => {
  it('formats typical margins with one decimal place', () => {
    expect(formatMarginPercent(25.5, 10)).toBe('25.5%');
    expect(formatMarginPercent(50, 50)).toBe('50.0%');
    expect(formatMarginPercent(99.5, 5)).toBe('99.5%');
  });

  it('shows 100.0% when cost is 0', () => {
    expect(formatMarginPercent(100, 0)).toBe('100.0%');
  });

  it('shows ~99.9% when cost > 0 and margin rounds to 100.0% (issue #120)', () => {
    const margin = ((1000000 - 5) / 1000000) * 100; // 99.9995%
    expect(formatMarginPercent(margin, 5)).toBe('~99.9%');
  });

  it('handles negative or zero margins properly', () => {
    expect(formatMarginPercent(0, 100)).toBe('0.0%');
    expect(formatMarginPercent(-10, 110)).toBe('-10.0%');
  });
});

