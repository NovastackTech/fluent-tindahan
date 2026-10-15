import React, { useState } from 'react';
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
  BuildingShopRegular,
  ArrowRightRegular,
  SparkleRegular,
  ArrowLeftRegular,
  CheckmarkCircleRegular
} from '@fluentui/react-icons';
import type { NavTab } from '../components/Navigation';
import { useTranslation } from '../state/languageStore';
import { useAuthStore } from '../state/authStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { useGCashFeeStore, DEFAULT_GCASH_FEE_TIERS } from '../state/gcashFeeStore';
import { registerStore, loginStore, loginPin } from '../services/authService';
import { createClientUuid, seedDexieDatabaseIfNeeded, DEFAULT_TENANT_ID } from '../db/seedData';

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
  const { t } = useTranslation();
  const { completeOnboarding, loginWithAuthPayload } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loginMode, setLoginMode] = useState<'password' | 'pin'>('password');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string>('');

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
  const [regPin, setRegPin] = useState('');
  const [regOfferGcash, setRegOfferGcash] = useState(true);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setAuthError('');

    const trimmedEmail = loginEmailVal.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setAuthError(t.onboarding.emailInvalid);
      return;
    }

    setIsSubmitting(true);
    try {
      let authResult;
      if (loginMode === 'password') {
        if (!loginPasswordVal) {
          setAuthError(t.onboarding.passwordRequired);
          setIsSubmitting(false);
          return;
        }
        authResult = await loginStore({
          email: trimmedEmail,
          password: loginPasswordVal
        });
      } else {
        if (!loginPinVal.trim() || !/^\d{4,6}$/.test(loginPinVal.trim())) {
          setAuthError(t.onboarding.pinInvalid);
          setIsSubmitting(false);
          return;
        }
        authResult = await loginPin({
          email: trimmedEmail,
          pin: loginPinVal.trim()
        });
      }

      await loginWithAuthPayload(authResult, loginMode === 'pin' ? loginPinVal.trim() : undefined);
      void useSubscriptionStore.getState().refreshSubscription();
      onNavigate('pos');
    } catch (err: any) {
      const msg = err?.response?.data?.message || t.onboarding.loginFailed;
      setAuthError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setAuthError('');

    const trimmedStore = regStoreName.trim();
    const trimmedEmail = regEmail.trim().toLowerCase();

    if (!trimmedStore || trimmedStore.length < 2) {
      setAuthError(t.onboarding.storeNameRequired);
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setAuthError(t.onboarding.emailInvalid);
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setAuthError(t.onboarding.passwordMinLength);
      return;
    }
    if (regPin.trim() && !/^\d{4,6}$/.test(regPin.trim())) {
      setAuthError(t.onboarding.pinInvalid);
      return;
    }

    setIsSubmitting(true);
    try {
      const newTenantId = createClientUuid();
      const newUserId = createClientUuid();

      // 1. Seed local Dexie (Zero Network Block Guarantee)
      await seedDexieDatabaseIfNeeded(false, newTenantId, false, trimmedStore);

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
          setAuthError(t.onboarding.emailAlreadyExists);
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
      onNavigate('pos');
    } catch (err: any) {
      setAuthError(err?.message || t.onboarding.submitError);
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
            {t.login.pageTitle}
          </Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            {t.login.pageSubtitle}
          </Text>
        </div>

        <TabList
          selectedValue={activeTab}
          onTabSelect={(_, data) => {
            setActiveTab(data.value as 'login' | 'register');
            setAuthError('');
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

        {authError && (
          <div className={styles.errorBanner} role="alert" data-testid="login-error-banner">
            <Text weight="semibold">{authError}</Text>
          </div>
        )}

        {activeTab === 'login' ? (
          <form onSubmit={handleLoginSubmit} noValidate>
            <Field label={t.landing.emailLabel} required style={{ marginBottom: tokens.spacingVerticalM }}>
              <Input
                type="email"
                id="login-email"
                name="email"
                autoComplete="username"
                enterKeyHint="next"
                value={loginEmailVal}
                onChange={(_, d) => setLoginEmailVal(d.value)}
                placeholder={t.landing.emailPlaceholder}
                contentBefore={<MailRegular />}
                required
              />
            </Field>

            {loginMode === 'password' ? (
              <Field label={t.landing.passwordLabel} required style={{ marginBottom: tokens.spacingVerticalS }}>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  name="password"
                  autoComplete="current-password"
                  enterKeyHint="done"
                  value={loginPasswordVal}
                  onChange={(_, d) => setLoginPasswordVal(d.value)}
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
              <Field label={t.landing.pinLabel} hint="4–6 numeric digits" required style={{ marginBottom: tokens.spacingVerticalS }}>
                <Input
                  type="password"
                  id="login-pin"
                  name="pin"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  enterKeyHint="done"
                  value={loginPinVal}
                  onChange={(_, d) => setLoginPinVal(d.value.replace(/\D/g, '').slice(0, 6))}
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
                  setAuthError('');
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
            <Field label={t.landing.storeNameLabel} required style={{ marginBottom: tokens.spacingVerticalS }}>
              <Input
                id="login-reg-store"
                name="businessName"
                value={regStoreName}
                onChange={(_, d) => setRegStoreName(d.value)}
                placeholder={t.landing.storeNamePlaceholder}
                contentBefore={<BuildingShopRegular />}
                required
              />
            </Field>

            <Field label={t.landing.emailLabel} required style={{ marginBottom: tokens.spacingVerticalS }}>
              <Input
                type="email"
                id="login-reg-email"
                name="email"
                autoComplete="username"
                value={regEmail}
                onChange={(_, d) => setRegEmail(d.value)}
                placeholder={t.landing.emailPlaceholder}
                contentBefore={<MailRegular />}
                required
              />
            </Field>

            <Field label={t.landing.passwordLabel} required style={{ marginBottom: tokens.spacingVerticalS }}>
              <Input
                type={showPassword ? 'text' : 'password'}
                id="login-reg-password"
                name="new-password"
                autoComplete="new-password"
                value={regPassword}
                onChange={(_, d) => setRegPassword(d.value)}
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

            <Field label={t.landing.pinLabel} style={{ marginBottom: tokens.spacingVerticalS }}>
              <Input
                type="password"
                id="login-reg-pin"
                name="pin"
                inputMode="numeric"
                maxLength={6}
                value={regPin}
                onChange={(_, d) => setRegPin(d.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t.landing.pinPlaceholder}
                contentBefore={<KeyRegular />}
              />
            </Field>

            <Checkbox
              checked={regOfferGcash}
              onChange={(_, d) => setRegOfferGcash(Boolean(d.checked))}
              label={t.landing.offerGcashLabel}
              style={{ marginBottom: tokens.spacingVerticalM }}
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
    </div>
  );
};

export default LoginPage;
