import { db, type SyncQueueRecord, type ProductRecord, type DeadLetterRecord } from '../db/db';
import {
  MIN_PRODUCT_PRICE,
  MAX_PRODUCT_PRICE,
  MIN_PRODUCT_COST,
  MAX_PRODUCT_COST,
  MIN_PRODUCT_STOCK,
  MAX_PRODUCT_STOCK
} from '../constants/inventory';
import {
  apiClient,
  ensureTenantProvisioned,
  TenantAccountMismatchError,
  TenantProvisioningError
} from '../services/apiClient';
import { useAuthStore } from '../state/authStore';
import { createClientUuid } from '../utils/uuid';
import { create } from 'zustand';
import { hasPendingProfileUpdate, syncPendingProfileUpdate } from '../services/profileSync';

import { STORAGE_KEY_LAST_SYNCED, getSyncStorageKey } from '../constants/sync';
export { STORAGE_KEY_LAST_SYNCED, getSyncStorageKey };

export function getSavedLastSyncedAt(tenantId?: string | null): Date | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const activeTenantId = tenantId !== undefined ? tenantId : useAuthStore.getState().tenantId;
    const key = getSyncStorageKey(activeTenantId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const date = new Date(raw);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export function persistLastSyncedAt(date: Date | null, tenantId?: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const activeTenantId = tenantId !== undefined ? tenantId : useAuthStore.getState().tenantId;
    const key = getSyncStorageKey(activeTenantId);
    if (date) {
      localStorage.setItem(key, date.toISOString());
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage quota or access errors
  }
}

interface SyncStoreState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  pendingCount: number;
  deadLetterCount: number;
  lastErrorMessage: string | null;
  authBlockedSessionKey: string | null;
  batchFailureCount: number;
  nextRetryAt: number | null;
  setOnline: (online: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setCounts: (pending: number, deadLetter: number) => void;
  setLastSyncedAt: (date: Date | null) => void;
  setLastErrorMessage: (msg: string | null) => void;
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  isOnline: navigator.onLine,
  isSyncing: false,
  lastSyncedAt: getSavedLastSyncedAt(),
  pendingCount: 0,
  deadLetterCount: 0,
  lastErrorMessage: null,
  authBlockedSessionKey: null,
  batchFailureCount: 0,
  nextRetryAt: null,
  setOnline: (online) => set({ isOnline: online }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setCounts: (pending, deadLetter) => set({ pendingCount: pending, deadLetterCount: deadLetter }),
  setLastSyncedAt: (date) => set({ lastSyncedAt: date, lastErrorMessage: null }),
  setLastErrorMessage: (msg) => set({ lastErrorMessage: msg })
}));

useSyncStore.subscribe((state, prevState) => {
  if (state.lastSyncedAt !== prevState.lastSyncedAt) {
    persistLastSyncedAt(state.lastSyncedAt);
  }
});

useAuthStore.subscribe((authState, prevAuthState) => {
  const currentTenant = authState.tenantId?.trim();
  const prevTenant = prevAuthState?.tenantId?.trim();
  if (currentTenant && prevTenant && currentTenant.toLowerCase() !== prevTenant.toLowerCase()) {
    const newTenantLastSync = getSavedLastSyncedAt(currentTenant);
    useSyncStore.getState().setLastSyncedAt(newTenantLastSync);
  }
});

function getDeviceId(): string {
  const KEY = 'fluent_tindahan_device_id';
  let deviceId = localStorage.getItem(KEY);
  if (!deviceId) {
    deviceId = createClientUuid();
    localStorage.setItem(KEY, deviceId);
  }
  return deviceId;
}

let globalQueueOrder = 0;

/**
 * Adds a sync queue row only (safe to call inside a Dexie transaction that
 * includes db.syncQueue). Call `kickSync()` after the transaction commits.
 */
export async function addSyncRecord(
  entity: 'Product' | 'Customer' | 'Sale' | 'UtangLedger' | 'GCashTxn',
  action: 'Insert' | 'Update' | 'Delete',
  payload: any
): Promise<string> {
  const syncId = createClientUuid();
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
  return syncId;
}

export async function kickSync() {
  await updateQueueCounts();

  // If online, kick off sync asynchronously
  if (navigator.onLine) {
    processSyncQueue().catch((err) => console.warn('Background sync trigger failed:', err));
  }
}

export async function enqueueSync(
  entity: 'Product' | 'Customer' | 'Sale' | 'UtangLedger' | 'GCashTxn',
  action: 'Insert' | 'Update' | 'Delete',
  payload: any
): Promise<string> {
  const syncId = await addSyncRecord(entity, action, payload);
  await kickSync();
  return syncId;
}

/** An in-flight batch older than this was interrupted by a reload or a crashed tab. */
export const IN_FLIGHT_STALE_MS = 20_000;

/**
 * Puts stranded InFlight queue rows back to Pending.
 * InFlight is not a durable lock: a reload clears the in-memory syncing flag
 * but leaves the IndexedDB status behind, and processSyncQueue only sends
 * Pending and Failed rows. Rows with no timestamp are treated as stale.
 */
export async function recoverStaleInFlightSyncItems(now = Date.now()): Promise<number> {
  const stranded = await db.syncQueue.where('status').equals('InFlight').toArray();
  const staleIds = stranded
    .filter((item) => {
      const started = item.inFlightAt ? Date.parse(item.inFlightAt) : Number.NaN;
      return !Number.isFinite(started) || now - started >= IN_FLIGHT_STALE_MS;
    })
    .map((item) => item.id);
  if (staleIds.length === 0) return 0;

  await db.syncQueue.where('id').anyOf(staleIds).modify((item: SyncQueueRecord) => {
    item.status = 'Pending';
    delete item.inFlightAt;
  });
  return staleIds.length;
}

export async function updateQueueCounts() {
  const pendingQueue = await db.syncQueue.count();
  const profilePending = hasPendingProfileUpdate() ? 1 : 0;
  const pending = pendingQueue + profilePending;
  const deadLetter = await db.deadLetterQueue.count();
  useSyncStore.getState().setCounts(pending, deadLetter);
  const errMsg = useSyncStore.getState().lastErrorMessage;
  if (deadLetter === 0 && (errMsg?.includes('Dead Letter Queue') || errMsg?.includes('Nalipat sa Dead Letter Queue'))) {
    useSyncStore.getState().setLastErrorMessage(null);
  }
}

function getAuthSessionKey(): string {
  const { tenantId, firebaseToken } = useAuthStore.getState();
  return `${tenantId}:${firebaseToken ?? ''}`;
}

export async function processSyncQueue(): Promise<{ processed: number; conflicts: number; errors: number }> {
  const auth = useAuthStore.getState();
  if (!auth.isOnboardingStatusReady || !auth.isOnboarded) {
    return { processed: 0, conflicts: 0, errors: 0 };
  }

  // Attempt to sync pending profile update if queued
  if (hasPendingProfileUpdate()) {
    try {
      await syncPendingProfileUpdate();
      await updateQueueCounts();
    } catch (e) {
      console.warn('[syncEngine] Pending profile sync failed:', e);
    }
  }

  const store = useSyncStore.getState();
  if (store.isSyncing) return { processed: 0, conflicts: 0, errors: 0 };

  const authSessionKey = getAuthSessionKey();
  if (store.authBlockedSessionKey === authSessionKey) {
    return { processed: 0, conflicts: 0, errors: 0 };
  }
  if (store.authBlockedSessionKey !== null) {
    useSyncStore.setState({ authBlockedSessionKey: null, lastErrorMessage: null });
  }
  if (store.nextRetryAt !== null && Date.now() < store.nextRetryAt) {
    return { processed: 0, conflicts: 0, errors: 0 };
  }

  await recoverStaleInFlightSyncItems();

  const pendingItems = await db.syncQueue
    .where('status')
    .anyOf('Pending', 'Failed')
    .limit(50)
    .toArray();

  if (pendingItems.length === 0) {
    await updateQueueCounts();
    return { processed: 0, conflicts: 0, errors: 0 };
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

  const batchIds = pendingItems.map((item) => item.id);
  await db.syncQueue.where('id').anyOf(batchIds).modify({
    status: 'InFlight',
    inFlightAt: new Date().toISOString()
  });

  store.setSyncing(true);

  try {
    await ensureTenantProvisioned();

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
    useSyncStore.setState({ batchFailureCount: 0, nextRetryAt: null });
    const data = response.data;
    const results: Array<{ syncId: string; status: string; error?: string }> = data.results || [];

    let successCount = 0;
    let conflictCount = 0;
    let failCount = 0;
    let duplicateRefCount = 0;
    let otherGCashConflictCount = 0;

    for (const res of results) {
      const original = pendingItems.find((p) => p.id === res.syncId);
      if (!original) continue;

      if (res.status === 'Success' || res.status === 'ConflictIgnored') {
        await db.syncQueue.delete(original.id);
        successCount++;
      } else if (
        original.entity === 'GCashTxn' &&
        (res.status === 'DuplicateRef' || res.status === 'Conflict')
      ) {
        // GCash conflicts need manual attention and should not retry automatically.
        await db.syncQueue.delete(original.id);
        conflictCount++;
        if (res.status === 'DuplicateRef') duplicateRefCount++;
        else otherGCashConflictCount++;

        // Mark/flag the local row so the UI can show it needs attention
        if (original.payload?.id) {
          const localTxn = await db.gcashTxns.get(original.payload.id);
          if (localTxn) {
            await db.gcashTxns.update(original.payload.id, {
              needsAttention: true,
              syncStatus: res.status,
              conflictReason: res.error || (
                res.status === 'DuplicateRef'
                  ? 'Duplicate reference number on server'
                  : 'GCash transaction conflict reported by server'
              )
            });
          }
        }
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
    const conflictMessages: string[] = [];
    if (duplicateRefCount > 0) {
      conflictMessages.push(
        `${duplicateRefCount} duplicate GCash reference${duplicateRefCount === 1 ? '' : 's'} detected.`
      );
    }
    if (otherGCashConflictCount > 0) {
      conflictMessages.push(
        `${otherGCashConflictCount} GCash transaction conflict${otherGCashConflictCount === 1 ? '' : 's'} detected.`
      );
    }
    if (conflictMessages.length > 0) {
      store.setLastErrorMessage(conflictMessages.join(' '));
    }
    await updateQueueCounts();
    return { processed: successCount, conflicts: conflictCount, errors: failCount };
  } catch (err: any) {
    console.error('Batch sync network/server failure:', err);
    if (err instanceof TenantAccountMismatchError || err instanceof TenantProvisioningError) {
      useSyncStore.setState({
        authBlockedSessionKey: authSessionKey,
        batchFailureCount: 0,
        nextRetryAt: null
      });
      store.setLastErrorMessage(err.message);
      return { processed: 0, conflicts: 0, errors: pendingItems.length };
    }

    const status = err?.response?.status;
    const serverMessage = err?.response?.data?.message;
    if (status === 401 || status === 403) {
      useSyncStore.setState({
        authBlockedSessionKey: authSessionKey,
        batchFailureCount: 0,
        nextRetryAt: null
      });
      store.setLastErrorMessage(
        status === 403
          ? 'Sync was rejected because this account has no authorized tenant. Re-authenticate to resume syncing. Pending changes remain on this device.'
          : 'Sync was rejected because this device has no valid tenant session. Re-authenticate to resume syncing. Pending changes remain on this device.'
      );
    } else if (status >= 500 || !status) {
      const batchFailureCount = store.batchFailureCount + 1;
      const retryDelayMs = Math.min(30_000 * 2 ** (batchFailureCount - 1), 5 * 60_000);
      useSyncStore.setState({
        batchFailureCount,
        nextRetryAt: Date.now() + retryDelayMs
      });
      store.setLastErrorMessage(
        `${serverMessage || err.message || `Sync server error (${status || 'network'})`}. Retrying with backoff; pending changes remain on this device.`
      );
    } else {
      store.setLastErrorMessage(serverMessage || err.message || 'Hindi makakonekta sa server');
    }
    return { processed: 0, conflicts: 0, errors: pendingItems.length };
  } finally {
    try {
      // Rows still InFlight were not acknowledged. Put them back so the next
      // pass (including after a reload) can send them. A crashed tab is covered
      // by recoverStaleInFlightSyncItems.
      await db.syncQueue.where('id').anyOf(batchIds).modify((item: SyncQueueRecord) => {
        if (item.status === 'InFlight') {
          item.status = 'Pending';
          delete item.inFlightAt;
        }
      });
    } finally {
      store.setSyncing(false);
    }
  }
}

export interface RetryDeadLetterResult {
  success: boolean;
  requiresEdit?: boolean;
  error?: string;
  item?: DeadLetterRecord;
}

export async function retryDeadLetterItem(
  id: string,
  correctedPayload?: Partial<ProductRecord>
): Promise<RetryDeadLetterResult> {
  const item = await db.deadLetterQueue.get(id);
  if (!item) {
    return { success: false, error: 'Item not found' };
  }

  let payload = item.payload;

  if (item.entity === 'Product' && item.action !== 'Delete') {
    if (correctedPayload) {
      // User explicitly confirmed/corrected the product values via edit form
      const priceNum = Number(correctedPayload.price);
      const costNum = Number(correctedPayload.cost);
      const stockNum = Number(correctedPayload.stockQty ?? payload?.stockQty ?? 0);

      if (isNaN(priceNum) || priceNum < MIN_PRODUCT_PRICE || priceNum > MAX_PRODUCT_PRICE) {
        return {
          success: false,
          requiresEdit: true,
          error: `Dapat ay ₱${MIN_PRODUCT_PRICE} hanggang ₱${MAX_PRODUCT_PRICE.toLocaleString()} ang presyo ng tinda.`
        };
      }
      if (isNaN(costNum) || costNum < MIN_PRODUCT_COST || costNum > MAX_PRODUCT_COST) {
        return {
          success: false,
          requiresEdit: true,
          error: `Dapat ay ₱${MIN_PRODUCT_COST} hanggang ₱${MAX_PRODUCT_COST.toLocaleString()} ang puhunan.`
        };
      }
      if (isNaN(stockNum) || stockNum < MIN_PRODUCT_STOCK || stockNum > MAX_PRODUCT_STOCK) {
        return {
          success: false,
          requiresEdit: true,
          error: `Dapat ay ${MIN_PRODUCT_STOCK} hanggang ${MAX_PRODUCT_STOCK.toLocaleString()} ang dami ng stock.`
        };
      }

      const prodId = payload?.id || correctedPayload.id;
      const nowIso = new Date().toISOString();
      const updatedProduct: ProductRecord = {
        ...payload,
        ...correctedPayload,
        id: prodId,
        tenantId: payload?.tenantId || correctedPayload.tenantId || useAuthStore.getState().tenantId || '',
        name: (correctedPayload.name ?? payload?.name ?? '').trim(),
        price: priceNum,
        cost: costNum,
        stockQty: stockNum,
        category: (correctedPayload.category ?? payload?.category ?? 'General').trim(),
        barcode: correctedPayload.barcode !== undefined ? correctedPayload.barcode : payload?.barcode,
        updatedAt: nowIso
      };

      if (prodId) {
        await db.products.put(updatedProduct);
      }
      payload = updatedProduct;
    } else {
      // Retrying without explicit correctedPayload: NEVER AUTO-CLAMP!
      let currentProduct = payload;
      if (payload?.id) {
        const localProduct = await db.products.get(payload.id);
        if (localProduct) {
          currentProduct = localProduct;
        }
      }

      const priceNum = Number(currentProduct?.price);
      const costNum = Number(currentProduct?.cost);
      const stockNum = Number(currentProduct?.stockQty ?? 0);

      const isPriceInvalid = isNaN(priceNum) || priceNum < MIN_PRODUCT_PRICE || priceNum > MAX_PRODUCT_PRICE;
      const isCostInvalid = isNaN(costNum) || costNum < MIN_PRODUCT_COST || costNum > MAX_PRODUCT_COST;
      const isStockInvalid = isNaN(stockNum) || stockNum < MIN_PRODUCT_STOCK || stockNum > MAX_PRODUCT_STOCK;

      if (isPriceInvalid || isCostInvalid || isStockInvalid) {
        // Do NOT auto-clamp and do NOT rewrite data. Item remains safely in DLQ.
        return {
          success: false,
          requiresEdit: true,
          error: isPriceInvalid
            ? `Hindi wastong presyo (₱${currentProduct?.price}). Dapat ay ₱${MIN_PRODUCT_PRICE} hanggang ₱${MAX_PRODUCT_PRICE.toLocaleString()}.`
            : isCostInvalid
            ? `Hindi wastong puhunan (₱${currentProduct?.cost}). Dapat ay ₱${MIN_PRODUCT_COST} hanggang ₱${MAX_PRODUCT_COST.toLocaleString()}.`
            : `Hindi wastong stock (${currentProduct?.stockQty}). Dapat ay ${MIN_PRODUCT_STOCK} hanggang ${MAX_PRODUCT_STOCK.toLocaleString()}.`,
          item
        };
      }

      // If valid, sync latest values from local record without modifying or clamping
      if (payload?.id) {
        const localProduct = await db.products.get(payload.id);
        if (localProduct) {
          payload = {
            ...payload,
            name: localProduct.name,
            price: localProduct.price,
            cost: localProduct.cost,
            stockQty: localProduct.stockQty,
            category: localProduct.category,
            barcode: localProduct.barcode,
            updatedAt: new Date().toISOString()
          };
        }
      }
    }
  }

  if (item.entity === 'GCashTxn' && payload?.id) {
    const localTxn = await db.gcashTxns.get(payload.id);
    if (localTxn && localTxn.amount > 0 && localTxn.amount <= 100000) {
      payload = {
        ...payload,
        amount: localTxn.amount,
        fee: localTxn.fee,
        refNo: localTxn.refNo,
        customerPhone: localTxn.customerPhone,
        notes: localTxn.notes
      };
    }
  }

  await db.syncQueue.add({
    id: item.id,
    entity: item.entity as any,
    action: item.action as any,
    timestamp: new Date().toISOString(),
    payload,
    status: 'Pending',
    retryCount: 0
  });

  await db.deadLetterQueue.delete(id);
  const remainingCount = await db.deadLetterQueue.count();
  useSyncStore.getState().setCounts(useSyncStore.getState().pendingCount + 1, remainingCount);
  await updateQueueCounts();
  if (navigator.onLine) {
    processSyncQueue().catch(console.error);
  }

  return { success: true, item };
}

export const DLQ_ARCHIVE_STORAGE_KEY = 'tindahan_dlq_archive';

export interface ArchivedDeadLetterRecord extends DeadLetterRecord {
  archivedAt: string;
}

export function getArchivedDeadLetterItems(): ArchivedDeadLetterRecord[] {
  try {
    const raw = localStorage.getItem(DLQ_ARCHIVE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function archiveDeadLetterRecord(item: DeadLetterRecord): void {
  try {
    const existing = getArchivedDeadLetterItems();
    const updated = [
      { ...item, archivedAt: new Date().toISOString() },
      ...existing.filter((x) => x.id !== item.id)
    ].slice(0, 100);
    localStorage.setItem(DLQ_ARCHIVE_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to archive dead letter item:', err);
  }
}

export function clearDeadLetterArchive(): void {
  try {
    localStorage.removeItem(DLQ_ARCHIVE_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear dead letter archive:', err);
  }
}

export async function deleteDeadLetterItem(id: string) {
  const item = await db.deadLetterQueue.get(id);
  if (item) {
    archiveDeadLetterRecord(item);
  }
  await db.deadLetterQueue.delete(id);
  const remaining = await db.deadLetterQueue.count();
  useSyncStore.getState().setCounts(useSyncStore.getState().pendingCount, remaining);
  await updateQueueCounts();
}

export async function clearDeadLetterQueue() {
  const allItems = await db.deadLetterQueue.toArray();
  for (const item of allItems) {
    archiveDeadLetterRecord(item);
  }
  await db.deadLetterQueue.clear();
  useSyncStore.getState().setCounts(useSyncStore.getState().pendingCount, 0);
  useSyncStore.getState().setLastErrorMessage(null);
  await updateQueueCounts();
}

export async function pullCatalogFromServer(): Promise<number> {
  try {
    await ensureTenantProvisioned();
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
    syncPendingProfileUpdate()
      .then(() => updateQueueCounts())
      .catch(console.error);
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
