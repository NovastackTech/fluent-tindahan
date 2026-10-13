import axios from 'axios';
import { useAuthStore } from '../state/authStore';
import { db } from '../db/db';
import { useGCashFeeStore } from '../state/gcashFeeStore';

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

const provisionedTenantIds = new Set<string>();

export async function ensureTenantProvisioned(): Promise<void> {
  const { tenantId, userId, businessName, userPhone } = useAuthStore.getState();
  if (!tenantId || provisionedTenantIds.has(tenantId)) return;

  const response = await apiClient.put('/tenant/provision', {
    userId,
    businessName,
    phone: userPhone
  });
  const provisionedTenantId = response.data?.tenantId;
  if (typeof provisionedTenantId !== 'string' || !provisionedTenantId) {
    throw new Error('The server did not return a tenant ID. Re-authenticate before syncing.');
  }

  const canonicalTenantId = provisionedTenantId.toLowerCase();
  if (canonicalTenantId !== tenantId.toLowerCase()) {
    const tables = [
      db.products,
      db.customers,
      db.sales,
      db.saleItems,
      db.utangLedger,
      db.gcashTxns,
      db.gcashTxnResolutions,
      db.tenants,
      db.syncQueue,
      db.deadLetterQueue
    ];

    await db.transaction('rw', tables, async () => {
      await db.products.where('tenantId').equals(tenantId).modify({ tenantId: canonicalTenantId });
      await db.customers.where('tenantId').equals(tenantId).modify({ tenantId: canonicalTenantId });
      await db.sales.where('tenantId').equals(tenantId).modify({ tenantId: canonicalTenantId });
      await db.saleItems.where('tenantId').equals(tenantId).modify({ tenantId: canonicalTenantId });
      await db.utangLedger.where('tenantId').equals(tenantId).modify({ tenantId: canonicalTenantId });
      await db.gcashTxns.where('tenantId').equals(tenantId).modify({ tenantId: canonicalTenantId });
      await db.gcashTxnResolutions.where('tenantId').equals(tenantId).modify({ tenantId: canonicalTenantId });

      const sourceTenant = await db.tenants.get(tenantId);
      const destinationTenant = await db.tenants.get(canonicalTenantId);
      if (sourceTenant) {
        if (!destinationTenant) {
          await db.tenants.put({ ...sourceTenant, id: canonicalTenantId });
        }
        await db.tenants.delete(tenantId);
      }

      await db.syncQueue.toCollection().modify((item) => {
        if (item.payload?.tenantId?.toLowerCase() === tenantId.toLowerCase()) {
          item.payload = { ...item.payload, tenantId: canonicalTenantId };
        }
      });
      await db.deadLetterQueue.toCollection().modify((item) => {
        if (item.payload?.tenantId?.toLowerCase() === tenantId.toLowerCase()) {
          item.payload = { ...item.payload, tenantId: canonicalTenantId };
        }
      });
    });

    useGCashFeeStore.getState().migrateTenantFees(tenantId, canonicalTenantId);
    useAuthStore.getState().setTenantId(canonicalTenantId);
  }

  provisionedTenantIds.add(canonicalTenantId);
}

apiClient.interceptors.request.use((config) => {
  const { tenantId, firebaseToken } = useAuthStore.getState();

  if (tenantId) {
    config.headers['X-Tenant-Id'] = tenantId;
  }

  if (firebaseToken) {
    config.headers['Authorization'] = `Bearer ${firebaseToken}`;
  }

  return config;
});
