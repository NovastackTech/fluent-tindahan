import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from './authStore';
import { DEFAULT_TENANT_ID, DEFAULT_USER_ID } from '../db/seedData';
import { DEMO_BUSINESS_NAME, DEMO_OWNER, DEMO_PHONE } from '../constants/demoProfile';

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      tenantId: DEFAULT_TENANT_ID,
      userId: DEFAULT_USER_ID,
      locallyCreatedTenantId: null,
      serverConfirmedTenantId: null,
      serverConfirmedUserId: null,
      businessName: DEMO_BUSINESS_NAME,
      ownerName: DEMO_OWNER,
      userPhone: DEMO_PHONE,
      role: 'Owner',
      firebaseToken: null,
      consentAccepted: false,
      isPrivacyNoticeOpen: false
    });
  });

  it('initializes with seed defaults and consent false', () => {
    const state = useAuthStore.getState();
    expect(state.tenantId).toBe(DEFAULT_TENANT_ID);
    expect(state.userId).toBe(DEFAULT_USER_ID);
    expect(state.businessName).toBe(DEMO_BUSINESS_NAME);
    expect(state.role).toBe('Owner');
    expect(state.consentAccepted).toBe(false);
    expect(state.isPrivacyNoticeOpen).toBe(false);
  });

  it('does not treat the default tenant subscription as completed onboarding after reload', async () => {
    localStorage.setItem('fluent_tindahan_tier_v1', 'TindahanPro');
    localStorage.setItem('fluent_tindahan_subs_end_v1', '2030-01-01T00:00:00.000Z');
    vi.resetModules();

    const { useAuthStore: reloadedAuthStore } = await import('./authStore');

    expect(reloadedAuthStore.getState().tier).toBe('TindahanPro');
    expect(reloadedAuthStore.getState().isOnboarded).toBe(false);
  });

  it('updates consentAccepted and persists to localStorage', () => {
    useAuthStore.getState().setConsentAccepted(true);

    expect(useAuthStore.getState().consentAccepted).toBe(true);
    expect(localStorage.getItem('fluent_tindahan_consent_v1')).toBe('true');

    useAuthStore.getState().setConsentAccepted(false);
    expect(useAuthStore.getState().consentAccepted).toBe(false);
    expect(localStorage.getItem('fluent_tindahan_consent_v1')).toBe('false');
  });

  it('toggles isPrivacyNoticeOpen without affecting consentAccepted', () => {
    useAuthStore.getState().setConsentAccepted(true);
    expect(useAuthStore.getState().isPrivacyNoticeOpen).toBe(false);

    useAuthStore.getState().openPrivacyNotice();
    expect(useAuthStore.getState().isPrivacyNoticeOpen).toBe(true);
    expect(useAuthStore.getState().consentAccepted).toBe(true);

    useAuthStore.getState().closePrivacyNotice();
    expect(useAuthStore.getState().isPrivacyNoticeOpen).toBe(false);
    expect(useAuthStore.getState().consentAccepted).toBe(true);

    useAuthStore.getState().setIsPrivacyNoticeOpen(true);
    expect(useAuthStore.getState().isPrivacyNoticeOpen).toBe(true);
  });

  it('sets custom tenantId', () => {
    const customTenant = '99999999-9999-9999-9999-999999999999';
    useAuthStore.getState().setTenantId(customTenant);

    expect(useAuthStore.getState().tenantId).toBe(customTenant);
  });

  it('persists server-confirmed tenant and user identity', () => {
    const tenantId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    useAuthStore.getState().confirmServerIdentity(tenantId, userId);

    expect(useAuthStore.getState().serverConfirmedTenantId).toBe(tenantId);
    expect(useAuthStore.getState().serverConfirmedUserId).toBe(userId);
    expect(localStorage.getItem('fluent_tindahan_server_confirmed_tenant_id_v1')).toBe(tenantId);
    expect(localStorage.getItem('fluent_tindahan_server_confirmed_user_id_v1')).toBe(userId);
    expect(localStorage.getItem('fluent_tindahan_tenant_id_v1')).toBe(tenantId);
    expect(localStorage.getItem('fluent_tindahan_user_id_v1')).toBe(userId);
  });

  it('replaces and persists the shared default owner ID when migrating a legacy store', () => {
    useAuthStore.setState({ userId: DEFAULT_USER_ID });

    useAuthStore.getState().resolveOnboardingStatus(true);

    const migratedUserId = useAuthStore.getState().userId;
    expect(migratedUserId).not.toBe(DEFAULT_USER_ID);
    expect(migratedUserId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(localStorage.getItem('fluent_tindahan_user_id_v1')).toBe(migratedUserId);
    expect(useAuthStore.getState().isOnboarded).toBe(true);
  });

  it('does not replace the default owner ID before onboarding', () => {
    useAuthStore.setState({ userId: DEFAULT_USER_ID });

    useAuthStore.getState().resolveOnboardingStatus(false);

    expect(useAuthStore.getState().userId).toBe(DEFAULT_USER_ID);
    expect(localStorage.getItem('fluent_tindahan_user_id_v1')).toBeNull();
  });

  it('sets firebase token and clears it on logout', () => {
    useAuthStore.getState().setFirebaseToken('sample-jwt-token');
    expect(useAuthStore.getState().firebaseToken).toBe('sample-jwt-token');

    useAuthStore.getState().logout();
    expect(useAuthStore.getState().firebaseToken).toBeNull();
  });

  it('resets subscription state when onboarding creates a new tenant', () => {
    localStorage.setItem('fluent_tindahan_tier_v1', 'TindahanPro');
    localStorage.setItem('fluent_tindahan_subs_end_v1', '2030-01-01T00:00:00.000Z');
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
    expect(state.locallyCreatedTenantId).toBe('custom-tenant-uuid');
    expect(state.serverConfirmedTenantId).toBeNull();
    expect(localStorage.getItem('fluent_tindahan_local_tenant_id_v1')).toBe('custom-tenant-uuid');
    expect(state.tier).toBe('Libre');
    expect(state.subscriptionEndDate).toBeNull();

    expect(localStorage.getItem('fluent_tindahan_store_name_v1')).toBe('Tindahan ni Pedro');
    expect(localStorage.getItem('fluent_tindahan_onboarded_v1')).toBe('true');
    expect(localStorage.getItem('fluent_tindahan_tier_v1')).toBe('Libre');
    expect(localStorage.getItem('fluent_tindahan_subs_end_v1')).toBeNull();
  });

  it('mints and persists a real owner ID when onboarding creates a tenant from the default identity', () => {
    useAuthStore.setState({ userId: DEFAULT_USER_ID });

    useAuthStore.getState().completeOnboarding({
      businessName: 'Bagong Tindahan',
      tenantId: 'new-tenant-id'
    });

    const userId = useAuthStore.getState().userId;
    expect(userId).not.toBe(DEFAULT_USER_ID);
    expect(userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(localStorage.getItem('fluent_tindahan_user_id_v1')).toBe(userId);
  });

  it('stores blank optional profile fields without restoring demo values', () => {
    useAuthStore.getState().completeOnboarding({
      businessName: 'Tindahan ni Maria',
      ownerName: '  ',
      userPhone: ''
    });

    const state = useAuthStore.getState();
    expect(state.ownerName).toBe('');
    expect(state.userPhone).toBe('');
    expect(localStorage.getItem('fluent_tindahan_owner_name_v1')).toBe('');
    expect(localStorage.getItem('fluent_tindahan_user_phone_v1')).toBe('');
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

  it('allows clearing owner and phone while updating the store profile', () => {
    useAuthStore.setState({ ownerName: 'Pedro P.', userPhone: '09190001122' });
    useAuthStore.getState().updateStoreProfile({
      businessName: 'Pedro Mini Mart',
      ownerName: '',
      userPhone: ''
    });

    const state = useAuthStore.getState();
    expect(state.ownerName).toBe('');
    expect(state.userPhone).toBe('');
    expect(localStorage.getItem('fluent_tindahan_owner_name_v1')).toBe('');
    expect(localStorage.getItem('fluent_tindahan_user_phone_v1')).toBe('');
  });
});
