import Papa from 'papaparse';
import { db, type ProductRecord } from '../db/db';
import { enqueueSync } from '../sync/syncEngine';
import { useAuthStore } from '../state/authStore';

export interface CsvProductRow {
  name: string;
  price: string | number;
  cost?: string | number;
  barcode?: string;
  category?: string;
  stockQty?: string | number;
}

export interface ParsedProductPreview {
  id: string;
  raw: CsvProductRow;
  name: string;
  price: number;
  cost: number;
  barcode: string;
  category: string;
  stockQty: number;
  isValid: boolean;
  errors: string[];
}

export function parseProductsCsv(fileOrText: File | string): Promise<ParsedProductPreview[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvProductRow>(fileOrText as any, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;
        const previews: ParsedProductPreview[] = rows.map((row) => {
          const errors: string[] = [];
          const name = (row.name || '').toString().trim();
          if (!name) {
            errors.push('Kailangan ang pangalan ng produkto (Product Name is required)');
          }

          const rawPrice = (row.price ?? '').toString().replace(/[^0-9.-]/g, '');
          const price = parseFloat(rawPrice);
          if (isNaN(price) || price <= 0) {
            errors.push('Wastong presyo ang kailangan (Valid price > 0 required)');
          }

          const rawCost = (row.cost ?? '0').toString().replace(/[^0-9.-]/g, '');
          const cost = isNaN(parseFloat(rawCost)) ? 0 : parseFloat(rawCost);
          if (cost < 0) {
            errors.push('Hindi puwedeng negatibo ang puhunan (Cost cannot be negative)');
          }

          const rawStock = (row.stockQty ?? '0').toString().replace(/[^0-9]/g, '');
          const stockQty = isNaN(parseInt(rawStock, 10)) ? 0 : parseInt(rawStock, 10);

          const barcode = (row.barcode || '').toString().trim();
          const category = (row.category || 'General').toString().trim();

          return {
            id: crypto.randomUUID(),
            raw: row,
            name,
            price: isNaN(price) ? 0 : price,
            cost,
            barcode,
            category,
            stockQty,
            isValid: errors.length === 0,
            errors
          };
        });

        resolve(previews);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

export async function importProductsToDexieAndSync(validItems: ParsedProductPreview[]): Promise<number> {
  const tenantId = useAuthStore.getState().tenantId;
  const now = new Date().toISOString();

  let imported = 0;
  for (const item of validItems) {
    if (!item.isValid) continue;

    const product: ProductRecord = {
      id: item.id,
      tenantId,
      name: item.name,
      price: item.price,
      cost: item.cost,
      barcode: item.barcode || undefined,
      category: item.category || 'General',
      stockQty: item.stockQty,
      updatedAt: now
    };

    // 1. Direct local-first insert to Dexie
    await db.products.put(product);

    // 2. Enqueue to batch sync queue
    await enqueueSync('Product', 'Insert', product);
    imported++;
  }

  return imported;
}
