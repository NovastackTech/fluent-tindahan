import { registerStore, loginStore, loginPin, type AuthResponseDto } from './authService';
import { createClientUuid, seedDexieDatabaseIfNeeded } from '../db/seedData';
import { useGCashFeeStore, DEFAULT_GCASH_FEE_TIERS } from '../state/gcashFeeStore';
import { useAuthStore } from '../state/authStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { updateQueueCounts, kickSync, restoreTenantDataFromServer, processSyncQueue } from '../sync/syncEngine';

export interface ExecuteStoreRegistrationParams {
  businessName: string;
  email: string;
  password: string;
  pin?: string;
  offerGcash?: boolean;
  includeStarterProducts?: boolean;
}

export interface ExecuteStoreRegistrationResult {
  success: boolean;
  emailAlreadyExists?: boolean;
}

export async function executeStoreRegistration(
  params: ExecuteStoreRegistrationParams
): Promise<ExecuteStoreRegistrationResult> {
  const newTenantId = createClientUuid();
  const newUserId = createClientUuid();

  // 1. Seed Dexie first (Zero Network Block Guarantee)
  await seedDexieDatabaseIfNeeded(
    false,
    newTenantId,
    params.includeStarterProducts === false,
    params.businessName
  );

  // 2. Save initial GCash fees
  try {
    const fees = params.offerGcash !== false ? DEFAULT_GCASH_FEE_TIERS : DEFAULT_GCASH_FEE_TIERS.map(() => 0);
    fees.forEach((fee, idx) => {
      useGCashFeeStore.getState().setFeeForTenant(newTenantId, idx, fee);
    });
  } catch (fErr) {
    console.warn('Could not set GCash fees:', fErr);
  }

  let serverToken: string | undefined;
  let registeredHasPin = Boolean(params.pin?.trim());

  try {
    const authResult = await registerStore({
      tenantId: newTenantId,
      userId: newUserId,
      email: params.email,
      password: params.password,
      pin: params.pin?.trim() || undefined,
      businessName: params.businessName
    });
    serverToken = authResult.token;
    registeredHasPin = authResult.hasPin;
  } catch (apiErr: any) {
    if (apiErr?.response?.status === 409) {
      return { success: false, emailAlreadyExists: true };
    }
    console.warn('Backend registration offline, proceeding locally:', apiErr);
  }

  useAuthStore.getState().completeOnboarding({
    businessName: params.businessName,
    userEmail: params.email,
    tenantId: newTenantId,
    userId: newUserId,
    hasPin: registeredHasPin,
    localPin: params.pin?.trim() || undefined,
    token: serverToken
  });

  useSubscriptionStore.setState({
    tier: 'Libre',
    subscriptionEndDate: null,
    isActive: false,
    daysRemaining: null
  });

  void useSubscriptionStore.getState().refreshSubscription();
  await updateQueueCounts();
  void kickSync();

  return { success: true };
}

export async function finalizeSuccessfulLogin(_tenantId: string): Promise<void> {
  void useSubscriptionStore.getState().refreshSubscription();
  void restoreTenantDataFromServer().catch(console.error);
  void processSyncQueue().catch(console.error);
}

export interface ExecuteStoreLoginParams {
  email: string;
  loginMode: 'password' | 'pin';
  password?: string;
  pin?: string;
}

export interface ExecuteStoreLoginResult {
  success: boolean;
  unsyncedCount?: number;
  authResult?: AuthResponseDto;
  localPin?: string;
}

export async function executeStoreLogin(
  params: ExecuteStoreLoginParams
): Promise<ExecuteStoreLoginResult> {
  const trimmedEmail = params.email.trim();
  let authResult: AuthResponseDto;
  if (params.loginMode === 'password') {
    authResult = await loginStore({
      email: trimmedEmail,
      password: params.password || ''
    });
  } else {
    authResult = await loginPin({
      email: trimmedEmail,
      pin: (params.pin || '').trim()
    });
  }

  const localPin = params.loginMode === 'pin' ? (params.pin || '').trim() : undefined;
  const loginRes = await useAuthStore.getState().loginWithAuthPayload(
    authResult,
    localPin,
    false
  );

  if (!loginRes.success) {
    return {
      success: false,
      unsyncedCount: loginRes.unsyncedCount,
      authResult,
      localPin
    };
  }

  await finalizeSuccessfulLogin(authResult.tenantId);
  return { success: true };
}
