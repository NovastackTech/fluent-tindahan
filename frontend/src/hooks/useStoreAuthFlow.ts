import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../state/authStore';
import { useTranslation } from '../state/languageStore';
import { db } from '../db/db';
import { processSyncQueue } from '../sync/syncEngine';
import { verifyEmailOtp, resendEmailOtp, type AuthResponseDto } from '../services/authService';
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
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const { loginWithAuthPayload } = useAuthStore();
  const { t } = useTranslation();

  const [isUnsyncedDialogOpen, setIsUnsyncedDialogOpen] = useState(false);
  const [unsyncedLoginCount, setUnsyncedLoginCount] = useState(0);
  const [pendingAuthPayload, setPendingAuthPayload] = useState<PendingAuthPayload | null>(null);
  const [isSyncingFirst, setIsSyncingFirst] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingOtpEmail, setPendingOtpEmail] = useState<string | null>(null);
  const [pendingOtpLocalPin, setPendingOtpLocalPin] = useState<string | undefined>(undefined);
  const [pendingDeletionInfo, setPendingDeletionInfo] = useState<{
    scheduledAt: string | null;
    retryWithRestore: () => Promise<boolean>;
  } | null>(null);

  const clearPendingDeletionInfo = () => setPendingDeletionInfo(null);

  const closeUnsyncedDialog = () => {
    setIsUnsyncedDialogOpen(false);
    setPendingAuthPayload(null);
    setPendingOtpLocalPin(undefined);
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
      if (isMountedRef.current && typeof window !== 'undefined') {
        if (pendingAuthPayload.payload.requiresEmailVerification) {
          setPendingOtpEmail(pendingAuthPayload.payload.email);
        } else {
          options?.onSuccess?.(pendingAuthPayload.payload);
        }
      }
    } finally {
      if (isMountedRef.current && typeof window !== 'undefined') {
        setIsSubmitting(false);
        setPendingAuthPayload(null);
      }
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
      if (isMountedRef.current && typeof window !== 'undefined') {
        setUnsyncedLoginCount(remaining);
      }
      if (remaining === 0 && pendingAuthPayload) {
        if (isMountedRef.current && typeof window !== 'undefined') {
          setIsUnsyncedDialogOpen(false);
        }
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
        if (isMountedRef.current && typeof window !== 'undefined') {
          if (pendingAuthPayload.payload.requiresEmailVerification) {
            setPendingOtpEmail(pendingAuthPayload.payload.email);
          } else {
            options?.onSuccess?.(pendingAuthPayload.payload);
          }
        }
      }
    } catch (e) {
      console.warn('Sync attempt failed:', e);
    } finally {
      if (isMountedRef.current && typeof window !== 'undefined') {
        setIsSyncingFirst(false);
      }
    }
  };

  const handleStoreLogin = async (params: ExecuteStoreLoginParams): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const res = await executeStoreLogin(params);
      setPendingDeletionInfo(null);
      if (!res.success && res.authResult) {
        if (isMountedRef.current && typeof window !== 'undefined') {
          setPendingAuthPayload({
            payload: res.authResult,
            localPin: res.localPin,
            newUserPreferences: res.newUserPreferences
          });
          setUnsyncedLoginCount(res.unsyncedCount || 0);
          setIsUnsyncedDialogOpen(true);
        }
        return false;
      }
      if (res.authResult?.requiresEmailVerification) {
        if (isMountedRef.current && typeof window !== 'undefined') {
          setPendingOtpEmail(res.authResult.email || params.email.trim());
          setPendingOtpLocalPin(res.localPin);
        }
        return true;
      }
      options?.onSuccess?.(res.authResult);
      return true;
    } catch (apiErr: any) {
      const status = apiErr?.response?.status;
      const responseData = apiErr?.response?.data;
      if (status === 409 && responseData?.pendingDeletion) {
        setPendingDeletionInfo({
          scheduledAt: responseData?.deletionScheduledAt || null,
          retryWithRestore: () => handleStoreLogin({ ...params, restoreAccount: true })
        });
        return false;
      }
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
      if (isMountedRef.current && typeof window !== 'undefined') {
        setIsSubmitting(false);
      }
    }
  };

  const handleStoreRegistration = async (
    params: ExecuteStoreRegistrationParams
  ): Promise<ExecuteStoreRegistrationResult> => {
    setIsSubmitting(true);
    try {
      const result = await executeStoreRegistration(params);
      if (result.success) {
        if (result.requiresEmailVerification) {
          if (isMountedRef.current && typeof window !== 'undefined') {
            setPendingOtpEmail(params.email.trim());
            setPendingOtpLocalPin(params.pin);
          }
        } else {
          options?.onSuccess?.(result.authResult);
        }
      }
      return result;
    } catch (err: any) {
      params.onError?.(err?.response?.data?.message || err?.message || t.onboarding.submitError);
      return { success: false };
    } finally {
      if (isMountedRef.current && typeof window !== 'undefined') {
        setIsSubmitting(false);
      }
    }
  };

  const handleVerifyEmailOtp = async (
    otp: string,
    onError?: (msg: string) => void
  ): Promise<boolean> => {
    const cleanedOtp = otp.replace(/\D/g, '').trim();
    if (cleanedOtp.length !== 6) {
      onError?.(t.onboarding.otpInvalid);
      return false;
    }
    setIsSubmitting(true);
    try {
      const verifiedDto = await verifyEmailOtp({
        email: pendingOtpEmail || undefined,
        otp: cleanedOtp
      });
      const loginRes = await loginWithAuthPayload(verifiedDto, pendingOtpLocalPin);
      if (!loginRes.success) {
        if (isMountedRef.current && typeof window !== 'undefined') {
          setPendingAuthPayload({ payload: { ...verifiedDto, requiresEmailVerification: false }, localPin: pendingOtpLocalPin });
          setUnsyncedLoginCount(loginRes.unsyncedCount || 0);
          setIsUnsyncedDialogOpen(true);
          setPendingOtpEmail(null);
          setPendingOtpLocalPin(undefined);
        }
        return true;
      }
      await finalizeSuccessfulLogin(verifiedDto.tenantId, {
        isNewUser: verifiedDto.isNewUser,
        businessName: verifiedDto.businessName
      });
      if (isMountedRef.current && typeof window !== 'undefined') {
        setPendingOtpEmail(null);
        setPendingOtpLocalPin(undefined);
      }
      options?.onSuccess?.(verifiedDto);
      return true;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || t.onboarding.otpInvalid;
      onError?.(msg);
      return false;
    } finally {
      if (isMountedRef.current && typeof window !== 'undefined') {
        setIsSubmitting(false);
      }
    }
  };

  const handleResendEmailOtp = async (
    onSuccess?: (msg: string) => void,
    onError?: (msg: string) => void
  ): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const res = await resendEmailOtp({
        email: pendingOtpEmail || undefined
      });
      onSuccess?.(res?.message || t.onboarding.otpResentNotice);
      return true;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || t.onboarding.submitError;
      onError?.(msg);
      return false;
    } finally {
      if (isMountedRef.current && typeof window !== 'undefined') {
        setIsSubmitting(false);
      }
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
          if (isMountedRef.current && typeof window !== 'undefined') {
            setPendingOtpEmail(null);
          }
          options?.onSuccess?.();
        },
        onUnsyncedDetected: (count, payload, localPin, newUserPreferences) => {
          if (isMountedRef.current && typeof window !== 'undefined') {
            setPendingAuthPayload({ payload, localPin, newUserPreferences });
            setUnsyncedLoginCount(count);
            setIsUnsyncedDialogOpen(true);
          }
        },
        onError: (msg) => {
          params.onError?.(msg);
        },
        defaultErrorMessage: params.defaultErrorMessage || 'Google authentication failed'
      });
      return success;
    } finally {
      if (isMountedRef.current && typeof window !== 'undefined') {
        setIsSubmitting(false);
      }
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
    pendingOtpEmail,
    setPendingOtpEmail,
    pendingDeletionInfo,
    clearPendingDeletionInfo,
    closeUnsyncedDialog,
    handleConfirmWipeAndLogin,
    handleSyncFirst,
    handleStoreLogin,
    handleStoreRegistration,
    handleVerifyEmailOtp,
    handleResendEmailOtp,
    handleGoogleAuth
  };
}

