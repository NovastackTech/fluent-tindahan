import { create } from 'zustand';
import { apiClient } from '../services/apiClient';
import { db, type PlanTier } from '../db/db';
import { useAuthStore } from './authStore';

export type BillingCycle = 'Weekly' | 'Monthly';

/**
 * Mock payments exist only in Vite dev builds. In production bundles this is statically `false`,
 * so the mock UI and code path are tree-shaken out and can never unlock paid tiers on the counter.
 */
export const IS_MOCK_PAYMENT_ENABLED = import.meta.env.DEV;

export interface TierLimits {
  maxProducts: number;
  maxCustomers: number;
  maxGCashTransactionsPerMonth: number;
  maxUsers: number;
  maxDevices: number;
  canImportCsv: boolean;
  hasWatermarkedReceipts: boolean;
  hasProfitAnalytics: boolean;
  hasAuditLogs: boolean;
}

export interface SubscriptionState {
  tier: PlanTier;
  subscriptionEndDate: string | null;
  isActive: boolean;
  daysRemaining: number | null;
  isLoading: boolean;
  error: string | null;
  isUpgradeModalOpen: boolean;

  // Actions
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
  getLimits: () => TierLimits;
  canAddProduct: (currentCount: number) => boolean;
  canAddCustomer: (currentCount: number) => boolean;
  canAddGCashTxn: (monthlyCount: number) => boolean;
  refreshSubscription: () => Promise<void>;
  createCheckoutSession: (targetTier: PlanTier, cycle: BillingCycle) => Promise<string>;
  simulateMockPayment: (targetTier: PlanTier, cycle: BillingCycle) => Promise<void>;
}

export const getTierLimits = (tier: PlanTier): TierLimits => {
  switch (tier) {
    case 'TindahanPro':
      return {
        maxProducts: Infinity,
        maxCustomers: Infinity,
        maxGCashTransactionsPerMonth: Infinity,
        maxUsers: 1,
        maxDevices: 2,
        canImportCsv: true,
        hasWatermarkedReceipts: false,
        hasProfitAnalytics: true,
        hasAuditLogs: false
      };
    case 'NegosyoPlus':
      return {
        maxProducts: Infinity,
        maxCustomers: Infinity,
        maxGCashTransactionsPerMonth: Infinity,
        maxUsers: 5,
        maxDevices: 4,
        canImportCsv: true,
        hasWatermarkedReceipts: false,
        hasProfitAnalytics: true,
        hasAuditLogs: true
      };
    case 'Libre':
    default:
      return {
        maxProducts: 50,
        maxCustomers: 30,
        maxGCashTransactionsPerMonth: 30,
        maxUsers: 1,
        maxDevices: 1,
        canImportCsv: false,
        hasWatermarkedReceipts: true,
        hasProfitAnalytics: false,
        hasAuditLogs: false
      };
  }
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => {
  const currentTier = useAuthStore.getState().tier || 'Libre';
  const currentEndDate = useAuthStore.getState().subscriptionEndDate;

  return {
    tier: currentTier,
    subscriptionEndDate: currentEndDate,
    isActive: currentTier !== 'Libre',
    daysRemaining: null,
    isLoading: false,
    error: null,
    isUpgradeModalOpen: false,

    openUpgradeModal: () => set({ isUpgradeModalOpen: true }),
    closeUpgradeModal: () => set({ isUpgradeModalOpen: false }),

    getLimits: () => getTierLimits(get().tier),

    canAddProduct: (currentCount: number) => {
      const limits = getTierLimits(get().tier);
      return currentCount < limits.maxProducts;
    },

    canAddCustomer: (currentCount: number) => {
      const limits = getTierLimits(get().tier);
      return currentCount < limits.maxCustomers;
    },

    canAddGCashTxn: (monthlyCount: number) => {
      const limits = getTierLimits(get().tier);
      return monthlyCount < limits.maxGCashTransactionsPerMonth;
    },

    refreshSubscription: async () => {
      set({ isLoading: true, error: null });
      try {
        const response = await apiClient.get('/billing/subscription');
        const data = response.data;

        const effectiveTier: PlanTier = data.tierName || (data.tier === 1 ? 'TindahanPro' : data.tier === 2 ? 'NegosyoPlus' : 'Libre');
        const endDate = data.subscriptionEndDate || null;

        // Update authStore & localStorage
        useAuthStore.getState().setSubscription(effectiveTier, endDate);

        // Update Dexie tenant table
        const tenantId = useAuthStore.getState().tenantId;
        if (tenantId) {
          await db.tenants.put({
            id: tenantId,
            businessName: data.businessName || useAuthStore.getState().businessName,
            tier: effectiveTier,
            subscriptionEndDate: endDate || undefined,
            updatedAt: new Date().toISOString()
          });
        }

        set({
          tier: effectiveTier,
          subscriptionEndDate: endDate,
          isActive: data.isActive,
          daysRemaining: data.daysRemaining,
          isLoading: false
        });
      } catch (err: any) {
        // In offline mode, read from Dexie or authStore
        const fallbackTier = useAuthStore.getState().tier || 'Libre';
        const fallbackEndDate = useAuthStore.getState().subscriptionEndDate;

        // Check if expired offline
        const now = new Date();
        const isExpired = fallbackEndDate ? new Date(fallbackEndDate) < now : false;
        const effective = isExpired ? 'Libre' : fallbackTier;

        set({
          tier: effective,
          subscriptionEndDate: fallbackEndDate,
          isActive: effective !== 'Libre',
          isLoading: false,
          error: err?.message || 'Unable to refresh subscription online.'
        });
      }
    },

    createCheckoutSession: async (targetTier: PlanTier, cycle: BillingCycle) => {
      set({ isLoading: true, error: null });
      try {
        // Redirect URLs are built server-side from configuration (prevents open redirects).
        const response = await apiClient.post('/billing/checkout', {
          targetTier: targetTier === 'TindahanPro' ? 1 : 2,
          cycle: cycle === 'Weekly' ? 0 : 1
        });

        set({ isLoading: false });
        return response.data.checkoutUrl;
      } catch (err: any) {
        set({ isLoading: false, error: err?.response?.data?.message || err.message });
        throw err;
      }
    },

    simulateMockPayment: async (targetTier: PlanTier, cycle: BillingCycle) => {
      if (!IS_MOCK_PAYMENT_ENABLED) {
        throw new Error('Mock payments are only available in development builds.');
      }

      set({ isLoading: true, error: null });
      try {
        try {
          await apiClient.post('/billing/mock-pay', {
            targetTier: targetTier === 'TindahanPro' ? 1 : 2,
            cycle: cycle === 'Weekly' ? 0 : 1
          });
          await get().refreshSubscription();
        } catch (apiErr) {
          // In development environments without a live backend (e.g. offline dev or unit tests),
          // simulate the upgrade locally so dev workflow and tests continue working.
          console.warn('[subscriptionStore] /billing/mock-pay endpoint unreachable or failed; applying local mock upgrade for development.', apiErr);
          const durationDays = cycle === 'Weekly' ? 7 : 30;
          const newEndDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

          useAuthStore.getState().setSubscription(targetTier, newEndDate);
          const tenantId = useAuthStore.getState().tenantId;
          if (tenantId) {
            await db.tenants.put({
              id: tenantId,
              businessName: useAuthStore.getState().businessName,
              tier: targetTier,
              subscriptionEndDate: newEndDate,
              updatedAt: new Date().toISOString()
            });
          }

          set({
            tier: targetTier,
            subscriptionEndDate: newEndDate,
            isActive: true,
            daysRemaining: durationDays,
            isLoading: false
          });
        }
        set({ isUpgradeModalOpen: false });
      } catch (err: any) {
        set({ isLoading: false, error: err?.response?.data?.message || err.message });
        throw err;
      }
    }
  };
});
