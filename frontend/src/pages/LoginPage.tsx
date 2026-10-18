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
  Divider
} from '@fluentui/react-components';
import {
  KeyRegular,
  ArrowRightRegular,
  SparkleRegular,
  ArrowLeftRegular,
  CheckmarkCircleRegular
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

  const {
    isUnsyncedDialogOpen,
    unsyncedLoginCount,
    isSyncingFirst,
    isSubmitting,
    setIsSubmitting,
    closeUnsyncedDialog,
    handleConfirmWipeAndLogin,
    handleSyncFirst,
    handleStoreLogin,
    handleStoreRegistration,
    handleGoogleAuth
  } = useStoreAuthFlow({
    onSuccess: () => onNavigate('pos')
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
            {activeTab === 'register' ? t.login.signUpPageTitle : t.login.pageTitle}
          </Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            {activeTab === 'register' ? t.login.signUpPageSubtitle : t.login.pageSubtitle}
          </Text>
        </div>

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

        <AuthErrorBanner
          authErrors={authErrors}
          language={language}
          containerClassName={styles.errorBanner}
          testId="login-error-banner"
          showSwitchToPassword={activeTab === 'login' && loginMode === 'pin'}
          onSwitchToPassword={() => {
            setLoginMode('password');
            setAuthErrors([]);
            setLoginFieldErrors({});
          }}
          switchToPasswordTestId="login-switch-to-password-btn"
        />

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

        {activeTab === 'login' ? (
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

        {/* Back to Landing Page link */}
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
