import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';
import { DEFAULT_TENANT_ID, DEFAULT_USER_ID } from '../db/seedData';

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      tenantId: DEFAULT_TENANT_ID,
      userId: DEFAULT_USER_ID,
      businessName: "Aling Nena's Tindahan & GCash",
      userPhone: '09171234567',
      role: 'Owner',
      firebaseToken: null,
      consentAccepted: false
    });
  });

  it('initializes with seed defaults and consent false', () => {
    const state = useAuthStore.getState();
    expect(state.tenantId).toBe(DEFAULT_TENANT_ID);
    expect(state.userId).toBe(DEFAULT_USER_ID);
    expect(state.businessName).toBe("Aling Nena's Tindahan & GCash");
    expect(state.role).toBe('Owner');
    expect(state.consentAccepted).toBe(false);
  });

  it('updates consentAccepted and persists to localStorage', () => {
    useAuthStore.getState().setConsentAccepted(true);

    expect(useAuthStore.getState().consentAccepted).toBe(true);
    expect(localStorage.getItem('fluent_tindahan_consent_v1')).toBe('true');

    useAuthStore.getState().setConsentAccepted(false);
    expect(useAuthStore.getState().consentAccepted).toBe(false);
    expect(localStorage.getItem('fluent_tindahan_consent_v1')).toBe('false');
  });

  it('sets custom tenantId', () => {
    const customTenant = '99999999-9999-9999-9999-999999999999';
    useAuthStore.getState().setTenantId(customTenant);

    expect(useAuthStore.getState().tenantId).toBe(customTenant);
  });

  it('sets firebase token and clears it on logout', () => {
    useAuthStore.getState().setFirebaseToken('sample-jwt-token');
    expect(useAuthStore.getState().firebaseToken).toBe('sample-jwt-token');

    useAuthStore.getState().logout();
    expect(useAuthStore.getState().firebaseToken).toBeNull();
  });
});
