import { describe, it, expect, beforeEach } from 'vitest';
import { apiClient } from './apiClient';
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
});
