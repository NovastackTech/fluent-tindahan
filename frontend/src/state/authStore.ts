import { create } from 'zustand';
import { DEFAULT_TENANT_ID, DEFAULT_USER_ID } from '../db/seedData';

interface AuthState {
  tenantId: string;
  userId: string;
  businessName: string;
  userPhone: string;
  role: 'Owner' | 'Staff';
  firebaseToken: string | null;
  consentAccepted: boolean;
  setConsentAccepted: (accepted: boolean) => void;
  setTenantId: (tenantId: string) => void;
  setFirebaseToken: (token: string | null) => void;
  logout: () => void;
}

const STORAGE_KEY_CONSENT = 'fluent_tindahan_consent_v1';
const initialConsent = localStorage.getItem(STORAGE_KEY_CONSENT) === 'true';

export const useAuthStore = create<AuthState>((set) => ({
  tenantId: DEFAULT_TENANT_ID,
  userId: DEFAULT_USER_ID,
  businessName: "Aling Nena's Tindahan & GCash",
  userPhone: '09171234567',
  role: 'Owner',
  firebaseToken: null,
  consentAccepted: initialConsent,

  setConsentAccepted: (accepted: boolean) => {
    localStorage.setItem(STORAGE_KEY_CONSENT, accepted ? 'true' : 'false');
    set({ consentAccepted: accepted });
  },

  setTenantId: (tenantId: string) => set({ tenantId }),

  setFirebaseToken: (token: string | null) => set({ firebaseToken: token }),

  logout: () => {
    set({
      firebaseToken: null
    });
  }
}));
