import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  useSyncStore,
  enqueueSync,
  updateQueueCounts,
  processSyncQueue,
  retryDeadLetterItem,
  clearDeadLetterQueue,
  pullCatalogFromServer,
  initSyncEngine,
  STORAGE_KEY_LAST_SYNCED,
  getSavedLastSyncedAt
} from './syncEngine';
import { db } from '../db/db';
import {
  apiClient,
  ensureTenantProvisioned,
  TenantAccountMismatchError,
  TenantProvisioningError
} from '../services/apiClient';
import { useAuthStore } from '../state/authStore';

vi.mock('../services/apiClient', () => ({
  TenantAccountMismatchError: class TenantAccountMismatchError extends Error {},
  TenantProvisioningError: class TenantProvisioningError extends Error {
    status: number;
    constructor(status: number) {
      super('Provisioning blocked');
      this.status = status;
    }
  },
  apiClient: {
    post: vi.fn(),
    put: vi.fn(),
    get: vi.fn()
  },
  ensureTenantProvisioned: vi.fn()
}));

describe('syncEngine', () => {
  beforeEach(async () => {
    await db.syncQueue.clear();
    await db.deadLetterQueue.clear();
    await db.products.clear();
    await db.gcashTxns.clear();
    useSyncStore.setState({
      isOnline: true,
      isSyncing: false,
      lastSyncedAt: null,
      pendingCount: 0,
      deadLetterCount: 0,
      lastErrorMessage: null,
      authBlockedSessionKey: null,
      batchFailureCount: 0,
      nextRetryAt: null
    });
    (apiClient.put as any).mockResolvedValue({ data: {} });
    (ensureTenantProvisioned as any).mockResolvedValue(undefined);
    useAuthStore.setState({
      firebaseToken: null,
      isOnboarded: true,
      isOnboardingStatusReady: true
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
    expect(localStorage.getItem(STORAGE_KEY_LAST_SYNCED)).toBe(date.toISOString());

    store.setLastErrorMessage('Connection error');
    expect(useSyncStore.getState().lastErrorMessage).toBe('Connection error');
  });

  it('persists lastSyncedAt to localStorage and restores it across reloads', () => {
    const testDate = new Date('2026-10-14T07:39:00.000Z');
    useSyncStore.getState().setLastSyncedAt(testDate);

    expect(localStorage.getItem(STORAGE_KEY_LAST_SYNCED)).toBe(testDate.toISOString());
    expect(getSavedLastSyncedAt()).toEqual(testDate);

    // Setting to null removes from localStorage
    useSyncStore.getState().setLastSyncedAt(null);
    expect(localStorage.getItem(STORAGE_KEY_LAST_SYNCED)).toBeNull();
    expect(getSavedLastSyncedAt()).toBeNull();
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

  it('does not sync queued operations before onboarding is resolved', async () => {
    await enqueueSync('Customer', 'Insert', { id: 'c-pending', name: 'Pending Customer' });
    useAuthStore.setState({
      isOnboarded: false,
      isOnboardingStatusReady: false
    });

    const result = await processSyncQueue();

    expect(result).toEqual({ processed: 0, conflicts: 0, errors: 0 });
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(await db.syncQueue.count()).toBe(1);
  });

  it('provisions tenant identity before uploading queued operations', async () => {
    const syncId = await enqueueSync('Product', 'Insert', { id: 'p-provisioned', name: 'Sabon' });
    useAuthStore.setState({
      tenantId: '33333333-3333-4333-8333-333333333333',
      userId: '44444444-4444-4444-8444-444444444444',
      businessName: 'My Store',
      userPhone: '09171234567'
    });
    (apiClient.post as any).mockResolvedValueOnce({
      data: { results: [{ syncId, status: 'Success' }] }
    });

    const result = await processSyncQueue();

    expect(result.processed).toBe(1);
    expect(ensureTenantProvisioned).toHaveBeenCalledOnce();
    expect((ensureTenantProvisioned as any).mock.invocationCallOrder[0])
      .toBeLessThan((apiClient.post as any).mock.invocationCallOrder[0]);
    expect(await db.syncQueue.get(syncId)).toBeUndefined();
  });

  it('blocks pending sync with the account-mismatch message without retrying or removing data', async () => {
    const syncId = await enqueueSync('Customer', 'Insert', { id: 'c-account-mismatch' });
    const mismatch = new TenantAccountMismatchError();
    (ensureTenantProvisioned as any).mockRejectedValueOnce(mismatch);

    const result = await processSyncQueue();

    expect(result).toEqual({ processed: 0, conflicts: 0, errors: 1 });
    expect(useSyncStore.getState().lastErrorMessage).toBe(mismatch.message);
    expect(useSyncStore.getState().authBlockedSessionKey).not.toBeNull();
    expect(useSyncStore.getState().batchFailureCount).toBe(0);
    expect(useSyncStore.getState().nextRetryAt).toBeNull();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(await db.syncQueue.get(syncId)).toMatchObject({ status: 'Pending', retryCount: 0 });
  });

  it('auth-blocks pending sync on a tenant provisioning conflict without retrying', async () => {
    const syncId = await enqueueSync('Customer', 'Insert', { id: 'c-provision-conflict' });
    const error = new TenantProvisioningError(409);
    (ensureTenantProvisioned as any).mockRejectedValueOnce(error);

    const result = await processSyncQueue();

    expect(result).toEqual({ processed: 0, conflicts: 0, errors: 1 });
    expect(useSyncStore.getState().lastErrorMessage).toBe(error.message);
    expect(useSyncStore.getState().authBlockedSessionKey).not.toBeNull();
    expect(useSyncStore.getState().batchFailureCount).toBe(0);
    expect(useSyncStore.getState().nextRetryAt).toBeNull();
    expect(await db.syncQueue.get(syncId)).toMatchObject({ status: 'Pending', retryCount: 0 });
  });

  it.each([
    ['Customer', 'Conflict'],
    ['Customer', 'DuplicateRef']
  ])('processSyncQueue retries %s %s responses', async (entity, status) => {
    const syncId = await enqueueSync(entity as 'Customer' | 'GCashTxn', 'Delete', { id: 'entity-conflict-1' });

    (apiClient.post as any).mockResolvedValueOnce({
      data: {
        results: [{ syncId, status, error: 'Operation conflict' }]
      }
    });

    const result = await processSyncQueue();

    expect(result.processed).toBe(0);
    expect(result.errors).toBe(1);

    const queued = await db.syncQueue.get(syncId);
    expect(queued?.status).toBe('Failed');
    expect(queued?.retryCount).toBe(1);
    expect(queued?.errorMessage).toBe('Operation conflict');
    expect(await db.deadLetterQueue.get(syncId)).toBeUndefined();
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

  it('backs off after server failures without dead-lettering pending operations', async () => {
    const syncId = await enqueueSync('Customer', 'Insert', { id: 'c-99' });

    (apiClient.post as any).mockRejectedValueOnce({
      message: 'Request failed with status code 500',
      response: { status: 500, data: { message: 'Database temporarily unavailable' } }
    });

    const result = await processSyncQueue();

    expect(result.processed).toBe(0);
    expect(result.errors).toBe(1);
    expect(useSyncStore.getState().lastErrorMessage).toContain('Database temporarily unavailable');
    expect(useSyncStore.getState().lastErrorMessage).toContain('backoff');
    expect(useSyncStore.getState().batchFailureCount).toBe(1);
    expect(useSyncStore.getState().nextRetryAt).toBeGreaterThan(Date.now());
    expect(await db.syncQueue.get(syncId)).toMatchObject({ status: 'Pending', retryCount: 0 });
    expect(await db.deadLetterQueue.get(syncId)).toBeUndefined();

    await processSyncQueue();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it('pauses sync after 403 until the tenant session changes', async () => {
    const syncId = await enqueueSync('Customer', 'Insert', { id: 'c-403' });
    (apiClient.post as any).mockRejectedValueOnce({
      message: 'Request failed with status code 403',
      response: { status: 403, data: {} }
    });

    await processSyncQueue();

    expect(useSyncStore.getState().lastErrorMessage).toContain('Re-authenticate');
    expect(useSyncStore.getState().authBlockedSessionKey).not.toBeNull();
    expect(await db.syncQueue.get(syncId)).toMatchObject({ status: 'Pending', retryCount: 0 });
    expect(await db.deadLetterQueue.get(syncId)).toBeUndefined();

    await processSyncQueue();
    expect(apiClient.post).toHaveBeenCalledTimes(1);

    useAuthStore.getState().setFirebaseToken('refreshed-tenant-session');
    (apiClient.post as any).mockResolvedValueOnce({
      data: { results: [{ syncId, status: 'Success' }] }
    });
    await processSyncQueue();

    expect(apiClient.post).toHaveBeenCalledTimes(2);
    expect(await db.syncQueue.get(syncId)).toBeUndefined();
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

  it('preserves delete-then-reinsert order for the same entity id and does not move reinserted delete to end', async () => {
    // Op 1: Delete Product p-1
    await enqueueSync('Product', 'Delete', { id: 'p-1' });
    // Op 2: Insert Product p-1 (undo/re-add)
    await enqueueSync('Product', 'Insert', { id: 'p-1', name: 'Kape Recreated' });
    // Op 3: Delete Product p-2 (terminal delete)
    await enqueueSync('Product', 'Delete', { id: 'p-2' });

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
    expect(result.processed).toBe(3);

    // Reinserted Delete for p-1 must be before Insert for p-1!
    // Terminal delete for p-2 is pushed to the end.
    expect(sentOperations.map((op: any) => `${op.action}:${op.payload.id}`)).toEqual([
      'Delete:p-1',
      'Insert:p-1',
      'Delete:p-2'
    ]);
  });

  it('uses queue order as tie-break when operations have identical timestamps', async () => {
    const fixedIso = '2026-10-10T12:00:00.000Z';
    // Add two items with the exact same timestamp
    await db.syncQueue.add({
      id: 'sync-1',
      entity: 'Product',
      action: 'Insert',
      timestamp: fixedIso,
      payload: { id: 'p-10' },
      status: 'Pending',
      retryCount: 0,
      queueOrder: 1
    });
    await db.syncQueue.add({
      id: 'sync-2',
      entity: 'Product',
      action: 'Insert',
      timestamp: fixedIso,
      payload: { id: 'p-20' },
      status: 'Pending',
      retryCount: 0,
      queueOrder: 2
    });

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
    expect(result.processed).toBe(2);
    expect(sentOperations.map((op: any) => op.payload.id)).toEqual(['p-10', 'p-20']);
  });

  it('processSyncQueue handles DuplicateRef status by clearing queue and flagging local GCashTxn row with needsAttention', async () => {
    const txnId = 'gcash-dup-test-1';
    const secondTxnId = 'gcash-dup-test-2';
    await db.gcashTxns.bulkAdd([
      {
        id: txnId,
        tenantId: 't-1',
        type: 'CashIn',
        amount: 1000,
        fee: 15,
        refNo: 'REF-DUP-999',
        refNoNorm: 'ref-dup-999',
        date: new Date().toISOString()
      },
      {
        id: secondTxnId,
        tenantId: 't-1',
        type: 'CashOut',
        amount: 500,
        fee: 10,
        refNo: 'REF-DUP-1000',
        refNoNorm: 'ref-dup-1000',
        date: new Date().toISOString()
      }
    ]);

    const syncId = await enqueueSync('GCashTxn', 'Insert', {
      id: txnId,
      tenantId: 't-1',
      type: 'CashIn',
      amount: 1000,
      fee: 15,
      refNo: 'REF-DUP-999',
      date: new Date().toISOString()
    });
    const secondSyncId = await enqueueSync('GCashTxn', 'Insert', {
      id: secondTxnId,
      tenantId: 't-1',
      type: 'CashOut',
      amount: 500,
      fee: 10,
      refNo: 'REF-DUP-1000',
      date: new Date().toISOString()
    });

    (apiClient.post as any).mockResolvedValueOnce({
      data: {
        processedCount: 2,
        results: [
          {
            syncId,
            status: 'DuplicateRef',
            error: "Duplicate GCash reference number 'REF-DUP-999' for this tenant."
          },
          {
            syncId: secondSyncId,
            status: 'DuplicateRef',
            error: "Duplicate GCash reference number 'REF-DUP-1000' for this tenant."
          }
        ]
      }
    });

    const result = await processSyncQueue();

    expect(result.processed).toBe(0);
    expect(result.conflicts).toBe(2);
    expect(result.errors).toBe(0);

    // Queue is cleared (not kept or retried until dead letter)
    const remaining = await db.syncQueue.toArray();
    expect(remaining).toHaveLength(0);

    // Local row is flagged with needsAttention and conflict reason
    const updatedTxn = await db.gcashTxns.get(txnId);
    expect(updatedTxn?.needsAttention).toBe(true);
    expect(updatedTxn?.syncStatus).toBe('DuplicateRef');
    expect(updatedTxn?.conflictReason).toContain('Duplicate GCash reference number');
    const secondUpdatedTxn = await db.gcashTxns.get(secondTxnId);
    expect(secondUpdatedTxn?.needsAttention).toBe(true);
    expect(secondUpdatedTxn?.syncStatus).toBe('DuplicateRef');

    expect(useSyncStore.getState().lastErrorMessage).toBe('2 duplicate GCash references detected.');
  });

  it('processSyncQueue handles GCash Conflict as a terminal attention result', async () => {
    const txnId = 'gcash-conflict-test-1';
    await db.gcashTxns.add({
      id: txnId,
      tenantId: 't-1',
      type: 'CashIn',
      amount: 650,
      fee: 10,
      refNo: 'REF-CONFLICT-1',
      refNoNorm: 'ref-conflict-1',
      date: new Date().toISOString()
    });

    const syncId = await enqueueSync('GCashTxn', 'Insert', {
      id: txnId,
      tenantId: 't-1',
      type: 'CashIn',
      amount: 650,
      fee: 10,
      refNo: 'REF-CONFLICT-1',
      date: new Date().toISOString()
    });

    (apiClient.post as any).mockResolvedValueOnce({
      data: {
        results: [{ syncId, status: 'Conflict', error: 'GCash operation conflicted on server' }]
      }
    });

    const result = await processSyncQueue();

    expect(result).toEqual({ processed: 0, conflicts: 1, errors: 0 });
    expect(await db.syncQueue.get(syncId)).toBeUndefined();
    expect(await db.deadLetterQueue.get(syncId)).toBeUndefined();
    expect(await db.gcashTxns.get(txnId)).toMatchObject({
      needsAttention: true,
      syncStatus: 'Conflict',
      conflictReason: 'GCash operation conflicted on server'
    });
    expect(useSyncStore.getState().lastErrorMessage).toBe('1 GCash transaction conflict detected.');
  });

  it('initSyncEngine attaches online and offline event handlers', () => {
    expect(() => initSyncEngine()).not.toThrow();

    window.dispatchEvent(new Event('offline'));
    expect(useSyncStore.getState().isOnline).toBe(false);

    window.dispatchEvent(new Event('online'));
    expect(useSyncStore.getState().isOnline).toBe(true);
  });
});
