import { registerStore, loginStore, loginPin, authenticateWithGoogle, type AuthResponseDto } from './authService';
import { createClientUuid, seedDexieDatabaseIfNeeded } from '../db/seedData';
import { useGCashFeeStore, DEFAULT_GCASH_FEE_TIERS } from '../state/gcashFeeStore';
import { useAuthStore } from '../state/authStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { updateQueueCounts, kickSync, restoreTenantDataFromServer, processSyncQueue } from '../sync/syncEngine';

export interface ExecuteStoreRegistrationParams {
  businessName: string;
  email: string;
  password?: string;
  pin?: string;
  ownerName?: string;
  phone?: string;
  offerGcash?: boolean;
  offersGcash?: boolean;
  includeStarterProducts?: boolean;
  tenantId?: string;
  userId?: string;
  onError?: (msg: string) => void;
  onOfflineNotice?: () => void;
}

export interface ExecuteStoreRegistrationResult {
  success: boolean;
  emailAlreadyExists?: boolean;
  requiresEmailVerification?: boolean;
  authResult?: AuthResponseDto;
}

export async function executeStoreRegistration(
  params: ExecuteStoreRegistrationParams
): Promise<ExecuteStoreRegistrationResult> {
  const newTenantId = params.tenantId || createClientUuid();
  const newUserId = params.userId || createClientUuid();

  // 1. Seed Dexie first (Zero Network Block Guarantee)
  await seedDexieDatabaseIfNeeded(
    false,
    newTenantId,
    params.includeStarterProducts === false,
    params.businessName
  );

  // 2. Save initial GCash fees
  try {
    const isOfferingGcash = params.offersGcash !== undefined
      ? params.offersGcash
      : params.offerGcash !== false;
    const fees = isOfferingGcash ? DEFAULT_GCASH_FEE_TIERS : DEFAULT_GCASH_FEE_TIERS.map(() => 0);
    fees.forEach((fee, idx) => {
      useGCashFeeStore.getState().setFeeForTenant(newTenantId, idx, fee);
    });
  } catch (fErr) {
    console.warn('Could not set GCash fees:', fErr);
  }

  let serverToken: string | undefined;
  let registeredHasPin = Boolean(params.pin?.trim());
  let authResult: AuthResponseDto | undefined;

  try {
    authResult = await registerStore({
      tenantId: newTenantId,
      userId: newUserId,
      email: params.email,
      password: params.password || '',
      pin: params.pin?.trim() || undefined,
      businessName: params.businessName,
      ownerName: params.ownerName?.trim() || undefined,
      phone: params.phone?.trim() || undefined
    });
    serverToken = authResult.token;
    registeredHasPin = authResult.hasPin;
  } catch (apiErr: any) {
    if (apiErr?.response?.status === 409) {
      params.onError?.(apiErr?.response?.data?.message || 'Email already exists');
      return { success: false, emailAlreadyExists: true };
    }
    if (apiErr?.response?.status === 400) {
      params.onError?.(apiErr?.response?.data?.message || 'Invalid registration data');
      return { success: false };
    }
    console.warn('Backend registration offline, proceeding locally:', apiErr);
    params.onOfflineNotice?.();
  }

  useAuthStore.getState().completeOnboarding({
    businessName: params.businessName,
    ownerName: params.ownerName?.trim() || undefined,
    userPhone: params.phone?.trim() || undefined,
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

  return {
    success: true,
    requiresEmailVerification: Boolean(authResult?.requiresEmailVerification),
    authResult
  };
}

export interface FinalizeLoginOptions {
  isNewUser?: boolean;
  businessName?: string;
  includeStarterProducts?: boolean;
  offerGcash?: boolean;
}

export async function finalizeSuccessfulLogin(
  tenantId: string,
  options?: FinalizeLoginOptions
): Promise<void> {
  if (options?.isNewUser) {
    await seedDexieDatabaseIfNeeded(
      false,
      tenantId,
      options.includeStarterProducts === false,
      options.businessName
    );

    try {
      const fees = options.offerGcash !== false ? DEFAULT_GCASH_FEE_TIERS : DEFAULT_GCASH_FEE_TIERS.map(() => 0);
      fees.forEach((fee, idx) => {
        useGCashFeeStore.getState().setFeeForTenant(tenantId, idx, fee);
      });
    } catch (fErr) {
      console.warn('Could not set GCash fees:', fErr);
    }
  }

  void useSubscriptionStore.getState().refreshSubscription();
  void restoreTenantDataFromServer().catch(console.error);
  void processSyncQueue().catch(console.error);
}

export interface ExecuteStoreLoginParams {
  email: string;
  loginMode: 'password' | 'pin';
  password?: string;
  pin?: string;
  onError?: (msg: string) => void;
}

export interface ExecuteStoreLoginResult {
  success: boolean;
  unsyncedCount?: number;
  authResult?: AuthResponseDto;
  localPin?: string;
  newUserPreferences?: {
    offerGcash?: boolean;
    includeStarterProducts?: boolean;
  };
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

  await finalizeSuccessfulLogin(authResult.tenantId, {
    isNewUser: authResult.isNewUser,
    businessName: authResult.businessName
  });
  return { success: true, authResult };
}

export interface ExecuteGoogleAuthParams {
  accessToken?: string;
  idToken?: string;
  businessName?: string;
  pin?: string;
  offerGcash?: boolean;
  includeStarterProducts?: boolean;
}

export async function executeGoogleAuth(
  params: ExecuteGoogleAuthParams
): Promise<ExecuteStoreLoginResult> {
  const newTenantId = createClientUuid();
  const newUserId = createClientUuid();

  const authResult = await authenticateWithGoogle({
    accessToken: params.accessToken,
    idToken: params.idToken,
    tenantId: newTenantId,
    userId: newUserId,
    businessName: params.businessName?.trim() || undefined,
    pin: params.pin?.trim() || undefined
  });

  const localPin = params.pin?.trim() || undefined;
  const loginRes = await useAuthStore.getState().loginWithAuthPayload(
    authResult,
    localPin,
    false
  );

  const newUserPreferences = {
    offerGcash: params.offerGcash !== false,
    includeStarterProducts: params.includeStarterProducts !== false
  };

  if (!loginRes.success) {
    return {
      success: false,
      unsyncedCount: loginRes.unsyncedCount,
      authResult,
      localPin,
      newUserPreferences
    };
  }

  await finalizeSuccessfulLogin(authResult.tenantId, {
    isNewUser: authResult.isNewUser,
    businessName: authResult.businessName,
    includeStarterProducts: newUserPreferences.includeStarterProducts,
    offerGcash: newUserPreferences.offerGcash
  });
  return { success: true, authResult };
}

export interface ProcessGoogleAuthFlowParams extends ExecuteGoogleAuthParams {
  onSuccess: () => void;
  onUnsyncedDetected: (
    unsyncedCount: number,
    authResult: AuthResponseDto,
    localPin?: string,
    newUserPreferences?: { offerGcash?: boolean; includeStarterProducts?: boolean }
  ) => void;
  onError: (errorMessage: string) => void;
  defaultErrorMessage: string;
}

export async function processGoogleAuthFlow(
  params: ProcessGoogleAuthFlowParams
): Promise<void> {
  try {
    const res = await executeGoogleAuth({
      accessToken: params.accessToken,
      idToken: params.idToken,
      businessName: params.businessName,
      pin: params.pin,
      offerGcash: params.offerGcash,
      includeStarterProducts: params.includeStarterProducts
    });

    if (!res.success && res.authResult) {
      params.onUnsyncedDetected(
        res.unsyncedCount || 0,
        res.authResult,
        res.localPin,
        res.newUserPreferences
      );
      return;
    }

    params.onSuccess();
  } catch (err: any) {
    const msg = err?.response?.data?.message || err?.message || params.defaultErrorMessage;
    params.onError(msg);
  }
}

