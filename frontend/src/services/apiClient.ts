import axios from 'axios';
import { useAuthStore } from '../state/authStore';
import { DEFAULT_TENANT_ID } from '../db/seedData';

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
  if (!tenantId || tenantId === DEFAULT_TENANT_ID || provisionedTenantIds.has(tenantId)) return;

  const response = await apiClient.put('/tenant/provision', {
    userId,
    businessName,
    phone: userPhone
  });
  const provisionedTenantId = response.data?.tenantId;
  if (provisionedTenantId && provisionedTenantId.toLowerCase() !== tenantId.toLowerCase()) {
    throw new Error('The server resolved a different tenant than this device. Re-authenticate before syncing.');
  }
  provisionedTenantIds.add(tenantId);
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
