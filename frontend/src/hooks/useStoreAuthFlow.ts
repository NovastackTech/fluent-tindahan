import { useState } from 'react';
import { useAuthStore } from '../state/authStore';
import { useTranslation } from '../state/languageStore';
import { db } from '../db/db';
import { processSyncQueue } from '../sync/syncEngine';
import type { AuthResponseDto } from '../services/authService';
import {
  executeStoreRegistration,
  executeStoreLogin,
  processGoogleAuthFlow,
  finalizeSuccessfulLogin,
  type ExecuteStoreRegistrationParams,
  type ExecuteStoreRegistrationResult,
  type ExecuteStoreLoginParams
} from '../services/storeRegistration';

export interface PendingAuthPayload {
  payload: AuthResponseDto;
  localPin?: string;
  newUserPreferences?: {
    offerGcash?: boolean;
    includeStarterProducts?: boolean;
  };
}

export interface UseStoreAuthFlowOptions {
  onSuccess?: (authPayload?: AuthResponseDto) => void;
}

export interface GoogleAuthFlowParams {
  accessToken: string;
  businessName?: string;
  pin?: string;
  offerGcash?: boolean;
  includeStarterProducts?: boolean;
  onError?: (msg: string) => void;
  defaultErrorMessage?: string;
}

export function useStoreAuthFlow(options?: UseStoreAuthFlowOptions) {
  const { loginWithAuthPayload } = useAuthStore();
  const { t } = useTranslation();

  const [isUnsyncedDialogOpen, setIsUnsyncedDialogOpen] = useState(false);
  const [unsyncedLoginCount, setUnsyncedLoginCount] = useState(0);
  const [pendingAuthPayload, setPendingAuthPayload] = useState<PendingAuthPayload | null>(null);
  const [isSyncingFirst, setIsSyncingFirst] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const closeUnsyncedDialog = () => {
    setIsUnsyncedDialogOpen(false);
    setPendingAuthPayload(null);
  };

  const handleConfirmWipeAndLogin = async () => {
    if (!pendingAuthPayload) return;
    setIsUnsyncedDialogOpen(false);
    setIsSubmitting(true);
    try {
      await loginWithAuthPayload(
        pendingAuthPayload.payload,
        pendingAuthPayload.localPin,
        true
      );
      await finalizeSuccessfulLogin(pendingAuthPayload.payload.tenantId, {
        isNewUser: pendingAuthPayload.payload.isNewUser,
        businessName: pendingAuthPayload.payload.businessName,
        offerGcash: pendingAuthPayload.newUserPreferences?.offerGcash,
        includeStarterProducts: pendingAuthPayload.newUserPreferences?.includeStarterProducts
      });
      options?.onSuccess?.(pendingAuthPayload.payload);
    } finally {
      setIsSubmitting(false);
      setPendingAuthPayload(null);
    }
  };

  const handleSyncFirst = async () => {
    setIsSyncingFirst(true);
    try {
      await processSyncQueue();
      const [syncCount, dlqCount] = await Promise.all([
        db.syncQueue.count(),
        db.deadLetterQueue.count()
      ]);
      const remaining = syncCount + dlqCount;
      setUnsyncedLoginCount(remaining);
      if (remaining === 0 && pendingAuthPayload) {
        setIsUnsyncedDialogOpen(false);
        await loginWithAuthPayload(
          pendingAuthPayload.payload,
          pendingAuthPayload.localPin,
          false
        );
        await finalizeSuccessfulLogin(pendingAuthPayload.payload.tenantId, {
          isNewUser: pendingAuthPayload.payload.isNewUser,
          businessName: pendingAuthPayload.payload.businessName,
          offerGcash: pendingAuthPayload.newUserPreferences?.offerGcash,
          includeStarterProducts: pendingAuthPayload.newUserPreferences?.includeStarterProducts
        });
        options?.onSuccess?.(pendingAuthPayload.payload);
      }
    } catch (e) {
      console.warn('Sync attempt failed:', e);
    } finally {
      setIsSyncingFirst(false);
    }
  };

  const handleStoreLogin = async (params: ExecuteStoreLoginParams): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const res = await executeStoreLogin(params);
      if (!res.success && res.authResult) {
        setPendingAuthPayload({
          payload: res.authResult,
          localPin: res.localPin,
          newUserPreferences: res.newUserPreferences
        });
        setUnsyncedLoginCount(res.unsyncedCount || 0);
        setIsUnsyncedDialogOpen(true);
        return false;
      }
      options?.onSuccess?.(res.authResult);
      return true;
    } catch (apiErr: any) {
      const status = apiErr?.response?.status;
      const responseData = apiErr?.response?.data;
      if (status === 429) {
        params.onError?.(responseData?.message || t.settings.invalidPinOrPassword);
      } else if (status === 401) {
        params.onError?.(responseData?.message || t.onboarding.loginFailed);
      } else if (!navigator.onLine || apiErr?.code === 'ERR_NETWORK') {
        params.onError?.(t.banner.offlineDesc);
      } else {
        params.onError?.(responseData?.message || t.onboarding.loginFailed);
      }
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStoreRegistration = async (
    params: ExecuteStoreRegistrationParams
  ): Promise<ExecuteStoreRegistrationResult> => {
    setIsSubmitting(true);
    try {
      const result = await executeStoreRegistration(params);
      if (result.success) {
        options?.onSuccess?.();
      }
      return result;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async (params: GoogleAuthFlowParams): Promise<boolean> => {
    setIsSubmitting(true);
    let success = false;
    try {
      await processGoogleAuthFlow({
        accessToken: params.accessToken,
        businessName: params.businessName,
        pin: params.pin,
        offerGcash: params.offerGcash,
        includeStarterProducts: params.includeStarterProducts,
        onSuccess: () => {
          success = true;
          options?.onSuccess?.();
        },
        onUnsyncedDetected: (count, payload, localPin, newUserPreferences) => {
          setPendingAuthPayload({ payload, localPin, newUserPreferences });
          setUnsyncedLoginCount(count);
          setIsUnsyncedDialogOpen(true);
        },
        onError: (msg) => {
          params.onError?.(msg);
        },
        defaultErrorMessage: params.defaultErrorMessage || 'Google authentication failed'
      });
      return success;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isUnsyncedDialogOpen,
    setIsUnsyncedDialogOpen,
    unsyncedLoginCount,
    setUnsyncedLoginCount,
    pendingAuthPayload,
    setPendingAuthPayload,
    isSyncingFirst,
    isSubmitting,
    setIsSubmitting,
    closeUnsyncedDialog,
    handleConfirmWipeAndLogin,
    handleSyncFirst,
    handleStoreLogin,
    handleStoreRegistration,
    handleGoogleAuth
  };
}
