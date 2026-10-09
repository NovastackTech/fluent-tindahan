import { describe, it, expect, beforeEach } from 'vitest';
import { parseProductsCsv, importProductsToDexieAndSync, type ParsedProductPreview } from './csvImporter';
import { db } from '../db/db';

describe('csvImporter', () => {
  beforeEach(async () => {
    await db.products.clear();
    await db.syncQueue.clear();
  });

  it('parses valid CSV text and converts to product previews', async () => {
    const csvContent = `name,price,cost,barcode,category,stockQty
Lucky Me Pancit Canton,16.00,13.25,4800016644026,Instant Noodles,24
Coke Mismo 295ml,18.00,14.50,4800001234567,Beverages,12`;

    const previews = await parseProductsCsv(csvContent);

    expect(previews).toHaveLength(2);
    expect(previews[0].name).toBe('Lucky Me Pancit Canton');
    expect(previews[0].price).toBe(16);
    expect(previews[0].cost).toBe(13.25);
    expect(previews[0].barcode).toBe('4800016644026');
    expect(previews[0].category).toBe('Instant Noodles');
    expect(previews[0].stockQty).toBe(24);
    expect(previews[0].isValid).toBe(true);
    expect(previews[0].errors).toHaveLength(0);

    expect(previews[1].name).toBe('Coke Mismo 295ml');
    expect(previews[1].price).toBe(18);
    expect(previews[1].isValid).toBe(true);
  });

  it('detects invalid rows with missing name, negative cost, or non-positive price', async () => {
    const invalidCsv = `name,price,cost,barcode,category,stockQty
,25.00,20.00,12345,Snacks,10
SkyFlakes,-5.00,10.00,67890,Biscuits,15
Chippy,15.00,-2.00,11111,Snacks,5`;

    const previews = await parseProductsCsv(invalidCsv);

    expect(previews).toHaveLength(3);
    // Missing name
    expect(previews[0].isValid).toBe(false);
    expect(previews[0].errors.some(e => e.includes('Product Name is required') || e.includes('Kailangan ang pangalan'))).toBe(true);

    // Negative/invalid price
    expect(previews[1].isValid).toBe(false);

    // Negative cost
    expect(previews[2].isValid).toBe(false);
  });

  it('imports valid products to Dexie and queues them for sync', async () => {
    const items: ParsedProductPreview[] = [
      {
        id: 'p-1',
        raw: { name: 'Piattos Cheese', price: 17 },
        name: 'Piattos Cheese',
        price: 17,
        cost: 14,
        barcode: '123456789',
        category: 'Snacks',
        stockQty: 20,
        isValid: true,
        errors: []
      },
      {
        id: 'p-invalid',
        raw: { name: '', price: 0 },
        name: '',
        price: 0,
        cost: 0,
        barcode: '',
        category: 'General',
        stockQty: 0,
        isValid: false,
        errors: ['Invalid']
      }
    ];

    const importedCount = await importProductsToDexieAndSync(items);

    expect(importedCount).toBe(1);

    const savedProduct = await db.products.get('p-1');
    expect(savedProduct).toBeDefined();
    expect(savedProduct?.name).toBe('Piattos Cheese');
    expect(savedProduct?.price).toBe(17);

    const queuedOps = await db.syncQueue.toArray();
    expect(queuedOps).toHaveLength(1);
    expect(queuedOps[0].entity).toBe('Product');
    expect(queuedOps[0].action).toBe('Insert');
    expect(queuedOps[0].payload.name).toBe('Piattos Cheese');
  });
});
