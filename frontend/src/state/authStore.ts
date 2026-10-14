import { create } from 'zustand';
import { createClientUuid, DEFAULT_TENANT_ID, DEFAULT_USER_ID } from '../db/seedData';
import type { PlanTier } from '../db/db';
import { DEMO_BUSINESS_NAME, DEMO_OWNER, DEMO_PHONE } from '../constants/demoProfile';
import { getSyncStorageKey } from '../constants/sync';

import { CURRENT_TERMS_VERSION } from '../legal/termsData';

export { DEMO_BUSINESS_NAME, DEMO_OWNER, DEMO_PHONE } from '../constants/demoProfile';
export { CURRENT_TERMS_VERSION } from '../legal/termsData';

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
  locallyCreatedTenantId: string | null;
  serverConfirmedTenantId: string | null;
  serverConfirmedUserId: string | null;
  businessName: string;
  ownerName: string;
  userPhone: string;
  role: 'Owner' | 'Staff';
  tier: PlanTier;
  subscriptionEndDate: string | null;
  firebaseToken: string | null;
  consentAccepted: boolean;
  termsAcceptedVersion: string | null;
  isPrivacyNoticeOpen: boolean;
  isOnboarded: boolean;
  isOnboardingStatusReady: boolean;
  isOnboardingOpen: boolean;
  onboardingMode: 'initial' | 'edit';
  setConsentAccepted: (accepted: boolean, termsVersion?: string | null) => void;
  setTermsAcceptedVersion: (version: string | null) => void;
  setIsPrivacyNoticeOpen: (open: boolean) => void;
  setPrivacyNoticeOpen: (open: boolean) => void;
  openPrivacyNotice: () => void;
  closePrivacyNotice: () => void;
  setTenantId: (tenantId: string) => void;
  setUserId: (userId: string) => void;
  confirmServerIdentity: (tenantId: string, userId: string) => void;
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
const STORAGE_KEY_TERMS_VERSION = 'fluent_tindahan_terms_version_v1';
const STORAGE_KEY_TIER = 'fluent_tindahan_tier_v1';
const STORAGE_KEY_SUBS_END = 'fluent_tindahan_subs_end_v1';
const STORAGE_KEY_TENANT_ID = 'fluent_tindahan_tenant_id_v1';
const STORAGE_KEY_USER_ID = 'fluent_tindahan_user_id_v1';
const STORAGE_KEY_LOCAL_TENANT_ID = 'fluent_tindahan_local_tenant_id_v1';
const STORAGE_KEY_CONFIRMED_TENANT_ID = 'fluent_tindahan_server_confirmed_tenant_id_v1';
const STORAGE_KEY_CONFIRMED_USER_ID = 'fluent_tindahan_server_confirmed_user_id_v1';
const STORAGE_KEY_STORE_NAME = 'fluent_tindahan_store_name_v1';
const STORAGE_KEY_OWNER_NAME = 'fluent_tindahan_owner_name_v1';
const STORAGE_KEY_USER_PHONE = 'fluent_tindahan_user_phone_v1';
const STORAGE_KEY_ONBOARDED = 'fluent_tindahan_onboarded_v1';

const initialConsent = localStorage.getItem(STORAGE_KEY_CONSENT) === 'true';
const initialTermsVersion = localStorage.getItem(STORAGE_KEY_TERMS_VERSION);
const initialTier = (localStorage.getItem(STORAGE_KEY_TIER) as PlanTier) || 'Libre';
const initialSubsEnd = localStorage.getItem(STORAGE_KEY_SUBS_END);
const initialTenantId = localStorage.getItem(STORAGE_KEY_TENANT_ID) || DEFAULT_TENANT_ID;
const initialUserId = localStorage.getItem(STORAGE_KEY_USER_ID) || DEFAULT_USER_ID;
const initialLocallyCreatedTenantId = localStorage.getItem(STORAGE_KEY_LOCAL_TENANT_ID);
const initialServerConfirmedTenantId = localStorage.getItem(STORAGE_KEY_CONFIRMED_TENANT_ID);
const initialServerConfirmedUserId = localStorage.getItem(STORAGE_KEY_CONFIRMED_USER_ID);
const initialBusinessName = localStorage.getItem(STORAGE_KEY_STORE_NAME) ?? DEMO_BUSINESS_NAME;
const initialOwnerName = localStorage.getItem(STORAGE_KEY_OWNER_NAME) ?? DEMO_OWNER;
const initialUserPhone = localStorage.getItem(STORAGE_KEY_USER_PHONE) ?? DEMO_PHONE;
const hasSavedStoreProfile = Boolean(
  localStorage.getItem(STORAGE_KEY_STORE_NAME)
  || localStorage.getItem(STORAGE_KEY_OWNER_NAME)
  || localStorage.getItem(STORAGE_KEY_USER_PHONE)
);
const initialOnboarded = localStorage.getItem(STORAGE_KEY_ONBOARDED) === 'true'
  || hasSavedStoreProfile
  || initialTenantId !== DEFAULT_TENANT_ID;

export const useAuthStore = create<AuthState>((set, get) => ({
  tenantId: initialTenantId,
  userId: initialUserId,
  locallyCreatedTenantId: initialLocallyCreatedTenantId,
  serverConfirmedTenantId: initialServerConfirmedTenantId,
  serverConfirmedUserId: initialServerConfirmedUserId,
  businessName: initialBusinessName,
  ownerName: initialOwnerName,
  userPhone: initialUserPhone,
  role: 'Owner',
  tier: initialTier,
  subscriptionEndDate: initialSubsEnd,
  firebaseToken: null,
  consentAccepted: initialConsent,
  termsAcceptedVersion: initialTermsVersion,
  isPrivacyNoticeOpen: false,
  isOnboarded: initialOnboarded,
  isOnboardingStatusReady: initialOnboarded,
  isOnboardingOpen: false,
  onboardingMode: 'initial',

  setConsentAccepted: (accepted: boolean, termsVersion?: string | null) => {
    localStorage.setItem(STORAGE_KEY_CONSENT, accepted ? 'true' : 'false');
    const version = accepted ? (termsVersion ?? CURRENT_TERMS_VERSION) : null;
    if (version) {
      localStorage.setItem(STORAGE_KEY_TERMS_VERSION, version);
    } else {
      localStorage.removeItem(STORAGE_KEY_TERMS_VERSION);
    }
    set({ consentAccepted: accepted, termsAcceptedVersion: version });
  },

  setTermsAcceptedVersion: (version: string | null) => {
    if (version) {
      localStorage.setItem(STORAGE_KEY_TERMS_VERSION, version);
    } else {
      localStorage.removeItem(STORAGE_KEY_TERMS_VERSION);
    }
    set({ termsAcceptedVersion: version });
  },

  setIsPrivacyNoticeOpen: (open: boolean) => {
    set({ isPrivacyNoticeOpen: open });
  },

  setPrivacyNoticeOpen: (open: boolean) => {
    set({ isPrivacyNoticeOpen: open });
  },

  openPrivacyNotice: () => {
    set({ isPrivacyNoticeOpen: true });
  },

  closePrivacyNotice: () => {
    set({ isPrivacyNoticeOpen: false });
  },

  setTenantId: (tenantId: string) => {
    localStorage.setItem(STORAGE_KEY_TENANT_ID, tenantId);
    set({ tenantId });
  },

  setUserId: (userId: string) => {
    localStorage.setItem(STORAGE_KEY_USER_ID, userId);
    set({ userId });
  },

  confirmServerIdentity: (tenantId: string, userId: string) => {
    localStorage.setItem(STORAGE_KEY_TENANT_ID, tenantId);
    localStorage.setItem(STORAGE_KEY_USER_ID, userId);
    localStorage.setItem(STORAGE_KEY_CONFIRMED_TENANT_ID, tenantId);
    localStorage.setItem(STORAGE_KEY_CONFIRMED_USER_ID, userId);
    localStorage.removeItem(STORAGE_KEY_LOCAL_TENANT_ID);
    set({
      tenantId,
      userId,
      locallyCreatedTenantId: null,
      serverConfirmedTenantId: tenantId,
      serverConfirmedUserId: userId
    });
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
    const currentUserId = get().userId;
    const userId = hasExistingStore && currentUserId === DEFAULT_USER_ID
      ? createClientUuid()
      : currentUserId;

    if (userId !== currentUserId) {
      localStorage.setItem(STORAGE_KEY_USER_ID, userId);
    }
    if (hasExistingStore) {
      localStorage.setItem(STORAGE_KEY_ONBOARDED, 'true');
    }
    set((state) => ({
      isOnboarded: state.isOnboarded || hasExistingStore,
      userId,
      isOnboardingStatusReady: true
    }));
  },

  closeOnboarding: () => {
    set({ isOnboardingOpen: false });
  },

  completeOnboarding: (payload: OnboardingPayload) => {
    const tenantId = payload.tenantId || localStorage.getItem(STORAGE_KEY_TENANT_ID) || DEFAULT_TENANT_ID;
    const previousTenantId = localStorage.getItem(STORAGE_KEY_TENANT_ID) || DEFAULT_TENANT_ID;
    const startsNewTenant = tenantId !== previousTenantId;
    const existingUserId = payload.userId || localStorage.getItem(STORAGE_KEY_USER_ID) || DEFAULT_USER_ID;
    const userId = startsNewTenant && existingUserId === DEFAULT_USER_ID
      ? createClientUuid()
      : existingUserId;
    const businessName = payload.businessName.trim();
    const ownerName = (payload.ownerName || '').trim();
    const userPhone = (payload.userPhone || '').trim();

    localStorage.setItem(STORAGE_KEY_TENANT_ID, tenantId);
    localStorage.setItem(STORAGE_KEY_USER_ID, userId);
    localStorage.setItem(STORAGE_KEY_STORE_NAME, businessName);
    localStorage.setItem(STORAGE_KEY_OWNER_NAME, ownerName);
    localStorage.setItem(STORAGE_KEY_USER_PHONE, userPhone);
    localStorage.setItem(STORAGE_KEY_ONBOARDED, 'true');
    if (startsNewTenant) {
      localStorage.setItem(STORAGE_KEY_LOCAL_TENANT_ID, tenantId);
      localStorage.removeItem(STORAGE_KEY_CONFIRMED_TENANT_ID);
      localStorage.removeItem(STORAGE_KEY_CONFIRMED_USER_ID);
      localStorage.setItem(STORAGE_KEY_TIER, 'Libre');
      localStorage.removeItem(STORAGE_KEY_SUBS_END);
      localStorage.removeItem(getSyncStorageKey(tenantId));
    }

    set({
      tenantId,
      userId,
      ...(startsNewTenant ? {
        locallyCreatedTenantId: tenantId,
        serverConfirmedTenantId: null,
        serverConfirmedUserId: null
      } : {}),
      businessName,
      ownerName,
      userPhone,
      ...(startsNewTenant ? { tier: 'Libre', subscriptionEndDate: null } : {}),
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
    localStorage.setItem(STORAGE_KEY_OWNER_NAME, ownerName);
    localStorage.setItem(STORAGE_KEY_USER_PHONE, userPhone);

    set({
      businessName,
      ownerName,
      userPhone,
      isOnboardingOpen: false
    });
  },

  logout: () => {
    set({
      firebaseToken: null
    });
  }
}));
