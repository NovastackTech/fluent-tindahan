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
    expect(useAuthStore.getState().termsAcceptedVersion).toBe('2026-10-14');
    expect(localStorage.getItem('fluent_tindahan_consent_v1')).toBe('true');
    expect(localStorage.getItem('fluent_tindahan_terms_version_v1')).toBe('2026-10-14');

    useAuthStore.getState().setConsentAccepted(false);
    expect(useAuthStore.getState().consentAccepted).toBe(false);
    expect(useAuthStore.getState().termsAcceptedVersion).toBeNull();
    expect(localStorage.getItem('fluent_tindahan_consent_v1')).toBe('false');
    expect(localStorage.getItem('fluent_tindahan_terms_version_v1')).toBeNull();
  });

  it('allows setting custom termsAcceptedVersion directly', () => {
    useAuthStore.getState().setTermsAcceptedVersion('2027-01-01');
    expect(useAuthStore.getState().termsAcceptedVersion).toBe('2027-01-01');
    expect(localStorage.getItem('fluent_tindahan_terms_version_v1')).toBe('2027-01-01');

    useAuthStore.getState().setTermsAcceptedVersion(null);
    expect(useAuthStore.getState().termsAcceptedVersion).toBeNull();
    expect(localStorage.getItem('fluent_tindahan_terms_version_v1')).toBeNull();
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

  it('sets firebase token and clears it on logout', async () => {
    useAuthStore.getState().setFirebaseToken('sample-jwt-token');
    expect(useAuthStore.getState().firebaseToken).toBe('sample-jwt-token');

    await useAuthStore.getState().logout(true);
    expect(useAuthStore.getState().firebaseToken).toBeNull();
    expect(useAuthStore.getState().businessName).toBe('');
    expect(useAuthStore.getState().ownerName).toBe('');
    expect(useAuthStore.getState().userPhone).toBe('');
    expect(useAuthStore.getState().isOnboarded).toBe(false);
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

  it('sets and persists user email and last login email', () => {
    useAuthStore.getState().setUserEmail('nanay.suki@gmail.com');

    expect(useAuthStore.getState().userEmail).toBe('nanay.suki@gmail.com');
    expect(localStorage.getItem('fluent_tindahan_user_email_v1')).toBe('nanay.suki@gmail.com');
    expect(localStorage.getItem('fluent_tindahan_last_email_v1')).toBe('nanay.suki@gmail.com');
  });

  it('manages PIN status and local verifier', () => {
    useAuthStore.getState().setHasPin(true);
    useAuthStore.getState().setLocalPinVerifier('mock-sha256-hash');
    useAuthStore.getState().setIsSessionLocked(true);

    expect(useAuthStore.getState().hasPin).toBe(true);
    expect(useAuthStore.getState().localPinVerifier).toBe('mock-sha256-hash');
    expect(useAuthStore.getState().isSessionLocked).toBe(true);

    useAuthStore.getState().setHasPin(false);
    expect(useAuthStore.getState().hasPin).toBe(false);
    expect(useAuthStore.getState().localPinVerifier).toBeNull();
    expect(useAuthStore.getState().isSessionLocked).toBe(false);
  });

  it('logs in with auth payload, updating identity and token', async () => {
    const authPayload = {
      tenantId: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      email: 'owner@tindahan.ph',
      businessName: 'Cloud Tindahan',
      ownerName: 'Nanay Nena',
      phone: '09171234567',
      role: 'Owner' as const,
      tier: 'TindahanPro' as const,
      planTier: 'TindahanPro',
      subscriptionEndDate: '2028-12-31T23:59:59Z',
      hasPin: true,
      token: 'jwt-auth-token-123',
      expiresAt: '2027-10-15T00:00:00Z'
    };

    await useAuthStore.getState().loginWithAuthPayload(authPayload, '1234');

    const state = useAuthStore.getState();
    expect(state.tenantId).toBe(authPayload.tenantId);
    expect(state.userId).toBe(authPayload.userId);
    expect(state.userEmail).toBe('owner@tindahan.ph');
    expect(state.businessName).toBe('Cloud Tindahan');
    expect(state.hasPin).toBe(true);
    expect(state.firebaseToken).toBe('jwt-auth-token-123');
    expect(state.localPinVerifier).not.toBeNull();
    expect(state.tier).toBe('TindahanPro');
    expect(localStorage.getItem('fluent_tindahan_tenant_id_v1')).toBe(authPayload.tenantId);
  });

  it('guards against logout when unsynced items exist in syncQueue unless forceWipe is true', async () => {
    const { db } = await import('../db/db');
    await db.syncQueue.add({
      id: 'pending-sale-uuid',
      entity: 'Sale',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: { id: 's1', total: 100 },
      status: 'Pending',
      retryCount: 0
    });

    const gentleResult = await useAuthStore.getState().logout(false);
    expect(gentleResult.success).toBe(false);
    expect(gentleResult.unsyncedCount).toBe(1);
    expect(useAuthStore.getState().isOnboarded).toBe(true); // still logged in

    const forceResult = await useAuthStore.getState().logout(true);
    expect(forceResult.success).toBe(true);
    expect(forceResult.unsyncedCount).toBe(0);
    expect(useAuthStore.getState().isOnboarded).toBe(false);
    expect(await db.syncQueue.count()).toBe(0);
  });
});
