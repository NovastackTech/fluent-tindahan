import { create } from 'zustand';
import {
  apiClient,
  ensureTenantProvisioned,
  SessionReauthRequiredError,
  TenantAccountMismatchError,
  TenantProvisioningError
} from '../services/apiClient';
import { db, type PlanTier } from '../db/db';
import { useAuthStore } from './authStore';
import { useLanguageStore } from './languageStore';
import { getLocalizedSyncErrorMessage } from '../utils/syncErrors';

export type BillingCycle = 'Monthly';
export const SUBSCRIPTION_REFRESH_ERROR = 'SUBSCRIPTION_REFRESH_ERROR';
export const LEGACY_STORAGE_KEY_CHECKOUT_SESSION = 'fluent_last_checkout_session_id';
const PENDING_BILLING_REFERENCE_KEY = 'fluent_pending_billing_reference';

interface PendingBillingReference {
  tenantId: string;
  id: string;
  qrPayment?: PendingQrPhPayment;
}

export interface PendingQrPhPayment {
  paymentIntentId: string;
  paymentMethodId: string;
  qrCodeUrl: string;
  orderId: string;
}

export const getPendingBillingReference = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PENDING_BILLING_REFERENCE_KEY);
    const tenantId = useAuthStore.getState().tenantId;
    if (raw) {
      const pending = JSON.parse(raw) as PendingBillingReference;
      if (pending.tenantId === tenantId) {
        return pending.id;
      }
    }
    const legacySessionId = localStorage.getItem(LEGACY_STORAGE_KEY_CHECKOUT_SESSION);
    if (legacySessionId && tenantId && !raw) {
      setPendingBillingReference(legacySessionId);
      localStorage.removeItem(LEGACY_STORAGE_KEY_CHECKOUT_SESSION);
      return legacySessionId;
    }
    return null;
  } catch {
    return null;
  }
};

export const getPendingQrPhPayment = (): PendingQrPhPayment | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PENDING_BILLING_REFERENCE_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as PendingBillingReference;
    return pending.tenantId === useAuthStore.getState().tenantId && pending.qrPayment?.paymentIntentId === pending.id
      ? pending.qrPayment
      : null;
  } catch {
    return null;
  }
};

export const setPendingBillingReference = (id: string, qrPayment?: PendingQrPhPayment): void => {
  const tenantId = useAuthStore.getState().tenantId;
  if (!tenantId || typeof window === 'undefined') return;
  localStorage.setItem(PENDING_BILLING_REFERENCE_KEY, JSON.stringify({ tenantId, id, qrPayment }));
};

export const clearPendingBillingReference = (expectedId?: string): void => {
  if (typeof window === 'undefined') return;
  if (!expectedId || getPendingBillingReference() === expectedId) {
    localStorage.removeItem(PENDING_BILLING_REFERENCE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY_CHECKOUT_SESSION);
  }
};

/**
 * Mock payments exist only in Vite dev builds. In production bundles this is statically `false`,
 * so the mock UI and code path are tree-shaken out and can never unlock paid tiers on the counter.
 */
export const IS_MOCK_PAYMENT_ENABLED = import.meta.env.DEV;
export const IS_LIBRE_UPGRADE_ENABLED = false;

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
  isUpgradeAllowed: () => boolean;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
  getLimits: () => TierLimits;
  canAddProduct: (currentCount: number) => boolean;
  canAddCustomer: (currentCount: number) => boolean;
  canAddGCashTxn: (monthlyCount: number) => boolean;
  refreshSubscription: () => Promise<void>;
  confirmCheckoutSession: (sessionId?: string) => Promise<boolean>;
  createCheckoutSession: (targetTier: 'TindahanPro', cycle: BillingCycle) => Promise<string>;
  simulateMockPayment: (targetTier: 'TindahanPro', cycle: BillingCycle) => Promise<void>;
  generateQrPhPayment: (targetTier: 'TindahanPro', cycle: BillingCycle) => Promise<{
    paymentIntentId: string;
    paymentMethodId: string;
    clientKey: string | null;
    status: string;
    amountCentavos: number;
    qrCodeUrl: string;
    orderId: string;
    createdAt: string;
  }>;
  checkQrPhStatus: (paymentIntentId: string) => Promise<{
    paymentIntentId: string;
    status: string;
    isPaid: boolean;
    amountCentavos: number;
    paymentId?: string;
  }>;
  confirmQrPhPayment: (paymentIntentId: string, targetTier: 'TindahanPro', cycle: BillingCycle) => Promise<boolean>;
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
        maxProducts: 30,
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
  const storedTier: PlanTier = data.tierName || (data.tier === 1 ? 'TindahanPro' : data.tier === 2 ? 'NegosyoPlus' : 'Libre');
  const endDate = data.subscriptionEndDate || null;
  const effectiveTier = getEffectiveTier(storedTier, endDate);

  useAuthStore.getState().setSubscription(effectiveTier, endDate);

  const tenantId = useAuthStore.getState().tenantId;
  if (tenantId) {
    try {
      await db.tenants.update(tenantId, {
        businessName: data.businessName || useAuthStore.getState().businessName,
        tier: effectiveTier,
        subscriptionEndDate: endDate || undefined,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('[Subscription] Failed to persist subscription state to local database:', err);
    }
  }

  set({
    tier: effectiveTier,
    subscriptionEndDate: endDate,
    isActive: effectiveTier !== 'Libre' && Boolean(data.isActive ?? true),
    daysRemaining: effectiveTier === 'Libre' && endDate ? 0 : (data.daysRemaining ?? (endDate ? Math.max(0, Math.ceil((Date.parse(endDate) - Date.now()) / (24 * 60 * 60 * 1000))) : null)),
    isLoading: false
  });

  scheduleExpiry(endDate);
  return effectiveTier;
}

const getEffectiveTier = (tier: PlanTier, endDate: string | null): PlanTier =>
  tier !== 'Libre' && endDate && Date.parse(endDate) <= Date.now() ? 'Libre' : tier;

let expiryTimer: number | undefined;

export const scheduleExpiry = (endDate: string | null): void => {
  if (typeof window === 'undefined') return;
  if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
  if (!endDate) return;
  const remaining = Date.parse(endDate) - Date.now();
  if (remaining <= 0) {
    if (useAuthStore.getState().tier !== 'Libre') {
      useAuthStore.getState().setSubscription('Libre', endDate);
    }
    useSubscriptionStore.setState({ tier: 'Libre', isActive: false, daysRemaining: 0 });
    return;
  }
  expiryTimer = window.setTimeout(() => scheduleExpiry(endDate), Math.min(remaining, 2_147_483_647));
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => {
  const currentTier = getEffectiveTier(
    useAuthStore.getState().tier || 'Libre',
    useAuthStore.getState().subscriptionEndDate
  );
  const currentEndDate = useAuthStore.getState().subscriptionEndDate;

  return {
    tier: currentTier,
    subscriptionEndDate: currentEndDate,
    isActive: currentTier !== 'Libre',
    daysRemaining: null,
    isLoading: false,
    error: null,
    isUpgradeModalOpen: false,

    isUpgradeAllowed: () => get().tier !== 'Libre' || Boolean(get().subscriptionEndDate) || IS_LIBRE_UPGRADE_ENABLED,
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
        if (
          err instanceof TenantAccountMismatchError
          || err instanceof TenantProvisioningError
          || err instanceof SessionReauthRequiredError
        ) {
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
        const isExpired = fallbackEndDate ? Date.parse(fallbackEndDate) <= now.getTime() : false;
        const effective = isExpired ? 'Libre' : fallbackTier;
        if (effective !== fallbackTier) {
          useAuthStore.getState().setSubscription('Libre', fallbackEndDate);
        }

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
        const previousTier = get().tier;
        const previousEndDate = get().subscriptionEndDate;
        const storedSessionId = sessionId || getPendingBillingReference();

        const response = await apiClient.post('/billing/confirm-session', {
          sessionId: storedSessionId || undefined
        });

        const effectiveTier = await persistAndApplySubscriptionState(response.data, set);
        const newEndDate = response.data?.subscriptionEndDate || null;
        let wasActivated = effectiveTier !== 'Libre' && (
          response.data?.paymentConfirmed === true ||
          previousTier === 'Libre' ||
          !previousEndDate ||
          newEndDate !== previousEndDate
        );
        if (!wasActivated && typeof window !== 'undefined' && storedSessionId) {
          const isQrIntent = storedSessionId.startsWith('pi_') || !!getPendingQrPhPayment();
          if (isQrIntent) {
            try {
              const qrStatus = await get().checkQrPhStatus(storedSessionId);
              if (qrStatus?.isPaid && effectiveTier !== 'Libre') {
                wasActivated = true;
              } else if (['expired', 'failed', 'canceled', 'cancelled'].includes(String(qrStatus?.status || '').toLowerCase())) {
                clearPendingBillingReference(storedSessionId);
              }
            } catch {
              // Ignore status check failure
            }
          } else {
            clearPendingBillingReference(storedSessionId);
          }
        }

        if (wasActivated && typeof window !== 'undefined') {
          try {
            clearPendingBillingReference(storedSessionId || undefined);
          } catch {
            // Ignore
          }
        }

        return wasActivated;
      } catch (err) {
        console.error('[Subscription] Failed to confirm checkout session:', err);
        set({ isLoading: false });
        return false;
      }
    },

    createCheckoutSession: async (_targetTier: 'TindahanPro', _cycle: BillingCycle) => {
      set({ isLoading: true, error: null });
      try {
        await ensureTenantProvisioned();
        // Redirect URLs are built server-side from configuration (prevents open redirects).
        const response = await apiClient.post('/billing/checkout', {
          targetTier: 1,
          cycle: 1
        });

        if (response.data?.sessionId && typeof window !== 'undefined') {
          try {
            setPendingBillingReference(response.data.sessionId);
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

    simulateMockPayment: async (targetTier: 'TindahanPro', _cycle: BillingCycle) => {
      if (!IS_MOCK_PAYMENT_ENABLED) {
        throw new Error('Mock payments are only available in development builds.');
      }

      set({ isLoading: true, error: null });
      try {
        await ensureTenantProvisioned();
        const response = await apiClient.post('/billing/mock-pay', {
          targetTier: 1,
          cycle: 1
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
    },

    generateQrPhPayment: async (_targetTier: 'TindahanPro', _cycle: BillingCycle) => {
      await ensureTenantProvisioned();
      const response = await apiClient.post('/billing/qrph/generate', {
        targetTier: 1,
        cycle: 1
      });
      return response.data;
    },

    checkQrPhStatus: async (paymentIntentId: string) => {
      const response = await apiClient.get(`/billing/qrph/${paymentIntentId}/status`);
      return response.data;
    },

    confirmQrPhPayment: async (paymentIntentId: string, targetTier: 'TindahanPro', _cycle: BillingCycle) => {
      set({ isLoading: true, error: null });
      try {
        await ensureTenantProvisioned();
        const response = await apiClient.post('/billing/qrph/confirm', {
          paymentIntentId,
          targetTier: 1,
          cycle: 1
        });

        const subscription = response.data;
        const responseTier = typeof subscription?.tierName === 'string'
          ? subscription.tierName as PlanTier
          : typeof subscription?.tier === 'string'
          ? subscription.tier as PlanTier
          : subscription?.tier === 1
            ? 'TindahanPro'
            : subscription?.tier === 2
              ? 'NegosyoPlus'
              : targetTier;
        const subscriptionEndDate = subscription?.subscriptionEndDate || null;
        const effectiveTier = getEffectiveTier(responseTier, subscriptionEndDate);
        if (effectiveTier === 'Libre') {
          throw new Error('Subscription activation could not be confirmed.');
        }
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

        set({
          tier: responseTier,
          subscriptionEndDate,
          isActive: responseTier !== 'Libre',
          daysRemaining,
          isLoading: false
        });

        if (typeof window !== 'undefined') {
          try {
            clearPendingBillingReference(paymentIntentId);
          } catch {
            // Ignore
          }
        }
        scheduleExpiry(subscriptionEndDate);
        return true;
      } catch (err: any) {
        set({ isLoading: false, error: err?.response?.data?.message || err.message });
        throw err;
      }
    }
  };
});

useAuthStore.subscribe((authState, prevAuthState) => {
  if (
    authState.tier !== prevAuthState?.tier ||
    authState.subscriptionEndDate !== prevAuthState?.subscriptionEndDate
  ) {
    const effectiveTier = getEffectiveTier(authState.tier || 'Libre', authState.subscriptionEndDate);
    const endDate = authState.subscriptionEndDate || null;
    const daysRemaining = endDate
      ? Math.max(0, Math.ceil((Date.parse(endDate) - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;
    useSubscriptionStore.setState({
      tier: effectiveTier,
      subscriptionEndDate: endDate,
      isActive: effectiveTier !== 'Libre',
      daysRemaining
    });
    scheduleExpiry(endDate);
  }
});

scheduleExpiry(useAuthStore.getState().subscriptionEndDate);
useLanguageStore.subscribe((langState, prevLangState) => {
  if (langState.language !== prevLangState?.language) {
    const currentError = useSubscriptionStore.getState().error;
    if (currentError && currentError !== SUBSCRIPTION_REFRESH_ERROR) {
      const localized = getLocalizedSyncErrorMessage(currentError, langState.language);
      if (localized && localized !== currentError) {
        useSubscriptionStore.setState({ error: localized });
      }
    }
  }
});
