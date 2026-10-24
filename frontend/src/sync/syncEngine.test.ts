import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  useSyncStore,
  enqueueSync,
  updateQueueCounts,
  processSyncQueue,
  retryDeadLetterItem,
  deleteDeadLetterItem,
  clearDeadLetterQueue,
  getArchivedDeadLetterItems,
  clearDeadLetterArchive,
  pullCatalogFromServer,
  pullCustomersFromServer,
  pullUtangFromServer,
  pullGCashFromServer,
  pullSalesFromServer,
  restoreTenantDataFromServer,
  initSyncEngine,
  STORAGE_KEY_LAST_SYNCED,
  getSyncStorageKey,
  getSavedLastSyncedAt
} from './syncEngine';
import { db } from '../db/db';
import {
  apiClient,
  ensureTenantProvisioned,
  SessionReauthRequiredError,
  TenantAccountMismatchError,
  TenantProvisioningError
} from '../services/apiClient';
import { useAuthStore } from '../state/authStore';
import { DEFAULT_TENANT_ID } from '../db/seedData';

vi.mock('../services/apiClient', () => ({
  TenantAccountMismatchError: class TenantAccountMismatchError extends Error { },
  TenantProvisioningError: class TenantProvisioningError extends Error {
    status: number;
    constructor(status: number) {
      super('Provisioning blocked');
      this.status = status;
    }
  },
  SessionReauthRequiredError: class SessionReauthRequiredError extends Error {
    constructor() {
      super('Sign in again to sync. Pending changes stay on this device.');
      this.name = 'SessionReauthRequiredError';
    }
  },
  isAccessTokenUsable: (token: string | null) => Boolean(token),
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
    clearDeadLetterArchive();
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
    localStorage.removeItem('fluent_tindahan_tenant_id_v1');
    useAuthStore.setState({
      tenantId: DEFAULT_TENANT_ID,
      firebaseToken: null,
      refreshToken: null,
      reauthRequired: false,
      reauthRequested: false,
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

    const currentTenant = useAuthStore.getState().tenantId;
    const date = new Date('2026-10-09T10:00:00Z');
    store.setLastSyncedAt(date);
    expect(useSyncStore.getState().lastSyncedAt).toEqual(date);
    expect(localStorage.getItem(getSyncStorageKey(currentTenant))).toBe(date.toISOString());

    store.setLastErrorMessage('Connection error');
    expect(useSyncStore.getState().lastErrorMessage).toBe('Connection error');
  });

  it('persists lastSyncedAt to localStorage per tenant and restores it across reloads', async () => {
    expect(STORAGE_KEY_LAST_SYNCED).toBe('fluent_tindahan_last_synced_at');
    const currentTenant = useAuthStore.getState().tenantId;
    const testDate = new Date('2026-10-14T07:39:00.000Z');
    useSyncStore.getState().setLastSyncedAt(testDate);

    expect(localStorage.getItem(getSyncStorageKey(currentTenant))).toBe(testDate.toISOString());
    expect(getSavedLastSyncedAt(currentTenant)).toEqual(testDate);

    // Ensure tenantId persists in localStorage for module re-import
    localStorage.setItem('fluent_tindahan_tenant_id_v1', currentTenant);

    // Simulate page reload: reset modules, re-import, and verify store hydrates from localStorage on init
    vi.resetModules();
    const { useSyncStore: reloadedSyncStore, getSavedLastSyncedAt: reloadedGetSavedLastSyncedAt } = await import('./syncEngine');
    expect(reloadedSyncStore.getState().lastSyncedAt).toEqual(testDate);

    // Setting to null removes from localStorage
    reloadedSyncStore.getState().setLastSyncedAt(null);
    expect(localStorage.getItem(getSyncStorageKey(currentTenant))).toBeNull();
    expect(reloadedGetSavedLastSyncedAt(currentTenant)).toBeNull();
    localStorage.removeItem('fluent_tindahan_tenant_id_v1');
  });

  it('resets in-memory lastSyncedAt when tenantId changes in useAuthStore', () => {
    const tenantA = 'tenant-a-uuid';
    const tenantB = 'tenant-b-uuid';

    useAuthStore.setState({ tenantId: tenantA });
    const syncTimeA = new Date('2026-10-14T07:39:00.000Z');
    useSyncStore.getState().setLastSyncedAt(syncTimeA);

    expect(useSyncStore.getState().lastSyncedAt).toEqual(syncTimeA);
    expect(localStorage.getItem(getSyncStorageKey(tenantA))).toBe(syncTimeA.toISOString());

    // Switch to new tenant B that has never synced
    useAuthStore.setState({ tenantId: tenantB });
    expect(useSyncStore.getState().lastSyncedAt).toBeNull();
    expect(localStorage.getItem(getSyncStorageKey(tenantB))).toBeNull();

    // Switch back to tenant A
    useAuthStore.setState({ tenantId: tenantA });
    expect(useSyncStore.getState().lastSyncedAt).toEqual(syncTimeA);
  });

  it('does not fall back to or inherit unscoped legacy last_synced key', () => {
    const tenant = 'test-isolated-tenant';
    localStorage.setItem(STORAGE_KEY_LAST_SYNCED, new Date('2026-10-10T00:00:00.000Z').toISOString());
    localStorage.removeItem(getSyncStorageKey(tenant));

    expect(getSavedLastSyncedAt(tenant)).toBeNull();
    expect(localStorage.getItem(getSyncStorageKey(tenant))).toBeNull();
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

  it('processSyncQueue without force returns immediately without calling server when queue is empty', async () => {
    expect(useSyncStore.getState().lastSyncedAt).toBeNull();

    const result = await processSyncQueue();

    expect(result).toEqual({ processed: 0, conflicts: 0, errors: 0 });
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(useSyncStore.getState().lastSyncedAt).toBeNull();
  });

  it('processSyncQueue with force: true pings server and updates lastSyncedAt even when queue is empty', async () => {
    expect(useSyncStore.getState().lastSyncedAt).toBeNull();

    (apiClient.post as any).mockResolvedValueOnce({
      data: { results: [] }
    });

    const result = await processSyncQueue({ force: true });

    expect(result).toEqual({ processed: 0, conflicts: 0, errors: 0 });
    expect(apiClient.post).toHaveBeenCalledWith('/sync/batch', expect.objectContaining({
      operations: []
    }));
    expect(useSyncStore.getState().lastSyncedAt).not.toBeNull();
  });

  it('processSyncQueue with force: true clears backoff and blocked session states before syncing', async () => {
    useSyncStore.setState({
      batchFailureCount: 3,
      nextRetryAt: Date.now() + 60000,
      authBlockedSessionKey: 'some-blocked-key',
      lastErrorMessage: 'Some previous error'
    });

    (apiClient.post as any).mockResolvedValueOnce({
      data: { results: [] }
    });

    await processSyncQueue({ force: true });

    expect(useSyncStore.getState().batchFailureCount).toBe(0);
    expect(useSyncStore.getState().nextRetryAt).toBeNull();
    expect(useSyncStore.getState().authBlockedSessionKey).toBeNull();
    expect(useSyncStore.getState().lastErrorMessage).toBeNull();
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

  it('keeps the queue when the session must be signed in again and does not retry', async () => {
    const syncId = await enqueueSync('Sale', 'Insert', { id: 'sale-reauth', total: 25 });
    const error = new SessionReauthRequiredError();
    (ensureTenantProvisioned as any).mockRejectedValueOnce(error);

    const result = await processSyncQueue();

    expect(result).toEqual({ processed: 0, conflicts: 0, errors: 1 });
    expect(useSyncStore.getState().lastErrorMessage).toBe(error.message);
    expect(useSyncStore.getState().authBlockedSessionKey).not.toBeNull();
    expect(await db.syncQueue.get(syncId)).toMatchObject({ status: 'Pending', retryCount: 0 });

    useAuthStore.setState({ reauthRequired: true, firebaseToken: null });
    (ensureTenantProvisioned as any).mockClear();
    (apiClient.post as any).mockClear();

    const forced = await processSyncQueue({ force: true });

    expect(forced).toEqual({ processed: 0, conflicts: 0, errors: 0 });
    expect(ensureTenantProvisioned).not.toHaveBeenCalled();
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

  it('retryDeadLetterItem does NOT auto-clamp out-of-range product price or cost silently, returning requiresEdit: true', async () => {
    await db.products.put({
      id: 'prod-out-of-bounds',
      tenantId: 'tenant-1',
      name: 'Unclamped High Price Item',
      price: 99999999999,
      cost: 50,
      stockQty: 10,
      updatedAt: new Date().toISOString()
    });

    await db.deadLetterQueue.add({
      id: 'dlq-prod-1',
      entity: 'Product',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: {
        id: 'prod-out-of-bounds',
        name: 'Unclamped High Price Item',
        price: 99999999999,
        cost: 50,
        stockQty: 10
      },
      retryCount: 3,
      errorMessage: 'Price exceeds maximum allowed bounds',
      failedAt: new Date().toISOString()
    });

    const result = await retryDeadLetterItem('dlq-prod-1');

    expect(result.success).toBe(false);
    expect(result.requiresEdit).toBe(true);
    expect(result.error).toMatch(/Hindi wastong presyo/i);

    // Verify local record was NOT silently rewritten or clamped!
    const localProd = await db.products.get('prod-out-of-bounds');
    expect(localProd?.price).toBe(99999999999);

    // Verify item remains in DLQ and was NOT added to syncQueue
    const dlqItems = await db.deadLetterQueue.toArray();
    expect(dlqItems).toHaveLength(1);
    expect(dlqItems[0].id).toBe('dlq-prod-1');

    const syncQueueItems = await db.syncQueue.toArray();
    expect(syncQueueItems.find(q => q.id === 'dlq-prod-1')).toBeUndefined();
  });

  it('retryDeadLetterItem updates local record and requeues when user confirms corrected values', async () => {
    await db.products.put({
      id: 'prod-to-correct',
      tenantId: 'tenant-1',
      name: 'Need Correction Item',
      price: 0,
      cost: -10,
      stockQty: 5,
      updatedAt: new Date().toISOString()
    });

    await db.deadLetterQueue.add({
      id: 'dlq-prod-2',
      entity: 'Product',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: {
        id: 'prod-to-correct',
        name: 'Need Correction Item',
        price: 0,
        cost: -10,
        stockQty: 5
      },
      retryCount: 3,
      errorMessage: 'Price must be positive',
      failedAt: new Date().toISOString()
    });

    // User explicitly saves corrected values via edit form
    const result = await retryDeadLetterItem('dlq-prod-2', {
      name: 'Corrected Item Name',
      price: 85.50,
      cost: 50.00,
      stockQty: 15
    });

    expect(result.success).toBe(true);

    // Local product now has the user-confirmed values
    const localProd = await db.products.get('prod-to-correct');
    expect(localProd?.price).toBe(85.50);
    expect(localProd?.cost).toBe(50.00);
    expect(localProd?.stockQty).toBe(15);
    expect(localProd?.name).toBe('Corrected Item Name');

    // Item removed from DLQ and enqueued to syncQueue
    const dlqItems = await db.deadLetterQueue.toArray();
    expect(dlqItems).toHaveLength(0);

    const syncQueueItems = await db.syncQueue.toArray();
    const queued = syncQueueItems.find(q => q.id === 'dlq-prod-2');
    expect(queued).toBeDefined();
    expect(queued?.payload.price).toBe(85.50);
    expect(queued?.payload.cost).toBe(50.00);
  });

  it('clearDeadLetterQueue purges all dead letter entries and resets lastErrorMessage', async () => {
    useSyncStore.setState({ lastErrorMessage: 'Nalipat sa Dead Letter Queue ang 1 transaksyon: Failed' });
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
    expect(useSyncStore.getState().lastErrorMessage).toBeNull();
  });

  it('deleteDeadLetterItem deletes an individual entry and updates counts', async () => {
    await db.deadLetterQueue.bulkAdd([
      {
        id: 'dlq-item-1',
        entity: 'Product',
        action: 'Insert',
        timestamp: new Date().toISOString(),
        payload: { id: 'p-1' },
        retryCount: 3,
        failedAt: new Date().toISOString()
      },
      {
        id: 'dlq-item-2',
        entity: 'Product',
        action: 'Insert',
        timestamp: new Date().toISOString(),
        payload: { id: 'p-2' },
        retryCount: 3,
        failedAt: new Date().toISOString()
      }
    ]);
    await updateQueueCounts();
    expect(useSyncStore.getState().deadLetterCount).toBe(2);

    await deleteDeadLetterItem('dlq-item-1');

    const remaining = await db.deadLetterQueue.toArray();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('dlq-item-2');
    expect(useSyncStore.getState().deadLetterCount).toBe(1);

    const archived = getArchivedDeadLetterItems();
    expect(archived).toHaveLength(1);
    expect(archived[0].id).toBe('dlq-item-1');
    expect(archived[0].archivedAt).toBeDefined();
  });

  it('clearDeadLetterQueue archives all entries before clearing table', async () => {
    await db.deadLetterQueue.bulkAdd([
      {
        id: 'dlq-item-1',
        entity: 'Sale',
        action: 'Insert',
        timestamp: new Date().toISOString(),
        payload: { id: 's-1', totalAmount: 120 },
        retryCount: 3,
        failedAt: new Date().toISOString()
      },
      {
        id: 'dlq-item-2',
        entity: 'GCashTxn',
        action: 'Insert',
        timestamp: new Date().toISOString(),
        payload: { id: 'g-1', amount: 500, fee: 10 },
        retryCount: 3,
        failedAt: new Date().toISOString()
      }
    ]);

    await clearDeadLetterQueue();

    const remaining = await db.deadLetterQueue.toArray();
    expect(remaining).toHaveLength(0);
    expect(useSyncStore.getState().deadLetterCount).toBe(0);

    const archived = getArchivedDeadLetterItems();
    expect(archived).toHaveLength(2);
    expect(archived.map((x) => x.id)).toEqual(expect.arrayContaining(['dlq-item-1', 'dlq-item-2']));
  });

  it('pullCatalogFromServer fetches products and writes to Dexie without clearing errors or setting lastSyncedAt', async () => {
    useSyncStore.setState({
      lastErrorMessage: 'Retrying with backoff; pending changes remain on this device',
      lastSyncedAt: null
    });

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

    expect(useSyncStore.getState().lastSyncedAt).toBeNull();
    expect(useSyncStore.getState().lastErrorMessage).toBe('Retrying with backoff; pending changes remain on this device');
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

  it('pullCustomersFromServer populates customers into Dexie', async () => {
    (apiClient.get as any).mockResolvedValueOnce({
      data: [
        {
          id: 'cust-1',
          tenantId: DEFAULT_TENANT_ID,
          name: 'Maria Santos',
          phone: '09171234567',
          totalUtangBalance: 150,
          updatedAt: '2026-10-18T00:00:00.000Z'
        }
      ]
    });

    const count = await pullCustomersFromServer();
    expect(count).toBe(1);
    const saved = await db.customers.get('cust-1');
    expect(saved?.name).toBe('Maria Santos');
    expect(saved?.totalUtangBalance).toBe(150);
  });

  it('pullUtangFromServer populates utang ledger into Dexie', async () => {
    (apiClient.get as any).mockResolvedValueOnce({
      data: [
        {
          id: 'utang-1',
          tenantId: DEFAULT_TENANT_ID,
          customerId: 'cust-1',
          amount: 150,
          type: 'Credit',
          date: '2026-10-18T00:00:00.000Z',
          notes: 'Initial utang'
        }
      ]
    });

    const count = await pullUtangFromServer();
    expect(count).toBe(1);
    const saved = await db.utangLedger.get('utang-1');
    expect(saved?.amount).toBe(150);
    expect(saved?.customerId).toBe('cust-1');
  });

  it('pullGCashFromServer populates gcash transactions into Dexie with normalized ref', async () => {
    (apiClient.get as any).mockResolvedValueOnce({
      data: [
        {
          id: 'gcash-1',
          tenantId: DEFAULT_TENANT_ID,
          type: 'CashIn',
          amount: 500,
          fee: 10,
          refNo: 'REF-998877',
          customerPhone: '09171234567',
          date: '2026-10-18T00:00:00.000Z'
        }
      ]
    });

    const count = await pullGCashFromServer();
    expect(count).toBe(1);
    const saved = await db.gcashTxns.get('gcash-1');
    expect(saved?.amount).toBe(500);
    expect(saved?.refNoNorm).toBe('ref-998877');
  });

  it('pullSalesFromServer populates sales and saleItems into Dexie', async () => {
    (apiClient.get as any).mockResolvedValueOnce({
      data: [
        {
          id: 'sale-1',
          tenantId: DEFAULT_TENANT_ID,
          totalAmount: 100,
          paymentMethod: 'Cash',
          date: '2026-10-18T00:00:00.000Z',
          userId: 'user-1',
          items: [
            {
              id: 'item-1',
              productId: 'prod-1',
              qty: 2,
              unitPrice: 50,
              subtotal: 100
            }
          ]
        }
      ]
    });

    const count = await pullSalesFromServer();
    expect(count).toBe(1);
    const savedSale = await db.sales.get('sale-1');
    expect(savedSale?.totalAmount).toBe(100);
    const savedItem = await db.saleItems.get('item-1');
    expect(savedItem?.qty).toBe(2);
  });

  it('restoreTenantDataFromServer pulls all resources', async () => {
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/products') return Promise.resolve({ data: [] });
      if (url === '/customers') return Promise.resolve({ data: [] });
      if (url === '/utang') return Promise.resolve({ data: [] });
      if (url === '/gcash') return Promise.resolve({ data: [] });
      if (url === '/sales') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    await restoreTenantDataFromServer();
    expect(apiClient.get).toHaveBeenCalledWith('/products');
    expect(apiClient.get).toHaveBeenCalledWith('/customers');
    expect(apiClient.get).toHaveBeenCalledWith('/utang');
    expect(apiClient.get).toHaveBeenCalledWith('/gcash');
    expect(apiClient.get).toHaveBeenCalledWith('/sales');
  });

  it('pullCatalogFromServer preserves local product edits that have pending syncQueue updates', async () => {
    await db.products.put({
      id: 'prod-local-edit',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Local Edited Item',
      price: 25,
      cost: 15,
      stockQty: 2,
      updatedAt: '2026-10-18T10:00:00.000Z'
    });

    await db.syncQueue.add({
      id: 'sync-prod-1',
      entity: 'Product',
      action: 'Update',
      timestamp: new Date().toISOString(),
      payload: { id: 'prod-local-edit', stockQty: 2 },
      status: 'Pending',
      retryCount: 0,
      queueOrder: 1
    });

    (apiClient.get as any).mockResolvedValueOnce({
      data: [
        {
          id: 'prod-local-edit',
          tenantId: DEFAULT_TENANT_ID,
          name: 'Server Stale Name',
          price: 20,
          cost: 10,
          stockQty: 10,
          updatedAt: '2026-10-18T09:00:00.000Z'
        },
        {
          id: 'prod-unmodified',
          tenantId: DEFAULT_TENANT_ID,
          name: 'Server Item',
          price: 30,
          cost: 20,
          stockQty: 5,
          updatedAt: '2026-10-18T09:00:00.000Z'
        }
      ]
    });

    const count = await pullCatalogFromServer();
    expect(count).toBe(1);

    const preserved = await db.products.get('prod-local-edit');
    expect(preserved?.stockQty).toBe(2);
    expect(preserved?.name).toBe('Local Edited Item');

    const imported = await db.products.get('prod-unmodified');
    expect(imported?.stockQty).toBe(5);
  });

  it('pullCustomersFromServer preserves local customer balance when pending mutations or newer updatedAt exist', async () => {
    await db.customers.put({
      id: 'cust-local-edit',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Ka Freddie',
      phone: '09191234567',
      totalUtangBalance: 150,
      updatedAt: '2026-10-18T11:00:00.000Z'
    });

    await db.syncQueue.add({
      id: 'sync-utang-1',
      entity: 'UtangLedger',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: { id: 'u-1', customerId: 'cust-local-edit', amount: 50 },
      status: 'Pending',
      retryCount: 0,
      queueOrder: 1
    });

    (apiClient.get as any).mockResolvedValueOnce({
      data: [
        {
          id: 'cust-local-edit',
          tenantId: DEFAULT_TENANT_ID,
          name: 'Ka Freddie',
          phone: '09191234567',
          totalUtangBalance: 100,
          updatedAt: '2026-10-18T09:00:00.000Z'
        },
        {
          id: 'cust-new',
          tenantId: DEFAULT_TENANT_ID,
          name: 'Ate Susan',
          phone: '09181234567',
          totalUtangBalance: 0,
          updatedAt: '2026-10-18T09:00:00.000Z'
        }
      ]
    });

    const count = await pullCustomersFromServer();
    expect(count).toBe(1);

    const preserved = await db.customers.get('cust-local-edit');
    expect(preserved?.totalUtangBalance).toBe(150);

    const imported = await db.customers.get('cust-new');
    expect(imported?.name).toBe('Ate Susan');
  });

  it('initSyncEngine attaches online and offline event handlers', () => {
    expect(() => initSyncEngine()).not.toThrow();

    window.dispatchEvent(new Event('offline'));
    expect(useSyncStore.getState().isOnline).toBe(false);

    window.dispatchEvent(new Event('online'));
    expect(useSyncStore.getState().isOnline).toBe(true);
  });

  describe('demo mode isolation (DEV-62)', () => {
    beforeEach(() => {
      useAuthStore.setState({
        isDemo: true,
        userEmail: 'demo@fluent-tindahan.ph',
        businessName: "Aling Nena's Demo Tindahan",
        isOnboarded: true
      });
    });

    it('does not enqueue mutations in demo mode', async () => {
      const syncId = await enqueueSync('Sale', 'Insert', { id: 'demo-sale-1', total: 100 });
      expect(syncId).toBeTruthy();
      expect(await db.syncQueue.count()).toBe(0);
      expect(useSyncStore.getState().pendingCount).toBe(0);
    });

    it('does not send batches to server in demo mode', async () => {
      const result = await processSyncQueue({ force: true });
      expect(result).toEqual({ processed: 0, conflicts: 0, errors: 0 });
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('does not restore data from server in demo mode', async () => {
      await restoreTenantDataFromServer();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('keeps queue counts at 0 when updateQueueCounts is called in demo mode', async () => {
      useSyncStore.setState({ pendingCount: 5, deadLetterCount: 2 });
      await updateQueueCounts();
      expect(useSyncStore.getState().pendingCount).toBe(0);
      expect(useSyncStore.getState().deadLetterCount).toBe(0);
    });
  });

  describe('pullCatalogFromServer and pullCustomersFromServer with bulkGet', () => {
    it('pullCatalogFromServer merges server products using bulkGet', async () => {
      useAuthStore.setState({
        tenantId: 'test-tenant'
      });

      const bulkGetSpy = vi.spyOn(db.products, 'bulkGet');

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: [
          {
            id: 'p-1',
            tenantId: 'test-tenant',
            name: 'Product 1',
            price: 10,
            cost: 5,
            stockQty: 20,
            updatedAt: '2026-10-23T10:00:00Z'
          },
          {
            id: 'p-2',
            tenantId: 'test-tenant',
            name: 'Product 2',
            price: 25,
            cost: 15,
            stockQty: 50,
            updatedAt: '2026-10-23T10:00:00Z'
          }
        ]
      });

      const count = await pullCatalogFromServer();
      expect(count).toBe(2);
      expect(bulkGetSpy).toHaveBeenCalledWith(['p-1', 'p-2']);

      const p1 = await db.products.get('p-1');
      expect(p1?.name).toBe('Product 1');
      bulkGetSpy.mockRestore();
    });

    it('pullCustomersFromServer merges server customers using bulkGet', async () => {
      useAuthStore.setState({
        tenantId: 'test-tenant'
      });

      const bulkGetSpy = vi.spyOn(db.customers, 'bulkGet');

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: [
          {
            id: 'c-1',
            tenantId: 'test-tenant',
            name: 'Customer 1',
            phone: '09123456789',
            totalUtangBalance: 100,
            updatedAt: '2026-10-23T10:00:00Z'
          }
        ]
      });

      const count = await pullCustomersFromServer();
      expect(count).toBe(1);
      expect(bulkGetSpy).toHaveBeenCalledWith(['c-1']);

      const c1 = await db.customers.get('c-1');
      expect(c1?.name).toBe('Customer 1');
      bulkGetSpy.mockRestore();
    });
  });
});

