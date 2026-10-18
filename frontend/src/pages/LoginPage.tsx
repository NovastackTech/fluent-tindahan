import React, { useState, useEffect } from 'react';
import {
  makeStyles,
  tokens,
  shorthands,
  Card,
  Text,
  Input,
  Button,
  Field,
  TabList,
  Tab,
  Badge,
  Spinner,
  Checkbox,
  Divider
} from '@fluentui/react-components';
import {
  KeyRegular,
  LockClosedRegular,
  MailRegular,
  EyeRegular,
  EyeOffRegular,
  ArrowRightRegular,
  SparkleRegular,
  ArrowLeftRegular,
  CheckmarkCircleRegular
} from '@fluentui/react-icons';
import type { NavTab } from '../components/Navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { processSyncQueue, kickSync, updateQueueCounts, pullCatalogFromServer } from '../sync/syncEngine';
import { ConfirmUnsyncedLoginDialog } from '../components/ConfirmUnsyncedLoginDialog';
import { useTranslation } from '../state/languageStore';
import { getLocalizedSyncErrorMessage } from '../utils/syncErrors';
import { useAuthStore } from '../state/authStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { useGCashFeeStore, DEFAULT_GCASH_FEE_TIERS } from '../state/gcashFeeStore';
import { registerStore, loginStore, loginPin, type AuthResponseDto } from '../services/authService';
import { createClientUuid, seedDexieDatabaseIfNeeded, DEFAULT_TENANT_ID } from '../db/seedData';
import { RegistrationFormFields } from '../components/RegistrationFormFields';
import { validateRegistrationInput } from '../utils/registrationValidation';

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
  const { completeOnboarding, loginWithAuthPayload } = useAuthStore();

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
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Unsynced queue protection
  const [isUnsyncedDialogOpen, setIsUnsyncedDialogOpen] = useState(false);
  const [unsyncedLoginCount, setUnsyncedLoginCount] = useState(0);
  const [pendingAuthPayload, setPendingAuthPayload] = useState<{
    payload: AuthResponseDto;
    localPin?: string;
  } | null>(null);
  const [isSyncingFirst, setIsSyncingFirst] = useState(false);
  const pendingSyncCount = useLiveQuery(() => db.syncQueue.count(), []) || 0;

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
      void useSubscriptionStore.getState().refreshSubscription();
      const productCount = await db.products.where('tenantId').equals(pendingAuthPayload.payload.tenantId).count();
      if (productCount === 0) {
        void pullCatalogFromServer().then(() => updateQueueCounts()).catch(console.error);
      }
      void processSyncQueue().catch(console.error);
      onNavigate('pos');
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
        void useSubscriptionStore.getState().refreshSubscription();
        const productCount = await db.products.where('tenantId').equals(pendingAuthPayload.payload.tenantId).count();
        if (productCount === 0) {
          void pullCatalogFromServer().then(() => updateQueueCounts()).catch(console.error);
        }
        void processSyncQueue().catch(console.error);
        onNavigate('pos');
      }
    } catch (e) {
      console.warn('Sync attempt failed:', e);
    } finally {
      setIsSyncingFirst(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setAuthErrors([]);
    setLoginFieldErrors({});

    const trimmedEmail = loginEmailVal.trim().toLowerCase();
    const errors: string[] = [];
    const fieldErrors: { email?: boolean; password?: boolean; pin?: boolean } = {};

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.push(t.onboarding.emailInvalid);
      fieldErrors.email = true;
    }

    if (loginMode === 'password') {
      if (!loginPasswordVal) {
        errors.push(t.onboarding.passwordRequired);
        fieldErrors.password = true;
      }
    } else {
      if (!loginPinVal.trim() || !/^\d{4,6}$/.test(loginPinVal.trim())) {
        errors.push(t.onboarding.pinInvalid);
        fieldErrors.pin = true;
      }
    }

    if (errors.length > 0) {
      setAuthErrors(errors);
      setLoginFieldErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      let authResult;
      if (loginMode === 'password') {
        authResult = await loginStore({
          email: trimmedEmail,
          password: loginPasswordVal
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

      void useSubscriptionStore.getState().refreshSubscription();
      const productCount = await db.products.where('tenantId').equals(authResult.tenantId).count();
      if (productCount === 0) {
        void pullCatalogFromServer().then(() => updateQueueCounts()).catch(console.error);
      }
      void processSyncQueue().catch(console.error);
      onNavigate('pos');
    } catch (err: any) {
      const msg = err?.response?.data?.message || t.onboarding.loginFailed;
      setAuthErrors([msg]);
      if (loginMode === 'password') {
        setLoginFieldErrors({ email: true, password: true });
      } else {
        setLoginFieldErrors({ email: true, pin: true });
      }
    } finally {
      setIsSubmitting(false);
    }
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

    setIsSubmitting(true);
    try {
      const newTenantId = createClientUuid();
      const newUserId = createClientUuid();

      // 1. Seed local Dexie (Zero Network Block Guarantee)
      await seedDexieDatabaseIfNeeded(
        false,
        newTenantId,
        !regIncludeStarterProducts,
        trimmedStore
      );

      // 2. Set GCash fees
      try {
        const fees = regOfferGcash ? DEFAULT_GCASH_FEE_TIERS : DEFAULT_GCASH_FEE_TIERS.map(() => 0);
        fees.forEach((fee, idx) => {
          useGCashFeeStore.getState().setFeeForTenant(newTenantId, idx, fee);
        });
      } catch (fErr) {
        console.warn('Could not set GCash fees:', fErr);
      }

      let serverToken: string | undefined;
      let registeredHasPin = Boolean(regPin.trim());

      try {
        const authResult = await registerStore({
          tenantId: newTenantId,
          userId: newUserId,
          email: trimmedEmail,
          password: regPassword,
          pin: regPin.trim() || undefined,
          businessName: trimmedStore
        });
        serverToken = authResult.token;
        registeredHasPin = authResult.hasPin;
      } catch (apiErr: any) {
        if (apiErr?.response?.status === 409) {
          setAuthErrors([t.onboarding.emailAlreadyExists]);
          setRegFieldErrors({ email: true });
          setIsSubmitting(false);
          return;
        }
        console.warn('Backend registration offline, proceeding locally:', apiErr);
      }

      completeOnboarding({
        businessName: trimmedStore,
        userEmail: trimmedEmail,
        tenantId: newTenantId,
        userId: newUserId,
        hasPin: registeredHasPin,
        localPin: regPin.trim() || undefined,
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
      onNavigate('pos');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || t.onboarding.submitError;
      setAuthError(msg);
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

        {authErrors.length > 0 && (
          <div className={styles.errorBanner} role="alert" data-testid="login-error-banner">
            {authErrors.length === 1 ? (
              <Text weight="semibold">{getLocalizedSyncErrorMessage(authErrors[0], language) || authErrors[0]}</Text>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {authErrors.map((err, idx) => (
                  <Text key={idx} weight="semibold">
                    • {getLocalizedSyncErrorMessage(err, language) || err}
                  </Text>
                ))}
              </div>
            )}
            {activeTab === 'login' && loginMode === 'pin' && (
              <div style={{ marginTop: '8px' }}>
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<LockClosedRegular />}
                  onClick={() => {
                    setLoginMode('password');
                    setAuthErrors([]);
                    setLoginFieldErrors({});
                  }}
                  data-testid="login-switch-to-password-btn"
                >
                  {language === 'tl' ? 'Mag-login gamit ang Password' : 'Log in using Password'}
                </Button>
              </div>
            )}
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

        {activeTab === 'login' ? (
          <form onSubmit={handleLoginSubmit} noValidate>
            <Field
              label={t.landing.emailLabel}
              required
              validationState={loginFieldErrors.email ? 'error' : undefined}
              style={{ marginBottom: tokens.spacingVerticalM }}
            >
              <Input
                type="email"
                id="login-email"
                name="email"
                autoComplete="username"
                enterKeyHint="next"
                value={loginEmailVal}
                onChange={(_, d) => {
                  setLoginEmailVal(d.value);
                  if (loginFieldErrors.email) {
                    setLoginFieldErrors(prev => ({ ...prev, email: false }));
                  }
                }}
                aria-invalid={Boolean(loginFieldErrors.email)}
                placeholder={t.landing.emailPlaceholder}
                contentBefore={<MailRegular />}
                required
              />
            </Field>

            {loginMode === 'password' ? (
              <Field
                label={t.landing.passwordLabel}
                required
                validationState={loginFieldErrors.password ? 'error' : undefined}
                style={{ marginBottom: tokens.spacingVerticalS }}
              >
                <Input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  name="password"
                  autoComplete="current-password"
                  enterKeyHint="done"
                  value={loginPasswordVal}
                  onChange={(_, d) => {
                    setLoginPasswordVal(d.value);
                    if (loginFieldErrors.password) {
                      setLoginFieldErrors(prev => ({ ...prev, password: false }));
                    }
                  }}
                  aria-invalid={Boolean(loginFieldErrors.password)}
                  placeholder={t.landing.passwordPlaceholder}
                  contentBefore={<LockClosedRegular />}
                  contentAfter={
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={showPassword ? <EyeOffRegular /> : <EyeRegular />}
                      onClick={() => setShowPassword(!showPassword)}
                      type="button"
                      aria-label="Toggle password visibility"
                    />
                  }
                  required
                />
              </Field>
            ) : (
              <Field
                label={t.landing.pinLabel}
                hint="4–6 numeric digits"
                required
                validationState={loginFieldErrors.pin ? 'error' : undefined}
                style={{ marginBottom: tokens.spacingVerticalS }}
              >
                <Input
                  type="password"
                  id="login-pin"
                  name="pin"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint="done"
                  value={loginPinVal}
                  onChange={(_, d) => {
                    setLoginPinVal(d.value);
                    if (loginFieldErrors.pin) {
                      setLoginFieldErrors(prev => ({ ...prev, pin: false }));
                    }
                  }}
                  aria-invalid={Boolean(loginFieldErrors.pin)}
                  placeholder={t.landing.pinPlaceholder}
                  contentBefore={<KeyRegular />}
                  required
                />
              </Field>
            )}

            <div className={styles.modeToggleRow}>
              <Button
                appearance="transparent"
                size="small"
                type="button"
                onClick={() => {
                  setLoginMode(loginMode === 'password' ? 'pin' : 'password');
                  setAuthErrors([]);
                  setLoginFieldErrors({});
                }}
                data-testid="login-toggle-mode-btn"
              >
                {loginMode === 'password' ? t.landing.usePinToggle : t.landing.usePasswordToggle}
              </Button>
            </div>

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
        onClose={() => {
          setIsUnsyncedDialogOpen(false);
          setPendingAuthPayload(null);
        }}
        onConfirmWipeAndLogin={handleConfirmWipeAndLogin}
        onSyncFirst={handleSyncFirst}
        isSyncing={isSyncingFirst}
      />
    </div>
  );
};

export default LoginPage;
