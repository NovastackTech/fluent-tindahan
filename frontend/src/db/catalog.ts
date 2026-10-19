import Papa from 'papaparse';
import catalogCsvRaw from './sari_sari_store_inventory_catalog.csv?raw';

export interface CatalogItem {
  barcode: string;
  name: string;
  brand: string;
  category: string;
  packageSize: string;
  unit: string;
  cost: number;
  price: number;
  stockQty: number;
}

let catalogCache: CatalogItem[] | null = null;

/**
 * Parses and returns the in-memory array of catalog items from the sari-sari store catalog CSV.
 * Cached after initial parsing.
 */
export function getCatalog(): CatalogItem[] {
  if (catalogCache) return catalogCache;

  const parsed = Papa.parse<Record<string, string>>(catalogCsvRaw, {
    header: true,
    skipEmptyLines: true,
  });

  catalogCache = (parsed.data || [])
    .filter((row) => row.product_name && row.product_name.trim().length > 0)
    .map((row) => ({
      barcode: (row.barcode || '').trim(),
      name: (row.product_name || '').trim(),
      brand: (row.brand || '').trim(),
      category: (row.category || '').trim(),
      packageSize: (row.package_size || '').trim(),
      unit: (row.unit || '').trim(),
      cost: parseFloat((row.cost_price_php || '').replace(/[^0-9.-]/g, '')) || 0,
      price: parseFloat((row.srp_php || '').replace(/[^0-9.-]/g, '')) || 0,
      stockQty: parseInt((row.stock_quantity || '').replace(/[^0-9]/g, ''), 10) || 0,
    }));

  return catalogCache;
}

/**
 * Resets the in-memory catalog cache (primarily for unit testing).
 */
export function resetCatalogCache(): void {
  catalogCache = null;
}

/**
 * Case-insensitive search by product name with prioritized ranking:
 * 1. Exact match
 * 2. Prefix match
 * 3. Substring match
 * Capped at `limit` (default 20) for optimal low-end Android performance.
 */
export function searchCatalogByName(query: string, limit = 20): CatalogItem[] {
  const catalog = getCatalog();
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    return catalog.slice(0, limit);
  }

  const exact: CatalogItem[] = [];
  const prefix: CatalogItem[] = [];
  const contains: CatalogItem[] = [];

  for (const item of catalog) {
    const lowerName = item.name.toLowerCase();
    if (lowerName === q) {
      exact.push(item);
    } else if (lowerName.startsWith(q)) {
      prefix.push(item);
    } else if (lowerName.includes(q)) {
      contains.push(item);
    }
  }

  return [...exact, ...prefix, ...contains].slice(0, limit);
}

/**
 * Search by barcode with prioritized ranking:
 * 1. Exact match
 * 2. Prefix match
 * 3. Substring match
 * Capped at `limit` (default 20).
 */
export function searchCatalogByBarcode(query: string, limit = 20): CatalogItem[] {
  const catalog = getCatalog();
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    return catalog.slice(0, limit);
  }

  const exact: CatalogItem[] = [];
  const prefix: CatalogItem[] = [];
  const contains: CatalogItem[] = [];

  for (const item of catalog) {
    const lowerBarcode = item.barcode.toLowerCase();
    if (lowerBarcode === q) {
      exact.push(item);
    } else if (lowerBarcode.startsWith(q)) {
      prefix.push(item);
    } else if (lowerBarcode.includes(q)) {
      contains.push(item);
    }
  }

  return [...exact, ...prefix, ...contains].slice(0, limit);
}

/**
 * Fast exact lookup by product name (case-insensitive).
 */
export function findCatalogByName(name: string): CatalogItem | undefined {
  const q = (name || '').trim().toLowerCase();
  if (!q) return undefined;
  return getCatalog().find((item) => item.name.toLowerCase() === q);
}

/**
 * Fast exact lookup by barcode.
 */
export function findCatalogByBarcode(barcode: string): CatalogItem | undefined {
  const q = (barcode || '').trim().toLowerCase();
  if (!q) return undefined;
  return getCatalog().find((item) => item.barcode.toLowerCase() === q);
}
