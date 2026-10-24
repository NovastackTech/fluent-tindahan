import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { db, FluentTindahanDatabase } from './db';

describe('FluentTindahanDatabase', () => {
  beforeEach(async () => {
    await db.products.clear();
    await db.customers.clear();
    await db.sales.clear();
    await db.saleItems.clear();
    await db.utangLedger.clear();
    await db.gcashTxns.clear();
    await db.gcashTxnResolutions.clear();
    await db.syncQueue.clear();
    await db.deadLetterQueue.clear();
  });

  it('initializes all tables properly', () => {
    expect(db.products).toBeDefined();
    expect(db.customers).toBeDefined();
    expect(db.sales).toBeDefined();
    expect(db.saleItems).toBeDefined();
    expect(db.utangLedger).toBeDefined();
    expect(db.gcashTxns).toBeDefined();
    expect(db.gcashTxnResolutions).toBeDefined();
    expect(db.syncQueue).toBeDefined();
    expect(db.deadLetterQueue).toBeDefined();
  });

  it('backfills normalized GCash references when upgrading from database version 4', async () => {
    const databaseName = `FluentTindahanLegacyRefs-${crypto.randomUUID()}`;
    const legacyDb = new Dexie(databaseName);
    legacyDb.version(4).stores({
      products: 'id, tenantId, name, barcode, category, updatedAt',
      customers: 'id, tenantId, name, phone, totalUtangBalance, updatedAt',
      sales: 'id, tenantId, date, paymentMethod, customerId',
      saleItems: 'id, tenantId, saleId, productId',
      utangLedger: 'id, tenantId, customerId, type, date, refSaleId',
      gcashTxns: 'id, tenantId, type, date, refNo, refNoNorm, [tenantId+refNoNorm]',
      gcashTxnResolutions: 'gcashTxnId, tenantId, resolution, resolvedAt',
      syncQueue: 'id, entity, status, retryCount, timestamp',
      deadLetterQueue: 'id, entity, failedAt',
      tenants: 'id, tier, subscriptionEndDate, updatedAt'
    });

    await legacyDb.open();
    await legacyDb.table('gcashTxns').bulkAdd([
      {
        id: 'legacy-ref-missing',
        tenantId: 'tenant-1',
        type: 'CashIn',
        amount: 100,
        fee: 5,
        refNo: '  REF-Legacy-1  ',
        date: new Date().toISOString()
      },
      {
        id: 'legacy-ref-stale',
        tenantId: 'tenant-1',
        type: 'CashIn',
        amount: 200,
        fee: 5,
        refNo: 'REF-Legacy-2',
        refNoNorm: 'incorrect-normalized-value',
        date: new Date().toISOString()
      }
    ]);
    legacyDb.close();

    const upgradedDb = new FluentTindahanDatabase(databaseName);
    try {
      await upgradedDb.open();
      expect((await upgradedDb.gcashTxns.get('legacy-ref-missing'))?.refNoNorm).toBe('ref-legacy-1');
      expect((await upgradedDb.gcashTxns.get('legacy-ref-stale'))?.refNoNorm).toBe('ref-legacy-2');
    } finally {
      upgradedDb.close();
      await Dexie.delete(databaseName);
    }
  });

  it('performs CRUD operations on products table', async () => {
    const testProduct = {
      id: 'test-p1',
      tenantId: 't-1',
      name: 'Milo 22g',
      price: 12,
      cost: 9.5,
      barcode: '480001234567',
      category: 'Beverages',
      stockQty: 30,
      updatedAt: new Date().toISOString()
    };

    await db.products.add(testProduct);
    let retrieved = await db.products.get('test-p1');
    expect(retrieved?.name).toBe('Milo 22g');

    // Update
    await db.products.update('test-p1', { stockQty: 25 });
    retrieved = await db.products.get('test-p1');
    expect(retrieved?.stockQty).toBe(25);

    // Delete
    await db.products.delete('test-p1');
    retrieved = await db.products.get('test-p1');
    expect(retrieved).toBeUndefined();
  });

  it('performs CRUD operations on customers and utang ledger', async () => {
    const custId = 'cust-test-1';
    await db.customers.add({
      id: custId,
      tenantId: 't-1',
      name: 'Ka Freddie',
      phone: '09181234567',
      totalUtangBalance: 50,
      updatedAt: new Date().toISOString()
    });

    await db.utangLedger.add({
      id: 'utang-1',
      tenantId: 't-1',
      customerId: custId,
      amount: 50,
      type: 'Credit',
      date: new Date().toISOString(),
      notes: 'Kape at asukal'
    });

    const customer = await db.customers.get(custId);
    expect(customer?.totalUtangBalance).toBe(50);

    const entries = await db.utangLedger.where('customerId').equals(custId).toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0].amount).toBe(50);
  });

  it('performs CRUD operations on sales and gcash transactions', async () => {
    const saleId = 'sale-1';
    await db.sales.add({
      id: saleId,
      tenantId: 't-1',
      totalAmount: 120,
      paymentMethod: 'Cash',
      date: new Date().toISOString(),
      userId: 'u-1',
      cashReceived: 200,
      changeGiven: 80
    });

    await db.gcashTxns.add({
      id: 'gcash-1',
      tenantId: 't-1',
      type: 'CashIn',
      amount: 500,
      fee: 10,
      refNo: 'REF-123456',
      date: new Date().toISOString()
    });

    const sale = await db.sales.get(saleId);
    expect(sale?.totalAmount).toBe(120);

    const gcash = await db.gcashTxns.get('gcash-1');
    expect(gcash?.amount).toBe(500);
    expect(gcash?.fee).toBe(10);
  });

  it('supports compound index queries on sales [tenantId+date] and utangLedger [tenantId+customerId]', async () => {
    await db.sales.bulkAdd([
      { id: 's-1', tenantId: 'tenant-a', totalAmount: 10, paymentMethod: 'Cash', date: '2026-10-23T10:00:00Z', userId: 'u-1' },
      { id: 's-2', tenantId: 'tenant-a', totalAmount: 20, paymentMethod: 'Cash', date: '2026-10-23T12:00:00Z', userId: 'u-1' },
      { id: 's-3', tenantId: 'tenant-b', totalAmount: 30, paymentMethod: 'Cash', date: '2026-10-23T11:00:00Z', userId: 'u-1' }
    ]);

    await db.utangLedger.bulkAdd([
      { id: 'u-1', tenantId: 'tenant-a', customerId: 'cust-1', amount: 50, type: 'Credit', date: '2026-10-23T10:00:00Z' },
      { id: 'u-2', tenantId: 'tenant-a', customerId: 'cust-2', amount: 75, type: 'Credit', date: '2026-10-23T10:30:00Z' },
      { id: 'u-3', tenantId: 'tenant-b', customerId: 'cust-1', amount: 100, type: 'Credit', date: '2026-10-23T11:00:00Z' }
    ]);

    const tenantASales = await db.sales
      .where('[tenantId+date]')
      .between(['tenant-a', '2026-10-23T00:00:00Z'], ['tenant-a', '2026-10-23T23:59:59Z'], true, true)
      .reverse()
      .toArray();
    expect(tenantASales).toHaveLength(2);
    expect(tenantASales[0].id).toBe('s-2');
    expect(tenantASales[1].id).toBe('s-1');

    const customer1Utang = await db.utangLedger
      .where('[tenantId+customerId]')
      .equals(['tenant-a', 'cust-1'])
      .toArray();
    expect(customer1Utang).toHaveLength(1);
    expect(customer1Utang[0].id).toBe('u-1');
  });
});
