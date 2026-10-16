import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  apiClient,
  ensureTenantProvisioned,
  TenantAccountMismatchError,
  TenantProvisioningError
} from './apiClient';
import { useAuthStore } from '../state/authStore';
import { db } from '../db/db';
import { GCASH_FEE_STORAGE_KEY, useGCashFeeStore } from '../state/gcashFeeStore';
import { DEFAULT_USER_ID } from '../db/seedData';

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
      userId: '33333333-3333-4333-8333-333333333333',
      locallyCreatedTenantId: null,
      serverConfirmedTenantId: null,
      serverConfirmedUserId: null,
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
    const serverUserId = crypto.randomUUID();
    useAuthStore.setState({
      tenantId,
      userId,
      businessName: 'Ate Rose Tindahan',
      userPhone: '09181234567'
    });
    const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValue({
      data: { tenantId, userId: serverUserId }
    } as any);

    await ensureTenantProvisioned();

    expect(putSpy).toHaveBeenCalledWith('/tenant/provision', {
      userId,
      businessName: 'Ate Rose Tindahan',
      phone: '09181234567'
    });
    expect(useAuthStore.getState().userId).toBe(serverUserId);
    expect(useAuthStore.getState().serverConfirmedUserId).toBe(serverUserId);
    putSpy.mockRestore();
  });

  it('types missing provisioned tenant identity as a hard provisioning failure', async () => {
    vi.spyOn(apiClient, 'put').mockResolvedValueOnce({ data: {} } as any);
    const error = await ensureTenantProvisioned().catch((caught) => caught);

    expect(error).toBeInstanceOf(TenantProvisioningError);
    expect(error).toMatchObject({
      name: 'TenantProvisioningError',
      status: 409
    });
  });

  it('types provision 409 responses as hard provisioning failures', async () => {
    vi.spyOn(apiClient, 'put').mockRejectedValueOnce({ response: { status: 409 } });

    await expect(ensureTenantProvisioned()).rejects.toMatchObject({
      name: 'TenantProvisioningError',
      status: 409
    });
  });

  it('shares one in-flight provision request between concurrent callers', async () => {
    const tenantId = crypto.randomUUID();
    useAuthStore.setState({
      tenantId,
      userId: DEFAULT_USER_ID,
      locallyCreatedTenantId: tenantId,
      serverConfirmedTenantId: null,
      serverConfirmedUserId: null
    });
    useAuthStore.getState().completeOnboarding({
      tenantId,
      businessName: 'New Tindahan'
    });
    const userId = useAuthStore.getState().userId;
    expect(userId).not.toBe(DEFAULT_USER_ID);
    let resolveProvision!: (response: { data: { tenantId: string; userId: string } }) => void;
    const putSpy = vi.spyOn(apiClient, 'put').mockImplementation(() => new Promise((resolve) => {
      resolveProvision = resolve;
    }) as any);

    const firstProvision = ensureTenantProvisioned();
    const secondProvision = ensureTenantProvisioned();

    expect(putSpy).toHaveBeenCalledTimes(1);
    resolveProvision({ data: { tenantId, userId } });
    await Promise.all([firstProvision, secondProvision]);
    expect(putSpy).toHaveBeenCalledTimes(1);
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
      locallyCreatedTenantId: localTenantId,
      serverConfirmedTenantId: null,
      serverConfirmedUserId: null,
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
    expect(useAuthStore.getState().serverConfirmedTenantId).toBe(serverTenantId);
    expect(useAuthStore.getState().serverConfirmedUserId).toBe(userId);
    expect((await db.products.get('local-product'))?.tenantId).toBe(serverTenantId);
    expect((await db.syncQueue.get('local-sync'))?.payload.tenantId).toBe(serverTenantId);
    expect(await db.tenants.get(localTenantId)).toBeUndefined();
    expect((await db.tenants.get(serverTenantId))?.businessName).toBe('Ate Rose Tindahan');
    expect(useGCashFeeStore.getState().feesByTenant[serverTenantId]).toEqual([6, 11, 31, 46, 61, 76, 16]);
    expect(useGCashFeeStore.getState().feesByTenant[localTenantId]).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(GCASH_FEE_STORAGE_KEY) || '{}')[serverTenantId]).toEqual([6, 11, 31, 46, 61, 76, 16]);
    putSpy.mockRestore();
  });

  it('uses the authenticated JWT subject instead of a locally generated owner ID', async () => {
    const tenantId = crypto.randomUUID();
    const authenticatedUserId = crypto.randomUUID();
    const previousUserId = crypto.randomUUID();
    const payload = btoa(JSON.stringify({ sub: authenticatedUserId }))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    useAuthStore.setState({
      tenantId,
      userId: previousUserId,
      firebaseToken: `header.${payload}.signature`
    });
    const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValueOnce({
      data: { tenantId, userId: authenticatedUserId }
    } as any);

    await ensureTenantProvisioned();

    expect(putSpy).toHaveBeenCalledWith('/tenant/provision', expect.objectContaining({
      userId: authenticatedUserId
    }));
    expect(useAuthStore.getState().userId).toBe(authenticatedUserId);
    expect(localStorage.getItem('fluent_tindahan_user_id_v1')).toBe(authenticatedUserId);
    putSpy.mockRestore();
  });

  it('does not re-key a tenant without proof that it was locally created', async () => {
    const localTenantId = crypto.randomUUID();
    const serverTenantId = crypto.randomUUID();
    useAuthStore.setState({
      tenantId: localTenantId,
      userId: crypto.randomUUID(),
      locallyCreatedTenantId: null,
      serverConfirmedTenantId: null,
      serverConfirmedUserId: null
    });
    await db.products.put({
      id: 'legacy-product',
      tenantId: localTenantId,
      name: 'Kape',
      price: 10,
      cost: 8,
      stockQty: 1,
      updatedAt: new Date().toISOString()
    });
    const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValueOnce({
      data: { tenantId: serverTenantId }
    } as any);

    await expect(ensureTenantProvisioned()).rejects.toBeInstanceOf(TenantAccountMismatchError);

    expect(useAuthStore.getState().tenantId).toBe(localTenantId);
    expect((await db.products.get('legacy-product'))?.tenantId).toBe(localTenantId);
    putSpy.mockRestore();
  });

  it('blocks provisioning when the current account differs from the confirmed owner', async () => {
    const tenantId = crypto.randomUUID();
    const confirmedUserId = crypto.randomUUID();
    useAuthStore.setState({
      tenantId,
      userId: crypto.randomUUID(),
      locallyCreatedTenantId: null,
      serverConfirmedTenantId: tenantId,
      serverConfirmedUserId: confirmedUserId
    });
    const putSpy = vi.spyOn(apiClient, 'put');

    await expect(ensureTenantProvisioned()).rejects.toBeInstanceOf(TenantAccountMismatchError);

    expect(putSpy).not.toHaveBeenCalled();
  });

  it('rejects a server owner mismatch for an already-confirmed tenant', async () => {
    const tenantId = crypto.randomUUID();
    const confirmedUserId = crypto.randomUUID();
    const differentUserId = crypto.randomUUID();
    useAuthStore.setState({
      tenantId,
      userId: confirmedUserId,
      locallyCreatedTenantId: null,
      serverConfirmedTenantId: tenantId,
      serverConfirmedUserId: confirmedUserId
    });
    const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValueOnce({
      data: { tenantId, userId: differentUserId }
    } as any);

    await expect(ensureTenantProvisioned()).rejects.toBeInstanceOf(TenantAccountMismatchError);

    expect(putSpy).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().tenantId).toBe(tenantId);
    expect(useAuthStore.getState().serverConfirmedTenantId).toBe(tenantId);
    expect(useAuthStore.getState().serverConfirmedUserId).toBe(confirmedUserId);
  });

  it('checks account identity before reusing a cached provisioned session', async () => {
    const tenantId = crypto.randomUUID();
    const confirmedUserId = crypto.randomUUID();
    useAuthStore.setState({
      tenantId,
      userId: confirmedUserId,
      locallyCreatedTenantId: null,
      serverConfirmedTenantId: null,
      serverConfirmedUserId: null
    });
    vi.spyOn(apiClient, 'put').mockResolvedValueOnce({
      data: { tenantId, userId: confirmedUserId }
    } as any);
    await ensureTenantProvisioned();
    const newAccountUserId = crypto.randomUUID();
    const payload = btoa(JSON.stringify({ sub: newAccountUserId }))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    useAuthStore.setState({ firebaseToken: `header.${payload}.signature` });

    await expect(ensureTenantProvisioned()).rejects.toBeInstanceOf(TenantAccountMismatchError);
  });

  it('replaces DEFAULT_USER_ID before provisioning a real tenant', async () => {
    const tenantId = crypto.randomUUID();
    useAuthStore.setState({
      tenantId,
      userId: '22222222-2222-2222-2222-222222222222'
    });
    const putSpy = vi.spyOn(apiClient, 'put').mockImplementation(async (_url, data) => ({
      data: { tenantId, userId: (data as { userId: string }).userId }
    } as any));

    await ensureTenantProvisioned();

    const sentUserId = (putSpy.mock.calls[0][1] as { userId: string }).userId;
    expect(sentUserId).not.toBe('22222222-2222-2222-2222-222222222222');
    expect(useAuthStore.getState().userId).toBe(sentUserId);
    putSpy.mockRestore();
  });

  it('response interceptor refreshes token on 401 when refreshToken is present', async () => {
    const axios = (await import('axios')).default;
    useAuthStore.setState({
      firebaseToken: 'old-access-token',
      refreshToken: 'valid-refresh-token'
    });

    const axiosPostSpy = vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: {
        token: 'new-access-token',
        refreshToken: 'new-refresh-token'
      }
    });

    const interceptor = (apiClient.interceptors.response as any).handlers[0];
    const originalRequest: any = {
      headers: { Authorization: 'Bearer old-access-token' },
      url: '/products'
    };

    const apiClientSpy = vi.spyOn(apiClient, 'request').mockResolvedValueOnce({
      status: 200,
      data: { success: true }
    } as any);

    // Call interceptor rejected handler
    await interceptor.rejected({
      response: { status: 401 },
      config: originalRequest
    });

    expect(axiosPostSpy).toHaveBeenCalledWith(
      '/api/auth/refresh',
      { refreshToken: 'valid-refresh-token' },
      expect.any(Object)
    );
    expect(useAuthStore.getState().firebaseToken).toBe('new-access-token');
    expect(useAuthStore.getState().refreshToken).toBe('new-refresh-token');

    axiosPostSpy.mockRestore();
    apiClientSpy.mockRestore();
  });

  it('response interceptor clears tokens on 401 refresh error', async () => {
    const axios = (await import('axios')).default;
    useAuthStore.setState({
      firebaseToken: 'old-access-token',
      refreshToken: 'stale-refresh-token'
    });

    const axiosPostSpy = vi.spyOn(axios, 'post').mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Invalid refresh token' } }
    });

    const interceptor = (apiClient.interceptors.response as any).handlers[0];
    const originalRequest: any = {
      headers: { Authorization: 'Bearer old-access-token' },
      url: '/products'
    };

    await expect(
      interceptor.rejected({
        response: { status: 401 },
        config: originalRequest
      })
    ).rejects.toEqual(
      expect.objectContaining({
        response: expect.objectContaining({ status: 401 })
      })
    );

    expect(useAuthStore.getState().firebaseToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();

    axiosPostSpy.mockRestore();
  });

  it('response interceptor clears tokens on 403 refresh error', async () => {
    const axios = (await import('axios')).default;
    useAuthStore.setState({
      firebaseToken: 'old-access-token',
      refreshToken: 'forbidden-refresh-token'
    });

    const axiosPostSpy = vi.spyOn(axios, 'post').mockRejectedValueOnce({
      response: { status: 403, data: { message: 'Refresh forbidden' } }
    });

    const interceptor = (apiClient.interceptors.response as any).handlers[0];
    const originalRequest: any = {
      headers: { Authorization: 'Bearer old-access-token' },
      url: '/products'
    };

    await expect(
      interceptor.rejected({
        response: { status: 401 },
        config: originalRequest
      })
    ).rejects.toEqual(
      expect.objectContaining({
        response: expect.objectContaining({ status: 403 })
      })
    );

    expect(useAuthStore.getState().firebaseToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();

    axiosPostSpy.mockRestore();
  });

  it('response interceptor preserves tokens and clears _retry on 500 server error', async () => {
    const axios = (await import('axios')).default;
    useAuthStore.setState({
      firebaseToken: 'old-access-token',
      refreshToken: 'preserve-me-refresh-token'
    });

    const axiosPostSpy = vi.spyOn(axios, 'post').mockRejectedValueOnce({
      response: { status: 500, data: { message: 'Internal server error' } }
    });

    const interceptor = (apiClient.interceptors.response as any).handlers[0];
    const originalRequest: any = {
      headers: { Authorization: 'Bearer old-access-token' },
      url: '/products'
    };

    await expect(
      interceptor.rejected({
        response: { status: 401 },
        config: originalRequest
      })
    ).rejects.toEqual(
      expect.objectContaining({
        response: expect.objectContaining({ status: 500 })
      })
    );

    // Tokens must be kept for future retry
    expect(useAuthStore.getState().firebaseToken).toBe('old-access-token');
    expect(useAuthStore.getState().refreshToken).toBe('preserve-me-refresh-token');
    // _retry flag should be cleared so the request can retry
    expect(originalRequest._retry).toBeUndefined();

    axiosPostSpy.mockRestore();
  });

  it('response interceptor preserves tokens and clears _retry on network failure', async () => {
    const axios = (await import('axios')).default;
    useAuthStore.setState({
      firebaseToken: 'old-access-token',
      refreshToken: 'preserve-me-network-refresh-token'
    });

    const networkError = new Error('Network Error');
    const axiosPostSpy = vi.spyOn(axios, 'post').mockRejectedValueOnce(networkError);

    const interceptor = (apiClient.interceptors.response as any).handlers[0];
    const originalRequest: any = {
      headers: { Authorization: 'Bearer old-access-token' },
      url: '/products'
    };

    await expect(
      interceptor.rejected({
        response: { status: 401 },
        config: originalRequest
      })
    ).rejects.toThrow('Network Error');

    // Tokens must remain intact
    expect(useAuthStore.getState().firebaseToken).toBe('old-access-token');
    expect(useAuthStore.getState().refreshToken).toBe('preserve-me-network-refresh-token');
    expect(originalRequest._retry).toBeUndefined();

    axiosPostSpy.mockRestore();
  });
});
