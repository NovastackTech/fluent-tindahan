import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getPendingBillingReference,
  setPendingBillingReference,
  clearPendingBillingReference,
  LEGACY_STORAGE_KEY_CHECKOUT_SESSION,
  scheduleExpiry,
  useSubscriptionStore,
  getTierLimits,
  SUBSCRIPTION_REFRESH_ERROR
} from './subscriptionStore';
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
      expect(limits.maxProducts).toBe(30);
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
      expect(store.canAddProduct(29)).toBe(true);
      expect(store.canAddProduct(30)).toBe(false);
      expect(store.canAddProduct(31)).toBe(false);

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

  describe('isUpgradeAllowed', () => {
    it('disallows upgrade for fresh Libre tier when IS_LIBRE_UPGRADE_ENABLED is false', () => {
      useSubscriptionStore.setState({ tier: 'Libre', subscriptionEndDate: null });
      expect(useSubscriptionStore.getState().isUpgradeAllowed()).toBe(false);
    });

    it('allows renewal for lapsed Pro subscriber with Libre tier and existing subscriptionEndDate', () => {
      useSubscriptionStore.setState({ tier: 'Libre', subscriptionEndDate: '2026-01-01T00:00:00Z' });
      expect(useSubscriptionStore.getState().isUpgradeAllowed()).toBe(true);
    });

    it('allows upgrade/renewal for active TindahanPro subscriber', () => {
      useSubscriptionStore.setState({ tier: 'TindahanPro', subscriptionEndDate: new Date(Date.now() + 86400000).toISOString() });
      expect(useSubscriptionStore.getState().isUpgradeAllowed()).toBe(true);
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

  });

  describe('confirmCheckoutSession', () => {
    it('saves sessionId to localStorage on checkout session creation', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: { checkoutUrl: 'https://paymongo.com/pay', sessionId: 'cs_test_999' }
      } as any);

      const url = await useSubscriptionStore.getState().createCheckoutSession('TindahanPro', 'Monthly');

      expect(url).toBe('https://paymongo.com/pay');
      expect(getPendingBillingReference()).toBe('cs_test_999');
    });

    it('confirms checkout session, upgrades tier and clears stored session id', async () => {
      setPendingBillingReference('cs_test_999');
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
      expect(getPendingBillingReference()).toBeNull();
    });

    it('returns true for paid tier even if db.tenants.update rejects', async () => {
      setPendingBillingReference('cs_test_888');
      const newEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: {
          tierName: 'TindahanPro',
          isActive: true,
          subscriptionEndDate: newEndDate,
          daysRemaining: 30
        }
      } as any);

      const dbUpdateSpy = vi.spyOn(db.tenants, 'update').mockRejectedValueOnce(new Error('IndexedDB quota exceeded'));

      const confirmed = await useSubscriptionStore.getState().confirmCheckoutSession();

      expect(confirmed).toBe(true);
      expect(useSubscriptionStore.getState().tier).toBe('TindahanPro');
      expect(useSubscriptionStore.getState().isActive).toBe(true);
      dbUpdateSpy.mockRestore();
    });

    it('clears a verified duplicate payment after a reload', async () => {
      const existingEndDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
      useSubscriptionStore.setState({
        tier: 'TindahanPro',
        subscriptionEndDate: existingEndDate,
        isActive: true
      });
      useAuthStore.getState().setSubscription('TindahanPro', existingEndDate);
      setPendingBillingReference('cs_already_applied');

      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: {
          tierName: 'TindahanPro',
          isActive: true,
          subscriptionEndDate: existingEndDate,
          daysRemaining: 20,
          paymentConfirmed: true
        }
      } as any);

      const confirmed = await useSubscriptionStore.getState().confirmCheckoutSession();

      expect(confirmed).toBe(true);
      expect(getPendingBillingReference()).toBeNull();
    });

    it('generates QR Ph payment intent via /billing/qrph/generate', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: {
          paymentIntentId: 'pi_test_sub',
          paymentMethodId: 'pm_test_sub',
          clientKey: 'ck_test',
          status: 'awaiting_next_action',
          amountCentavos: 12900,
          qrCodeUrl: 'data:image/png;base64,mockqr',
          orderId: 'sub_order_123',
          createdAt: new Date().toISOString()
        }
      } as any);

      const result = await useSubscriptionStore.getState().generateQrPhPayment('TindahanPro', 'Monthly');

      expect(postSpy).toHaveBeenCalledWith('/billing/qrph/generate', {
        targetTier: 1,
        cycle: 1
      });
      expect(result.paymentIntentId).toBe('pi_test_sub');
      expect(result.qrCodeUrl).toBe('data:image/png;base64,mockqr');
    });

    it('checks QR Ph payment status via /billing/qrph/{id}/status', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: {
          paymentIntentId: 'pi_test_sub',
          status: 'succeeded',
          isPaid: true,
          amountCentavos: 12900,
          paymentId: 'pay_123'
        }
      } as any);

      const status = await useSubscriptionStore.getState().checkQrPhStatus('pi_test_sub');

      expect(getSpy).toHaveBeenCalledWith('/billing/qrph/pi_test_sub/status');
      expect(status.isPaid).toBe(true);
      expect(status.paymentId).toBe('pay_123');
    });

    it('confirms QR Ph payment and upgrades subscription tier and end date', async () => {
      const newEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: {
          tier: 'TindahanPro',
          subscriptionEndDate: newEndDate,
          isActive: true
        }
      } as any);

      const success = await useSubscriptionStore.getState().confirmQrPhPayment('pi_test_sub', 'TindahanPro', 'Monthly');

      expect(postSpy).toHaveBeenCalledWith('/billing/qrph/confirm', {
        paymentIntentId: 'pi_test_sub',
        targetTier: 1,
        cycle: 1
      });
      expect(success).toBe(true);
      expect(useSubscriptionStore.getState().tier).toBe('TindahanPro');
      expect(useSubscriptionStore.getState().subscriptionEndDate).toBe(newEndDate);
      expect(useSubscriptionStore.getState().isActive).toBe(true);
    });

    it('applies Libre limits at expiry during an open offline sale without interrupting the cart, and restores Pro on renewal', async () => {
      const { useCartStore } = await import('./cartStore');
      useCartStore.setState({
        items: [{ productId: "prod-1", name: "Pancit Canton", price: 15, qty: 2, subtotal: 30 }]
      });

      const pastEndDate = new Date(Date.now() - 1000).toISOString();
      useAuthStore.setState({ tier: 'TindahanPro', subscriptionEndDate: pastEndDate });
      useSubscriptionStore.setState({ tier: 'TindahanPro', subscriptionEndDate: pastEndDate, isActive: true });

      scheduleExpiry(pastEndDate);

      expect(useSubscriptionStore.getState().tier).toBe('Libre');
      expect(useAuthStore.getState().tier).toBe('Libre');
      expect(useSubscriptionStore.getState().canAddProduct(35)).toBe(false);
      expect(useCartStore.getState().items).toHaveLength(1);

      const renewedEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: {
          tierName: 'TindahanPro',
          subscriptionEndDate: renewedEndDate,
          isActive: true
        }
      } as any);

      const confirmed = await useSubscriptionStore.getState().confirmQrPhPayment('pi_renew_01', 'TindahanPro', 'Monthly');
      expect(confirmed).toBe(true);
      expect(useSubscriptionStore.getState().tier).toBe('TindahanPro');
      expect(useSubscriptionStore.getState().canAddProduct(35)).toBe(true);
      useCartStore.getState().clearCart();
    });

    it('keeps pending QR reference during early renewal until payment is confirmed or expired', async () => {
      const existingEndDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      useAuthStore.setState({ tier: 'TindahanPro', subscriptionEndDate: existingEndDate });
      useSubscriptionStore.setState({ tier: 'TindahanPro', subscriptionEndDate: existingEndDate, isActive: true });
      setPendingBillingReference('pi_early_renew');

      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: {
          tierName: 'TindahanPro',
          isActive: true,
          subscriptionEndDate: existingEndDate,
          daysRemaining: 5
        }
      } as any);
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: {
          paymentIntentId: 'pi_early_renew',
          status: 'awaiting_next_action',
          isPaid: false,
          amountCentavos: 12900
        }
      } as any);

      const confirmedWhilePending = await useSubscriptionStore.getState().confirmCheckoutSession();
      expect(confirmedWhilePending).toBe(false);
      expect(getPendingBillingReference()).toBe('pi_early_renew');

      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: {
          tierName: 'TindahanPro',
          isActive: true,
          subscriptionEndDate: existingEndDate,
          daysRemaining: 5
        }
      } as any);
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: {
          paymentIntentId: 'pi_early_renew',
          status: 'expired',
          isPaid: false,
          amountCentavos: 12900
        }
      } as any);

      const confirmedAfterExpired = await useSubscriptionStore.getState().confirmCheckoutSession();
      expect(confirmedAfterExpired).toBe(false);
      expect(getPendingBillingReference()).toBeNull();
    });

    it('migrates legacy checkout session storage key to tenant-scoped reference', () => {
      localStorage.setItem(LEGACY_STORAGE_KEY_CHECKOUT_SESSION, 'cs_legacy_checkout_123');

      const migrated = getPendingBillingReference();
      expect(migrated).toBe('cs_legacy_checkout_123');
      expect(localStorage.getItem(LEGACY_STORAGE_KEY_CHECKOUT_SESSION)).toBeNull();

      // Subsequent access reads from the new tenant-scoped structure
      expect(getPendingBillingReference()).toBe('cs_legacy_checkout_123');
    });

    it('does not migrate legacy key when another tenant has a pending reference', () => {
      setPendingBillingReference('pi_tenant_one', {
        paymentIntentId: 'pi_tenant_one',
        paymentMethodId: 'pm_one',
        qrCodeUrl: 'data:image/png;base64,mockqr',
        orderId: 'order_one'
      });

      // Switch to a different store/tenant on the same device
      useAuthStore.setState({ tenantId: '00000000-0000-0000-0000-000000000099' });
      localStorage.setItem(LEGACY_STORAGE_KEY_CHECKOUT_SESSION, 'cs_legacy_checkout_456');

      const result = getPendingBillingReference();
      expect(result).toBeNull();
      expect(localStorage.getItem(LEGACY_STORAGE_KEY_CHECKOUT_SESSION)).toBe('cs_legacy_checkout_456');

      // First tenant's pending reference was NOT overwritten
      useAuthStore.setState({ tenantId: DEFAULT_TENANT_ID });
      expect(getPendingBillingReference()).toBe('pi_tenant_one');
    });

    it('clears legacy checkout session key when clearPendingBillingReference is called', () => {
      localStorage.setItem(LEGACY_STORAGE_KEY_CHECKOUT_SESSION, 'cs_legacy_to_clear');
      clearPendingBillingReference('cs_legacy_to_clear');

      expect(localStorage.getItem(LEGACY_STORAGE_KEY_CHECKOUT_SESSION)).toBeNull();
      expect(getPendingBillingReference()).toBeNull();
    });
  });
});
