import { create } from 'zustand';
import { createClientUuid, DEFAULT_TENANT_ID, DEFAULT_USER_ID } from '../db/seedData';
import { db, type PlanTier } from '../db/db';
import { DEMO_BUSINESS_NAME, DEMO_OWNER, DEMO_PHONE } from '../constants/demoProfile';
import { getSyncStorageKey } from '../constants/sync';
import { CURRENT_TERMS_VERSION } from '../legal/termsData';
import { generateLocalPinVerifier, logoutStore, type AuthResponseDto } from '../services/authService';
import { useGCashFeeStore } from './gcashFeeStore';
import { useCartStore } from './cartStore';
import {
  hasPendingProfileUpdate,
  clearPendingProfileUpdate,
  STORAGE_KEY_PENDING_PROFILE_UPDATE
} from '../services/profileSync';

export { DEMO_BUSINESS_NAME, DEMO_OWNER, DEMO_PHONE } from '../constants/demoProfile';
export { CURRENT_TERMS_VERSION } from '../legal/termsData';

export interface StoreProfilePayload {
  businessName?: string | null;
  ownerName?: string | null;
  userPhone?: string | null;
  userEmail?: string | null;
}

export interface OnboardingPayload extends StoreProfilePayload {
  tenantId?: string;
  userId?: string;
  userEmail?: string;
  hasPin?: boolean;
  localPin?: string;
  token?: string;
  isDemo?: boolean;
}

export interface LogoutResult {
  success: boolean;
  unsyncedCount: number;
}

export interface LoginResult {
  success: boolean;
  unsyncedCount: number;
}

interface AuthState {
  tenantId: string;
  userId: string;
  userEmail: string;
  hasPin: boolean;
  localPinVerifier: string | null;
  isSessionLocked: boolean;
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
  refreshToken: string | null;
  /** Access token could not be renewed. Sign in again without clearing local data. */
  reauthRequired: boolean;
  /** UI asked to open the login screen for that sign-in. */
  reauthRequested: boolean;
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
  openPrivacyNotice: () => void;
  closePrivacyNotice: () => void;
  setTenantId: (tenantId: string) => void;
  setUserId: (userId: string) => void;
  setUserEmail: (email: string) => void;
  setHasPin: (hasPin: boolean) => void;
  setLocalPinVerifier: (verifier: string | null) => void;
  setIsSessionLocked: (locked: boolean) => void;
  isDemo: boolean;
  setIsDemo: (isDemo: boolean) => void;
  offlineFailedPinAttempts: number;
  offlinePinLockoutEnd: string | null;
  recordOfflinePinFailure: () => { attempts: number; isLockedOut: boolean; lockoutMinutes: number };
  resetOfflinePinFailures: () => void;
  isOfflinePinLockedOut: () => boolean;
  getOfflinePinLockoutMinutesRemaining: () => number;
  confirmServerIdentity: (tenantId: string, userId: string) => void;
  setBusinessName: (businessName: string) => void;
  setOwnerName: (ownerName: string) => void;
  setUserPhone: (userPhone: string) => void;
  setRole: (role: 'Owner' | 'Staff') => void;
  setSubscription: (tier: PlanTier, subscriptionEndDate?: string | null) => void;
  setFirebaseToken: (token: string | null) => void;
  setRefreshToken: (token: string | null) => void;
  setReauthRequired: (required: boolean) => void;
  requestReauth: () => void;
  clearReauthRequest: () => void;
  adoptStoredSessionTokens: () => void;
  openOnboarding: (mode?: 'initial' | 'edit') => void;
  resolveOnboardingStatus: (hasExistingStore: boolean) => void;
  closeOnboarding: () => void;
  completeOnboarding: (payload: OnboardingPayload) => void;
  updateStoreProfile: (payload: StoreProfilePayload) => void;
  loginWithAuthPayload: (payload: AuthResponseDto, localPin?: string, forceWipe?: boolean) => Promise<LoginResult>;
  logout: (forceWipe?: boolean, isAccountDeletion?: boolean) => Promise<LogoutResult>;
}

export const STORAGE_KEY_CONSENT = 'fluent_tindahan_consent_v1';
export const STORAGE_KEY_TERMS_VERSION = 'fluent_tindahan_terms_version_v1';
export const STORAGE_KEY_TIER = 'fluent_tindahan_tier_v1';
export const STORAGE_KEY_SUBS_END = 'fluent_tindahan_subs_end_v1';
export const STORAGE_KEY_TENANT_ID = 'fluent_tindahan_tenant_id_v1';
export const STORAGE_KEY_USER_ID = 'fluent_tindahan_user_id_v1';
export const STORAGE_KEY_USER_EMAIL = 'fluent_tindahan_user_email_v1';
export const STORAGE_KEY_LAST_EMAIL = 'fluent_tindahan_last_email_v1';
export const STORAGE_KEY_HAS_PIN = 'fluent_tindahan_has_pin_v1';
export const STORAGE_KEY_LOCAL_PIN_HASH = 'fluent_tindahan_local_pin_hash_v1';
export const STORAGE_KEY_OFFLINE_PIN_FAILURES = 'fluent_tindahan_offline_pin_failures_v1';
export const STORAGE_KEY_OFFLINE_PIN_LOCKOUT_END = 'fluent_tindahan_offline_pin_lockout_end_v1';
export const MAX_OFFLINE_PIN_ATTEMPTS = 5;
export const OFFLINE_PIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
export const STORAGE_KEY_SESSION_LOCKED = 'fluent_tindahan_session_locked_v1';
export const STORAGE_KEY_LOCAL_TENANT_ID = 'fluent_tindahan_local_tenant_id_v1';
export const STORAGE_KEY_CONFIRMED_TENANT_ID = 'fluent_tindahan_server_confirmed_tenant_id_v1';
export const STORAGE_KEY_CONFIRMED_USER_ID = 'fluent_tindahan_server_confirmed_user_id_v1';
export const STORAGE_KEY_STORE_NAME = 'fluent_tindahan_store_name_v1';
export const STORAGE_KEY_OWNER_NAME = 'fluent_tindahan_owner_name_v1';
export const STORAGE_KEY_USER_PHONE = 'fluent_tindahan_user_phone_v1';
export const STORAGE_KEY_ONBOARDED = 'fluent_tindahan_onboarded_v1';
/**
 * Local storage key for the native ASP.NET Core backend JWT access token.
 * Note: Tokens are self-issued HMAC-SHA256 JWTs generated by the Fluent Tindahan backend, NOT Firebase Auth.
 */
export const STORAGE_KEY_TOKEN = 'fluent_tindahan_auth_token_v1';
export const LEGACY_STORAGE_KEY_FIREBASE_TOKEN = 'fluent_tindahan_firebase_token_v1';
export const STORAGE_KEY_REFRESH_TOKEN = 'fluent_tindahan_refresh_token_v1';
export const STORAGE_KEY_REAUTH_REQUIRED = 'fluent_tindahan_reauth_required_v1';
export const STORAGE_KEY_IS_DEMO = 'fluent_tindahan_is_demo_v1';
export const STORAGE_KEY_DLQ_ARCHIVE = 'tindahan_dlq_archive';

const initialConsent = localStorage.getItem(STORAGE_KEY_CONSENT) === 'true';
const initialTermsVersion = localStorage.getItem(STORAGE_KEY_TERMS_VERSION);
const getEffectiveStoredTier = (tier: PlanTier, endDate?: string | null): PlanTier =>
  tier !== 'Libre' && endDate && Date.parse(endDate) <= Date.now() ? 'Libre' : tier;
const initialTier = getEffectiveStoredTier((localStorage.getItem(STORAGE_KEY_TIER) as PlanTier) || 'Libre', localStorage.getItem(STORAGE_KEY_SUBS_END));
const initialSubsEnd = localStorage.getItem(STORAGE_KEY_SUBS_END);
const initialTenantId = localStorage.getItem(STORAGE_KEY_TENANT_ID) || DEFAULT_TENANT_ID;
const initialUserId = localStorage.getItem(STORAGE_KEY_USER_ID) || DEFAULT_USER_ID;
const initialUserEmail = localStorage.getItem(STORAGE_KEY_USER_EMAIL) || '';
const initialHasPin = localStorage.getItem(STORAGE_KEY_HAS_PIN) === 'true';
const initialLocalPinHash = localStorage.getItem(STORAGE_KEY_LOCAL_PIN_HASH);
const initialOfflineFailures = parseInt(localStorage.getItem(STORAGE_KEY_OFFLINE_PIN_FAILURES) || '0', 10);
const initialOfflineLockoutEnd = localStorage.getItem(STORAGE_KEY_OFFLINE_PIN_LOCKOUT_END);
const initialSessionLocked = localStorage.getItem(STORAGE_KEY_SESSION_LOCKED) === 'true';
const initialLocallyCreatedTenantId = localStorage.getItem(STORAGE_KEY_LOCAL_TENANT_ID);
const initialServerConfirmedTenantId = localStorage.getItem(STORAGE_KEY_CONFIRMED_TENANT_ID);
const initialServerConfirmedUserId = localStorage.getItem(STORAGE_KEY_CONFIRMED_USER_ID);
const initialBusinessName = localStorage.getItem(STORAGE_KEY_STORE_NAME) ?? DEMO_BUSINESS_NAME;
const initialOwnerName = localStorage.getItem(STORAGE_KEY_OWNER_NAME) ?? DEMO_OWNER;
const initialUserPhone = localStorage.getItem(STORAGE_KEY_USER_PHONE) ?? DEMO_PHONE;
const initialToken = localStorage.getItem(STORAGE_KEY_TOKEN) ?? localStorage.getItem(LEGACY_STORAGE_KEY_FIREBASE_TOKEN);
const initialRefreshToken = localStorage.getItem(STORAGE_KEY_REFRESH_TOKEN);
const initialReauthRequired = localStorage.getItem(STORAGE_KEY_REAUTH_REQUIRED) === 'true';
const initialIsDemo = localStorage.getItem(STORAGE_KEY_IS_DEMO) === 'true'
  || initialUserEmail === 'demo@fluent-tindahan.ph';
const hasSavedStoreProfile = Boolean(
  localStorage.getItem(STORAGE_KEY_STORE_NAME)
  || localStorage.getItem(STORAGE_KEY_OWNER_NAME)
  || localStorage.getItem(STORAGE_KEY_USER_PHONE)
  || localStorage.getItem(STORAGE_KEY_USER_EMAIL)
);
const initialOnboarded = localStorage.getItem(STORAGE_KEY_ONBOARDED) === 'true'
  || hasSavedStoreProfile
  || initialTenantId !== DEFAULT_TENANT_ID;

export async function clearAllLocalDexieTables(): Promise<void> {
  const tables = [
    db.products,
    db.customers,
    db.sales,
    db.saleItems,
    db.utangLedger,
    db.gcashTxns,
    db.gcashTxnResolutions,
    db.gcashBalanceEntries,
    db.syncQueue,
    db.deadLetterQueue,
    db.tenants
  ];
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((table) => table.clear()));
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  tenantId: initialTenantId,
  userId: initialUserId,
  userEmail: initialUserEmail,
  hasPin: initialHasPin,
  localPinVerifier: initialLocalPinHash,
  isSessionLocked: initialSessionLocked && initialHasPin,
  locallyCreatedTenantId: initialLocallyCreatedTenantId,
  serverConfirmedTenantId: initialServerConfirmedTenantId,
  serverConfirmedUserId: initialServerConfirmedUserId,
  businessName: initialBusinessName,
  ownerName: initialOwnerName,
  userPhone: initialUserPhone,
  role: 'Owner',
  tier: initialTier,
  subscriptionEndDate: initialSubsEnd,
  firebaseToken: initialToken,
  refreshToken: initialRefreshToken,
  reauthRequired: initialReauthRequired,
  reauthRequested: false,
  offlineFailedPinAttempts: isNaN(initialOfflineFailures) ? 0 : initialOfflineFailures,
  offlinePinLockoutEnd: initialOfflineLockoutEnd,
  consentAccepted: initialConsent,
  termsAcceptedVersion: initialTermsVersion,
  isPrivacyNoticeOpen: false,
  isDemo: initialIsDemo,
  setIsDemo: (isDemo: boolean) => set({ isDemo }),
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

  setUserEmail: (email: string) => {
    const trimmed = email.trim();
    localStorage.setItem(STORAGE_KEY_USER_EMAIL, trimmed);
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY_LAST_EMAIL, trimmed);
    }
    set({ userEmail: trimmed });
  },

  setHasPin: (hasPin: boolean) => {
    localStorage.setItem(STORAGE_KEY_HAS_PIN, hasPin ? 'true' : 'false');
    if (!hasPin) {
      localStorage.removeItem(STORAGE_KEY_LOCAL_PIN_HASH);
      localStorage.removeItem(STORAGE_KEY_SESSION_LOCKED);
      set({ hasPin: false, localPinVerifier: null, isSessionLocked: false });
    } else {
      set({ hasPin: true });
    }
  },

  setLocalPinVerifier: (verifier: string | null) => {
    if (verifier) {
      localStorage.setItem(STORAGE_KEY_LOCAL_PIN_HASH, verifier);
    } else {
      localStorage.removeItem(STORAGE_KEY_LOCAL_PIN_HASH);
    }
    set({ localPinVerifier: verifier });
  },

  setIsSessionLocked: (locked: boolean) => {
    localStorage.setItem(STORAGE_KEY_SESSION_LOCKED, locked ? 'true' : 'false');
    set({ isSessionLocked: locked });
  },

  isOfflinePinLockedOut: () => {
    const { offlinePinLockoutEnd } = get();
    if (!offlinePinLockoutEnd) return false;
    const lockoutDate = new Date(offlinePinLockoutEnd).getTime();
    if (isNaN(lockoutDate)) return false;
    if (Date.now() < lockoutDate) {
      return true;
    }
    localStorage.removeItem(STORAGE_KEY_OFFLINE_PIN_LOCKOUT_END);
    localStorage.setItem(STORAGE_KEY_OFFLINE_PIN_FAILURES, '0');
    set({ offlinePinLockoutEnd: null, offlineFailedPinAttempts: 0 });
    return false;
  },

  getOfflinePinLockoutMinutesRemaining: () => {
    const { offlinePinLockoutEnd } = get();
    if (!offlinePinLockoutEnd) return 0;
    const diffMs = new Date(offlinePinLockoutEnd).getTime() - Date.now();
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (60 * 1000));
  },

  recordOfflinePinFailure: () => {
    let attempts = get().offlineFailedPinAttempts;
    const existingLockoutEnd = get().offlinePinLockoutEnd;
    if (existingLockoutEnd) {
      const lockoutDate = new Date(existingLockoutEnd).getTime();
      if (!isNaN(lockoutDate) && Date.now() >= lockoutDate) {
        attempts = 0;
        localStorage.removeItem(STORAGE_KEY_OFFLINE_PIN_LOCKOUT_END);
      }
    }

    const current = attempts + 1;
    let lockoutEnd = get().offlinePinLockoutEnd;
    if (existingLockoutEnd && attempts === 0) {
      lockoutEnd = null;
    }
    let isLockedOut = false;
    let lockoutMinutes = 0;

    if (current >= MAX_OFFLINE_PIN_ATTEMPTS) {
      const expires = new Date(Date.now() + OFFLINE_PIN_LOCKOUT_DURATION_MS).toISOString();
      lockoutEnd = expires;
      isLockedOut = true;
      lockoutMinutes = 15;
      localStorage.setItem(STORAGE_KEY_OFFLINE_PIN_LOCKOUT_END, expires);
    }

    localStorage.setItem(STORAGE_KEY_OFFLINE_PIN_FAILURES, String(current));
    set({
      offlineFailedPinAttempts: current,
      offlinePinLockoutEnd: lockoutEnd
    });

    return { attempts: current, isLockedOut, lockoutMinutes };
  },

  resetOfflinePinFailures: () => {
    localStorage.removeItem(STORAGE_KEY_OFFLINE_PIN_FAILURES);
    localStorage.removeItem(STORAGE_KEY_OFFLINE_PIN_LOCKOUT_END);
    set({
      offlineFailedPinAttempts: 0,
      offlinePinLockoutEnd: null
    });
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
    tier = getEffectiveStoredTier(tier, subscriptionEndDate);
    localStorage.setItem(STORAGE_KEY_TIER, tier);
    if (subscriptionEndDate) {
      localStorage.setItem(STORAGE_KEY_SUBS_END, subscriptionEndDate);
    } else {
      localStorage.removeItem(STORAGE_KEY_SUBS_END);
    }
    set({ tier, subscriptionEndDate: subscriptionEndDate ?? null });
  },

  setFirebaseToken: (token: string | null) => {
    if (token) {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      localStorage.removeItem(LEGACY_STORAGE_KEY_FIREBASE_TOKEN);
    } else {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(LEGACY_STORAGE_KEY_FIREBASE_TOKEN);
    }
    set({ firebaseToken: token });
  },

  setRefreshToken: (token: string | null) => {
    if (token) {
      localStorage.setItem(STORAGE_KEY_REFRESH_TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_KEY_REFRESH_TOKEN);
    }
    set({ refreshToken: token });
  },

  setReauthRequired: (required: boolean) => {
    if (required) {
      localStorage.setItem(STORAGE_KEY_REAUTH_REQUIRED, 'true');
      set({ reauthRequired: true });
      return;
    }
    localStorage.removeItem(STORAGE_KEY_REAUTH_REQUIRED);
    set({ reauthRequired: false, reauthRequested: false });
  },

  requestReauth: () => {
    localStorage.setItem(STORAGE_KEY_REAUTH_REQUIRED, 'true');
    set({ reauthRequired: true, reauthRequested: true });
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'login');
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  },

  clearReauthRequest: () => set({ reauthRequested: false }),

  adoptStoredSessionTokens: () => {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN) ?? localStorage.getItem(LEGACY_STORAGE_KEY_FIREBASE_TOKEN);
    const refresh = localStorage.getItem(STORAGE_KEY_REFRESH_TOKEN);
    const current = get();
    if (token === current.firebaseToken && refresh === current.refreshToken) return;
    set({
      firebaseToken: token,
      refreshToken: refresh
    });
  },

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
    const businessName = (payload.businessName || '').trim();
    const ownerName = (payload.ownerName || '').trim();
    const userPhone = (payload.userPhone || '').trim();
    const userEmail = (payload.userEmail || '').trim();
    const hasPin = Boolean(payload.hasPin);

    localStorage.setItem(STORAGE_KEY_TENANT_ID, tenantId);
    localStorage.setItem(STORAGE_KEY_USER_ID, userId);
    localStorage.setItem(STORAGE_KEY_STORE_NAME, businessName);
    localStorage.setItem(STORAGE_KEY_OWNER_NAME, ownerName);
    localStorage.setItem(STORAGE_KEY_USER_PHONE, userPhone);
    localStorage.setItem(STORAGE_KEY_USER_EMAIL, userEmail);
    if (userEmail) {
      localStorage.setItem(STORAGE_KEY_LAST_EMAIL, userEmail);
    }
    localStorage.setItem(STORAGE_KEY_HAS_PIN, hasPin ? 'true' : 'false');
    localStorage.setItem(STORAGE_KEY_ONBOARDED, 'true');
    if (payload.token) {
      localStorage.setItem(STORAGE_KEY_TOKEN, payload.token);
      localStorage.removeItem(LEGACY_STORAGE_KEY_FIREBASE_TOKEN);
    }

    if (startsNewTenant) {
      localStorage.setItem(STORAGE_KEY_LOCAL_TENANT_ID, tenantId);
      localStorage.removeItem(STORAGE_KEY_CONFIRMED_TENANT_ID);
      localStorage.removeItem(STORAGE_KEY_CONFIRMED_USER_ID);
      localStorage.setItem(STORAGE_KEY_TIER, 'Libre');
      localStorage.removeItem(STORAGE_KEY_SUBS_END);
      localStorage.removeItem(getSyncStorageKey(tenantId));
    }

    const isDemo = Boolean(payload.isDemo || userEmail === 'demo@fluent-tindahan.ph');
    if (isDemo) {
      localStorage.setItem(STORAGE_KEY_IS_DEMO, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY_IS_DEMO);
    }

    set({
      tenantId,
      userId,
      userEmail,
      hasPin,
      isDemo,
      ...(startsNewTenant ? {
        locallyCreatedTenantId: tenantId,
        serverConfirmedTenantId: null,
        serverConfirmedUserId: null
      } : {}),
      businessName,
      ownerName,
      userPhone,
      firebaseToken: payload.token || get().firebaseToken,
      ...(startsNewTenant ? { tier: 'Libre', subscriptionEndDate: null } : {}),
      isOnboarded: true,
      isOnboardingStatusReady: true,
      isOnboardingOpen: false
    });
  },

  updateStoreProfile: (payload: StoreProfilePayload) => {
    const currentState = get();
    let nextBusinessName = currentState.businessName;
    let nextOwnerName = currentState.ownerName;
    let nextUserPhone = currentState.userPhone;
    let nextUserEmail = currentState.userEmail;

    if (payload.businessName !== undefined && payload.businessName !== null) {
      const trimmed = payload.businessName.trim();
      if (trimmed.length > 0) {
        nextBusinessName = trimmed;
        localStorage.setItem(STORAGE_KEY_STORE_NAME, trimmed);
      }
    }

    if (payload.ownerName !== undefined && payload.ownerName !== null) {
      const trimmed = payload.ownerName.trim();
      nextOwnerName = trimmed;
      localStorage.setItem(STORAGE_KEY_OWNER_NAME, trimmed);
    }

    if (payload.userPhone !== undefined && payload.userPhone !== null) {
      const trimmed = payload.userPhone.trim();
      nextUserPhone = trimmed;
      localStorage.setItem(STORAGE_KEY_USER_PHONE, trimmed);
    }

    if (payload.userEmail !== undefined && payload.userEmail !== null) {
      const trimmed = payload.userEmail.trim();
      if (trimmed.length > 0) {
        nextUserEmail = trimmed;
        localStorage.setItem(STORAGE_KEY_USER_EMAIL, trimmed);
        localStorage.setItem(STORAGE_KEY_LAST_EMAIL, trimmed);
      }
    }

    set({
      businessName: nextBusinessName,
      ownerName: nextOwnerName,
      userPhone: nextUserPhone,
      userEmail: nextUserEmail
    });
  },

  loginWithAuthPayload: async (
    payload: AuthResponseDto,
    localPin?: string,
    forceWipe = false
  ): Promise<LoginResult> => {
    const currentTenantId = get().tenantId;
    const isNewTenant = payload.tenantId.toLowerCase() !== currentTenantId.toLowerCase();

    if (isNewTenant) {
      let pendingCount = 0;
      try {
        const [syncCount, dlqCount] = await Promise.all([
          db.syncQueue.count(),
          db.deadLetterQueue.count()
        ]);
        pendingCount = syncCount + dlqCount;
      } catch (e) {
        console.warn('[authStore] Failed to check syncQueue count:', e);
      }

      if (pendingCount > 0 && !forceWipe) {
        return { success: false, unsyncedCount: pendingCount };
      }

      try {
        await clearAllLocalDexieTables();
      } catch (e) {
        console.warn('[authStore] Failed to clear local Dexie tables on tenant switch:', e);
      } finally {
        useGCashFeeStore.getState().resetFeeStore();
        useCartStore.getState().clearCart();
        localStorage.removeItem(STORAGE_KEY_DLQ_ARCHIVE);
      }
    }

    let localVerifier: string | null = null;
    if (localPin) {
      localVerifier = await generateLocalPinVerifier(localPin);
      localStorage.setItem(STORAGE_KEY_LOCAL_PIN_HASH, localVerifier);
      localStorage.removeItem(STORAGE_KEY_OFFLINE_PIN_FAILURES);
      localStorage.removeItem(STORAGE_KEY_OFFLINE_PIN_LOCKOUT_END);
    } else if (!payload.hasPin) {
      localStorage.removeItem(STORAGE_KEY_LOCAL_PIN_HASH);
      localStorage.removeItem(STORAGE_KEY_OFFLINE_PIN_FAILURES);
      localStorage.removeItem(STORAGE_KEY_OFFLINE_PIN_LOCKOUT_END);
    }

    localStorage.setItem(STORAGE_KEY_TENANT_ID, payload.tenantId);
    localStorage.setItem(STORAGE_KEY_USER_ID, payload.userId);
    localStorage.setItem(STORAGE_KEY_CONFIRMED_TENANT_ID, payload.tenantId);
    localStorage.setItem(STORAGE_KEY_CONFIRMED_USER_ID, payload.userId);
    localStorage.removeItem(STORAGE_KEY_LOCAL_TENANT_ID);
    localStorage.setItem(STORAGE_KEY_USER_EMAIL, payload.email);
    localStorage.setItem(STORAGE_KEY_LAST_EMAIL, payload.email);
    localStorage.setItem(STORAGE_KEY_STORE_NAME, payload.businessName);
    localStorage.setItem(STORAGE_KEY_OWNER_NAME, payload.ownerName || '');
    localStorage.setItem(STORAGE_KEY_USER_PHONE, payload.phone || '');
    localStorage.setItem(STORAGE_KEY_HAS_PIN, payload.hasPin ? 'true' : 'false');
    localStorage.setItem(STORAGE_KEY_TOKEN, payload.token);
    localStorage.removeItem(LEGACY_STORAGE_KEY_FIREBASE_TOKEN);
    if (payload.refreshToken) {
      localStorage.setItem(STORAGE_KEY_REFRESH_TOKEN, payload.refreshToken);
    }
    localStorage.removeItem(STORAGE_KEY_REAUTH_REQUIRED);
    const effectiveLoginTier = getEffectiveStoredTier(payload.tier, payload.subscriptionEndDate);
    localStorage.setItem(STORAGE_KEY_TIER, effectiveLoginTier);
    if (payload.subscriptionEndDate) {
      localStorage.setItem(STORAGE_KEY_SUBS_END, payload.subscriptionEndDate);
    } else {
      localStorage.removeItem(STORAGE_KEY_SUBS_END);
    }
    localStorage.setItem(STORAGE_KEY_ONBOARDED, 'true');
    localStorage.removeItem(STORAGE_KEY_SESSION_LOCKED);
    localStorage.removeItem(STORAGE_KEY_IS_DEMO);

    set({
      tenantId: payload.tenantId,
      userId: payload.userId,
      userEmail: payload.email,
      hasPin: payload.hasPin,
      localPinVerifier: localVerifier,
      isSessionLocked: false,
      isDemo: false,
      offlineFailedPinAttempts: 0,
      offlinePinLockoutEnd: null,
      serverConfirmedTenantId: payload.tenantId,
      serverConfirmedUserId: payload.userId,
      locallyCreatedTenantId: null,
      businessName: payload.businessName,
      ownerName: payload.ownerName || '',
      userPhone: payload.phone || '',
      role: payload.role,
      tier: effectiveLoginTier,
      subscriptionEndDate: payload.subscriptionEndDate,
      firebaseToken: payload.token,
      refreshToken: payload.refreshToken ?? get().refreshToken,
      reauthRequired: false,
      reauthRequested: false,
      isOnboarded: true,
      isOnboardingStatusReady: true,
      isOnboardingOpen: false
    });

    return { success: true, unsyncedCount: 0 };
  },

  logout: async (forceWipe = false, isAccountDeletion = false): Promise<LogoutResult> => {
    let pendingCount = 0;
    try {
      const [syncCount, dlqCount] = await Promise.all([
        db.syncQueue.count(),
        db.deadLetterQueue.count()
      ]);
      pendingCount = syncCount + dlqCount;
      if (hasPendingProfileUpdate()) {
        pendingCount += 1;
      }
    } catch (e) {
      console.warn('[authStore] Failed to check syncQueue count:', e);
    }

    if (pendingCount > 0 && !forceWipe) {
      return { success: false, unsyncedCount: pendingCount };
    }

    const currentRefreshToken = get().refreshToken;
    if (currentRefreshToken) {
      void logoutStore(currentRefreshToken);
    }

    try {
      await clearAllLocalDexieTables();
    } catch (e) {
      console.warn('[authStore] Failed to clear local Dexie tables on logout:', e);
    } finally {
      useGCashFeeStore.getState().resetFeeStore();
      useCartStore.getState().clearCart();
    }

    // Keep STORAGE_KEY_LAST_EMAIL on ordinary logout so login remembers the email address,
    // but remove it when the account was deleted.
    // Keep consent & terms accepted.
    const keysToRemove = [
      STORAGE_KEY_TENANT_ID,
      STORAGE_KEY_USER_ID,
      STORAGE_KEY_USER_EMAIL,
      STORAGE_KEY_STORE_NAME,
      STORAGE_KEY_OWNER_NAME,
      STORAGE_KEY_USER_PHONE,
      STORAGE_KEY_HAS_PIN,
      STORAGE_KEY_LOCAL_PIN_HASH,
      STORAGE_KEY_SESSION_LOCKED,
      STORAGE_KEY_ONBOARDED,
      STORAGE_KEY_TOKEN,
      LEGACY_STORAGE_KEY_FIREBASE_TOKEN,
      STORAGE_KEY_REFRESH_TOKEN,
      STORAGE_KEY_REAUTH_REQUIRED,
      STORAGE_KEY_TIER,
      STORAGE_KEY_SUBS_END,
      STORAGE_KEY_LOCAL_TENANT_ID,
      STORAGE_KEY_CONFIRMED_TENANT_ID,
      STORAGE_KEY_CONFIRMED_USER_ID,
      STORAGE_KEY_OFFLINE_PIN_FAILURES,
      STORAGE_KEY_OFFLINE_PIN_LOCKOUT_END,
      STORAGE_KEY_PENDING_PROFILE_UPDATE,
      STORAGE_KEY_IS_DEMO,
      STORAGE_KEY_DLQ_ARCHIVE
    ];
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
    const currentTenantId = get().tenantId;
    if (currentTenantId) {
      localStorage.removeItem(getSyncStorageKey(currentTenantId));
    }
    if (isAccountDeletion) {
      localStorage.removeItem(STORAGE_KEY_LAST_EMAIL);
    }
    clearPendingProfileUpdate();

    set({
      tenantId: DEFAULT_TENANT_ID,
      userId: DEFAULT_USER_ID,
      userEmail: '',
      hasPin: false,
      localPinVerifier: null,
      isSessionLocked: false,
      isDemo: false,
      offlineFailedPinAttempts: 0,
      offlinePinLockoutEnd: null,
      locallyCreatedTenantId: null,
      serverConfirmedTenantId: null,
      serverConfirmedUserId: null,
      businessName: '',
      ownerName: '',
      userPhone: '',
      role: 'Owner',
      tier: 'Libre',
      subscriptionEndDate: null,
      firebaseToken: null,
      refreshToken: null,
      reauthRequired: false,
      reauthRequested: false,
      isOnboarded: false,
      isOnboardingStatusReady: true,
      isOnboardingOpen: false,
      onboardingMode: 'initial'
    });

    return { success: true, unsyncedCount: 0 };
  }
}));

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (
      event.key !== null
      && event.key !== STORAGE_KEY_TOKEN
      && event.key !== LEGACY_STORAGE_KEY_FIREBASE_TOKEN
      && event.key !== STORAGE_KEY_REFRESH_TOKEN
    ) {
      return;
    }
    useAuthStore.getState().adoptStoredSessionTokens();
  });
}

export function isDemoMode(): boolean {
  const auth = useAuthStore.getState();
  return Boolean(auth.isDemo || auth.userEmail === 'demo@fluent-tindahan.ph');
}
