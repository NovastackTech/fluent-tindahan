import { describe, it, expect } from 'vitest';
import { sariSariBrand, sariSariLightTheme, sariSariDarkTheme } from './theme';

describe('theme', () => {
  it('defines the brand color tokens correctly', () => {
    expect(sariSariBrand[10]).toBe('#021B11');
    expect(sariSariBrand[80]).toBe('#20BA7C');
    expect(sariSariBrand[160]).toBe('#F7FEFA');
  });

  it('creates light and dark themes from sari-sari brand variants', () => {
    expect(sariSariLightTheme).toBeDefined();
    expect(sariSariDarkTheme).toBeDefined();
    expect(sariSariLightTheme.colorBrandForeground1).toBeDefined();
    expect(sariSariDarkTheme.colorBrandForeground1).toBeDefined();
  });
});
