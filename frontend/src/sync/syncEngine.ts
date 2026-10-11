import { db, type SyncQueueRecord } from '../db/db';
import { apiClient } from '../services/apiClient';
import { create } from 'zustand';

interface SyncStoreState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  pendingCount: number;
  deadLetterCount: number;
  lastErrorMessage: string | null;
  setOnline: (online: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setCounts: (pending: number, deadLetter: number) => void;
  setLastSyncedAt: (date: Date) => void;
  setLastErrorMessage: (msg: string | null) => void;
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  isOnline: navigator.onLine,
  isSyncing: false,
  lastSyncedAt: null,
  pendingCount: 0,
  deadLetterCount: 0,
  lastErrorMessage: null,
  setOnline: (online) => set({ isOnline: online }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setCounts: (pending, deadLetter) => set({ pendingCount: pending, deadLetterCount: deadLetter }),
  setLastSyncedAt: (date) => set({ lastSyncedAt: date, lastErrorMessage: null }),
  setLastErrorMessage: (msg) => set({ lastErrorMessage: msg })
}));

function getDeviceId(): string {
  const KEY = 'fluent_tindahan_device_id';
  let deviceId = localStorage.getItem(KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(KEY, deviceId);
  }
  return deviceId;
}

let globalQueueOrder = 0;

export async function enqueueSync(
  entity: 'Product' | 'Customer' | 'Sale' | 'UtangLedger' | 'GCashTxn',
  action: 'Insert' | 'Update' | 'Delete',
  payload: any
): Promise<string> {
  const syncId = crypto.randomUUID();
  const record: SyncQueueRecord = {
    id: syncId,
    entity,
    action,
    timestamp: new Date().toISOString(),
    payload,
    status: 'Pending',
    retryCount: 0,
    queueOrder: Date.now() * 1000 + (++globalQueueOrder % 1000)
  };

  await db.syncQueue.add(record);
  await updateQueueCounts();

  // If online, kick off sync asynchronously
  if (navigator.onLine) {
    processSyncQueue().catch((err) => console.warn('Background sync trigger failed:', err));
  }

  return syncId;
}

export async function updateQueueCounts() {
  const pending = await db.syncQueue.count();
  const deadLetter = await db.deadLetterQueue.count();
  useSyncStore.getState().setCounts(pending, deadLetter);
}

export async function processSyncQueue(): Promise<{ processed: number; errors: number }> {
  const store = useSyncStore.getState();
  if (store.isSyncing) return { processed: 0, errors: 0 };

  const pendingItems = await db.syncQueue
    .where('status')
    .anyOf('Pending', 'Failed')
    .limit(50)
    .toArray();

  if (pendingItems.length === 0) {
    await updateQueueCounts();
    return { processed: 0, errors: 0 };
  }

  // Initially order pending items strictly by enqueued sequence (queueOrder / timestamp)
  pendingItems.sort((a, b) => {
    const qA = a.queueOrder ?? new Date(a.timestamp).getTime();
    const qB = b.queueOrder ?? new Date(b.timestamp).getTime();
    return qA - qB;
  });

  // Identify entity IDs that have a subsequent Insert/Update in the same batch
  const reinsertedIds = new Set<string>();
  const seenDeletes = new Set<string>();
  for (const item of pendingItems) {
    const targetId = item.payload?.id;
    if (targetId) {
      const key = `${item.entity}:${targetId}`;
      if (item.action === 'Delete') {
        seenDeletes.add(key);
      } else if (seenDeletes.has(key)) {
        reinsertedIds.add(key);
      }
    }
  }

  // Ensure dependencies are ordered: Customer -> Product -> Sale -> UtangLedger -> GCashTxn -> Deletes (unless reinserted)
  const entityOrder: Record<string, number> = {
    Customer: 1,
    Product: 2,
    Sale: 3,
    UtangLedger: 4,
    GCashTxn: 5
  };

  const originalIndices = new Map(pendingItems.map((item, idx) => [item.id, idx]));

  pendingItems.sort((a, b) => {
    // Keep original outbox order for ops on the exact same entity and id
    if (a.payload?.id && b.payload?.id && a.entity === b.entity && a.payload.id === b.payload.id) {
      return (originalIndices.get(a.id) ?? 0) - (originalIndices.get(b.id) ?? 0);
    }

    const isReinsertedA = a.payload?.id && reinsertedIds.has(`${a.entity}:${a.payload.id}`);
    const isReinsertedB = b.payload?.id && reinsertedIds.has(`${b.entity}:${b.payload.id}`);

    const orderA = a.action === 'Delete' && !isReinsertedA ? 10 : (entityOrder[a.entity] ?? 6);
    const orderB = b.action === 'Delete' && !isReinsertedB ? 10 : (entityOrder[b.entity] ?? 6);
    if (orderA !== orderB) return orderA - orderB;

    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    if (timeA !== timeB) return timeA - timeB;

    if (a.queueOrder !== undefined && b.queueOrder !== undefined && a.queueOrder !== b.queueOrder) {
      return a.queueOrder - b.queueOrder;
    }

    return (originalIndices.get(a.id) ?? 0) - (originalIndices.get(b.id) ?? 0);
  });

  store.setSyncing(true);

  try {
    const payload = {
      deviceId: getDeviceId(),
      operations: pendingItems.map((item) => ({
        syncId: item.id,
        entity: item.entity,
        action: item.action,
        timestamp: item.timestamp,
        payload: item.payload
      }))
    };

    const response = await apiClient.post('/sync/batch', payload);
    const data = response.data;
    const results: Array<{ syncId: string; status: string; error?: string }> = data.results || [];

    let successCount = 0;
    let failCount = 0;

    for (const res of results) {
      const original = pendingItems.find((p) => p.id === res.syncId);
      if (!original) continue;

      if (res.status === 'Success' || res.status === 'ConflictIgnored') {
        await db.syncQueue.delete(original.id);
        successCount++;
      } else {
        failCount++;
        const newRetryCount = (original.retryCount || 0) + 1;
        if (newRetryCount >= 3) {
          // Move to dead letter queue to prevent blocking
          await db.deadLetterQueue.add({
            id: original.id,
            entity: original.entity,
            action: original.action,
            timestamp: original.timestamp,
            payload: original.payload,
            retryCount: newRetryCount,
            errorMessage: res.error || 'Max retries exceeded',
            failedAt: new Date().toISOString()
          });
          await db.syncQueue.delete(original.id);
          store.setLastErrorMessage(`Nalipat sa Dead Letter Queue ang 1 transaksyon: ${res.error || 'Failed'}`);
        } else {
          await db.syncQueue.update(original.id, {
            status: 'Failed',
            retryCount: newRetryCount,
            errorMessage: res.error
          });
        }
      }
    }

    store.setLastSyncedAt(new Date());
    await updateQueueCounts();
    return { processed: successCount, errors: failCount };
  } catch (err: any) {
    console.error('Batch sync network/server failure:', err);
    store.setLastErrorMessage(err.message || 'Hindi makakonekta sa server');
    return { processed: 0, errors: pendingItems.length };
  } finally {
    store.setSyncing(false);
  }
}

export async function retryDeadLetterItem(id: string) {
  const item = await db.deadLetterQueue.get(id);
  if (!item) return;

  await db.syncQueue.add({
    id: item.id,
    entity: item.entity as any,
    action: item.action as any,
    timestamp: new Date().toISOString(),
    payload: item.payload,
    status: 'Pending',
    retryCount: 0
  });

  await db.deadLetterQueue.delete(id);
  await updateQueueCounts();
  if (navigator.onLine) {
    processSyncQueue().catch(console.error);
  }
}

export async function clearDeadLetterQueue() {
  await db.deadLetterQueue.clear();
  await updateQueueCounts();
}

export async function pullCatalogFromServer(): Promise<number> {
  try {
    const response = await apiClient.get('/products');
    const products = response.data;
    if (Array.isArray(products) && products.length > 0) {
      for (const p of products) {
        await db.products.put({
          id: p.id,
          tenantId: p.tenantId,
          name: p.name,
          price: p.price,
          cost: p.cost,
          barcode: p.barcode,
          category: p.category,
          stockQty: p.stockQty,
          updatedAt: p.updatedAt
        });
      }
      return products.length;
    }
    return 0;
  } catch (err) {
    console.warn('Failed to pull catalog from server:', err);
    return 0;
  }
}

// Setup network & sync listeners
export function initSyncEngine() {
  const store = useSyncStore.getState();

  window.addEventListener('online', () => {
    store.setOnline(true);
    processSyncQueue().catch(console.error);
  });

  window.addEventListener('offline', () => {
    store.setOnline(false);
  });

  // Request storage persistence (Section 11)
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then((persistent) => {
      console.log('IndexedDB storage persistence granted:', persistent);
    }).catch(console.error);
  }

  // Periodic heartbeat / sync trigger every 30s
  setInterval(() => {
    if (navigator.onLine) {
      processSyncQueue().catch(() => {});
    }
  }, 30000);

  updateQueueCounts().catch(console.error);
}
