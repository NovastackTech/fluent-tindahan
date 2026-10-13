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

  it('completes onboarding and persists store identity to localStorage', () => {
    useAuthStore.setState({
      tier: 'TindahanPro',
      subscriptionEndDate: '2030-01-01T00:00:00.000Z'
    });
    useAuthStore.getState().completeOnboarding({
      businessName: 'Tindahan ni Pedro',
      ownerName: 'Pedro Penduko',
      userPhone: '09198765432',
      tenantId: 'custom-tenant-uuid',
      userId: 'custom-user-uuid'
    });

    const state = useAuthStore.getState();
    expect(state.isOnboarded).toBe(true);
    expect(state.businessName).toBe('Tindahan ni Pedro');
    expect(state.ownerName).toBe('Pedro Penduko');
    expect(state.userPhone).toBe('09198765432');
    expect(state.tenantId).toBe('custom-tenant-uuid');
    expect(state.userId).toBe('custom-user-uuid');
    expect(state.tier).toBe('Libre');
    expect(state.subscriptionEndDate).toBeNull();

    expect(localStorage.getItem('fluent_tindahan_store_name_v1')).toBe('Tindahan ni Pedro');
    expect(localStorage.getItem('fluent_tindahan_onboarded_v1')).toBe('true');
    expect(localStorage.getItem('fluent_tindahan_tier_v1')).toBe('Libre');
    expect(localStorage.getItem('fluent_tindahan_subs_end_v1')).toBeNull();
  });

  it('updates store profile metadata cleanly', () => {
    useAuthStore.getState().updateStoreProfile({
      businessName: 'Pedro Mini Mart',
      ownerName: 'Pedro P.',
      userPhone: '09190001122'
    });

    const state = useAuthStore.getState();
    expect(state.businessName).toBe('Pedro Mini Mart');
    expect(state.ownerName).toBe('Pedro P.');
    expect(state.userPhone).toBe('09190001122');
    expect(localStorage.getItem('fluent_tindahan_store_name_v1')).toBe('Pedro Mini Mart');
  });
});
