import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  queuePendingProfileUpdate,
  getPendingProfileUpdate,
  clearPendingProfileUpdate,
  hasPendingProfileUpdate,
  syncPendingProfileUpdate
} from './profileSync';
import * as authService from './authService';
import { useAuthStore } from '../state/authStore';

vi.mock('./authService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./authService')>();
  return {
    ...actual,
    updateProfile: vi.fn()
  };
});

describe('profileSync service', () => {
  const mockTenantId = 'tenant-test-123';
  const mockPayload = {
    businessName: 'My Awesome Tindahan',
    ownerName: 'Aling Nena',
    phone: '09181234567',
    email: 'nena@tindahan.ph'
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useAuthStore.setState({
      tenantId: mockTenantId,
      userId: 'user-test-123',
      businessName: 'Old Store',
      ownerName: 'Old Owner',
      userPhone: '09000000000',
      userEmail: 'old@tindahan.ph'
    });
  });

  it('queues, checks, and clears pending profile update in localStorage', () => {
    expect(hasPendingProfileUpdate()).toBe(false);
    expect(getPendingProfileUpdate()).toBeNull();

    queuePendingProfileUpdate(mockPayload, mockTenantId);

    expect(hasPendingProfileUpdate()).toBe(true);
    const pending = getPendingProfileUpdate();
    expect(pending).not.toBeNull();
    expect(pending?.tenantId).toBe(mockTenantId);
    expect(pending?.payload).toEqual(mockPayload);
    expect(pending?.retryCount).toBe(0);

    clearPendingProfileUpdate();
    expect(hasPendingProfileUpdate()).toBe(false);
    expect(getPendingProfileUpdate()).toBeNull();
  });

  it('syncPendingProfileUpdate returns true immediately if queue is empty', async () => {
    const res = await syncPendingProfileUpdate();
    expect(res.success).toBe(true);
    expect(authService.updateProfile).not.toHaveBeenCalled();
  });

  it('syncPendingProfileUpdate defers if navigator.onLine is false', async () => {
    queuePendingProfileUpdate(mockPayload, mockTenantId);

    const originalOnLine = navigator.onLine;
    try {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const res = await syncPendingProfileUpdate();
      expect(res.success).toBe(false);
      expect(res.deferred).toBe(true);
      expect(authService.updateProfile).not.toHaveBeenCalled();
      expect(hasPendingProfileUpdate()).toBe(true);
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    }
  });

  it('syncPendingProfileUpdate successfully syncs to server and clears queue when online', async () => {
    queuePendingProfileUpdate(mockPayload, mockTenantId);

    const mockAuthResult: authService.AuthResponseDto = {
      tenantId: mockTenantId,
      userId: 'user-test-123',
      email: 'nena@tindahan.ph',
      businessName: 'My Awesome Tindahan',
      ownerName: 'Aling Nena',
      phone: '09181234567',
      role: 'Owner',
      tier: 'Libre',
      planTier: 'Libre',
      subscriptionEndDate: null,
      hasPin: false,
      token: 'jwt-new-token',
      expiresAt: '2028-01-01'
    };

    vi.mocked(authService.updateProfile).mockResolvedValueOnce(mockAuthResult);

    const originalOnLine = navigator.onLine;
    try {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      const res = await syncPendingProfileUpdate();
      expect(res.success).toBe(true);
      expect(authService.updateProfile).toHaveBeenCalledWith(mockPayload);
      expect(hasPendingProfileUpdate()).toBe(false);
      expect(useAuthStore.getState().businessName).toBe('My Awesome Tindahan');
      expect(useAuthStore.getState().ownerName).toBe('Aling Nena');
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    }
  });

  it('clears queue if server responds with non-retryable 403 or 409 error', async () => {
    queuePendingProfileUpdate(mockPayload, mockTenantId);

    vi.mocked(authService.updateProfile).mockRejectedValueOnce({
      response: {
        status: 403,
        data: { message: 'May-ari lamang ang maaaring magpalit ng pangalan ng tindahan.' }
      }
    });

    const originalOnLine = navigator.onLine;
    try {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      const res = await syncPendingProfileUpdate();
      expect(res.success).toBe(false);
      expect(res.deferred).toBeUndefined();
      expect(hasPendingProfileUpdate()).toBe(false);
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    }
  });

  it('retains queued update and increments retryCount on network / server failure', async () => {
    queuePendingProfileUpdate(mockPayload, mockTenantId);

    vi.mocked(authService.updateProfile).mockRejectedValueOnce(new Error('Network offline or gateway timeout'));

    const originalOnLine = navigator.onLine;
    try {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      const res = await syncPendingProfileUpdate();
      expect(res.success).toBe(false);
      expect(res.deferred).toBe(true);
      expect(hasPendingProfileUpdate()).toBe(true);

      const pending = getPendingProfileUpdate();
      expect(pending?.retryCount).toBe(1);
      expect(pending?.lastError).toContain('Network offline');
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    }
  });
});
