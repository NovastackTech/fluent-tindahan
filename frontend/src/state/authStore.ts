import { create } from 'zustand';
import { DEFAULT_TENANT_ID, DEFAULT_USER_ID } from '../db/seedData';
import type { PlanTier } from '../db/db';

export interface StoreProfilePayload {
  businessName: string;
  ownerName?: string;
  userPhone?: string;
}

export interface OnboardingPayload extends StoreProfilePayload {
  tenantId?: string;
  userId?: string;
}

interface AuthState {
  tenantId: string;
  userId: string;
  businessName: string;
  ownerName: string;
  userPhone: string;
  role: 'Owner' | 'Staff';
  tier: PlanTier;
  subscriptionEndDate: string | null;
  firebaseToken: string | null;
  consentAccepted: boolean;
  isOnboarded: boolean;
  isOnboardingStatusReady: boolean;
  isOnboardingOpen: boolean;
  onboardingMode: 'initial' | 'edit';
  setConsentAccepted: (accepted: boolean) => void;
  setTenantId: (tenantId: string) => void;
  setBusinessName: (businessName: string) => void;
  setOwnerName: (ownerName: string) => void;
  setUserPhone: (userPhone: string) => void;
  setRole: (role: 'Owner' | 'Staff') => void;
  setSubscription: (tier: PlanTier, subscriptionEndDate?: string | null) => void;
  setFirebaseToken: (token: string | null) => void;
  openOnboarding: (mode?: 'initial' | 'edit') => void;
  resolveOnboardingStatus: (hasExistingStore: boolean) => void;
  closeOnboarding: () => void;
  completeOnboarding: (payload: OnboardingPayload) => void;
  updateStoreProfile: (payload: StoreProfilePayload) => void;
  logout: () => void;
}

const STORAGE_KEY_CONSENT = 'fluent_tindahan_consent_v1';
const STORAGE_KEY_TIER = 'fluent_tindahan_tier_v1';
const STORAGE_KEY_SUBS_END = 'fluent_tindahan_subs_end_v1';
const STORAGE_KEY_TENANT_ID = 'fluent_tindahan_tenant_id_v1';
const STORAGE_KEY_USER_ID = 'fluent_tindahan_user_id_v1';
const STORAGE_KEY_STORE_NAME = 'fluent_tindahan_store_name_v1';
const STORAGE_KEY_OWNER_NAME = 'fluent_tindahan_owner_name_v1';
const STORAGE_KEY_USER_PHONE = 'fluent_tindahan_user_phone_v1';
const STORAGE_KEY_ONBOARDED = 'fluent_tindahan_onboarded_v1';

const initialConsent = localStorage.getItem(STORAGE_KEY_CONSENT) === 'true';
const initialTier = (localStorage.getItem(STORAGE_KEY_TIER) as PlanTier) || 'Libre';
const initialSubsEnd = localStorage.getItem(STORAGE_KEY_SUBS_END);
const initialTenantId = localStorage.getItem(STORAGE_KEY_TENANT_ID) || DEFAULT_TENANT_ID;
const initialUserId = localStorage.getItem(STORAGE_KEY_USER_ID) || DEFAULT_USER_ID;
const initialBusinessName = localStorage.getItem(STORAGE_KEY_STORE_NAME) || "Aling Nena's Tindahan & GCash";
const initialOwnerName = localStorage.getItem(STORAGE_KEY_OWNER_NAME) || 'Aling Nena';
const initialUserPhone = localStorage.getItem(STORAGE_KEY_USER_PHONE) || '09171234567';
const hasSavedStoreProfile = Boolean(
  localStorage.getItem(STORAGE_KEY_STORE_NAME)
  || localStorage.getItem(STORAGE_KEY_OWNER_NAME)
  || localStorage.getItem(STORAGE_KEY_USER_PHONE)
);
const initialOnboarded = localStorage.getItem(STORAGE_KEY_ONBOARDED) === 'true'
  || hasSavedStoreProfile
  || initialTenantId !== DEFAULT_TENANT_ID
  || initialTier !== 'Libre'
  || initialSubsEnd !== null;

export const useAuthStore = create<AuthState>((set) => ({
  tenantId: initialTenantId,
  userId: initialUserId,
  businessName: initialBusinessName,
  ownerName: initialOwnerName,
  userPhone: initialUserPhone,
  role: 'Owner',
  tier: initialTier,
  subscriptionEndDate: initialSubsEnd,
  firebaseToken: null,
  consentAccepted: initialConsent,
  isOnboarded: initialOnboarded,
  isOnboardingStatusReady: initialOnboarded,
  isOnboardingOpen: false,
  onboardingMode: 'initial',

  setConsentAccepted: (accepted: boolean) => {
    localStorage.setItem(STORAGE_KEY_CONSENT, accepted ? 'true' : 'false');
    set({ consentAccepted: accepted });
  },

  setTenantId: (tenantId: string) => {
    localStorage.setItem(STORAGE_KEY_TENANT_ID, tenantId);
    set({ tenantId });
  },

  setBusinessName: (businessName: string) => {
    localStorage.setItem(STORAGE_KEY_STORE_NAME, businessName);
    set({ businessName });
  },

  setOwnerName: (ownerName: string) => {
    localStorage.setItem(STORAGE_KEY_OWNER_NAME, ownerName);
    set({ ownerName });
  },

  setUserPhone: (userPhone: string) => {
    localStorage.setItem(STORAGE_KEY_USER_PHONE, userPhone);
    set({ userPhone });
  },

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

  openOnboarding: (mode: 'initial' | 'edit' = 'initial') => {
    set({ isOnboardingOpen: true, onboardingMode: mode });
  },

  resolveOnboardingStatus: (hasExistingStore: boolean) => {
    if (hasExistingStore) {
      localStorage.setItem(STORAGE_KEY_ONBOARDED, 'true');
    }
    set((state) => ({
      isOnboarded: state.isOnboarded || hasExistingStore,
      isOnboardingStatusReady: true
    }));
  },

  closeOnboarding: () => {
    set({ isOnboardingOpen: false });
  },

  completeOnboarding: (payload: OnboardingPayload) => {
    const tenantId = payload.tenantId || localStorage.getItem(STORAGE_KEY_TENANT_ID) || DEFAULT_TENANT_ID;
    const userId = payload.userId || localStorage.getItem(STORAGE_KEY_USER_ID) || DEFAULT_USER_ID;
    const businessName = payload.businessName.trim();
    const ownerName = (payload.ownerName || '').trim();
    const userPhone = (payload.userPhone || '').trim();

    localStorage.setItem(STORAGE_KEY_TENANT_ID, tenantId);
    localStorage.setItem(STORAGE_KEY_USER_ID, userId);
    localStorage.setItem(STORAGE_KEY_STORE_NAME, businessName);
    localStorage.setItem(STORAGE_KEY_TIER, 'Libre');
    localStorage.removeItem(STORAGE_KEY_SUBS_END);
    if (ownerName) localStorage.setItem(STORAGE_KEY_OWNER_NAME, ownerName);
    if (userPhone) localStorage.setItem(STORAGE_KEY_USER_PHONE, userPhone);
    localStorage.setItem(STORAGE_KEY_ONBOARDED, 'true');

    set({
      tenantId,
      userId,
      businessName,
      ownerName: ownerName || initialOwnerName,
      userPhone: userPhone || initialUserPhone,
      tier: 'Libre',
      subscriptionEndDate: null,
      isOnboarded: true,
      isOnboardingStatusReady: true,
      isOnboardingOpen: false
    });
  },

  updateStoreProfile: (payload: StoreProfilePayload) => {
    const businessName = payload.businessName.trim();
    const ownerName = (payload.ownerName || '').trim();
    const userPhone = (payload.userPhone || '').trim();

    localStorage.setItem(STORAGE_KEY_STORE_NAME, businessName);
    if (ownerName) localStorage.setItem(STORAGE_KEY_OWNER_NAME, ownerName);
    if (userPhone) localStorage.setItem(STORAGE_KEY_USER_PHONE, userPhone);

    set((state) => ({
      businessName,
      ownerName: ownerName || state.ownerName,
      userPhone: userPhone || state.userPhone,
      isOnboardingOpen: false
    }));
  },

  logout: () => {
    set({
      firebaseToken: null
    });
  }
}));

