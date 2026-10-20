import React, { useState, useEffect } from 'react';
import {
  makeStyles,
  tokens,
  shorthands,
  Card,
  Text,
  Button,
  TabList,
  Tab,
  Badge,
  Spinner,
  Checkbox,
  Divider,
  Field,
  Input
} from '@fluentui/react-components';
import {
  KeyRegular,
  ArrowRightRegular,
  SparkleRegular,
  ArrowLeftRegular,
  CheckmarkCircleRegular,
  LockClosedRegular,
  EyeRegular,
  EyeOffRegular,
  MailRegular
} from '@fluentui/react-icons';
import type { NavTab } from '../components/Navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useStoreAuthFlow } from '../hooks/useStoreAuthFlow';
import { ConfirmUnsyncedLoginDialog } from '../components/ConfirmUnsyncedLoginDialog';
import { useTranslation } from '../state/languageStore';
import { useAuthStore } from '../state/authStore';
import { seedDexieDatabaseIfNeeded, DEFAULT_TENANT_ID } from '../db/seedData';
import { RegistrationFormFields } from '../components/RegistrationFormFields';
import { LoginFormFields } from '../components/LoginFormFields';
import { AuthErrorBanner } from '../components/AuthErrorBanner';
import { validateRegistrationInput, validateLoginInput } from '../utils/registrationValidation';
import { GoogleAuthButton } from '../components/GoogleAuthButton';
import { forgotPassword, resetPassword } from '../services/authService';
import { getLocalizedSyncErrorMessage } from '../utils/syncErrors';

export interface LoginPageProps {
  onNavigate: (tab: NavTab) => void;
}

const useStyles = makeStyles({
  pageRoot: {
    minHeight: 'calc(100vh - 54px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalM)
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
    boxShadow: tokens.shadow16,
    ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalXL),
    boxSizing: 'border-box'
  },
  header: {
    textAlign: 'center',
    marginBottom: tokens.spacingVerticalL
  },
  logoBadge: {
    width: '48px',
    height: '48px',
    marginRight: 'auto',
    marginLeft: 'auto',
    marginBottom: tokens.spacingVerticalS,
    ...shorthands.borderRadius(tokens.borderRadiusCircular),
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralBackground1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    boxShadow: tokens.shadow4
  },
  pillRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: tokens.spacingVerticalS
  },
  errorBanner: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
    ...shorthands.border('1px', 'solid', tokens.colorPaletteRedBorder1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    marginBottom: tokens.spacingVerticalM,
    fontSize: tokens.fontSizeBase200
  },
  modeToggleRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: tokens.spacingVerticalS
  },
  demoCard: {
    marginTop: tokens.spacingVerticalM,
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground2,
    textAlign: 'center'
  },
  footerNav: {
    marginTop: tokens.spacingVerticalL,
    textAlign: 'center'
  }
});


export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const styles = useStyles();
  const { t, language } = useTranslation();
  const { completeOnboarding } = useAuthStore();

  const [isDeleteIntent, setIsDeleteIntent] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('intent') === 'delete-account' || params.get('tab') === 'delete-account';
  });

  const {
    isUnsyncedDialogOpen,
    unsyncedLoginCount,
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
  } = useStoreAuthFlow({
    onSuccess: () => {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      if (isDeleteIntent || params?.get('intent') === 'delete-account' || params?.get('tab') === 'delete-account') {
        onNavigate('settings');
      } else {
        onNavigate('pos');
      }
    }
  });

  const getInitialTab = (): 'login' | 'register' => {
    if (typeof window === 'undefined') return 'login';
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab')?.toLowerCase();
    if (tab === 'signup' || tab === 'register' || tab === 'newstore' || tab === 'new-store') {
      return 'register';
    }
    const path = window.location.pathname.replace(/^\//, '').toLowerCase();
    if (path === 'signup' || path === 'register') {
      return 'register';
    }
    return 'login';
  };

  const [activeTab, setActiveTab] = useState<'login' | 'register'>(getInitialTab);
  const [loginMode, setLoginMode] = useState<'password' | 'pin'>('password');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authErrors, setAuthErrors] = useState<string[]>([]);
  const [otpCode, setOtpCode] = useState('');
  const [otpInfoMsg, setOtpInfoMsg] = useState('');
  const [regFieldErrors, setRegFieldErrors] = useState<{
    storeName?: boolean;
    email?: boolean;
    password?: boolean;
    confirmPassword?: boolean;
    pin?: boolean;
  }>({});
  const [loginFieldErrors, setLoginFieldErrors] = useState<{
    email?: boolean;
    password?: boolean;
    pin?: boolean;
  }>({});

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getInitialTab());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleTabSelect = (nextTab: 'login' | 'register') => {
    setActiveTab(nextTab);
    setPendingOtpEmail(null);
    setOtpCode('');
    setOtpInfoMsg('');
    setAuthErrors([]);
    setRegFieldErrors({});
    setLoginFieldErrors({});
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', nextTab === 'register' ? 'signup' : 'login');
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  };

  const setAuthError = (err: string | string[]) => {
    if (!err || (Array.isArray(err) && err.length === 0)) {
      setAuthErrors([]);
    } else if (Array.isArray(err)) {
      setAuthErrors(err);
    } else {
      setAuthErrors([err]);
    }
  };

  // Login inputs
  const initialEmail = typeof window !== 'undefined'
    ? localStorage.getItem('fluent_tindahan_last_email_v1') || ''
    : '';
  const [loginEmailVal, setLoginEmailVal] = useState(initialEmail);

  // Forgot / Reset Password state
  const [isForgotPassword, setIsForgotPassword] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab')?.toLowerCase();
    return tab === 'forgot' || tab === 'reset-password';
  });
  const [forgotStep, setForgotStep] = useState<'email' | 'otp'>('email');
  const [forgotEmail, setForgotEmail] = useState(initialEmail);
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [forgotSuccessBanner, setForgotSuccessBanner] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);
  const [loginPasswordVal, setLoginPasswordVal] = useState('');
  const [loginPinVal, setLoginPinVal] = useState('');

  // Register inputs
  const [regStoreName, setRegStoreName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regOfferGcash, setRegOfferGcash] = useState(true);
  const [regIncludeStarterProducts, setRegIncludeStarterProducts] = useState(true);

  const pendingSyncCount = useLiveQuery(() => db.syncQueue.count(), []) || 0;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setAuthErrors([]);
    setLoginFieldErrors({});

    const validation = validateLoginInput(loginEmailVal, loginMode, loginPasswordVal, loginPinVal, t);
    if (!validation.isValid) {
      setAuthErrors(validation.errors);
      setLoginFieldErrors(validation.fieldErrors);
      return;
    }

    await handleStoreLogin({
      email: validation.trimmedEmail,
      loginMode,
      password: loginPasswordVal,
      pin: loginPinVal,
      onError: (msg) => {
        setAuthErrors([msg]);
        if (loginMode === 'password') {
          setLoginFieldErrors({ email: true, password: true });
        } else {
          setLoginFieldErrors({ email: true, pin: true });
        }
      }
    });
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setAuthErrors([]);
    setRegFieldErrors({});

    const validation = validateRegistrationInput(
      regStoreName,
      regEmail,
      regPassword,
      regConfirmPassword,
      regPin,
      t
    );

    if (!validation.isValid) {
      setAuthErrors(validation.errors);
      setRegFieldErrors(validation.fieldErrors);
      return;
    }

    const { trimmedStore, trimmedEmail } = validation;

    await handleStoreRegistration({
      businessName: trimmedStore,
      email: trimmedEmail,
      password: regPassword,
      pin: regPin,
      offerGcash: regOfferGcash,
      includeStarterProducts: regIncludeStarterProducts,
      onError: (msg) => {
        setAuthErrors([msg]);
        setRegFieldErrors({ email: true });
      }
    });
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setAuthErrors([]);
    setOtpInfoMsg('');
    await handleVerifyEmailOtp(otpCode, (msg) => setAuthErrors([msg]));
  };

  const handleOtpResend = async () => {
    if (isSubmitting) return;
    setAuthErrors([]);
    setOtpInfoMsg('');
    await handleResendEmailOtp(
      (msg) => setOtpInfoMsg(msg),
      (msg) => setAuthErrors([msg])
    );
  };

  const handleForgotEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setAuthErrors([]);
    setOtpInfoMsg('');

    const cleanEmail = forgotEmail.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAuthErrors([t.onboarding.emailInvalid || 'Please enter a valid email address.']);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await forgotPassword({ email: cleanEmail });
      setOtpInfoMsg(res.message);
      setForgotStep('otp');
      setResendCooldown(60);
    } catch (err: any) {
      setAuthErrors([err?.response?.data?.message || err?.message || 'Failed to send reset code.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setAuthErrors([]);

    if (forgotOtp.trim().length !== 6) {
      setAuthErrors([t.onboarding.otpInvalid || 'Please enter a 6-digit verification code.']);
      return;
    }

    if (forgotNewPassword.length < 6) {
      setAuthErrors([t.settings.newPasswordMinLength]);
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setAuthErrors([t.settings.passwordMismatchError || 'Passwords do not match.']);
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword({
        email: forgotEmail.trim(),
        otp: forgotOtp.trim(),
        newPassword: forgotNewPassword
      });
      setLoginEmailVal(forgotEmail.trim());
      setLoginPasswordVal('');
      setForgotSuccessBanner(t.login.resetPasswordSuccessBanner);
      setIsForgotPassword(false);
      setForgotStep('email');
      setForgotOtp('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');
      setActiveTab('login');
    } catch (err: any) {
      setAuthErrors([err?.response?.data?.message || err?.message || 'Failed to reset password.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotResend = async () => {
    if (isSubmitting || resendCooldown > 0) return;
    setAuthErrors([]);
    setOtpInfoMsg('');
    setIsSubmitting(true);
    try {
      const res = await forgotPassword({ email: forgotEmail.trim() });
      setOtpInfoMsg(res.message);
      setResendCooldown(60);
    } catch (err: any) {
      setAuthErrors([err?.response?.data?.message || err?.message || 'Failed to resend code.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExploreDemo = async () => {
    setIsSubmitting(true);
    try {
      await seedDexieDatabaseIfNeeded(false, DEFAULT_TENANT_ID, false, "Aling Nena's Demo Tindahan");
      completeOnboarding({
        businessName: "Aling Nena's Demo Tindahan",
        ownerName: 'Nena Santos',
        userEmail: 'demo@fluent-tindahan.ph',
        tenantId: DEFAULT_TENANT_ID,
        userId: '22222222-2222-2222-2222-222222222222',
        hasPin: false
      });
      onNavigate('pos');
    } catch (err: any) {
      console.error('Demo initialization failed:', err);
      setAuthError('Demo failed to initialize.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (tokenResponse: { access_token: string }) => {
    setAuthErrors([]);
    await handleGoogleAuth({
      accessToken: tokenResponse.access_token,
      businessName: activeTab === 'register' ? regStoreName.trim() || undefined : undefined,
      pin: activeTab === 'register' ? regPin.trim() || undefined : undefined,
      offerGcash: activeTab === 'register' ? regOfferGcash : true,
      includeStarterProducts: activeTab === 'register' ? regIncludeStarterProducts : true,
      onError: (msg) => setAuthErrors([msg]),
      defaultErrorMessage: t.login.googleAuthFailed
    });
  };

  const handleGoogleError = (err: unknown) => {
    console.warn('[LoginPage] Google sign-in cancelled or failed:', err);
    setAuthErrors([t.login.googleAuthFailed]);
  };

  return (
    <div className={styles.pageRoot} id="login-page-root">
      <Card className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoBadge} aria-hidden="true">
            🛒
          </div>
          <div className={styles.pillRow}>
            <Badge appearance="tint" color="success">
              {t.login.badgeText}
            </Badge>
          </div>
          <Text as="h1" size={500} weight="bold" style={{ display: 'block', marginBottom: '4px' }}>
            {pendingOtpEmail
              ? t.onboarding.otpTitle
              : isForgotPassword
                ? forgotStep === 'email'
                  ? t.login.forgotPasswordTitle
                  : t.login.resetPasswordTitle
                : activeTab === 'register'
                  ? t.login.signUpPageTitle
                  : t.login.pageTitle}
          </Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            {pendingOtpEmail
              ? t.onboarding.otpSubtitle.replace('{email}', pendingOtpEmail)
              : isForgotPassword
                ? forgotStep === 'email'
                  ? t.login.forgotPasswordSubtitle
                  : t.login.resetPasswordSubtitle.replace('{email}', forgotEmail)
                : activeTab === 'register'
                  ? t.login.signUpPageSubtitle
                  : t.login.pageSubtitle}
          </Text>
        </div>

        {!pendingOtpEmail && !isForgotPassword && (
          <TabList
            selectedValue={activeTab}
            onTabSelect={(_, data) => {
              handleTabSelect(data.value as 'login' | 'register');
            }}
            style={{ marginBottom: tokens.spacingVerticalM }}
          >
            <Tab value="login" icon={<KeyRegular />} data-testid="login-tab-login">
              {t.landing.tabLogin}
            </Tab>
            <Tab value="register" icon={<SparkleRegular />} data-testid="login-tab-register">
              {t.landing.tabRegister}
            </Tab>
          </TabList>
        )}

        {isDeleteIntent && (
          <div
            style={{
              backgroundColor: tokens.colorPaletteYellowBackground1,
              color: tokens.colorNeutralForeground1,
              borderLeft: `4px solid ${tokens.colorPaletteYellowBorderActive}`,
              borderRadius: tokens.borderRadiusMedium,
              padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
              marginBottom: tokens.spacingVerticalM,
              fontSize: tokens.fontSizeBase200
            }}
            role="status"
            data-testid="login-delete-intent-banner"
          >
            {t.login.webDeleteIntentBanner}
          </div>
        )}

        {pendingDeletionInfo && (
          <div
            style={{
              backgroundColor: tokens.colorPaletteYellowBackground1,
              border: `1px solid ${tokens.colorPaletteYellowBorderActive}`,
              borderRadius: tokens.borderRadiusMedium,
              padding: tokens.spacingVerticalM,
              marginBottom: tokens.spacingVerticalM,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
            role="alert"
            data-testid="login-pending-deletion-banner"
          >
            <Text weight="bold" size={300}>
              {t.login.pendingDeletionTitle}
            </Text>
            <Text size={200}>
              {t.login.pendingDeletionDesc.replace(
                '{date}',
                pendingDeletionInfo.scheduledAt
                  ? new Date(pendingDeletionInfo.scheduledAt).toLocaleDateString()
                  : '30 days'
              )}
            </Text>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              <Button
                appearance="primary"
                size="small"
                disabled={isSubmitting}
                onClick={() => void pendingDeletionInfo.retryWithRestore()}
                data-testid="login-restore-account-btn"
              >
                {t.login.restoreAccountBtn}
              </Button>
              <Button
                appearance="secondary"
                size="small"
                disabled={isSubmitting}
                onClick={clearPendingDeletionInfo}
                data-testid="login-cancel-restore-btn"
              >
                {t.login.cancelRestoreBtn}
              </Button>
            </div>
          </div>
        )}

        <AuthErrorBanner
          authErrors={authErrors}
          language={language}
          containerClassName={styles.errorBanner}
          testId="login-error-banner"
          showSwitchToPassword={!pendingOtpEmail && activeTab === 'login' && loginMode === 'pin'}
          onSwitchToPassword={() => {
            setLoginMode('password');
            setAuthErrors([]);
            setLoginFieldErrors({});
          }}
          switchToPasswordTestId="login-switch-to-password-btn"
        />

        {otpInfoMsg && (
          <div
            style={{
              backgroundColor: tokens.colorPaletteGreenBackground1,
              color: tokens.colorPaletteGreenForeground1,
              border: `1px solid ${tokens.colorPaletteGreenBorder1}`,
              borderRadius: tokens.borderRadiusMedium,
              padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
              marginBottom: tokens.spacingVerticalM,
              fontSize: tokens.fontSizeBase200
            }}
            role="status"
            data-testid="login-otp-info-banner"
          >
            {getLocalizedSyncErrorMessage(otpInfoMsg, language) || otpInfoMsg}
          </div>
        )}

        {pendingSyncCount > 0 && (
          <div
            style={{
              backgroundColor: tokens.colorPaletteYellowBackground1,
              color: tokens.colorPaletteYellowForeground1,
              border: `1px solid ${tokens.colorPaletteYellowBorder1}`,
              borderRadius: tokens.borderRadiusMedium,
              padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
              marginBottom: tokens.spacingVerticalM,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            role="status"
            data-testid="login-unsynced-notice"
          >
            <Text size={200} weight="semibold">
              {t.onboarding.loginUnsyncedNotice.replace('{count}', String(pendingSyncCount))}
            </Text>
          </div>
        )}

        {forgotSuccessBanner && !isForgotPassword && (
          <div
            style={{
              backgroundColor: tokens.colorPaletteGreenBackground1,
              color: tokens.colorPaletteGreenForeground1,
              border: `1px solid ${tokens.colorPaletteGreenBorder1}`,
              borderRadius: tokens.borderRadiusMedium,
              padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
              marginBottom: tokens.spacingVerticalM,
              fontSize: tokens.fontSizeBase200
            }}
            role="status"
            data-testid="login-reset-success-banner"
          >
            {forgotSuccessBanner}
          </div>
        )}

        {isForgotPassword ? (
          forgotStep === 'email' ? (
            <form onSubmit={handleForgotEmailSubmit} noValidate data-testid="login-forgot-email-form">
              <Field label={t.landing.emailLabel} required style={{ marginBottom: tokens.spacingVerticalL }}>
                <Input
                  type="email"
                  value={forgotEmail}
                  onChange={(_, d) => {
                    setForgotEmail(d.value);
                    if (authErrors.length) setAuthErrors([]);
                  }}
                  placeholder={t.landing.emailPlaceholder}
                  contentBefore={<MailRegular />}
                  autoFocus
                  data-testid="login-forgot-email-input"
                  required
                />
              </Field>
              <Button
                appearance="primary"
                size="large"
                type="submit"
                disabled={isSubmitting || !forgotEmail.trim()}
                icon={isSubmitting ? <Spinner size="extra-tiny" /> : <ArrowRightRegular />}
                style={{ width: '100%', marginBottom: tokens.spacingVerticalS }}
                data-testid="login-forgot-send-btn"
              >
                {t.login.sendResetCodeBtn}
              </Button>
              <Button
                appearance="subtle"
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setIsForgotPassword(false);
                  setAuthErrors([]);
                  setOtpInfoMsg('');
                }}
                style={{ width: '100%' }}
                data-testid="login-forgot-back-btn"
              >
                {t.login.backToLoginBtn}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleForgotResetSubmit} noValidate data-testid="login-forgot-reset-form">
              <Field label={t.onboarding.otpLabel} required style={{ marginBottom: tokens.spacingVerticalM }}>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={forgotOtp}
                  onChange={(_, d) => {
                    setForgotOtp(d.value.replace(/\D/g, '').slice(0, 6));
                    if (authErrors.length) setAuthErrors([]);
                  }}
                  placeholder={t.onboarding.otpPlaceholder}
                  contentBefore={<KeyRegular />}
                  autoFocus
                  data-testid="login-reset-otp-input"
                  required
                />
              </Field>

              <Field
                label={t.settings.newPasswordLabel}
                required
                hint={t.settings.newPasswordPlaceholder}
                validationState={forgotNewPassword && forgotNewPassword.length < 6 ? 'error' : undefined}
                validationMessage={
                  forgotNewPassword && forgotNewPassword.length < 6
                    ? t.settings.newPasswordMinLength
                    : undefined
                }
                style={{ marginBottom: tokens.spacingVerticalM }}
              >
                <Input
                  type={showForgotNewPassword ? 'text' : 'password'}
                  value={forgotNewPassword}
                  onChange={(_, d) => {
                    setForgotNewPassword(d.value);
                    if (authErrors.length) setAuthErrors([]);
                  }}
                  placeholder={t.settings.newPasswordPlaceholder}
                  contentBefore={<LockClosedRegular />}
                  contentAfter={
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={showForgotNewPassword ? <EyeOffRegular /> : <EyeRegular />}
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      type="button"
                      aria-label="Toggle new password visibility"
                    />
                  }
                  data-testid="login-reset-new-password-input"
                  required
                />
              </Field>

              <Field
                label={t.settings.confirmNewPasswordLabel}
                required
                validationState={
                  forgotConfirmPassword && forgotConfirmPassword !== forgotNewPassword ? 'error' : undefined
                }
                validationMessage={
                  forgotConfirmPassword && forgotConfirmPassword !== forgotNewPassword
                    ? t.settings.passwordMismatchError || 'Passwords do not match.'
                    : undefined
                }
                style={{ marginBottom: tokens.spacingVerticalM }}
              >
                <Input
                  type={showForgotConfirmPassword ? 'text' : 'password'}
                  value={forgotConfirmPassword}
                  onChange={(_, d) => {
                    setForgotConfirmPassword(d.value);
                    if (authErrors.length) setAuthErrors([]);
                  }}
                  placeholder={t.settings.confirmNewPasswordPlaceholder}
                  contentBefore={<LockClosedRegular />}
                  contentAfter={
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={showForgotConfirmPassword ? <EyeOffRegular /> : <EyeRegular />}
                      onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                      type="button"
                      aria-label="Toggle confirm password visibility"
                    />
                  }
                  data-testid="login-reset-confirm-password-input"
                  required
                />
              </Field>

              <Button
                appearance="primary"
                size="large"
                type="submit"
                disabled={
                  isSubmitting ||
                  forgotOtp.trim().length !== 6 ||
                  forgotNewPassword.length < 6 ||
                  !forgotConfirmPassword ||
                  forgotConfirmPassword !== forgotNewPassword
                }
                icon={isSubmitting ? <Spinner size="extra-tiny" /> : <CheckmarkCircleRegular />}
                style={{ width: '100%', marginBottom: tokens.spacingVerticalS }}
                data-testid="login-reset-submit-btn"
              >
                {t.login.resetPasswordBtn}
              </Button>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: tokens.spacingHorizontalS }}>
                <Button
                  appearance="subtle"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setIsForgotPassword(false);
                    setForgotStep('email');
                    setAuthErrors([]);
                    setOtpInfoMsg('');
                  }}
                  data-testid="login-reset-back-btn"
                >
                  {t.login.backToLoginBtn}
                </Button>
                <Button
                  appearance="secondary"
                  type="button"
                  disabled={isSubmitting || resendCooldown > 0}
                  onClick={handleForgotResend}
                  data-testid="login-reset-resend-btn"
                >
                  {resendCooldown > 0 ? `${t.onboarding.otpResendBtn} (${resendCooldown}s)` : t.onboarding.otpResendBtn}
                </Button>
              </div>
            </form>
          )
        ) : pendingOtpEmail ? (
          <form onSubmit={handleOtpSubmit} noValidate data-testid="login-otp-form">
            <Field label={t.onboarding.otpLabel} required style={{ marginBottom: tokens.spacingVerticalM }}>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otpCode}
                onChange={(_, d) => {
                  setOtpCode(d.value.replace(/\D/g, '').slice(0, 6));
                  if (authErrors.length) setAuthErrors([]);
                }}
                placeholder={t.onboarding.otpPlaceholder}
                contentBefore={<KeyRegular />}
                autoFocus
                data-testid="login-otp-input"
              />
            </Field>
            <Button
              appearance="primary"
              size="large"
              type="submit"
              disabled={isSubmitting}
              icon={isSubmitting ? <Spinner size="extra-tiny" /> : <CheckmarkCircleRegular />}
              style={{ width: '100%', marginBottom: tokens.spacingVerticalS }}
              data-testid="login-otp-verify-btn"
            >
              {t.onboarding.otpVerifyBtn}
            </Button>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: tokens.spacingHorizontalS }}>
              <Button
                appearance="subtle"
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setPendingOtpEmail(null);
                  setOtpCode('');
                  setOtpInfoMsg('');
                  setAuthErrors([]);
                }}
                data-testid="login-otp-back-btn"
              >
                {t.onboarding.otpBackBtn}
              </Button>
              <Button
                appearance="secondary"
                type="button"
                disabled={isSubmitting}
                onClick={handleOtpResend}
                data-testid="login-otp-resend-btn"
              >
                {t.onboarding.otpResendBtn}
              </Button>
            </div>
          </form>
        ) : activeTab === 'login' ? (
          <form onSubmit={handleLoginSubmit} noValidate>
            <LoginFormFields
              idPrefix="login"
              loginEmailVal={loginEmailVal}
              setLoginEmailVal={setLoginEmailVal}
              loginPasswordVal={loginPasswordVal}
              setLoginPasswordVal={setLoginPasswordVal}
              loginPinVal={loginPinVal}
              setLoginPinVal={setLoginPinVal}
              loginMode={loginMode}
              setLoginMode={setLoginMode}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              loginFieldErrors={loginFieldErrors}
              setLoginFieldErrors={setLoginFieldErrors}
              setAuthErrors={setAuthErrors}
              t={t}
              toggleTestId="login-toggle-mode-btn"
              toggleClassName={styles.modeToggleRow}
              onForgotPassword={() => {
                setIsForgotPassword(true);
                setForgotStep('email');
                setForgotEmail(loginEmailVal || initialEmail);
                setAuthErrors([]);
                setOtpInfoMsg('');
              }}
            />

            <Button
              appearance="primary"
              size="large"
              type="submit"
              disabled={isSubmitting}
              icon={isSubmitting ? <Spinner size="extra-tiny" /> : <ArrowRightRegular />}
              style={{ width: '100%', marginTop: tokens.spacingVerticalS }}
              data-testid="login-submit-btn"
            >
              {t.landing.loginSubmitBtn}
            </Button>

            <Divider style={{ margin: `${tokens.spacingVerticalM} 0` }}>
              {t.login.orDivider}
            </Divider>

            <GoogleAuthButton
              mode="login"
              disabled={isSubmitting}
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              dataTestId="login-google-btn"
            />
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} noValidate>
            <RegistrationFormFields
              idPrefix="login"
              regStoreName={regStoreName}
              setRegStoreName={setRegStoreName}
              regEmail={regEmail}
              setRegEmail={setRegEmail}
              regPassword={regPassword}
              setRegPassword={setRegPassword}
              regConfirmPassword={regConfirmPassword}
              setRegConfirmPassword={setRegConfirmPassword}
              regPin={regPin}
              setRegPin={setRegPin}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              showConfirmPassword={showConfirmPassword}
              setShowConfirmPassword={setShowConfirmPassword}
              regFieldErrors={regFieldErrors}
              setRegFieldErrors={setRegFieldErrors}
              t={t}
            />

            <Checkbox
              checked={regOfferGcash}
              onChange={(_, d) => setRegOfferGcash(Boolean(d.checked))}
              label={t.landing.offerGcashLabel}
              style={{ marginBottom: tokens.spacingVerticalS }}
            />

            <Checkbox
              checked={regIncludeStarterProducts}
              onChange={(_, d) => setRegIncludeStarterProducts(Boolean(d.checked))}
              label={
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <Text weight="semibold" size={200}>
                    {t.landing.starterProductsLabel}
                  </Text>
                  <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                    {t.landing.starterProductsDesc}
                  </Text>
                </div>
              }
              style={{ marginBottom: tokens.spacingVerticalM }}
              data-testid="login-reg-starter-products"
            />

            <Button
              appearance="primary"
              size="large"
              type="submit"
              disabled={isSubmitting}
              icon={isSubmitting ? <Spinner size="extra-tiny" /> : <SparkleRegular />}
              style={{ width: '100%' }}
              data-testid="login-register-submit-btn"
            >
              {t.landing.registerSubmitBtn}
            </Button>

            <Divider style={{ margin: `${tokens.spacingVerticalM} 0` }}>
              {t.login.orDivider}
            </Divider>

            <GoogleAuthButton
              mode="register"
              disabled={isSubmitting}
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              dataTestId="register-google-btn"
            />
          </form>
        )}

        <Divider style={{ margin: `${tokens.spacingVerticalL} 0` }} />

        {/* 1-Click Demo Test Drive */}
        <div className={styles.demoCard}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: '8px' }}>
            {t.login.demoNote}
          </Text>
          <Button
            appearance="secondary"
            size="medium"
            icon={<CheckmarkCircleRegular primaryFill={tokens.colorPaletteGreenForeground1} />}
            onClick={handleExploreDemo}
            disabled={isSubmitting}
            data-testid="login-demo-btn"
            style={{ width: '100%' }}
          >
            {t.landing.exploreDemoBtn}
          </Button>
        </div>

        {/* Back to Landing Page link & Web Account Deletion entry point */}
        <div className={styles.footerNav}>
          <Button
            appearance="subtle"
            size="small"
            icon={<ArrowLeftRegular />}
            onClick={() => onNavigate('landing')}
            data-testid="login-back-landing-btn"
          >
            {t.login.backToLanding}
          </Button>
          <div style={{ marginTop: '4px' }}>
            <Button
              appearance="subtle"
              size="small"
              style={{ fontSize: tokens.fontSizeBase100, color: tokens.colorNeutralForeground3 }}
              onClick={() => {
                setIsDeleteIntent(true);
                setActiveTab('login');
                if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
                  const url = new URL(window.location.href);
                  url.searchParams.set('intent', 'delete-account');
                  window.history.replaceState(null, '', url.pathname + url.search);
                }
              }}
              data-testid="login-web-delete-link"
            >
              {t.login.webDeleteAccountPrompt}
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmUnsyncedLoginDialog
        isOpen={isUnsyncedDialogOpen}
        unsyncedCount={unsyncedLoginCount}
        onClose={closeUnsyncedDialog}
        onConfirmWipeAndLogin={handleConfirmWipeAndLogin}
        onSyncFirst={handleSyncFirst}
        isSyncing={isSyncingFirst}
      />
    </div>
  );
};

export default LoginPage;
