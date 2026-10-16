import { create } from 'zustand';
import {
  apiClient,
  ensureTenantProvisioned,
  TenantAccountMismatchError,
  TenantProvisioningError
} from '../services/apiClient';
import { db, type PlanTier } from '../db/db';
import { useAuthStore } from './authStore';

export type BillingCycle = 'Weekly' | 'Monthly';
export const SUBSCRIPTION_REFRESH_ERROR = 'SUBSCRIPTION_REFRESH_ERROR';

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
  confirmCheckoutSession: (sessionId?: string) => Promise<boolean>;
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

interface SubscriptionSyncPayload {
  tierName?: PlanTier;
  tier?: number;
  subscriptionEndDate?: string | null;
  businessName?: string;
  isActive?: boolean;
  daysRemaining?: number | null;
}

async function persistAndApplySubscriptionState(
  data: SubscriptionSyncPayload,
  set: (state: Partial<SubscriptionState>) => void
): Promise<PlanTier> {
  const effectiveTier: PlanTier = data.tierName || (data.tier === 1 ? 'TindahanPro' : data.tier === 2 ? 'NegosyoPlus' : 'Libre');
  const endDate = data.subscriptionEndDate || null;

  useAuthStore.getState().setSubscription(effectiveTier, endDate);

  const tenantId = useAuthStore.getState().tenantId;
  if (tenantId) {
    await db.tenants.update(tenantId, {
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

  return effectiveTier;
}

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
      const auth = useAuthStore.getState();
      if (!auth.isOnboardingStatusReady || !auth.isOnboarded || get().isLoading) return;

      set({ isLoading: true, error: null });
      try {
        await ensureTenantProvisioned();
        const response = await apiClient.get('/billing/subscription');
        await persistAndApplySubscriptionState(response.data, set);
      } catch (err) {
        if (err instanceof TenantAccountMismatchError || err instanceof TenantProvisioningError) {
          set({
            isLoading: false,
            error: err.message
          });
          return;
        }

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
          error: SUBSCRIPTION_REFRESH_ERROR
        });
      }
    },

    confirmCheckoutSession: async (sessionId?: string) => {
      const auth = useAuthStore.getState();
      if (!auth.isOnboardingStatusReady || !auth.isOnboarded) return false;

      set({ isLoading: true, error: null });
      try {
        await ensureTenantProvisioned();
        const storedSessionId = sessionId || (typeof window !== 'undefined' ? localStorage.getItem('fluent_last_checkout_session_id') : null);

        const response = await apiClient.post('/billing/confirm-session', {
          sessionId: storedSessionId || undefined
        });

        const effectiveTier = await persistAndApplySubscriptionState(response.data, set);

        if (effectiveTier !== 'Libre' && typeof window !== 'undefined') {
          try {
            localStorage.removeItem('fluent_last_checkout_session_id');
          } catch {
            // Ignore
          }
        }

        return effectiveTier !== 'Libre';
      } catch {
        set({ isLoading: false });
        return false;
      }
    },

    createCheckoutSession: async (targetTier: PlanTier, cycle: BillingCycle) => {
      set({ isLoading: true, error: null });
      try {
        await ensureTenantProvisioned();
        // Redirect URLs are built server-side from configuration (prevents open redirects).
        const response = await apiClient.post('/billing/checkout', {
          targetTier: targetTier === 'TindahanPro' ? 1 : 2,
          cycle: cycle === 'Weekly' ? 0 : 1
        });

        if (response.data?.sessionId && typeof window !== 'undefined') {
          try {
            localStorage.setItem('fluent_last_checkout_session_id', response.data.sessionId);
          } catch {
            // Ignore
          }
        }

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
        await ensureTenantProvisioned();
        const response = await apiClient.post('/billing/mock-pay', {
          targetTier: targetTier === 'TindahanPro' ? 1 : 2,
          cycle: cycle === 'Weekly' ? 0 : 1
        });
        const payment = response.data;
        if (payment?.success === false) {
          throw new Error(payment.message || 'The server rejected the mock payment.');
        }

        const responseTier = typeof payment?.tier === 'string'
          ? payment.tier as PlanTier
          : payment?.tier === 1
            ? 'TindahanPro'
            : payment?.tier === 2
              ? 'NegosyoPlus'
              : targetTier;
        const subscriptionEndDate = payment?.newEndDate || null;
        const auth = useAuthStore.getState();
        auth.setSubscription(responseTier, subscriptionEndDate);

        if (auth.tenantId) {
          const existingTenant = await db.tenants.get(auth.tenantId);
          await db.tenants.put({
            ...existingTenant,
            id: auth.tenantId,
            businessName: existingTenant?.businessName || auth.businessName,
            tier: responseTier,
            subscriptionEndDate: subscriptionEndDate || undefined,
            updatedAt: new Date().toISOString()
          });
        }

        const daysRemaining = subscriptionEndDate
          ? Math.max(0, Math.ceil((Date.parse(subscriptionEndDate) - Date.now()) / (24 * 60 * 60 * 1000)))
          : null;
        set({ isUpgradeModalOpen: false, isLoading: false });
        set({
          tier: responseTier,
          subscriptionEndDate,
          isActive: responseTier !== 'Libre',
          daysRemaining
        });
      } catch (err: any) {
        set({ isLoading: false, error: err?.response?.data?.message || err.message });
        throw err;
      }
    }
  };
});
