import { create } from 'zustand';
import { DEFAULT_TENANT_ID, DEFAULT_USER_ID } from '../db/seedData';
import type { PlanTier } from '../db/db';

interface AuthState {
  tenantId: string;
  userId: string;
  businessName: string;
  userPhone: string;
  role: 'Owner' | 'Staff';
  tier: PlanTier;
  subscriptionEndDate: string | null;
  firebaseToken: string | null;
  consentAccepted: boolean;
  setConsentAccepted: (accepted: boolean) => void;
  setTenantId: (tenantId: string) => void;
  setBusinessName: (businessName: string) => void;
  setRole: (role: 'Owner' | 'Staff') => void;
  setSubscription: (tier: PlanTier, subscriptionEndDate?: string | null) => void;
  setFirebaseToken: (token: string | null) => void;
  logout: () => void;
}

const STORAGE_KEY_CONSENT = 'fluent_tindahan_consent_v1';
const STORAGE_KEY_TIER = 'fluent_tindahan_tier_v1';
const STORAGE_KEY_SUBS_END = 'fluent_tindahan_subs_end_v1';

const initialConsent = localStorage.getItem(STORAGE_KEY_CONSENT) === 'true';
const initialTier = (localStorage.getItem(STORAGE_KEY_TIER) as PlanTier) || 'Libre';
const initialSubsEnd = localStorage.getItem(STORAGE_KEY_SUBS_END);

export const useAuthStore = create<AuthState>((set) => ({
  tenantId: DEFAULT_TENANT_ID,
  userId: DEFAULT_USER_ID,
  businessName: "Aling Nena's Tindahan & GCash",
  userPhone: '09171234567',
  role: 'Owner',
  tier: initialTier,
  subscriptionEndDate: initialSubsEnd,
  firebaseToken: null,
  consentAccepted: initialConsent,

  setConsentAccepted: (accepted: boolean) => {
    localStorage.setItem(STORAGE_KEY_CONSENT, accepted ? 'true' : 'false');
    set({ consentAccepted: accepted });
  },

  setTenantId: (tenantId: string) => set({ tenantId }),

  setBusinessName: (businessName: string) => set({ businessName }),

  setRole: (role: 'Owner' | 'Staff') => set({ role }),

  setSubscription: (tier: PlanTier, subscriptionEndDate?: string | null) => {
    localStorage.setItem(STORAGE_KEY_TIER, tier);
    if (subscriptionEndDate) {
      localStorage.setItem(STORAGE_KEY_SUBS_END, subscriptionEndDate);
    } else {
      localStorage.removeItem(STORAGE_KEY_SUBS_END);
    }
    set({ tier, subscriptionEndDate: subscriptionEndDate ?? null });
  },

  setFirebaseToken: (token: string | null) => set({ firebaseToken: token }),

  logout: () => {
    set({
      firebaseToken: null
    });
  }
}));
