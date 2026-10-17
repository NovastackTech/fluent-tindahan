import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Field,
  Input,
  RadioGroup,
  Radio,
  Checkbox,
  Button,
  Text,
  Badge,
  TabList,
  Tab,
  makeStyles,
  tokens,
  shorthands,
  Spinner,
  mergeClasses
} from '@fluentui/react-components';
import {
  BuildingShopRegular,
  PersonRegular,
  PhoneRegular,
  BoxRegular,
  CheckmarkRegular,
  DismissRegular,
  SparkleRegular,
  PhoneLaptopRegular,
  MailRegular,
  LockClosedRegular,
  KeyRegular,
  EyeRegular,
  EyeOffRegular
} from '@fluentui/react-icons';
import {
  DEMO_BUSINESS_NAME,
  DEMO_OWNER,
  DEMO_PHONE,
  STORAGE_KEY_LAST_EMAIL,
  useAuthStore
} from '../state/authStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { useTranslation } from '../state/languageStore';
import { getLocalizedSyncErrorMessage } from '../utils/syncErrors';
import { createClientUuid, seedDexieDatabaseIfNeeded } from '../db/seedData';
import { db } from '../db/db';
import { normalizePhilippineMobile } from '../utils/philippineMobile';
import { DEFAULT_GCASH_FEE_TIERS, useGCashFeeStore } from '../state/gcashFeeStore';
import { processSyncQueue, updateQueueCounts, kickSync, pullCatalogFromServer } from '../sync/syncEngine';
import { ConfirmUnsyncedLoginDialog } from './ConfirmUnsyncedLoginDialog';
import { registerStore, loginStore, loginPin, updateProfile, type AuthResponseDto } from '../services/authService';
import { queuePendingProfileUpdate, clearPendingProfileUpdate } from '../services/profileSync';

const useStyles = makeStyles({
  surface: {
    maxWidth: '560px',
    width: '95vw',
    maxHeight: '90vh',
    overflowY: 'auto',
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusLarge)
  },
  headerIcon: {
    width: '42px',
    height: '42px',
    ...shorthands.borderRadius(tokens.borderRadiusCircular),
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralBackground1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    flexShrink: 0
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM
  },
  titleArea: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    gap: tokens.spacingVerticalXS
  },
  tabNav: {
    marginBottom: tokens.spacingVerticalM
  },
  formSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalL
  },
  catalogCard: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    marginTop: tokens.spacingVerticalXS
  },
  radioLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalM
  },
  passwordInputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  switchPrompt: {
    textAlign: 'center',
    marginTop: tokens.spacingVerticalM
  },
  statusNotice: {
    display: 'block',
    marginBottom: tokens.spacingVerticalM,
    ...shorthands.padding('8px', '12px'),
    ...shorthands.borderRadius(tokens.borderRadiusMedium)
  },
  errorNotice: {
    color: tokens.colorPaletteRedForeground1,
    backgroundColor: tokens.colorPaletteRedBackground1
  },
  warningNotice: {
    color: tokens.colorPaletteYellowForeground1,
    backgroundColor: tokens.colorPaletteYellowBackground1
  }
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN_REGEX = /^\d{4,6}$/;

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const PasswordInput: React.FC<PasswordInputProps> = ({ value, onChange, placeholder }) => {
  const styles = useStyles();
  const [show, setShow] = useState(false);

  return (
    <div className={styles.passwordInputWrapper}>
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(_, data) => onChange(data.value)}
        placeholder={placeholder}
        contentBefore={<LockClosedRegular />}
        contentAfter={
          <Button
            appearance="subtle"
            size="small"
            icon={show ? <EyeOffRegular /> : <EyeRegular />}
            onClick={() => setShow((prev) => !prev)}
            type="button"
          />
        }
        style={{ width: '100%' }}
      />
    </div>
  );
};

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const PinInput: React.FC<PinInputProps> = ({ value, onChange, placeholder }) => (
  <Input
    type="password"
    inputMode="numeric"
    pattern="[0-9]*"
    maxLength={6}
    value={value}
    onChange={(_, data) => {
      const cleaned = data.value.replace(/\D/g, '').slice(0, 6);
      onChange(cleaned);
    }}
    placeholder={placeholder}
    contentBefore={<KeyRegular />}
  />
);

interface EmailFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

const EmailField: React.FC<EmailFieldProps> = ({
  label,
  value,
  onChange,
  error,
  placeholder,
  autoFocus
}) => (
  <Field
    label={label}
    required
    validationState={error ? 'error' : 'none'}
    validationMessage={error}
  >
    <Input
      type="email"
      value={value}
      onChange={(_, data) => onChange(data.value)}
      placeholder={placeholder}
      contentBefore={<MailRegular />}
      autoFocus={autoFocus}
    />
  </Field>
);

export const OnboardingModal: React.FC = () => {
  const styles = useStyles();
  const { t, language } = useTranslation();

  const {
    tenantId,
    businessName,
    ownerName,
    userPhone,
    userEmail,
    role,
    hasPin,
    consentAccepted,
    isOnboarded,
    isOnboardingOpen,
    onboardingMode,
    closeOnboarding,
    completeOnboarding,
    updateStoreProfile,
    loginWithAuthPayload
  } = useAuthStore();

  const isOpen = isOnboardingOpen && consentAccepted;
  const isEditMode = onboardingMode === 'edit' && isOnboarded;

  const [activeTab, setActiveTab] = useState<'register' | 'login'>('register');

  // Register Fields
  const [formBusinessName, setFormBusinessName] = useState('');
  const [formOwnerName, setFormOwnerName] = useState('');
  const [formUserPhone, setFormUserPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formCurrentPassword, setFormCurrentPassword] = useState('');
  const [formCurrentPin, setFormCurrentPin] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [catalogChoice, setCatalogChoice] = useState<'standard' | 'empty'>('standard');
  const [offersGcash, setOffersGcash] = useState(true);

  const isEmailChanged = isEditMode && formEmail.trim().toLowerCase() !== (userEmail || '').trim().toLowerCase();

  // Login Fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginMode, setLoginMode] = useState<'password' | 'pin'>('password');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPinVal, setLoginPinVal] = useState('');

  // Errors & States
  const [businessNameError, setBusinessNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pinError, setPinError] = useState('');
  const [submissionError, setSubmissionError] = useState('');
  const [offlineNotice, setOfflineNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const onboardingIds = useRef<{ tenantId: string; userId: string } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current);
      }
    };
  }, []);

  // Unsynced queue protection
  const [isUnsyncedDialogOpen, setIsUnsyncedDialogOpen] = useState(false);
  const [unsyncedLoginCount, setUnsyncedLoginCount] = useState(0);
  const [pendingAuthPayload, setPendingAuthPayload] = useState<{
    payload: AuthResponseDto;
    localPin?: string;
  } | null>(null);
  const [isSyncingFirst, setIsSyncingFirst] = useState(false);

  const clearValidationErrors = () => {
    setBusinessNameError('');
    setPhoneError('');
    setEmailError('');
    setPasswordError('');
    setPinError('');
    setCurrentPasswordError('');
    setSubmissionError('');
    setOfflineNotice('');
  };

  const finishLogin = async (payload: AuthResponseDto) => {
    useSubscriptionStore.setState({
      tier: payload.tier,
      subscriptionEndDate: payload.subscriptionEndDate,
      isActive: payload.tier !== 'Libre'
    });
    void useSubscriptionStore.getState().refreshSubscription();
    const productCount = await db.products.where('tenantId').equals(payload.tenantId).count();
    if (productCount === 0) {
      void pullCatalogFromServer().then(() => updateQueueCounts()).catch(console.error);
    }
    void processSyncQueue().catch(console.error);
    closeOnboarding();
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
      await finishLogin(pendingAuthPayload.payload);
    } finally {
      setIsSubmitting(false);
      setPendingAuthPayload(null);
    }
  };

  const handleSyncFirst = async () => {
    setIsSyncingFirst(true);
    try {
      await processSyncQueue();
      const remaining = await db.syncQueue.count();
      setUnsyncedLoginCount(remaining);
      if (remaining === 0 && pendingAuthPayload) {
        setIsUnsyncedDialogOpen(false);
        await loginWithAuthPayload(
          pendingAuthPayload.payload,
          pendingAuthPayload.localPin,
          false
        );
        await finishLogin(pendingAuthPayload.payload);
      }
    } catch (e) {
      console.warn('Sync attempt failed:', e);
    } finally {
      setIsSyncingFirst(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      /* oxlint-disable react/set-state-in-effect */
      const rememberedEmail = localStorage.getItem(STORAGE_KEY_LAST_EMAIL) || userEmail || '';
      if (isEditMode || isOnboarded) {
        setFormBusinessName(businessName || '');
        setFormOwnerName(ownerName || '');
        setFormUserPhone(userPhone || '');
        setFormEmail(rememberedEmail);
      } else {
        setFormBusinessName(businessName === DEMO_BUSINESS_NAME ? '' : businessName);
        setFormOwnerName(ownerName === DEMO_OWNER ? '' : ownerName);
        setFormUserPhone(userPhone === DEMO_PHONE ? '' : userPhone);
        setFormEmail(rememberedEmail);
      }
      setLoginEmail(rememberedEmail);
      setFormPassword('');
      setFormPin('');
      setLoginPassword('');
      setLoginPinVal('');
      setFormCurrentPassword('');
      setFormCurrentPin('');
      clearValidationErrors();
      setIsSubmitting(false);
    } else {
      onboardingIds.current = null;
    }
  }, [isOpen, isEditMode, isOnboarded, businessName, ownerName, userPhone, userEmail]);
  /* oxlint-enable react/set-state-in-effect */

  if (!isOpen) {
    return null;
  }

  const validateEmail = (email: string): boolean => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError(t.onboarding.emailRequired);
      return false;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailError(t.onboarding.emailInvalid);
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePinFormat = (pin: string, required: boolean): boolean => {
    const trimmed = pin.trim();
    if (!trimmed) {
      if (required) {
        setPinError(t.onboarding.pinInvalid);
        return false;
      }
      setPinError('');
      return true;
    }
    if (!PIN_REGEX.test(trimmed)) {
      setPinError(t.onboarding.pinInvalid);
      return false;
    }
    setPinError('');
    return true;
  };

  const validateRegister = (): boolean => {
    let isValid = true;

    if (!formBusinessName.trim() || formBusinessName.trim().length < 2) {
      setBusinessNameError(t.onboarding.storeNameRequired);
      isValid = false;
    } else {
      setBusinessNameError('');
    }

    if (!validateEmail(formEmail)) {
      isValid = false;
    }

    if (isEditMode) {
      if (isEmailChanged) {
        if (!formCurrentPassword.trim() && !formCurrentPin.trim()) {
          setCurrentPasswordError(t.onboarding.currentPasswordRequired);
          isValid = false;
        } else {
          setCurrentPasswordError('');
        }

        if (!validatePinFormat(formCurrentPin, false)) {
          isValid = false;
        }
      } else {
        setCurrentPasswordError('');
        setPinError('');
      }
    }

    if (!isEditMode) {
      if (!formPassword) {
        setPasswordError(t.onboarding.passwordRequired);
        isValid = false;
      } else if (formPassword.length < 6) {
        setPasswordError(t.onboarding.passwordMinLength);
        isValid = false;
      } else {
        setPasswordError('');
      }

      if (!validatePinFormat(formPin, false)) {
        isValid = false;
      }
    }

    if (formUserPhone.trim()) {
      const normalized = normalizePhilippineMobile(formUserPhone);
      if (!normalized) {
        setPhoneError(t.onboarding.phoneInvalid);
        isValid = false;
      } else {
        setPhoneError('');
      }
    } else {
      setPhoneError('');
    }

    return isValid;
  };

  const validateLogin = (): boolean => {
    let isValid = true;

    if (!validateEmail(loginEmail)) {
      isValid = false;
    }

    if (loginMode === 'password') {
      if (!loginPassword) {
        setPasswordError(t.onboarding.passwordRequired);
        isValid = false;
      } else {
        setPasswordError('');
      }
    } else if (!validatePinFormat(loginPinVal, true)) {
      isValid = false;
    }

    return isValid;
  };

  const updateLocalTenantBusinessName = async (name: string) => {
    await db.tenants.update(tenantId, {
      businessName: name,
      updatedAt: new Date().toISOString()
    }).catch(console.warn);
  };

  const handleRegisterSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (submissionInFlight.current || isSubmitting) return;
    if (!validateRegister()) return;

    submissionInFlight.current = true;
    setSubmissionError('');
    setOfflineNotice('');
    setIsSubmitting(true);

    try {
      const trimmedBusinessName = formBusinessName.trim();
      const trimmedOwnerName = formOwnerName.trim();
      const trimmedEmail = formEmail.trim().toLowerCase();
      const normalizedPhone = formUserPhone.trim()
        ? normalizePhilippineMobile(formUserPhone) || formUserPhone.trim()
        : '';

      if (isEditMode) {
        const isChangingStoreName = trimmedBusinessName !== (businessName || '').trim();
        if (isChangingStoreName && role !== 'Owner') {
          setSubmissionError(t.onboarding.ownerOnlyBusinessName);
          setIsSubmitting(false);
          submissionInFlight.current = false;
          return;
        }

        try {
          const authResult = await updateProfile({
            businessName: trimmedBusinessName,
            ownerName: trimmedOwnerName,
            phone: normalizedPhone,
            email: trimmedEmail,
            ...(isEmailChanged ? {
              currentPassword: formCurrentPassword.trim() || undefined,
              pin: formCurrentPin.trim() || undefined
            } : {})
          });

          await loginWithAuthPayload(authResult);
          clearPendingProfileUpdate();
          void updateQueueCounts();

          await updateLocalTenantBusinessName(trimmedBusinessName);

          closeOnboarding();
          return;
        } catch (serverError: any) {
          const status = serverError?.response?.status;
          const serverMessage = serverError?.response?.data?.message;

          if (status === 400 || status === 401 || status === 403 || status === 409 || status === 429) {
            setSubmissionError(
              serverMessage ||
              (status === 403 ? t.onboarding.ownerOnlyBusinessName : undefined) ||
              (status === 409 ? t.onboarding.emailAlreadyExists : undefined) ||
              'May error sa pag-update ng profile.'
            );
            setIsSubmitting(false);
            submissionInFlight.current = false;
            return;
          }

          console.warn('[OnboardingModal] Profile update server sync deferred:', serverError);
          updateStoreProfile({
            businessName: trimmedBusinessName,
            ownerName: trimmedOwnerName,
            userPhone: normalizedPhone,
            userEmail: isEmailChanged ? (userEmail || '') : trimmedEmail
          });

          queuePendingProfileUpdate({
            businessName: trimmedBusinessName,
            ownerName: trimmedOwnerName,
            phone: normalizedPhone,
            // email change requires re-verification online; never persist credentials
            ...(isEmailChanged ? {} : { email: trimmedEmail })
          }, tenantId);

          setOfflineNotice(t.onboarding.savedLocallyNotice);
          void updateQueueCounts();

          await updateLocalTenantBusinessName(trimmedBusinessName);

          noticeTimer.current = setTimeout(() => {
            closeOnboarding();
          }, 400);
          return;
        }
      }

      if (!onboardingIds.current) {
        onboardingIds.current = {
          tenantId: createClientUuid(),
          userId: createClientUuid()
        };
      }
      const { tenantId: newTenantId, userId: newUserId } = onboardingIds.current;

      // 1. Seed Dexie first (Zero Network Block / Local-First guarantee)
      await seedDexieDatabaseIfNeeded(
        false,
        newTenantId,
        catalogChoice === 'empty',
        trimmedBusinessName
      );

      try {
        const fees = offersGcash
          ? DEFAULT_GCASH_FEE_TIERS
          : DEFAULT_GCASH_FEE_TIERS.map(() => 0);
        fees.forEach((fee, tierIndex) => {
          useGCashFeeStore.getState().setFeeForTenant(newTenantId, tierIndex, fee);
        });
      } catch (feeError) {
        console.warn('[OnboardingModal] Could not save GCash fees:', feeError);
      }

      // 2. Attempt online registration with server
      let serverToken: string | undefined;
      let registeredHasPin = Boolean(formPin.trim());

      try {
        const authResult = await registerStore({
          tenantId: newTenantId,
          userId: newUserId,
          email: trimmedEmail,
          password: formPassword,
          pin: formPin.trim() || undefined,
          businessName: trimmedBusinessName,
          ownerName: trimmedOwnerName,
          phone: normalizedPhone
        });
        serverToken = authResult.token;
        registeredHasPin = authResult.hasPin;
      } catch (apiErr: any) {
        const status = apiErr?.response?.status;
        if (status === 409) {
          setSubmissionError(t.onboarding.emailAlreadyExists);
          setIsSubmitting(false);
          submissionInFlight.current = false;
          return;
        }

        // Offline / network failure: allow local onboarding to proceed gracefully
        console.warn('[OnboardingModal] Server registration offline or failed, continuing locally:', apiErr);
        setOfflineNotice(t.onboarding.offlineRegisterNotice);
      }

      completeOnboarding({
        businessName: trimmedBusinessName,
        ownerName: trimmedOwnerName,
        userPhone: normalizedPhone,
        userEmail: trimmedEmail,
        tenantId: newTenantId,
        userId: newUserId,
        hasPin: registeredHasPin,
        localPin: formPin.trim() || undefined,
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
      closeOnboarding();
    } catch (err) {
      console.error('[OnboardingModal] Failed to complete registration:', err);
      setSubmissionError(t.onboarding.submitError);
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (submissionInFlight.current || isSubmitting) return;
    if (!validateLogin()) return;

    submissionInFlight.current = true;
    setSubmissionError('');
    setIsSubmitting(true);

    try {
      const trimmedEmail = loginEmail.trim().toLowerCase();
      let authResult;

      if (loginMode === 'password') {
        authResult = await loginStore({
          email: trimmedEmail,
          password: loginPassword
        });
      } else {
        authResult = await loginPin({
          email: trimmedEmail,
          pin: loginPinVal.trim()
        });
      }

      const loginRes = await loginWithAuthPayload(
        authResult,
        loginMode === 'pin' ? loginPinVal.trim() : undefined,
        false
      );

      if (!loginRes.success) {
        setPendingAuthPayload({
          payload: authResult,
          localPin: loginMode === 'pin' ? loginPinVal.trim() : undefined
        });
        setUnsyncedLoginCount(loginRes.unsyncedCount);
        setIsUnsyncedDialogOpen(true);
        setIsSubmitting(false);
        return;
      }

      await finishLogin(authResult);
    } catch (apiErr: any) {
      const status = apiErr?.response?.status;
      const responseData = apiErr?.response?.data;

      if (status === 429) {
        setSubmissionError(responseData?.message || t.settings.invalidPinOrPassword);
      } else if (status === 401) {
        setSubmissionError(responseData?.message || t.onboarding.loginFailed);
      } else if (!navigator.onLine || apiErr?.code === 'ERR_NETWORK') {
        setSubmissionError(t.banner.offlineDesc);
      } else {
        setSubmissionError(responseData?.message || t.onboarding.loginFailed);
      }
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(_, data) => !data.open && isEditMode && closeOnboarding()}>
      <DialogSurface className={styles.surface} aria-label={isEditMode ? t.onboarding.editTitle : t.onboarding.welcomeTitle}>
        <DialogBody>
          <div className={styles.headerRow}>
            <div className={styles.headerIcon}>
              <BuildingShopRegular />
            </div>
            <div className={styles.titleArea}>
              <DialogTitle>{isEditMode ? t.onboarding.editTitle : t.onboarding.welcomeTitle}</DialogTitle>
              {!isEditMode && <Badge appearance="filled" color="brand">🇵🇭 Tindahan</Badge>}
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                {isEditMode ? t.onboarding.editSubtitle : t.onboarding.welcomeSubtitle}
              </Text>
            </div>
          </div>

          {!isEditMode && (
            <TabList
              className={styles.tabNav}
              selectedValue={activeTab}
              onTabSelect={(_, data) => {
                setActiveTab(data.value as 'register' | 'login');
                clearValidationErrors();
              }}
            >
              <Tab value="register" icon={<SparkleRegular />}>
                {t.onboarding.registerTab}
              </Tab>
              <Tab value="login" icon={<KeyRegular />}>
                {t.onboarding.loginTab}
              </Tab>
            </TabList>
          )}

          <DialogContent>
            {submissionError && (
              <Text
                role="alert"
                size={200}
                className={mergeClasses(styles.statusNotice, styles.errorNotice)}
              >
                {getLocalizedSyncErrorMessage(submissionError, language) || submissionError}
              </Text>
            )}

            {offlineNotice && (
              <Text
                size={200}
                className={mergeClasses(styles.statusNotice, styles.warningNotice)}
              >
                {offlineNotice}
              </Text>
            )}

            {activeTab === 'register' || isEditMode ? (
              <form onSubmit={handleRegisterSubmit} id="onboarding-form">
                <div className={styles.formSection}>
                  {/* Store Name */}
                  <Field
                    label={t.onboarding.storeNameLabel}
                    required
                    validationState={businessNameError ? 'error' : 'none'}
                    validationMessage={businessNameError}
                    hint={isEditMode && role !== 'Owner' ? t.onboarding.ownerOnlyBusinessName : undefined}
                  >
                    <Input
                      value={formBusinessName}
                      disabled={isEditMode && role !== 'Owner'}
                      onChange={(_, data) => {
                        setFormBusinessName(data.value);
                        if (businessNameError) setBusinessNameError('');
                      }}
                      placeholder={t.onboarding.storeNamePlaceholder}
                      contentBefore={<BuildingShopRegular />}
                      autoFocus={!isEditMode || role === 'Owner'}
                    />
                  </Field>

                  {/* Email Address */}
                  <EmailField
                    label={t.onboarding.emailLabel}
                    value={formEmail}
                    onChange={(val) => {
                      setFormEmail(val);
                      if (emailError) setEmailError('');
                    }}
                    error={emailError}
                    placeholder={t.onboarding.emailPlaceholder}
                  />

                  {/* Current Password & PIN required when changing email in Edit Mode */}
                  {isEditMode && isEmailChanged && (
                    <>
                      <Field
                        label={t.onboarding.currentPasswordLabel}
                        required
                        hint={t.onboarding.currentPasswordHint}
                        validationState={currentPasswordError ? 'error' : 'none'}
                        validationMessage={currentPasswordError}
                      >
                        <PasswordInput
                          value={formCurrentPassword}
                          onChange={(val) => {
                            setFormCurrentPassword(val);
                            if (currentPasswordError) setCurrentPasswordError('');
                          }}
                          placeholder={t.onboarding.currentPasswordPlaceholder}
                        />
                      </Field>

                      {hasPin && (
                        <Field
                          label={t.onboarding.pinLabel}
                          hint={t.onboarding.pinHint}
                          validationState={pinError ? 'error' : 'none'}
                          validationMessage={pinError}
                        >
                          <PinInput
                            value={formCurrentPin}
                            onChange={(val) => {
                              setFormCurrentPin(val);
                              if (pinError) setPinError('');
                              if (currentPasswordError) setCurrentPasswordError('');
                            }}
                            placeholder={t.onboarding.pinPlaceholder}
                          />
                        </Field>
                      )}
                    </>
                  )}

                  {/* Password & PIN (Only in Initial Setup) */}
                  {!isEditMode && (
                    <>
                      <Field
                        label={t.onboarding.passwordLabel}
                        required
                        validationState={passwordError ? 'error' : 'none'}
                        validationMessage={passwordError}
                      >
                        <PasswordInput
                          value={formPassword}
                          onChange={(val) => {
                            setFormPassword(val);
                            if (passwordError) setPasswordError('');
                          }}
                          placeholder={t.onboarding.passwordPlaceholder}
                        />
                      </Field>

                      <Field
                        label={t.onboarding.pinLabel}
                        hint={t.onboarding.pinHint}
                        validationState={pinError ? 'error' : 'none'}
                        validationMessage={pinError}
                      >
                        <PinInput
                          value={formPin}
                          onChange={(val) => {
                            setFormPin(val);
                            if (pinError) setPinError('');
                          }}
                          placeholder={t.onboarding.pinPlaceholder}
                        />
                      </Field>
                    </>
                  )}

                  {/* Owner Name */}
                  <Field label={t.onboarding.ownerNameLabel}>
                    <Input
                      value={formOwnerName}
                      onChange={(_, data) => setFormOwnerName(data.value)}
                      placeholder={t.onboarding.ownerNamePlaceholder}
                      contentBefore={<PersonRegular />}
                    />
                  </Field>

                  {/* Mobile Phone */}
                  <Field
                    label={t.onboarding.userPhoneLabel}
                    validationState={phoneError ? 'error' : 'none'}
                    validationMessage={phoneError}
                  >
                    <Input
                      type="tel"
                      value={formUserPhone}
                      onChange={(_, data) => {
                        setFormUserPhone(data.value);
                        if (phoneError) setPhoneError('');
                      }}
                      placeholder={t.onboarding.userPhonePlaceholder}
                      contentBefore={<PhoneRegular />}
                    />
                  </Field>

                  {/* Catalog Choice (Only during initial onboarding) */}
                  {!isEditMode && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <BoxRegular fontSize={18} />
                        <Text weight="semibold" size={300}>
                          {t.onboarding.catalogSectionTitle}
                        </Text>
                      </div>
                      <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginBottom: '8px', display: 'block' }}>
                        {t.onboarding.catalogSectionDesc}
                      </Text>

                      <RadioGroup
                        value={catalogChoice}
                        onChange={(_, data) => setCatalogChoice(data.value as 'standard' | 'empty')}
                      >
                        <div className={styles.catalogCard}>
                          <Radio
                            value="standard"
                            label={
                              <div className={styles.radioLabel}>
                                <Text weight="semibold" size={200}>
                                  {t.onboarding.catalogStandardTitle}
                                </Text>
                                <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                                  {t.onboarding.catalogStandardDesc}
                                </Text>
                              </div>
                            }
                          />
                        </div>
                        <div className={styles.catalogCard}>
                          <Radio
                            value="empty"
                            label={
                              <div className={styles.radioLabel}>
                                <Text weight="semibold" size={200}>
                                  {t.onboarding.catalogEmptyTitle}
                                </Text>
                                <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                                  {t.onboarding.catalogEmptyDesc}
                                </Text>
                              </div>
                            }
                          />
                        </div>
                      </RadioGroup>

                      {/* GCash Checkbox */}
                      <div style={{ marginTop: '12px' }}>
                        <Checkbox
                          checked={offersGcash}
                          onChange={(_, data) => setOffersGcash(!!data.checked)}
                          label={
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <PhoneLaptopRegular />
                                <Text weight="semibold" size={200}>{t.onboarding.gcashToggleTitle}</Text>
                              </div>
                              <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                                {t.onboarding.gcashToggleDesc}
                              </Text>
                            </div>
                          }
                        />
                      </div>

                      <div className={styles.switchPrompt}>
                        <Button
                          appearance="transparent"
                          size="small"
                          onClick={() => {
                            setActiveTab('login');
                            setSubmissionError('');
                          }}
                        >
                          {t.onboarding.switchAccountPrompt}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </form>
            ) : (
              /* LOGIN TAB */
              <form onSubmit={handleLoginSubmit} id="login-form">
                <div className={styles.formSection}>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginBottom: tokens.spacingVerticalS }}>
                    {t.onboarding.loginSubtitle}
                  </Text>

                  {/* Login Email */}
                  <EmailField
                    label={t.onboarding.emailLabel}
                    value={loginEmail}
                    onChange={(val) => {
                      setLoginEmail(val);
                      if (emailError) setEmailError('');
                    }}
                    error={emailError}
                    placeholder={t.onboarding.emailPlaceholder}
                    autoFocus
                  />

                  {/* Mode Selector */}
                  <RadioGroup
                    value={loginMode}
                    onChange={(_, data) => {
                      setLoginMode(data.value as 'password' | 'pin');
                      setPasswordError('');
                      setPinError('');
                      setSubmissionError('');
                    }}
                    layout="horizontal"
                  >
                    <Radio value="password" label={t.onboarding.loginModePassword} />
                    <Radio value="pin" label={t.onboarding.loginModePin} />
                  </RadioGroup>

                  {/* Password Input */}
                  {loginMode === 'password' ? (
                    <Field
                      label={t.onboarding.passwordLabel}
                      required
                      validationState={passwordError ? 'error' : 'none'}
                      validationMessage={passwordError}
                    >
                      <PasswordInput
                        value={loginPassword}
                        onChange={(val) => {
                          setLoginPassword(val);
                          if (passwordError) setPasswordError('');
                        }}
                        placeholder={t.onboarding.passwordPlaceholder}
                      />
                    </Field>
                  ) : (
                    /* PIN Input */
                    <Field
                      label={t.onboarding.pinLabel}
                      required
                      validationState={pinError ? 'error' : 'none'}
                      validationMessage={pinError}
                    >
                      <PinInput
                        value={loginPinVal}
                        onChange={(val) => {
                          setLoginPinVal(val);
                          if (pinError) setPinError('');
                        }}
                        placeholder={t.onboarding.pinPlaceholder}
                      />
                    </Field>
                  )}

                  <div className={styles.switchPrompt}>
                    <Button
                      appearance="transparent"
                      size="small"
                      onClick={() => {
                        setActiveTab('register');
                        setSubmissionError('');
                      }}
                    >
                      {t.onboarding.registerPrompt}
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </DialogContent>

          <DialogActions className={styles.actions}>
            {isEditMode && (
              <Button
                appearance="secondary"
                icon={<DismissRegular />}
                onClick={closeOnboarding}
                disabled={isSubmitting}
              >
                {t.onboarding.cancelBtn}
              </Button>
            )}
            <Button
              appearance="primary"
              icon={isSubmitting ? <Spinner size="extra-tiny" /> : isEditMode ? <CheckmarkRegular /> : <SparkleRegular />}
              onClick={activeTab === 'register' || isEditMode ? handleRegisterSubmit : handleLoginSubmit}
              disabled={isSubmitting}
            >
              {isEditMode
                ? t.onboarding.saveProfileBtn
                : activeTab === 'register'
                  ? t.onboarding.launchBtn
                  : t.onboarding.loginBtn}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>

    <ConfirmUnsyncedLoginDialog
      isOpen={isUnsyncedDialogOpen}
      unsyncedCount={unsyncedLoginCount}
      onClose={() => {
        setIsUnsyncedDialogOpen(false);
        setPendingAuthPayload(null);
      }}
      onConfirmWipeAndLogin={handleConfirmWipeAndLogin}
      onSyncFirst={handleSyncFirst}
      isSyncing={isSyncingFirst}
    />
  </>
  );
};
