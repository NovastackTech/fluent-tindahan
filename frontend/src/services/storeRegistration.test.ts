import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  executeStoreRegistration,
  executeStoreLogin,
  executeGoogleAuth,
  finalizeSuccessfulLogin
} from './storeRegistration';
import * as authService from './authService';
import * as seedData from '../db/seedData';
import * as syncEngine from '../sync/syncEngine';
import { useAuthStore } from '../state/authStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { useGCashFeeStore } from '../state/gcashFeeStore';

vi.mock('./authService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./authService')>();
  return {
    ...actual,
    registerStore: vi.fn().mockResolvedValue({
      tenantId: 'mock-registered-tenant',
      userId: 'mock-registered-user',
      email: 'sari@tindahan.ph',
      businessName: 'Bagong Tindahan',
      ownerName: 'Nanay Coring',
      phone: '09171234567',
      role: 'Owner',
      tier: 'Libre',
      planTier: 'Libre',
      subscriptionEndDate: null,
      hasPin: false,
      token: 'mock-token',
      expiresAt: '2028-01-01'
    }),
    loginStore: vi.fn().mockResolvedValue({
      tenantId: 'mock-login-tenant',
      userId: 'mock-login-user',
      email: 'owner@tindahan.ph',
      businessName: 'Sari-Sari Store Ni Juan',
      ownerName: 'Juan Dela Cruz',
      phone: '09179876543',
      role: 'Owner',
      tier: 'Libre',
      planTier: 'Libre',
      subscriptionEndDate: null,
      hasPin: false,
      token: 'mock-login-token',
      expiresAt: '2028-01-01'
    }),
    loginPin: vi.fn().mockResolvedValue({
      tenantId: 'mock-pin-tenant',
      userId: 'mock-pin-user',
      email: 'pin@tindahan.ph',
      businessName: 'PIN Sari-Sari Store',
      ownerName: 'Maria Santos',
      phone: '09181112233',
      role: 'Owner',
      tier: 'Libre',
      planTier: 'Libre',
      subscriptionEndDate: null,
      hasPin: true,
      token: 'mock-pin-token',
      expiresAt: '2028-01-01'
    }),
    authenticateWithGoogle: vi.fn().mockResolvedValue({
      tenantId: 'mock-google-tenant',
      userId: 'mock-google-user',
      email: 'google@tindahan.ph',
      businessName: 'Google Tindahan',
      ownerName: 'Google User',
      phone: '',
      role: 'Owner',
      tier: 'Libre',
      planTier: 'Libre',
      subscriptionEndDate: null,
      hasPin: false,
      token: 'mock-google-token',
      expiresAt: '2028-01-01',
      isNewUser: true
    })
  };
});

vi.mock('../db/seedData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../db/seedData')>();
  return {
    ...actual,
    seedDexieDatabaseIfNeeded: vi.fn().mockResolvedValue(true)
  };
});

vi.mock('../sync/syncEngine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../sync/syncEngine')>();
  return {
    ...actual,
    updateQueueCounts: vi.fn().mockResolvedValue(undefined),
    kickSync: vi.fn().mockResolvedValue(undefined),
    pullCatalogFromServer: vi.fn().mockResolvedValue(undefined),
    restoreTenantDataFromServer: vi.fn().mockResolvedValue(undefined),
    processSyncQueue: vi.fn().mockResolvedValue(undefined)
  };
});

describe('storeRegistration services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      isOnboarded: false,
      businessName: '',
      userEmail: '',
      tenantId: 'default-store',
      userId: 'default-user',
      hasPin: false
    });
  });

  describe('executeStoreRegistration', () => {
    it('successfully registers store, seeds database, and updates store state', async () => {
      const result = await executeStoreRegistration({
        businessName: 'Tindahan ni Juan',
        email: 'juan@tindahan.ph',
        password: 'password123',
        pin: '1234',
        offerGcash: true,
        includeStarterProducts: true
      });

      expect(result.success).toBe(true);
      expect(seedData.seedDexieDatabaseIfNeeded).toHaveBeenCalled();
      expect(authService.registerStore).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'juan@tindahan.ph',
          businessName: 'Tindahan ni Juan'
        })
      );
      expect(useAuthStore.getState().isOnboarded).toBe(true);
      expect(useSubscriptionStore.getState().tier).toBe('Libre');
      expect(syncEngine.updateQueueCounts).toHaveBeenCalled();
      expect(syncEngine.kickSync).toHaveBeenCalled();
    });

    it('returns emailAlreadyExists when server responds with 409', async () => {
      vi.mocked(authService.registerStore).mockRejectedValueOnce({
        response: { status: 409 }
      });

      const result = await executeStoreRegistration({
        businessName: 'Tindahan ni Juan',
        email: 'existing@tindahan.ph',
        password: 'password123'
      });

      expect(result.success).toBe(false);
      expect(result.emailAlreadyExists).toBe(true);
    });

    it('falls back to local registration when server is unreachable', async () => {
      vi.mocked(authService.registerStore).mockRejectedValueOnce(new Error('Network error'));

      const result = await executeStoreRegistration({
        businessName: 'Offline Store',
        email: 'offline@tindahan.ph',
        password: 'password123'
      });

      expect(result.success).toBe(true);
      expect(useAuthStore.getState().isOnboarded).toBe(true);
    });

    it('configures zero GCash fees when offerGcash is false', async () => {
      const setFeeSpy = vi.spyOn(useGCashFeeStore.getState(), 'setFeeForTenant');

      await executeStoreRegistration({
        businessName: 'No GCash Store',
        email: 'nogcash@tindahan.ph',
        password: 'password123',
        offerGcash: false
      });

      expect(setFeeSpy).toHaveBeenCalled();
      const feeCalls = setFeeSpy.mock.calls;
      expect(feeCalls.every(([, , fee]) => fee === 0)).toBe(true);
    });
  });

  describe('executeStoreLogin', () => {
    it('executes password login and finalizes successfully', async () => {
      const result = await executeStoreLogin({
        email: 'owner@tindahan.ph',
        loginMode: 'password',
        password: 'password123'
      });

      expect(result.success).toBe(true);
      expect(authService.loginStore).toHaveBeenCalledWith({
        email: 'owner@tindahan.ph',
        password: 'password123'
      });
      expect(useAuthStore.getState().isOnboarded).toBe(true);
    });

    it('executes PIN login and finalizes successfully', async () => {
      const result = await executeStoreLogin({
        email: 'pin@tindahan.ph',
        loginMode: 'pin',
        pin: '1234'
      });

      expect(result.success).toBe(true);
      expect(authService.loginPin).toHaveBeenCalledWith({
        email: 'pin@tindahan.ph',
        pin: '1234'
      });
      expect(useAuthStore.getState().isOnboarded).toBe(true);
    });

    it('returns unsyncedCount if login payload has unsynced local data and forceWipe is false', async () => {
      vi.spyOn(useAuthStore.getState(), 'loginWithAuthPayload').mockResolvedValueOnce({
        success: false,
        unsyncedCount: 5
      });

      const result = await executeStoreLogin({
        email: 'owner@tindahan.ph',
        loginMode: 'password',
        password: 'password123'
      });

      expect(result.success).toBe(false);
      expect(result.unsyncedCount).toBe(5);
      expect(result.authResult).toBeDefined();
    });
  });

  describe('executeGoogleAuth', () => {
    it('authenticates new Google user, seeds database and sets GCash fees', async () => {
      const setFeeSpy = vi.spyOn(useGCashFeeStore.getState(), 'setFeeForTenant');

      const result = await executeGoogleAuth({
        accessToken: 'valid-google-access-token',
        businessName: 'Google Store',
        pin: '1234',
        offerGcash: true,
        includeStarterProducts: true
      });

      expect(result.success).toBe(true);
      expect(authService.authenticateWithGoogle).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'valid-google-access-token',
          businessName: 'Google Store',
          pin: '1234'
        })
      );
      expect(seedData.seedDexieDatabaseIfNeeded).toHaveBeenCalledWith(
        false,
        'mock-google-tenant',
        false,
        'Google Tindahan'
      );
      expect(setFeeSpy).toHaveBeenCalled();
      expect(syncEngine.restoreTenantDataFromServer).toHaveBeenCalled();
      expect(useAuthStore.getState().isOnboarded).toBe(true);
    });

    it('authenticates existing Google user without reseeding Dexie database', async () => {
      vi.mocked(authService.authenticateWithGoogle).mockResolvedValueOnce({
        tenantId: 'existing-google-tenant',
        userId: 'existing-google-user',
        email: 'existing@google.ph',
        businessName: 'Existing Google Store',
        ownerName: 'Existing User',
        phone: '',
        role: 'Owner',
        tier: 'Libre',
        planTier: 'Libre',
        subscriptionEndDate: null,
        hasPin: true,
        token: 'existing-token',
        expiresAt: '2028-01-01',
        isNewUser: false
      });

      const result = await executeGoogleAuth({
        accessToken: 'existing-token'
      });

      expect(result.success).toBe(true);
      expect(seedData.seedDexieDatabaseIfNeeded).not.toHaveBeenCalled();
      expect(syncEngine.restoreTenantDataFromServer).toHaveBeenCalled();
      expect(useAuthStore.getState().isOnboarded).toBe(true);
    });

    it('returns unsyncedCount and newUserPreferences when local unsynced mutations block login', async () => {
      vi.spyOn(useAuthStore.getState(), 'loginWithAuthPayload').mockResolvedValueOnce({
        success: false,
        unsyncedCount: 3
      });

      const result = await executeGoogleAuth({
        accessToken: 'valid-token',
        businessName: 'Google Unsynced Store',
        offerGcash: false,
        includeStarterProducts: false
      });

      expect(result.success).toBe(false);
      expect(result.unsyncedCount).toBe(3);
      expect(result.authResult).toBeDefined();
      expect(result.newUserPreferences).toEqual({
        offerGcash: false,
        includeStarterProducts: false
      });
    });
  });

  describe('finalizeSuccessfulLogin', () => {
    it('restores tenant data from server and triggers queue sync', async () => {
      await finalizeSuccessfulLogin('mock-tenant-id');

      expect(seedData.seedDexieDatabaseIfNeeded).not.toHaveBeenCalled();
      expect(syncEngine.restoreTenantDataFromServer).toHaveBeenCalled();
      expect(syncEngine.processSyncQueue).toHaveBeenCalled();
    });

    it('seeds Dexie database and configures zero GCash fees when isNewUser is true and offerGcash is false', async () => {
      const setFeeSpy = vi.spyOn(useGCashFeeStore.getState(), 'setFeeForTenant');

      await finalizeSuccessfulLogin('mock-new-tenant', {
        isNewUser: true,
        businessName: 'My New Google Store',
        includeStarterProducts: true,
        offerGcash: false
      });

      expect(seedData.seedDexieDatabaseIfNeeded).toHaveBeenCalledWith(
        false,
        'mock-new-tenant',
        false,
        'My New Google Store'
      );
      expect(setFeeSpy).toHaveBeenCalled();
      const feeCalls = setFeeSpy.mock.calls;
      expect(feeCalls.every(([, , fee]) => fee === 0)).toBe(true);
      expect(syncEngine.restoreTenantDataFromServer).toHaveBeenCalled();
    });

    it('seeds Dexie database without starter products when includeStarterProducts is false', async () => {
      await finalizeSuccessfulLogin('mock-new-tenant-empty', {
        isNewUser: true,
        businessName: 'Empty Store',
        includeStarterProducts: false,
        offerGcash: true
      });

      expect(seedData.seedDexieDatabaseIfNeeded).toHaveBeenCalledWith(
        false,
        'mock-new-tenant-empty',
        true,
        'Empty Store'
      );
    });
  });
});
