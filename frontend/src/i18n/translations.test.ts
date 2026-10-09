import { describe, it, expect } from 'vitest';
import { translations } from './translations';

describe('translations', () => {
  it('has entries for both tl and en', () => {
    expect(translations.tl).toBeDefined();
    expect(translations.en).toBeDefined();
  });

  it('ensures all top-level keys in tl match en', () => {
    const tlKeys = Object.keys(translations.tl).sort();
    const enKeys = Object.keys(translations.en).sort();
    expect(tlKeys).toEqual(enKeys);
  });

  it('ensures all sub-keys in every section are fully populated in both languages', () => {
    const sections = Object.keys(translations.tl) as Array<keyof typeof translations.tl>;

    for (const section of sections) {
      const tlSubKeys = Object.keys(translations.tl[section]).sort();
      const enSubKeys = Object.keys(translations.en[section]).sort();
      expect(tlSubKeys).toEqual(enSubKeys);

      // Verify no empty string values
      for (const key of tlSubKeys) {
        expect((translations.tl[section] as any)[key]).toBeTruthy();
        expect((translations.en[section] as any)[key]).toBeTruthy();
      }
    }
  });
});
