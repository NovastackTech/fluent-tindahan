import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSubscriptionStore, getTierLimits, SUBSCRIPTION_REFRESH_ERROR } from './subscriptionStore';
import { useAuthStore } from './authStore';
import { db } from '../db/db';
import { apiClient } from '../services/apiClient';

describe('subscriptionStore', () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.tenants.clear();
    useAuthStore.setState({
      tier: 'Libre',
      subscriptionEndDate: null
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

  describe('simulateMockPayment', () => {
    it('upgrades tier locally to TindahanPro with future expiration', async () => {
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
      const localTenant = await db.tenants.get(useAuthStore.getState().tenantId);
      expect(localTenant?.tier).toBe('TindahanPro');
    });

    it('upgrades tier locally to NegosyoPlus for weekly cycle', async () => {
      const store = useSubscriptionStore.getState();
      await store.simulateMockPayment('NegosyoPlus', 'Weekly');

      const updated = useSubscriptionStore.getState();
      expect(updated.tier).toBe('NegosyoPlus');
      expect(updated.isActive).toBe(true);
      expect(updated.daysRemaining).toBeLessThanOrEqual(7);
      expect(useAuthStore.getState().tier).toBe('NegosyoPlus');
    });
  });
});
