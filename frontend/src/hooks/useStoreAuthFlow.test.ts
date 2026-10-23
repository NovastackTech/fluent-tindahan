import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStoreAuthFlow } from './useStoreAuthFlow';
import * as authService from '../services/authService';
import * as storeRegistration from '../services/storeRegistration';
import { useAuthStore } from '../state/authStore';

vi.mock('../services/authService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/authService')>();
  return {
    ...actual,
    verifyEmailOtp: vi.fn(),
    resendEmailOtp: vi.fn()
  };
});

vi.mock('../services/storeRegistration', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/storeRegistration')>();
  return {
    ...actual,
    executeStoreRegistration: vi.fn(),
    executeStoreLogin: vi.fn(),
    processGoogleAuthFlow: vi.fn(),
    finalizeSuccessfulLogin: vi.fn().mockResolvedValue(undefined)
  };
});

vi.mock('../sync/syncEngine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../sync/syncEngine')>();
  return {
    ...actual,
    processSyncQueue: vi.fn().mockResolvedValue({ processed: 0, conflicts: 0, errors: 0 })
  };
});

describe('useStoreAuthFlow hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      isOnboarded: false,
      businessName: '',
      userEmail: '',
      tenantId: 'default-tenant',
      userId: 'default-user',
      hasPin: false
    });
  });

  it('preserves offersGcash: false and forces isNewUser: true upon OTP verification after registration', async () => {
    const mockAuthResult: authService.AuthResponseDto = {
      tenantId: 'otp-tenant-123',
      userId: 'otp-user-456',
      email: 'sari@tindahan.ph',
      businessName: 'Tindahan ni Nanay',
      ownerName: 'Nanay',
      phone: '09171234567',
      role: 'Owner',
      tier: 'Libre',
      planTier: 'Libre',
      subscriptionEndDate: null,
      hasPin: false,
      token: 'otp-token',
      expiresAt: '2028-01-01',
      requiresEmailVerification: true
    };

    vi.mocked(storeRegistration.executeStoreRegistration).mockResolvedValueOnce({
      success: true,
      requiresEmailVerification: true,
      authResult: mockAuthResult
    });

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useStoreAuthFlow({ onSuccess }));

    // 1. Store registration requires email verification with offersGcash = false
    await act(async () => {
      await result.current.handleStoreRegistration({
        businessName: 'Tindahan ni Nanay',
        email: 'sari@tindahan.ph',
        password: 'password123',
        offersGcash: false,
        includeStarterProducts: true
      });
    });

    expect(result.current.pendingOtpEmail).toBe('sari@tindahan.ph');

    // 2. Server verify-email-otp returns isNewUser: false (or omitted)
    const verifiedResponse: authService.AuthResponseDto = {
      ...mockAuthResult,
      requiresEmailVerification: false,
      isNewUser: false // Server default
    };
    vi.mocked(authService.verifyEmailOtp).mockResolvedValueOnce(verifiedResponse);
    vi.spyOn(useAuthStore.getState(), 'loginWithAuthPayload').mockResolvedValueOnce({
      success: true,
      unsyncedCount: 0
    });

    // 3. User submits 6-digit OTP
    await act(async () => {
      const verifySuccess = await result.current.handleVerifyEmailOtp('123456');
      expect(verifySuccess).toBe(true);
    });

    // 4. finalizeSuccessfulLogin must be called with effective isNewUser: true and offerGcash: false
    expect(storeRegistration.finalizeSuccessfulLogin).toHaveBeenCalledWith(
      'otp-tenant-123',
      {
        isNewUser: true,
        businessName: 'Tindahan ni Nanay',
        includeStarterProducts: true,
        offerGcash: false
      }
    );
    expect(onSuccess).toHaveBeenCalledWith(verifiedResponse);
    expect(result.current.pendingOtpEmail).toBeNull();
  });

  it('passes effective isNewUser and preferences into pendingAuthPayload when unsynced local data blocks login', async () => {
    const mockAuthResult: authService.AuthResponseDto = {
      tenantId: 'otp-tenant-unsynced',
      userId: 'otp-user-unsynced',
      email: 'unsynced@tindahan.ph',
      businessName: 'Unsynced Tindahan',
      ownerName: 'Juan',
      phone: '09170000000',
      role: 'Owner',
      tier: 'Libre',
      planTier: 'Libre',
      subscriptionEndDate: null,
      hasPin: true,
      token: 'otp-token-2',
      expiresAt: '2028-01-01',
      requiresEmailVerification: true
    };

    vi.mocked(storeRegistration.executeStoreRegistration).mockResolvedValueOnce({
      success: true,
      requiresEmailVerification: true,
      authResult: mockAuthResult
    });

    const mockLoginSpy = vi.fn().mockResolvedValueOnce({
      success: false,
      unsyncedCount: 5
    });
    useAuthStore.setState({ loginWithAuthPayload: mockLoginSpy });

    const { result } = renderHook(() => useStoreAuthFlow());

    await act(async () => {
      await result.current.handleStoreRegistration({
        businessName: 'Unsynced Tindahan',
        email: 'unsynced@tindahan.ph',
        pin: '1234',
        offersGcash: false,
        includeStarterProducts: false
      });
    });

    vi.mocked(authService.verifyEmailOtp).mockResolvedValueOnce({
      ...mockAuthResult,
      requiresEmailVerification: false,
      isNewUser: false
    });

    await act(async () => {
      await result.current.handleVerifyEmailOtp('654321');
    });

    expect(result.current.isUnsyncedDialogOpen).toBe(true);
    expect(result.current.unsyncedLoginCount).toBe(5);
    expect(result.current.pendingAuthPayload).toEqual({
      payload: expect.objectContaining({
        tenantId: 'otp-tenant-unsynced',
        isNewUser: true,
        businessName: 'Unsynced Tindahan'
      }),
      localPin: '1234',
      newUserPreferences: {
        offerGcash: false,
        includeStarterProducts: false
      }
    });
  });
});
