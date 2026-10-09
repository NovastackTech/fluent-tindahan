import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';

describe('FluentTindahanDatabase', () => {
  beforeEach(async () => {
    await db.products.clear();
    await db.customers.clear();
    await db.sales.clear();
    await db.saleItems.clear();
    await db.utangLedger.clear();
    await db.gcashTxns.clear();
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
    expect(db.syncQueue).toBeDefined();
    expect(db.deadLetterQueue).toBeDefined();
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
});
