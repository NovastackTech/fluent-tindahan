import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCatalog,
  resetCatalogCache,
  searchCatalogByName,
  searchCatalogByBarcode,
  findCatalogByName,
  findCatalogByBarcode
} from './catalog';

describe('catalog service', () => {
  beforeEach(() => {
    resetCatalogCache();
  });

  it('loads and caches catalog items from CSV', () => {
    const catalog = getCatalog();
    expect(catalog.length).toBeGreaterThan(100);

    const luckyMe = catalog.find((c) => c.barcode === '4800016644026');
    expect(luckyMe).toBeDefined();
    expect(luckyMe?.name).toBe('Lucky Me! Instant Pancit Canton Kalamansi');
    expect(luckyMe?.category).toBe('Instant Noodles');
    expect(luckyMe?.cost).toBe(13.25);
    expect(luckyMe?.price).toBe(16.0);
  });

  it('searches products by name with case-insensitivity and prioritizes exact and prefix matches', () => {
    const results = searchCatalogByName('pancit canton');
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(20);
    expect(results.every((r) => r.name.toLowerCase().includes('pancit canton'))).toBe(true);

    const singleMatch = searchCatalogByName('Lucky Me! Instant Pancit Canton Kalamansi');
    expect(singleMatch[0].name).toBe('Lucky Me! Instant Pancit Canton Kalamansi');
  });

  it('limits name suggestions to specified limit (default 20)', () => {
    const top5 = searchCatalogByName('', 5);
    expect(top5.length).toBe(5);

    const default20 = searchCatalogByName('', 20);
    expect(default20.length).toBe(20);
  });

  it('searches products by barcode prefix', () => {
    const results = searchCatalogByBarcode('4800016');
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(20);
    expect(results.every((r) => r.barcode.startsWith('4800016') || r.barcode.includes('4800016'))).toBe(true);
  });

  it('finds exact catalog item by barcode', () => {
    const item = findCatalogByBarcode('4800016644026');
    expect(item).toBeDefined();
    expect(item?.name).toBe('Lucky Me! Instant Pancit Canton Kalamansi');

    expect(findCatalogByBarcode('nonexistent')).toBeUndefined();
    expect(findCatalogByBarcode('')).toBeUndefined();
  });

  it('finds exact catalog item by name (case-insensitive)', () => {
    const item = findCatalogByName('lucky me! instant pancit canton kalamansi');
    expect(item).toBeDefined();
    expect(item?.barcode).toBe('4800016644026');

    expect(findCatalogByName('nonexistent product')).toBeUndefined();
    expect(findCatalogByName('')).toBeUndefined();
  });
});
