import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient, ensureTenantProvisioned } from './apiClient';
import { useAuthStore } from '../state/authStore';
import { db } from '../db/db';
import { GCASH_FEE_STORAGE_KEY, useGCashFeeStore } from '../state/gcashFeeStore';

describe('apiClient', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await db.tenants.clear();
    await db.products.clear();
    await db.syncQueue.clear();
    useGCashFeeStore.setState({ feesByTenant: {} });
    useAuthStore.setState({
      tenantId: 'tenant-123',
      firebaseToken: null,
      isOnboarded: true,
      isOnboardingStatusReady: true
    });
  });

  it('has base configuration with /api prefix and 15s timeout', () => {
    expect(apiClient.defaults.baseURL).toBe('/api');
    expect(apiClient.defaults.timeout).toBe(15000);
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
  });

  it('request interceptor injects X-Tenant-Id header from authStore', async () => {
    // Interceptor test by invoking internal interceptor handler or checking behavior
    const interceptor = (apiClient.interceptors.request as any).handlers[0];
    const config: any = { headers: {} };
    const updated = await interceptor.fulfilled(config);

    expect(updated.headers['X-Tenant-Id']).toBe('tenant-123');
    expect(updated.headers['Authorization']).toBeUndefined();
  });

  it('request interceptor injects Authorization Bearer header when token exists', async () => {
    useAuthStore.setState({
      tenantId: 'tenant-456',
      firebaseToken: 'jwt-bearer-xyz'
    });

    const interceptor = (apiClient.interceptors.request as any).handlers[0];
    const config: any = { headers: {} };
    const updated = await interceptor.fulfilled(config);

    expect(updated.headers['X-Tenant-Id']).toBe('tenant-456');
    expect(updated.headers['Authorization']).toBe('Bearer jwt-bearer-xyz');
  });

  it('provisions the current tenant and owner before remote writes', async () => {
    const tenantId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    useAuthStore.setState({
      tenantId,
      userId,
      businessName: 'Ate Rose Tindahan',
      userPhone: '09181234567'
    });
    const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValue({
      data: { tenantId }
    } as any);

    await ensureTenantProvisioned();

    expect(putSpy).toHaveBeenCalledWith('/tenant/provision', {
      userId,
      businessName: 'Ate Rose Tindahan',
      phone: '09181234567'
    });
    putSpy.mockRestore();
  });

  it('does not provision a tenant before onboarding is resolved', async () => {
    useAuthStore.setState({
      isOnboarded: false,
      isOnboardingStatusReady: false
    });
    const putSpy = vi.spyOn(apiClient, 'put');

    await ensureTenantProvisioned();

    expect(putSpy).not.toHaveBeenCalled();
  });

  it('adopts the server tenant ID and rekeys local data and pending operations', async () => {
    const localTenantId = crypto.randomUUID();
    const serverTenantId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    useAuthStore.setState({
      tenantId: localTenantId,
      userId,
      businessName: 'Ate Rose Tindahan',
      userPhone: '09181234567'
    });
    useGCashFeeStore.setState({ feesByTenant: { [localTenantId]: [6, 11, 31, 46, 61, 76, 16] } });
    await db.tenants.put({
      id: localTenantId,
      businessName: 'Ate Rose Tindahan',
      tier: 'Libre',
      updatedAt: new Date().toISOString()
    });
    await db.products.put({
      id: 'local-product',
      tenantId: localTenantId,
      name: 'Kape',
      price: 10,
      cost: 8,
      stockQty: 1,
      updatedAt: new Date().toISOString()
    });
    await db.syncQueue.put({
      id: 'local-sync',
      entity: 'Product',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: { id: 'local-product', tenantId: localTenantId },
      status: 'Pending',
      retryCount: 0
    });
    const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValueOnce({
      data: { tenantId: serverTenantId }
    } as any);

    await ensureTenantProvisioned();

    expect(useAuthStore.getState().tenantId).toBe(serverTenantId);
    expect((await db.products.get('local-product'))?.tenantId).toBe(serverTenantId);
    expect((await db.syncQueue.get('local-sync'))?.payload.tenantId).toBe(serverTenantId);
    expect(await db.tenants.get(localTenantId)).toBeUndefined();
    expect((await db.tenants.get(serverTenantId))?.businessName).toBe('Ate Rose Tindahan');
    expect(useGCashFeeStore.getState().feesByTenant[serverTenantId]).toEqual([6, 11, 31, 46, 61, 76, 16]);
    expect(useGCashFeeStore.getState().feesByTenant[localTenantId]).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(GCASH_FEE_STORAGE_KEY) || '{}')[serverTenantId]).toEqual([6, 11, 31, 46, 61, 76, 16]);
    putSpy.mockRestore();
  });
});
