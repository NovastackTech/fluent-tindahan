import { describe, it, expect, beforeEach } from 'vitest';
import { seedDexieDatabaseIfNeeded, DEFAULT_TENANT_ID, DEFAULT_USER_ID } from './seedData';
import { db } from './db';

describe('seedData', () => {
  beforeEach(async () => {
    await db.products.clear();
    await db.customers.clear();
    await db.utangLedger.clear();
  });

  it('exports default constant IDs', () => {
    expect(DEFAULT_TENANT_ID).toBe('11111111-1111-1111-1111-111111111111');
    expect(DEFAULT_USER_ID).toBe('22222222-2222-2222-2222-222222222222');
  });

  it('seeds products, customers, and sample utang ledgers when database is empty', async () => {
    await seedDexieDatabaseIfNeeded();

    const productCount = await db.products.count();
    expect(productCount).toBe(50);

    const customerCount = await db.customers.count();
    expect(customerCount).toBeGreaterThan(0);

    const utangCount = await db.utangLedger.count();
    expect(utangCount).toBeGreaterThan(0);
  });

  it('is idempotent and skips seeding when catalog is already populated', async () => {
    await seedDexieDatabaseIfNeeded();
    const count1 = await db.products.count();

    // Call second time without force
    await seedDexieDatabaseIfNeeded(false);
    const count2 = await db.products.count();

    expect(count2).toBe(count1);
  });
});
