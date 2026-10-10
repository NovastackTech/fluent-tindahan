import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  useSyncStore,
  enqueueSync,
  updateQueueCounts,
  processSyncQueue,
  retryDeadLetterItem,
  clearDeadLetterQueue,
  pullCatalogFromServer,
  initSyncEngine
} from './syncEngine';
import { db } from '../db/db';
import { apiClient } from '../services/apiClient';

vi.mock('../services/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn()
  }
}));

describe('syncEngine', () => {
  beforeEach(async () => {
    await db.syncQueue.clear();
    await db.deadLetterQueue.clear();
    await db.products.clear();
    useSyncStore.setState({
      isOnline: true,
      isSyncing: false,
      lastSyncedAt: null,
      pendingCount: 0,
      deadLetterCount: 0,
      lastErrorMessage: null
    });
    vi.resetAllMocks();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  });

  it('useSyncStore updates store state correctly', () => {
    const store = useSyncStore.getState();
    store.setOnline(false);
    expect(useSyncStore.getState().isOnline).toBe(false);

    store.setSyncing(true);
    expect(useSyncStore.getState().isSyncing).toBe(true);

    store.setCounts(5, 2);
    expect(useSyncStore.getState().pendingCount).toBe(5);
    expect(useSyncStore.getState().deadLetterCount).toBe(2);

    const date = new Date('2026-10-09T10:00:00Z');
    store.setLastSyncedAt(date);
    expect(useSyncStore.getState().lastSyncedAt).toEqual(date);

    store.setLastErrorMessage('Connection error');
    expect(useSyncStore.getState().lastErrorMessage).toBe('Connection error');
  });

  it('enqueueSync adds an operation to Dexie syncQueue and updates pending count', async () => {
    const syncId = await enqueueSync('Product', 'Insert', { id: 'p-1', name: 'Sabon' });

    expect(syncId).toBeDefined();

    const queued = await db.syncQueue.get(syncId);
    expect(queued).toBeDefined();
    expect(queued?.entity).toBe('Product');
    expect(queued?.action).toBe('Insert');
    expect(queued?.status).toBe('Pending');
    expect(queued?.retryCount).toBe(0);

    const state = useSyncStore.getState();
    expect(state.pendingCount).toBe(1);
  });

  it('processSyncQueue successfully pushes operations and removes them from syncQueue', async () => {
    const syncId = await enqueueSync('Customer', 'Insert', { id: 'c-1', name: 'Aling Maria' });

    (apiClient.post as any).mockResolvedValueOnce({
      data: {
        results: [
          { syncId, status: 'Success' }
        ]
      }
    });

    const result = await processSyncQueue();

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(0);

    const remaining = await db.syncQueue.toArray();
    expect(remaining).toHaveLength(0);
    expect(useSyncStore.getState().lastSyncedAt).not.toBeNull();
  });

  it('processSyncQueue treats ConflictIgnored as resolved success', async () => {
    const syncId = await enqueueSync('Product', 'Update', { id: 'p-1', name: 'Old name' });

    (apiClient.post as any).mockResolvedValueOnce({
      data: {
        results: [
          { syncId, status: 'ConflictIgnored' }
        ]
      }
    });

    const result = await processSyncQueue();

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(0);

    const remaining = await db.syncQueue.toArray();
    expect(remaining).toHaveLength(0);
  });

  it('processSyncQueue moves item to DeadLetterQueue when retry count reaches 3', async () => {
    const syncId = await enqueueSync('Sale', 'Insert', { id: 's-1', totalAmount: 100 });

    // 1st failure
    (apiClient.post as any).mockResolvedValueOnce({
      data: { results: [{ syncId, status: 'Failed', error: 'Database constraint' }] }
    });
    await processSyncQueue();

    let item = await db.syncQueue.get(syncId);
    expect(item?.retryCount).toBe(1);
    expect(item?.status).toBe('Failed');

    // 2nd failure
    (apiClient.post as any).mockResolvedValueOnce({
      data: { results: [{ syncId, status: 'Failed', error: 'Database constraint' }] }
    });
    await processSyncQueue();

    item = await db.syncQueue.get(syncId);
    expect(item?.retryCount).toBe(2);

    // 3rd failure -> moved to dead letter queue
    (apiClient.post as any).mockResolvedValueOnce({
      data: { results: [{ syncId, status: 'Failed', error: 'Database constraint' }] }
    });
    await processSyncQueue();

    const queueItems = await db.syncQueue.toArray();
    expect(queueItems).toHaveLength(0);

    const dlqItems = await db.deadLetterQueue.toArray();
    expect(dlqItems).toHaveLength(1);
    expect(dlqItems[0].id).toBe(syncId);
    expect(dlqItems[0].errorMessage).toBe('Database constraint');
    expect(useSyncStore.getState().deadLetterCount).toBe(1);
  });

  it('retryDeadLetterItem moves item from DeadLetterQueue back to syncQueue', async () => {
    await db.deadLetterQueue.add({
      id: 'dlq-1',
      entity: 'GCashTxn',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: { id: 'g-1', amount: 500 },
      retryCount: 3,
      errorMessage: 'Service timeout',
      failedAt: new Date().toISOString()
    });
    await updateQueueCounts();
    expect(useSyncStore.getState().deadLetterCount).toBe(1);

    await retryDeadLetterItem('dlq-1');

    const dlqItems = await db.deadLetterQueue.toArray();
    expect(dlqItems).toHaveLength(0);
  });

  it('clearDeadLetterQueue purges all dead letter entries', async () => {
    await db.deadLetterQueue.add({
      id: 'dlq-1',
      entity: 'Product',
      action: 'Delete',
      timestamp: new Date().toISOString(),
      payload: {},
      retryCount: 3,
      failedAt: new Date().toISOString()
    });

    await clearDeadLetterQueue();

    const dlqItems = await db.deadLetterQueue.toArray();
    expect(dlqItems).toHaveLength(0);
    expect(useSyncStore.getState().deadLetterCount).toBe(0);
  });

  it('pullCatalogFromServer fetches products and writes to Dexie', async () => {
    (apiClient.get as any).mockResolvedValueOnce({
      data: [
        {
          id: 'server-p1',
          tenantId: 't-1',
          name: 'Nescafe Classic 2g',
          price: 5,
          cost: 4,
          barcode: '112233',
          category: 'Coffee',
          stockQty: 50,
          updatedAt: '2026-10-09T00:00:00Z'
        }
      ]
    });

    const pulled = await pullCatalogFromServer();

    expect(pulled).toBe(1);
    const prod = await db.products.get('server-p1');
    expect(prod).toBeDefined();
    expect(prod?.name).toBe('Nescafe Classic 2g');
  });

  it('handles server network failure during processSyncQueue gracefully', async () => {
    await enqueueSync('Customer', 'Insert', { id: 'c-99' });

    (apiClient.post as any).mockRejectedValueOnce(new Error('Network error 500'));

    const result = await processSyncQueue();

    expect(result.processed).toBe(0);
    expect(result.errors).toBe(1);
    expect(useSyncStore.getState().lastErrorMessage).toContain('Network error 500');
  });

  it('orders outbox operations so Customer and Product precede UtangLedger and Sale', async () => {
    // Enqueue out of order: UtangLedger first, Sale second, Product third, Customer fourth
    await enqueueSync('UtangLedger', 'Insert', { id: 'u-1', customerId: 'c-1', amount: 50 });
    await enqueueSync('Sale', 'Insert', { id: 's-1', totalAmount: 50 });
    await enqueueSync('Product', 'Insert', { id: 'p-1', name: 'Kape' });
    await enqueueSync('Customer', 'Insert', { id: 'c-1', name: 'Nena' });

    let sentOperations: any[] = [];
    (apiClient.post as any).mockImplementationOnce(async (_url: string, payload: any) => {
      sentOperations = payload.operations;
      return {
        data: {
          results: sentOperations.map((op: any) => ({ syncId: op.syncId, status: 'Success' }))
        }
      };
    });

    const result = await processSyncQueue();
    expect(result.processed).toBe(4);

    // Verify ordering: Customer (1), Product (2), Sale (3), UtangLedger (4)
    expect(sentOperations.map((op: any) => op.entity)).toEqual([
      'Customer',
      'Product',
      'Sale',
      'UtangLedger'
    ]);
  });

  it('initSyncEngine attaches online and offline event handlers', () => {
    expect(() => initSyncEngine()).not.toThrow();

    window.dispatchEvent(new Event('offline'));
    expect(useSyncStore.getState().isOnline).toBe(false);

    window.dispatchEvent(new Event('online'));
    expect(useSyncStore.getState().isOnline).toBe(true);
  });
});
