import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSubscriptionStore, getTierLimits, SUBSCRIPTION_REFRESH_ERROR } from './subscriptionStore';
import { useAuthStore } from './authStore';
import { db } from '../db/db';
import { apiClient, TenantProvisioningError } from '../services/apiClient';
import { DEFAULT_TENANT_ID } from '../db/seedData';

describe('subscriptionStore', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await db.tenants.clear();
    useAuthStore.setState({
      tenantId: DEFAULT_TENANT_ID,
      tier: 'Libre',
      subscriptionEndDate: null,
      isOnboarded: true,
      isOnboardingStatusReady: true
    });
    useSubscriptionStore.setState({
      tier: 'Libre',
      subscriptionEndDate: null,
      isActive: false,
      daysRemaining: null,
      isLoading: false,
      error: null,
      isUpgradeModalOpen: false
    });
    vi.spyOn(apiClient, 'put').mockImplementation(async () => ({
      data: { tenantId: useAuthStore.getState().tenantId }
    } as any));
  });

  describe('getTierLimits', () => {
    it('returns strict limits for Libre tier', () => {
      const limits = getTierLimits('Libre');
      expect(limits.maxProducts).toBe(50);
      expect(limits.maxCustomers).toBe(30);
      expect(limits.maxGCashTransactionsPerMonth).toBe(30);
      expect(limits.canImportCsv).toBe(false);
      expect(limits.hasWatermarkedReceipts).toBe(true);
      expect(limits.maxUsers).toBe(1);
      expect(limits.maxDevices).toBe(1);
    });

    it('returns unlimited capacity for TindahanPro tier', () => {
      const limits = getTierLimits('TindahanPro');
      expect(limits.maxProducts).toBe(Infinity);
      expect(limits.maxCustomers).toBe(Infinity);
      expect(limits.maxGCashTransactionsPerMonth).toBe(Infinity);
      expect(limits.canImportCsv).toBe(true);
      expect(limits.hasWatermarkedReceipts).toBe(false);
      expect(limits.maxUsers).toBe(1);
      expect(limits.maxDevices).toBe(2);
    });

    it('returns multi-user enterprise limits for NegosyoPlus tier', () => {
      const limits = getTierLimits('NegosyoPlus');
      expect(limits.maxProducts).toBe(Infinity);
      expect(limits.maxCustomers).toBe(Infinity);
      expect(limits.maxGCashTransactionsPerMonth).toBe(Infinity);
      expect(limits.canImportCsv).toBe(true);
      expect(limits.hasWatermarkedReceipts).toBe(false);
      expect(limits.maxUsers).toBe(5);
      expect(limits.maxDevices).toBe(4);
      expect(limits.hasAuditLogs).toBe(true);
    });
  });

  describe('allowance guards', () => {
    it('guards product additions based on tier', () => {
      const store = useSubscriptionStore.getState();
      expect(store.canAddProduct(49)).toBe(true);
      expect(store.canAddProduct(50)).toBe(false);
      expect(store.canAddProduct(51)).toBe(false);

      useSubscriptionStore.setState({ tier: 'TindahanPro' });
      expect(useSubscriptionStore.getState().canAddProduct(1000)).toBe(true);
    });

    it('guards debtor additions based on tier', () => {
      const store = useSubscriptionStore.getState();
      expect(store.canAddCustomer(29)).toBe(true);
      expect(store.canAddCustomer(30)).toBe(false);
      expect(store.canAddCustomer(31)).toBe(false);

      useSubscriptionStore.setState({ tier: 'TindahanPro' });
      expect(useSubscriptionStore.getState().canAddCustomer(100)).toBe(true);
    });

    it('guards monthly GCash transactions based on tier', () => {
      const store = useSubscriptionStore.getState();
      expect(store.canAddGCashTxn(29)).toBe(true);
      expect(store.canAddGCashTxn(30)).toBe(false);
      expect(store.canAddGCashTxn(50)).toBe(false);

      useSubscriptionStore.setState({ tier: 'NegosyoPlus' });
      expect(useSubscriptionStore.getState().canAddGCashTxn(500)).toBe(true);
    });
  });

  describe('modal state', () => {
    it('opens and closes upgrade modal', () => {
      const store = useSubscriptionStore.getState();
      expect(store.isUpgradeModalOpen).toBe(false);

      store.openUpgradeModal();
      expect(useSubscriptionStore.getState().isUpgradeModalOpen).toBe(true);

      store.closeUpgradeModal();
      expect(useSubscriptionStore.getState().isUpgradeModalOpen).toBe(false);
    });
  });

  it('preserves the saved tier and uses a non-raw fallback when subscription refresh fails', async () => {
    useAuthStore.setState({ tier: 'TindahanPro' });
    useSubscriptionStore.setState({ tier: 'TindahanPro' });
    const getSpy = vi.spyOn(apiClient, 'get').mockRejectedValueOnce(
      new Error('Request failed with status code 500')
    );

    await useSubscriptionStore.getState().refreshSubscription();

    expect(useSubscriptionStore.getState().tier).toBe('TindahanPro');
    expect(useSubscriptionStore.getState().isLoading).toBe(false);
    expect(useSubscriptionStore.getState().error).toBe(SUBSCRIPTION_REFRESH_ERROR);
    expect(useSubscriptionStore.getState().error).not.toContain('500');
    getSpy.mockRestore();
  });

  it('surfaces a provisioning conflict instead of treating it as an offline refresh', async () => {
    useAuthStore.setState({
      tenantId: crypto.randomUUID(),
      locallyCreatedTenantId: null,
      serverConfirmedTenantId: null,
      serverConfirmedUserId: null
    });
    vi.spyOn(apiClient, 'put').mockRejectedValueOnce({ response: { status: 409 } });

    await useSubscriptionStore.getState().refreshSubscription();

    expect(useSubscriptionStore.getState().error).toBe(new TenantProvisioningError(409).message);
    expect(useSubscriptionStore.getState().error).not.toBe(SUBSCRIPTION_REFRESH_ERROR);
    expect(useSubscriptionStore.getState().isLoading).toBe(false);
  });

  it('restores a paid tier from the server after reload', async () => {
    const subscriptionEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await db.tenants.put({
      id: DEFAULT_TENANT_ID,
      businessName: 'My Store',
      tier: 'Libre',
      updatedAt: new Date().toISOString()
    });
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        tier: 1,
        tierName: 'TindahanPro',
        subscriptionEndDate,
        isActive: true,
        daysRemaining: 30,
        businessName: 'My Store'
      }
    } as any);

    await useSubscriptionStore.getState().refreshSubscription();

    expect(useSubscriptionStore.getState().tier).toBe('TindahanPro');
    expect(useAuthStore.getState().tier).toBe('TindahanPro');
    expect(localStorage.getItem('fluent_tindahan_tier_v1')).toBe('TindahanPro');
    expect((await db.tenants.get(DEFAULT_TENANT_ID))?.tier).toBe('TindahanPro');
    expect((await db.tenants.get(DEFAULT_TENANT_ID))?.businessName).toBe('My Store');
    getSpy.mockRestore();
  });

  it('updates a tenant row only when one already exists', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        tierName: 'Libre',
        isActive: false,
        daysRemaining: null,
        businessName: 'My Store'
      }
    } as any);

    await useSubscriptionStore.getState().refreshSubscription();

    expect(await db.tenants.get(DEFAULT_TENANT_ID)).toBeUndefined();
  });

  it('does not refresh or provision before onboarding is resolved', async () => {
    useAuthStore.setState({
      isOnboarded: false,
      isOnboardingStatusReady: false
    });
    const getSpy = vi.spyOn(apiClient, 'get');
    const putSpy = vi.spyOn(apiClient, 'put');

    await useSubscriptionStore.getState().refreshSubscription();

    expect(getSpy).not.toHaveBeenCalled();
    expect(putSpy).not.toHaveBeenCalled();
    expect(useSubscriptionStore.getState().isLoading).toBe(false);
  });

  describe('simulateMockPayment', () => {
    it('does not report a local upgrade when the server rejects mock payment', async () => {
      const serverError = {
        response: {
          status: 404,
          data: { message: 'Mock payments are disabled on this server.' }
        }
      };
      const postSpy = vi.spyOn(apiClient, 'post').mockRejectedValueOnce(serverError);

      await expect(
        useSubscriptionStore.getState().simulateMockPayment('TindahanPro', 'Monthly')
      ).rejects.toBe(serverError);

      expect(useAuthStore.getState().tier).toBe('Libre');
      expect(useSubscriptionStore.getState().tier).toBe('Libre');
      expect(useSubscriptionStore.getState().error).toBe('Mock payments are disabled on this server.');
      postSpy.mockRestore();
    });

    it('upgrades tier locally to TindahanPro with future expiration', async () => {
      const newEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: { success: true, tier: 1, newEndDate }
      } as any);
      const store = useSubscriptionStore.getState();
      await store.simulateMockPayment('TindahanPro', 'Monthly');

      const updated = useSubscriptionStore.getState();
      expect(updated.tier).toBe('TindahanPro');
      expect(updated.isActive).toBe(true);
      expect(updated.subscriptionEndDate).toBeDefined();
      expect(updated.daysRemaining).toBeGreaterThan(25);
      expect(updated.isUpgradeModalOpen).toBe(false);

      // Verify synced with authStore and Dexie
      expect(useAuthStore.getState().tier).toBe('TindahanPro');
      expect(localStorage.getItem('fluent_tindahan_tier_v1')).toBe('TindahanPro');
      const localTenant = await db.tenants.get(useAuthStore.getState().tenantId);
      expect(localTenant?.tier).toBe('TindahanPro');
    });

    it('upgrades tier locally to NegosyoPlus for weekly cycle', async () => {
      const newEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: { success: true, tier: 2, newEndDate }
      } as any);
      const store = useSubscriptionStore.getState();
      await store.simulateMockPayment('NegosyoPlus', 'Weekly');

      const updated = useSubscriptionStore.getState();
      expect(updated.tier).toBe('NegosyoPlus');
      expect(updated.isActive).toBe(true);
      expect(updated.daysRemaining).toBeLessThanOrEqual(7);
      expect(useAuthStore.getState().tier).toBe('NegosyoPlus');
    });
  });

  describe('confirmCheckoutSession', () => {
    it('saves sessionId to localStorage on checkout session creation', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: { checkoutUrl: 'https://paymongo.com/pay', sessionId: 'cs_test_999' }
      } as any);

      const url = await useSubscriptionStore.getState().createCheckoutSession('TindahanPro', 'Monthly');

      expect(url).toBe('https://paymongo.com/pay');
      expect(localStorage.getItem('fluent_last_checkout_session_id')).toBe('cs_test_999');
    });

    it('confirms checkout session, upgrades tier and clears stored session id', async () => {
      localStorage.setItem('fluent_last_checkout_session_id', 'cs_test_999');
      const newEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: {
          tierName: 'TindahanPro',
          isActive: true,
          subscriptionEndDate: newEndDate,
          daysRemaining: 30
        }
      } as any);

      const confirmed = await useSubscriptionStore.getState().confirmCheckoutSession();

      expect(confirmed).toBe(true);
      expect(postSpy).toHaveBeenCalledWith('/billing/confirm-session', {
        sessionId: 'cs_test_999'
      });
      expect(useSubscriptionStore.getState().tier).toBe('TindahanPro');
      expect(useSubscriptionStore.getState().subscriptionEndDate).toBe(newEndDate);
      expect(localStorage.getItem('fluent_last_checkout_session_id')).toBeNull();
    });
  });
});
