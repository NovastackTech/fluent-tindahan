import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient, ensureTenantProvisioned } from './apiClient';
import { useAuthStore } from '../state/authStore';

describe('apiClient', () => {
  beforeEach(() => {
    useAuthStore.setState({
      tenantId: 'tenant-123',
      firebaseToken: null
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
});
