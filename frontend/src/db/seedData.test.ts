import { describe, it, expect, beforeEach } from 'vitest';
import { seedDexieDatabaseIfNeeded, DEFAULT_TENANT_ID, DEFAULT_USER_ID } from './seedData';
import { db } from './db';

describe('seedData', () => {
  beforeEach(async () => {
    await db.products.clear();
    await db.customers.clear();
    await db.utangLedger.clear();
    await db.tenants.clear();
    await db.syncQueue.clear();
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

  it('seeds an isolated catalog of 10 starter products for a new tenant without changing default data or copying demo activity', async () => {
    await seedDexieDatabaseIfNeeded();
    const defaultProduct = await db.products.orderBy('id').first();
    const newTenantId = '99999999-9999-4999-8999-999999999999';

    await seedDexieDatabaseIfNeeded(false, newTenantId, false, 'New Store');

    const tenantProducts = await db.products.where('tenantId').equals(newTenantId).toArray();
    const retainedDefaultProduct = await db.products.get(defaultProduct!.id);
    expect(tenantProducts).toHaveLength(10);
    expect(tenantProducts.every((product) => product.id !== defaultProduct!.id)).toBe(true);
    expect(retainedDefaultProduct?.tenantId).toBe(DEFAULT_TENANT_ID);
    expect(await db.customers.where('tenantId').equals(newTenantId).count()).toBe(0);
    expect(await db.utangLedger.where('tenantId').equals(newTenantId).count()).toBe(0);
    expect(await db.gcashTxns.where('tenantId').equals(newTenantId).count()).toBe(0);
    expect((await db.tenants.get(newTenantId))?.businessName).toBe('New Store');
    expect(await db.syncQueue.count()).toBe(10);
    const queuedItems = await db.syncQueue.toArray();
    expect(queuedItems.every((item) => item.entity === 'Product' && item.action === 'Insert' && item.payload.tenantId === newTenantId)).toBe(true);
  });

  it('creates empty catalog for custom tenant when emptyCatalog is true without enqueuing sync items', async () => {
    const emptyTenantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    await seedDexieDatabaseIfNeeded(false, emptyTenantId, true, 'Clean Store');
    expect(await db.products.where('tenantId').equals(emptyTenantId).count()).toBe(0);
    expect(await db.syncQueue.count()).toBe(0);
    expect((await db.tenants.get(emptyTenantId))?.businessName).toBe('Clean Store');
  });

  it('keeps a custom tenant catalog at 10 when two non-forced seeds race', async () => {
    const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    await Promise.all([
      seedDexieDatabaseIfNeeded(false, tenantId, false, 'Concurrent Store'),
      seedDexieDatabaseIfNeeded(false, tenantId, false, 'Concurrent Store')
    ]);

    expect(await db.products.where('tenantId').equals(tenantId).count()).toBe(10);
    expect((await db.tenants.get(tenantId))?.businessName).toBe('Concurrent Store');
  });

  it('preserves existing tenant profile and tier when startup seeding runs', async () => {
    await db.tenants.put({
      id: DEFAULT_TENANT_ID,
      businessName: 'My Existing Store',
      tier: 'TindahanPro',
      subscriptionEndDate: '2026-12-31T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    });

    await seedDexieDatabaseIfNeeded();

    const tenant = await db.tenants.get(DEFAULT_TENANT_ID);
    expect(tenant?.businessName).toBe('My Existing Store');
    expect(tenant?.tier).toBe('TindahanPro');
    expect(tenant?.subscriptionEndDate).toBe('2026-12-31T00:00:00.000Z');
  });

  it('creates a missing tenant without assigning a subscription tier', async () => {
    await seedDexieDatabaseIfNeeded(true, DEFAULT_TENANT_ID, true);

    const tenant = await db.tenants.get(DEFAULT_TENANT_ID);
    expect(tenant?.businessName).toBe("Aling Nena's Tindahan & GCash");
    expect(tenant).not.toHaveProperty('tier');
  });
});
