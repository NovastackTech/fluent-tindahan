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
  Spinner
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
  }
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN_REGEX = /^\d{4,6}$/;

export const OnboardingModal: React.FC = () => {
  const styles = useStyles();
  const { t } = useTranslation();

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
  const [showPassword, setShowPassword] = useState(false);
  const [formCurrentPassword, setFormCurrentPassword] = useState('');
  const [formCurrentPin, setFormCurrentPin] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [catalogChoice, setCatalogChoice] = useState<'standard' | 'empty'>('standard');
  const [offersGcash, setOffersGcash] = useState(true);

  const isEmailChanged = isEditMode && formEmail.trim().toLowerCase() !== (userEmail || '').trim().toLowerCase();

  // Login Fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginMode, setLoginMode] = useState<'password' | 'pin'>('password');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPinVal, setLoginPinVal] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

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
      useSubscriptionStore.setState({
        tier: pendingAuthPayload.payload.tier,
        subscriptionEndDate: pendingAuthPayload.payload.subscriptionEndDate,
        isActive: pendingAuthPayload.payload.tier !== 'Libre'
      });
      void useSubscriptionStore.getState().refreshSubscription();
      const productCount = await db.products.where('tenantId').equals(pendingAuthPayload.payload.tenantId).count();
      if (productCount === 0) {
        void pullCatalogFromServer().then(() => updateQueueCounts()).catch(console.error);
      }
      void processSyncQueue().catch(console.error);
      closeOnboarding();
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
        useSubscriptionStore.setState({
          tier: pendingAuthPayload.payload.tier,
          subscriptionEndDate: pendingAuthPayload.payload.subscriptionEndDate,
          isActive: pendingAuthPayload.payload.tier !== 'Libre'
        });
        void useSubscriptionStore.getState().refreshSubscription();
        const productCount = await db.products.where('tenantId').equals(pendingAuthPayload.payload.tenantId).count();
        if (productCount === 0) {
          void pullCatalogFromServer().then(() => updateQueueCounts()).catch(console.error);
        }
        void processSyncQueue().catch(console.error);
        closeOnboarding();
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
      setShowCurrentPassword(false);
      setCurrentPasswordError('');
      setBusinessNameError('');
      setPhoneError('');
      setEmailError('');
      setPasswordError('');
      setPinError('');
      setSubmissionError('');
      setOfflineNotice('');
      setIsSubmitting(false);
    } else {
      onboardingIds.current = null;
    }
  }, [isOpen, isEditMode, isOnboarded, businessName, ownerName, userPhone, userEmail]);
  /* oxlint-enable react/set-state-in-effect */

  if (!isOpen) {
    return null;
  }

  const validateRegister = (): boolean => {
    let isValid = true;

    if (!formBusinessName.trim() || formBusinessName.trim().length < 2) {
      setBusinessNameError(t.onboarding.storeNameRequired);
      isValid = false;
    } else {
      setBusinessNameError('');
    }

    const trimmedEmail = formEmail.trim();
    if (!trimmedEmail) {
      setEmailError(t.onboarding.emailRequired);
      isValid = false;
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError(t.onboarding.emailInvalid);
      isValid = false;
    } else {
      setEmailError('');
    }

    if (isEditMode) {
      if (isEmailChanged) {
        if (!formCurrentPassword.trim() && !formCurrentPin.trim()) {
          setCurrentPasswordError(t.onboarding.currentPasswordRequired);
          isValid = false;
        } else {
          setCurrentPasswordError('');
        }

        if (formCurrentPin.trim() && !PIN_REGEX.test(formCurrentPin.trim())) {
          setPinError(t.onboarding.pinInvalid);
          isValid = false;
        } else {
          setPinError('');
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

      if (formPin.trim() && !PIN_REGEX.test(formPin.trim())) {
        setPinError(t.onboarding.pinInvalid);
        isValid = false;
      } else {
        setPinError('');
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

    const trimmedEmail = loginEmail.trim();
    if (!trimmedEmail) {
      setEmailError(t.onboarding.emailRequired);
      isValid = false;
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError(t.onboarding.emailInvalid);
      isValid = false;
    } else {
      setEmailError('');
    }

    if (loginMode === 'password') {
      if (!loginPassword) {
        setPasswordError(t.onboarding.passwordRequired);
        isValid = false;
      } else {
        setPasswordError('');
      }
    } else {
      if (!loginPinVal.trim()) {
        setPinError(t.onboarding.pinInvalid);
        isValid = false;
      } else if (!PIN_REGEX.test(loginPinVal.trim())) {
        setPinError(t.onboarding.pinInvalid);
        isValid = false;
      } else {
        setPinError('');
      }
    }

    return isValid;
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

          await db.tenants.update(tenantId, {
            businessName: trimmedBusinessName,
            updatedAt: new Date().toISOString()
          }).catch(console.warn);

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

          await db.tenants.update(tenantId, {
            businessName: trimmedBusinessName,
            updatedAt: new Date().toISOString()
          }).catch(console.warn);

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

      useSubscriptionStore.setState({
        tier: authResult.tier,
        subscriptionEndDate: authResult.subscriptionEndDate,
        isActive: authResult.tier !== 'Libre'
      });
      void useSubscriptionStore.getState().refreshSubscription();
      const productCount = await db.products.where('tenantId').equals(authResult.tenantId).count();
      if (productCount === 0) {
        void pullCatalogFromServer().then(() => updateQueueCounts()).catch(console.error);
      }
      void processSyncQueue().catch(console.error);
      closeOnboarding();
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
                setSubmissionError('');
                setOfflineNotice('');
                setEmailError('');
                setPasswordError('');
                setPinError('');
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
                style={{
                  color: tokens.colorPaletteRedForeground1,
                  display: 'block',
                  marginBottom: tokens.spacingVerticalM,
                  padding: '8px 12px',
                  backgroundColor: tokens.colorPaletteRedBackground1,
                  borderRadius: tokens.borderRadiusMedium
                }}
              >
                {submissionError}
              </Text>
            )}

            {offlineNotice && (
              <Text
                size={200}
                style={{
                  color: tokens.colorPaletteYellowForeground1,
                  display: 'block',
                  marginBottom: tokens.spacingVerticalM,
                  padding: '8px 12px',
                  backgroundColor: tokens.colorPaletteYellowBackground1,
                  borderRadius: tokens.borderRadiusMedium
                }}
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
                  <Field
                    label={t.onboarding.emailLabel}
                    required
                    validationState={emailError ? 'error' : 'none'}
                    validationMessage={emailError}
                  >
                    <Input
                      type="email"
                      value={formEmail}
                      onChange={(_, data) => {
                        setFormEmail(data.value);
                        if (emailError) setEmailError('');
                      }}
                      placeholder={t.onboarding.emailPlaceholder}
                      contentBefore={<MailRegular />}
                    />
                  </Field>

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
                        <div className={styles.passwordInputWrapper}>
                          <Input
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={formCurrentPassword}
                            onChange={(_, data) => {
                              setFormCurrentPassword(data.value);
                              if (currentPasswordError) setCurrentPasswordError('');
                            }}
                            placeholder={t.onboarding.currentPasswordPlaceholder}
                            contentBefore={<LockClosedRegular />}
                            contentAfter={
                              <Button
                                appearance="subtle"
                                size="small"
                                icon={showCurrentPassword ? <EyeOffRegular /> : <EyeRegular />}
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                type="button"
                              />
                            }
                            style={{ width: '100%' }}
                          />
                        </div>
                      </Field>

                      {hasPin && (
                        <Field
                          label={t.onboarding.pinLabel}
                          hint={t.onboarding.pinHint}
                          validationState={pinError ? 'error' : 'none'}
                          validationMessage={pinError}
                        >
                          <Input
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={formCurrentPin}
                            onChange={(_, data) => {
                              const cleaned = data.value.replace(/\D/g, '').slice(0, 6);
                              setFormCurrentPin(cleaned);
                              if (pinError) setPinError('');
                              if (currentPasswordError) setCurrentPasswordError('');
                            }}
                            placeholder={t.onboarding.pinPlaceholder}
                            contentBefore={<KeyRegular />}
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
                        <div className={styles.passwordInputWrapper}>
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            value={formPassword}
                            onChange={(_, data) => {
                              setFormPassword(data.value);
                              if (passwordError) setPasswordError('');
                            }}
                            placeholder={t.onboarding.passwordPlaceholder}
                            contentBefore={<LockClosedRegular />}
                            contentAfter={
                              <Button
                                appearance="subtle"
                                size="small"
                                icon={showPassword ? <EyeOffRegular /> : <EyeRegular />}
                                onClick={() => setShowPassword(!showPassword)}
                                type="button"
                              />
                            }
                            style={{ width: '100%' }}
                          />
                        </div>
                      </Field>

                      <Field
                        label={t.onboarding.pinLabel}
                        hint={t.onboarding.pinHint}
                        validationState={pinError ? 'error' : 'none'}
                        validationMessage={pinError}
                      >
                        <Input
                          type="password"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          value={formPin}
                          onChange={(_, data) => {
                            const cleaned = data.value.replace(/\D/g, '').slice(0, 6);
                            setFormPin(cleaned);
                            if (pinError) setPinError('');
                          }}
                          placeholder={t.onboarding.pinPlaceholder}
                          contentBefore={<KeyRegular />}
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
                  <Field
                    label={t.onboarding.emailLabel}
                    required
                    validationState={emailError ? 'error' : 'none'}
                    validationMessage={emailError}
                  >
                    <Input
                      type="email"
                      value={loginEmail}
                      onChange={(_, data) => {
                        setLoginEmail(data.value);
                        if (emailError) setEmailError('');
                      }}
                      placeholder={t.onboarding.emailPlaceholder}
                      contentBefore={<MailRegular />}
                      autoFocus
                    />
                  </Field>

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
                      <div className={styles.passwordInputWrapper}>
                        <Input
                          type={showLoginPassword ? 'text' : 'password'}
                          value={loginPassword}
                          onChange={(_, data) => {
                            setLoginPassword(data.value);
                            if (passwordError) setPasswordError('');
                          }}
                          placeholder={t.onboarding.passwordPlaceholder}
                          contentBefore={<LockClosedRegular />}
                          contentAfter={
                            <Button
                              appearance="subtle"
                              size="small"
                              icon={showLoginPassword ? <EyeOffRegular /> : <EyeRegular />}
                              onClick={() => setShowLoginPassword(!showLoginPassword)}
                              type="button"
                            />
                          }
                          style={{ width: '100%' }}
                        />
                      </div>
                    </Field>
                  ) : (
                    /* PIN Input */
                    <Field
                      label={t.onboarding.pinLabel}
                      required
                      validationState={pinError ? 'error' : 'none'}
                      validationMessage={pinError}
                    >
                      <Input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={loginPinVal}
                        onChange={(_, data) => {
                          const cleaned = data.value.replace(/\D/g, '').slice(0, 6);
                          setLoginPinVal(cleaned);
                          if (pinError) setPinError('');
                        }}
                        placeholder={t.onboarding.pinPlaceholder}
                        contentBefore={<KeyRegular />}
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
