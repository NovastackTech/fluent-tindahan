import React, { useState } from 'react';
import {
  makeStyles,
  tokens,
  shorthands,
  Text,
  Card,
  Button,
  Badge,
  Input,
  Field,
  Checkbox,
  TabList,
  Tab,
  Spinner,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  mergeClasses
} from '@fluentui/react-components';
import {
  ShoppingBagRegular,
  NotebookRegular,
  PhoneRegular,
  BoxRegular,
  PrintRegular,
  CloudCheckmarkRegular,
  SparkleRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  LockClosedRegular,
  KeyRegular,
  MailRegular,
  EyeRegular,
  EyeOffRegular,
  BuildingShopRegular,
  ArrowRightRegular,
  CalculatorRegular,
  StarFilled,
  QuestionCircleRegular
} from '@fluentui/react-icons';
import type { NavTab } from '../components/Navigation';
import { useTranslation } from '../state/languageStore';
import { getLocalizedSyncErrorMessage } from '../utils/syncErrors';
import { useAuthStore } from '../state/authStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { useGCashFeeStore, DEFAULT_GCASH_FEE_TIERS } from '../state/gcashFeeStore';
import { db } from '../db/db';
import { processSyncQueue, updateQueueCounts, kickSync } from '../sync/syncEngine';
import { ConfirmUnsyncedLoginDialog } from '../components/ConfirmUnsyncedLoginDialog';
import { registerStore, loginStore, loginPin, type AuthResponseDto } from '../services/authService';
import { createClientUuid, seedDexieDatabaseIfNeeded, DEFAULT_TENANT_ID } from '../db/seedData';
import { formatPeso } from '../utils/currency';

interface LandingPageProps {
  onNavigate: (tab: NavTab) => void;
}

const useStyles = makeStyles({
  container: {
    maxWidth: '1160px',
    marginLeft: 'auto',
    marginRight: 'auto',
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalM),
    paddingBottom: '120px'
  },
  heroSection: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: tokens.spacingHorizontalXL,
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalXXL,
    '@media (min-width: 900px)': {
      gridTemplateColumns: '1.2fr 0.9fr'
    }
  },
  heroBadgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalM
  },
  heroTitle: {
    fontSize: '32px',
    lineHeight: '40px',
    fontWeight: 800,
    color: tokens.colorNeutralForeground1,
    marginBottom: tokens.spacingVerticalM,
    '@media (min-width: 768px)': {
      fontSize: '42px',
      lineHeight: '50px'
    }
  },
  heroTitleGradient: {
    color: tokens.colorPaletteGreenForeground1
  },
  heroSubtitle: {
    fontSize: '16px',
    lineHeight: '26px',
    color: tokens.colorNeutralForeground2,
    marginBottom: tokens.spacingVerticalL
  },
  heroActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalL
  },
  heroPerks: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    fontSize: '13px',
    color: tokens.colorNeutralForeground3
  },
  perkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  heroCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL)
  },
  photoBannerCard: {
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    overflow: 'hidden',
    boxShadow: tokens.shadow8,
    marginBottom: tokens.spacingVerticalXXL,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
    backgroundColor: tokens.colorNeutralBackground1
  },
  photoBannerGraphic: {
    width: '100%',
    minHeight: '180px',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #064e3b 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM)
  },
  photoBannerCaption: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    backgroundColor: tokens.colorNeutralBackground2
  },
  sectionHeader: {
    textAlign: 'center',
    maxWidth: '720px',
    marginLeft: 'auto',
    marginRight: 'auto',
    marginBottom: tokens.spacingVerticalXL
  },
  sectionTitle: {
    fontSize: '26px',
    fontWeight: 700,
    marginBottom: tokens.spacingVerticalS,
    display: 'block'
  },
  sectionSubtitle: {
    fontSize: '15px',
    color: tokens.colorNeutralForeground3,
    display: 'block'
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalXXL
  },
  featureCard: {
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    transitionProperty: 'transform, box-shadow',
    transitionDuration: '200ms',
    ':hover': {
      transform: 'translateY(-3px)',
      boxShadow: tokens.shadow8
    }
  },
  featureIconWrapper: {
    width: '44px',
    height: '44px',
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px'
  },
  calcContainer: {
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalXL),
    marginBottom: tokens.spacingVerticalXXL,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2)
  },
  calcGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: tokens.spacingHorizontalXL,
    marginTop: tokens.spacingVerticalL,
    '@media (min-width: 800px)': {
      gridTemplateColumns: '1fr 1fr'
    }
  },
  calcSliders: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL
  },
  calcOutputGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: tokens.spacingHorizontalM
  },
  calcStatCard: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1)
  },
  compareGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalXXL,
    '@media (min-width: 768px)': {
      gridTemplateColumns: '1fr 1fr'
    }
  },
  compareCard: {
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    ...shorthands.borderRadius(tokens.borderRadiusLarge)
  },
  compareOld: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border('1px', 'solid', tokens.colorPaletteRedBorder1)
  },
  compareNew: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border('2px', 'solid', tokens.colorPaletteGreenBorder1),
    boxShadow: tokens.shadow8
  },
  compareList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalM
  },
  compareItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px'
  },
  pricingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalXXL,
    paddingTop: '16px'
  },
  pricingCard: {
    ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalL),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    overflow: 'visible'
  },
  pricingCardHighlighted: {
    ...shorthands.border('2px', 'solid', tokens.colorBrandStroke1),
    boxShadow: tokens.shadow16,
    position: 'relative',
    overflow: 'visible'
  },
  popularBadge: {
    position: 'absolute',
    top: '-12px',
    right: '20px',
    zIndex: 10,
    boxShadow: tokens.shadow4,
    fontWeight: 700
  },
  testimonialsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalXXL
  },
  testimonialCard: {
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1)
  },
  faqContainer: {
    maxWidth: '820px',
    marginLeft: 'auto',
    marginRight: 'auto',
    marginBottom: tokens.spacingVerticalXXL
  },
  ctaBanner: {
    textAlign: 'center',
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralBackground1,
    ...shorthands.padding(tokens.spacingVerticalXXL, tokens.spacingHorizontalXL),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    boxShadow: tokens.shadow16
  },
  errorText: {
    color: tokens.colorPaletteRedForeground1,
    fontSize: '12px',
    marginTop: '4px'
  }
});

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const styles = useStyles();
  const { t, language } = useTranslation();
  const {
    isOnboarded,
    businessName,
    userEmail,
    loginWithAuthPayload,
    completeOnboarding,
    openOnboarding
  } = useAuthStore();

  // Auth Card State
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loginMode, setLoginMode] = useState<'password' | 'pin'>('password');
  const [loginEmailVal, setLoginEmailVal] = useState('');
  const [loginPasswordVal, setLoginPasswordVal] = useState('');
  const [loginPinVal, setLoginPinVal] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Registration Form State
  const [regStoreName, setRegStoreName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regOfferGcash, setRegOfferGcash] = useState(true);

  // Profit Calculator State
  const [calcDailySales, setCalcDailySales] = useState<number>(8000);
  const [calcGcashTxns, setCalcGcashTxns] = useState<number>(60);
  const [calcMargin, setCalcMargin] = useState<number>(15);

  // Calculated Values
  const monthlyRetailProfit = Math.round(calcDailySales * 30 * (calcMargin / 100));
  const monthlyGcashProfit = Math.round(calcGcashTxns * 15);
  const monthlyUtangRecovered = Math.round(calcDailySales * 30 * 0.018); // ~1.8% loss avoided
  const monthlyHoursSaved = Math.max(15, Math.round(calcDailySales / 250));

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
      void useSubscriptionStore.getState().refreshSubscription();
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
    setAuthError('');

    const trimmedEmail = loginEmailVal.trim().toLowerCase();
    if (!trimmedEmail) {
      setAuthError(t.onboarding.emailRequired);
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

      // 1. Seed Dexie first (Zero Network Block Guarantee)
      await seedDexieDatabaseIfNeeded(false, newTenantId, false, trimmedStore);

      // Save initial GCash fees
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
      await updateQueueCounts();
      void kickSync();
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
      useSubscriptionStore.setState({
        tier: 'Libre',
        subscriptionEndDate: null,
        isActive: false
      });
      await updateQueueCounts();
      onNavigate('pos');
    } catch (err) {
      console.error('Failed to launch demo:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToPricing = () => {
    const el = document.getElementById('pricing');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className={styles.container} id="landing-page-root">
      {/* 1. Hero Section */}
      <section className={styles.heroSection}>
        <div>
          <div className={styles.heroBadgeRow}>
            <Badge appearance="filled" color="brand">{t.landing.heroBadge}</Badge>
            <Badge appearance="tint" color="success">⚡ Zero Network Delay</Badge>
          </div>

          <h1 className={styles.heroTitle}>
            {t.landing.heroTitle.split('—')[0]}
            {t.landing.heroTitle.includes('—') && (
              <>
                <br />
                <span className={styles.heroTitleGradient}>
                  — {t.landing.heroTitle.split('—')[1]}
                </span>
              </>
            )}
          </h1>

          <p className={styles.heroSubtitle}>
            {t.landing.heroSubtitle}
          </p>

          <div className={styles.heroActions}>
            <Button
              appearance="primary"
              size="large"
              icon={<SparkleRegular />}
              onClick={handleExploreDemo}
              disabled={isSubmitting}
              data-testid="hero-explore-demo-btn"
            >
              {t.landing.tryDemoBtn}
            </Button>
            <Button
              appearance="secondary"
              size="large"
              onClick={scrollToPricing}
            >
              {t.landing.viewPricingBtn}
            </Button>
          </div>

          <div className={styles.heroPerks}>
            <div className={styles.perkItem}>
              <CheckmarkCircleRegular primaryFill={tokens.colorPaletteGreenForeground1} />
              <span>100% Offline-First sa IndexedDB — Hindi mababagal sa mahinang signal</span>
            </div>
            <div className={styles.perkItem}>
              <CheckmarkCircleRegular primaryFill={tokens.colorPaletteGreenForeground1} />
              <span>Integer Centavo Math — Walang floating point rounding drift sa kaha</span>
            </div>
            <div className={styles.perkItem}>
              <CheckmarkCircleRegular primaryFill={tokens.colorPaletteGreenForeground1} />
              <span>Libre Magpakailanman — Hanggang 30 paninda at 30 debtors</span>
            </div>
          </div>
        </div>

        {/* Hero Card: Sign In / Register / Logged In State */}
        <div id="login-section">
          <Card className={styles.heroCard}>
            {isOnboarded ? (
              <div style={{ textAlign: 'center', padding: `${tokens.spacingVerticalM} 0` }}>
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>🛒</div>
                <Text size={400} weight="bold" style={{ display: 'block', marginBottom: '4px' }}>
                  {t.landing.loggedInStatus}
                </Text>
                <Text size={500} weight="bold" style={{ color: tokens.colorBrandForeground1, display: 'block' }}>
                  {businessName}
                </Text>
                {userEmail && (
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: '16px' }}>
                    {userEmail}
                  </Text>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                  <Button
                    appearance="primary"
                    size="large"
                    icon={<ShoppingBagRegular />}
                    onClick={() => onNavigate('pos')}
                    data-testid="landing-authenticated-pos-btn"
                  >
                    {t.landing.openPosBtn}
                  </Button>
                  <Button
                    appearance="secondary"
                    onClick={() => onNavigate('dashboard')}
                    data-testid="landing-authenticated-dashboard-btn"
                  >
                    {t.landing.openDashboardBtn}
                  </Button>
                  <Button
                    appearance="subtle"
                    size="small"
                    onClick={() => openOnboarding('initial')}
                  >
                    {t.landing.switchStoreBtn}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: tokens.spacingVerticalM }}>
                  <Text size={400} weight="bold" style={{ display: 'block' }}>
                    {t.landing.loginCardTitle}
                  </Text>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                    {t.landing.loginCardDesc}
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
                  <Tab value="login" icon={<KeyRegular />} data-testid="tab-login-btn">
                    {t.landing.tabLogin}
                  </Tab>
                  <Tab value="register" icon={<SparkleRegular />} data-testid="tab-register-btn">
                    {t.landing.tabRegister}
                  </Tab>
                </TabList>

                {authError && (
                  <div style={{ marginBottom: tokens.spacingVerticalM }}>
                    <Text role="alert" className={styles.errorText} style={{ display: 'block' }}>
                      {getLocalizedSyncErrorMessage(authError, language) || authError}
                    </Text>
                  </div>
                )}

                {activeTab === 'login' ? (
                  <form onSubmit={handleLoginSubmit} noValidate>
                    <Field label={t.landing.emailLabel} required style={{ marginBottom: tokens.spacingVerticalM }}>
                      <Input
                        type="email"
                        id="landing-login-email"
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
                      <Field label={t.landing.passwordLabel} required style={{ marginBottom: tokens.spacingVerticalM }}>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          id="landing-login-password"
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
                      <Field label={t.landing.pinLabel} hint="4–6 numeric digits" required style={{ marginBottom: tokens.spacingVerticalM }}>
                        <Input
                          type="password"
                          id="landing-login-pin"
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

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacingVerticalM }}>
                      <Button
                        appearance="transparent"
                        size="small"
                        type="button"
                        onClick={() => {
                          setLoginMode(loginMode === 'password' ? 'pin' : 'password');
                          setAuthError('');
                        }}
                        data-testid="landing-toggle-pin-btn"
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
                      style={{ width: '100%', marginBottom: tokens.spacingVerticalM }}
                      data-testid="landing-login-submit-btn"
                    >
                      {t.landing.loginSubmitBtn}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleRegisterSubmit} noValidate>
                    <Field label={t.landing.storeNameLabel} required style={{ marginBottom: tokens.spacingVerticalS }}>
                      <Input
                        id="landing-reg-store"
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
                        id="landing-reg-email"
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
                        id="landing-reg-password"
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
                          />
                        }
                        required
                      />
                    </Field>

                    <Field label={t.landing.pinLabel} style={{ marginBottom: tokens.spacingVerticalS }}>
                      <Input
                        type="password"
                        id="landing-reg-pin"
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
                      style={{ width: '100%', marginBottom: tokens.spacingVerticalM }}
                      data-testid="landing-register-submit-btn"
                    >
                      {t.landing.registerSubmitBtn}
                    </Button>
                  </form>
                )}

                <div style={{ textAlign: 'center', borderTop: `1px solid ${tokens.colorNeutralStroke2}`, paddingTop: tokens.spacingVerticalM }}>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: '6px' }}>
                    {t.landing.demoStorePrompt}
                  </Text>
                  <Button
                    appearance="subtle"
                    size="small"
                    onClick={handleExploreDemo}
                    disabled={isSubmitting}
                  >
                    {t.landing.exploreDemoBtn} →
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* 2. Photo Banner & Real Sari-Sari Context */}
      <section className={styles.photoBannerCard}>
        <div className={styles.photoBannerGraphic}>
          <svg
            viewBox="0 0 800 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: '100%', maxHeight: '200px' }}
            aria-label="Balay ni Maria Sari-Sari Store with Modern POS Counter"
            role="img"
          >
            <rect x="180" y="50" width="440" height="150" rx="12" fill="#1e293b" stroke="#334155" strokeWidth="2" />
            
            {/* Awning stripes */}
            <path d="M160 50 L180 20 L620 20 L640 50 Z" fill="#b91c1c" />
            <path d="M190 20 L220 20 L210 50 L180 50 Z" fill="#ffffff" />
            <path d="M250 20 L280 20 L270 50 L240 50 Z" fill="#ffffff" />
            <path d="M310 20 L340 20 L330 50 L300 50 Z" fill="#ffffff" />
            <path d="M370 20 L400 20 L390 50 L360 50 Z" fill="#ffffff" />
            <path d="M430 20 L460 20 L450 50 L420 50 Z" fill="#ffffff" />
            <path d="M490 20 L520 20 L510 50 L480 50 Z" fill="#ffffff" />
            <path d="M550 20 L580 20 L570 50 L540 50 Z" fill="#ffffff" />
            <path d="M610 20 L620 20 L640 50 L630 50 Z" fill="#ffffff" />

            {/* Store counter & tablet */}
            <rect x="220" y="140" width="360" height="50" rx="6" fill="#334155" />
            <rect x="360" y="95" width="80" height="55" rx="6" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
            <rect x="368" y="103" width="64" height="36" rx="3" fill="#0284c7" />
            <path d="M390 150 L410 150 L405 160 L395 160 Z" fill="#64748b" />
            
            {/* Shelves & FMCG products */}
            <rect x="220" y="70" width="120" height="8" rx="2" fill="#475569" />
            <rect x="460" y="70" width="120" height="8" rx="2" fill="#475569" />
            <rect x="230" y="56" width="14" height="14" rx="2" fill="#f59e0b" />
            <rect x="250" y="54" width="16" height="16" rx="2" fill="#ef4444" />
            <rect x="272" y="57" width="12" height="13" rx="2" fill="#10b981" />
            <rect x="290" y="55" width="15" height="15" rx="2" fill="#3b82f6" />
            
            <rect x="470" y="55" width="16" height="15" rx="2" fill="#ec4899" />
            <rect x="492" y="53" width="18" height="17" rx="2" fill="#8b5cf6" />
            <rect x="516" y="56" width="14" height="14" rx="2" fill="#f97316" />
            <rect x="536" y="54" width="15" height="16" rx="2" fill="#14b8a6" />

            {/* Feature badges */}
            <g transform="translate(140, 95)">
              <rect width="110" height="32" rx="16" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" strokeWidth="1" />
              <text x="55" y="20" fill="#34d399" fontSize="11" fontWeight="bold" textAnchor="middle">⚡ Zero Latency POS</text>
            </g>

            <g transform="translate(550, 95)">
              <rect width="110" height="32" rx="16" fill="rgba(56, 189, 248, 0.2)" stroke="#38bdf8" strokeWidth="1" />
              <text x="55" y="20" fill="#7dd3fc" fontSize="11" fontWeight="bold" textAnchor="middle">📶 100% Offline-Ready</text>
            </g>
          </svg>
        </div>
        <div className={styles.photoBannerCaption}>
          <div>
            <Text weight="bold" size={300}>Balay ni Maria Sari-Sari Store • Maynila</Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
              Mabilisang checkout sa suki gamit ang Fluent Tindahan kahit brownout at walang internet load.
            </Text>
          </div>
          <Badge appearance="filled" color="success">🇵🇭 Tindahang Pinoy</Badge>
        </div>
      </section>

      {/* 3. Core Features Grid */}
      <section style={{ marginBottom: tokens.spacingVerticalXXL }}>
        <div className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>{t.landing.featuresTitle}</Text>
          <Text className={styles.sectionSubtitle}>{t.landing.featuresSubtitle}</Text>
        </div>

        <div className={styles.featuresGrid}>
          <Card className={styles.featureCard}>
            <div className={styles.featureIconWrapper}>
              <ShoppingBagRegular />
            </div>
            <div>
              <Text weight="bold" size={400} style={{ display: 'block', marginBottom: '4px' }}>
                {t.landing.feat1Title}
              </Text>
              <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
                {t.landing.feat1Desc}
              </Text>
            </div>
          </Card>

          <Card className={styles.featureCard}>
            <div className={styles.featureIconWrapper}>
              <NotebookRegular />
            </div>
            <div>
              <Text weight="bold" size={400} style={{ display: 'block', marginBottom: '4px' }}>
                {t.landing.feat2Title}
              </Text>
              <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
                {t.landing.feat2Desc}
              </Text>
            </div>
          </Card>

          <Card className={styles.featureCard}>
            <div className={styles.featureIconWrapper}>
              <PhoneRegular />
            </div>
            <div>
              <Text weight="bold" size={400} style={{ display: 'block', marginBottom: '4px' }}>
                {t.landing.feat3Title}
              </Text>
              <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
                {t.landing.feat3Desc}
              </Text>
            </div>
          </Card>

          <Card className={styles.featureCard}>
            <div className={styles.featureIconWrapper}>
              <BoxRegular />
            </div>
            <div>
              <Text weight="bold" size={400} style={{ display: 'block', marginBottom: '4px' }}>
                {t.landing.feat4Title}
              </Text>
              <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
                {t.landing.feat4Desc}
              </Text>
            </div>
          </Card>

          <Card className={styles.featureCard}>
            <div className={styles.featureIconWrapper}>
              <PrintRegular />
            </div>
            <div>
              <Text weight="bold" size={400} style={{ display: 'block', marginBottom: '4px' }}>
                {t.landing.feat5Title}
              </Text>
              <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
                {t.landing.feat5Desc}
              </Text>
            </div>
          </Card>

          <Card className={styles.featureCard}>
            <div className={styles.featureIconWrapper}>
              <CloudCheckmarkRegular />
            </div>
            <div>
              <Text weight="bold" size={400} style={{ display: 'block', marginBottom: '4px' }}>
                {t.landing.feat6Title}
              </Text>
              <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
                {t.landing.feat6Desc}
              </Text>
            </div>
          </Card>
        </div>
      </section>

      {/* 4. Interactive ROI & Profit Calculator */}
      <section className={styles.calcContainer}>
        <div className={styles.sectionHeader} style={{ marginBottom: tokens.spacingVerticalM }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <CalculatorRegular fontSize={24} color={tokens.colorBrandForeground1} />
            <Text className={styles.sectionTitle} style={{ marginBottom: 0 }}>{t.landing.calcTitle}</Text>
          </div>
          <Text className={styles.sectionSubtitle}>{t.landing.calcSubtitle}</Text>
        </div>

        <div className={styles.calcGrid}>
          {/* Sliders */}
          <div className={styles.calcSliders}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <Text size={300} weight="semibold">{t.landing.calcDailySales}</Text>
                <Text size={300} weight="bold" style={{ color: tokens.colorBrandForeground1 }}>
                  {formatPeso(calcDailySales)} / araw
                </Text>
              </div>
              <input
                type="range"
                min={1000}
                max={50000}
                step={500}
                value={calcDailySales}
                onChange={(e) => setCalcDailySales(Number(e.target.value))}
                style={{ width: '100%', accentColor: tokens.colorBrandBackground }}
                aria-label={t.landing.calcDailySales}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <Text size={300} weight="semibold">{t.landing.calcGcashTxns}</Text>
                <Text size={300} weight="bold" style={{ color: tokens.colorBrandForeground1 }}>
                  {calcGcashTxns} txns / buwan
                </Text>
              </div>
              <input
                type="range"
                min={0}
                max={500}
                step={10}
                value={calcGcashTxns}
                onChange={(e) => setCalcGcashTxns(Number(e.target.value))}
                style={{ width: '100%', accentColor: tokens.colorBrandBackground }}
                aria-label={t.landing.calcGcashTxns}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <Text size={300} weight="semibold">{t.landing.calcMargin}</Text>
                <Text size={300} weight="bold" style={{ color: tokens.colorBrandForeground1 }}>
                  {calcMargin}% tubo
                </Text>
              </div>
              <input
                type="range"
                min={5}
                max={35}
                step={1}
                value={calcMargin}
                onChange={(e) => setCalcMargin(Number(e.target.value))}
                style={{ width: '100%', accentColor: tokens.colorBrandBackground }}
                aria-label={t.landing.calcMargin}
              />
            </div>
          </div>

          {/* Computed Output Cards */}
          <div className={styles.calcOutputGrid}>
            <div className={styles.calcStatCard}>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{t.landing.calcMonthlyProfit}</Text>
              <Text size={600} weight="bold" style={{ color: tokens.colorPaletteGreenForeground1 }}>
                {formatPeso(monthlyRetailProfit)}
              </Text>
            </div>

            <div className={styles.calcStatCard}>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{t.landing.calcGcashProfit}</Text>
              <Text size={600} weight="bold" style={{ color: tokens.colorPaletteGreenForeground1 }}>
                +{formatPeso(monthlyGcashProfit)}
              </Text>
            </div>

            <div className={styles.calcStatCard}>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{t.landing.calcUtangRecovered}</Text>
              <Text size={600} weight="bold" style={{ color: tokens.colorPaletteBlueForeground2 }}>
                ~{formatPeso(monthlyUtangRecovered)}
              </Text>
            </div>

            <div className={styles.calcStatCard}>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{t.landing.calcHoursSaved}</Text>
              <Text size={600} weight="bold" style={{ color: tokens.colorPaletteDarkOrangeForeground1 }}>
                ~{monthlyHoursSaved} oras
              </Text>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Comparison: Paper Notebook vs Fluent Tindahan */}
      <section style={{ marginBottom: tokens.spacingVerticalXXL }}>
        <div className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>{t.landing.compareTitle}</Text>
          <Text className={styles.sectionSubtitle}>{t.landing.compareSubtitle}</Text>
        </div>

        <div className={styles.compareGrid}>
          <Card className={mergeClasses(styles.compareCard, styles.compareOld)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <DismissCircleRegular fontSize={24} primaryFill={tokens.colorPaletteRedForeground1} />
              <Text size={500} weight="bold">{t.landing.compareOldTitle}</Text>
            </div>
            <div className={styles.compareList}>
              <div className={styles.compareItem}>
                <DismissCircleRegular primaryFill={tokens.colorPaletteRedForeground1} />
                <Text size={300}>{t.landing.compareOldItem1}</Text>
              </div>
              <div className={styles.compareItem}>
                <DismissCircleRegular primaryFill={tokens.colorPaletteRedForeground1} />
                <Text size={300}>{t.landing.compareOldItem2}</Text>
              </div>
              <div className={styles.compareItem}>
                <DismissCircleRegular primaryFill={tokens.colorPaletteRedForeground1} />
                <Text size={300}>{t.landing.compareOldItem3}</Text>
              </div>
              <div className={styles.compareItem}>
                <DismissCircleRegular primaryFill={tokens.colorPaletteRedForeground1} />
                <Text size={300}>{t.landing.compareOldItem4}</Text>
              </div>
            </div>
          </Card>

          <Card className={mergeClasses(styles.compareCard, styles.compareNew)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <CheckmarkCircleRegular fontSize={24} primaryFill={tokens.colorPaletteGreenForeground1} />
              <Text size={500} weight="bold" style={{ color: tokens.colorBrandForeground1 }}>
                {t.landing.compareNewTitle}
              </Text>
            </div>
            <div className={styles.compareList}>
              <div className={styles.compareItem}>
                <CheckmarkCircleRegular primaryFill={tokens.colorPaletteGreenForeground1} />
                <Text size={300}>{t.landing.compareNewItem1}</Text>
              </div>
              <div className={styles.compareItem}>
                <CheckmarkCircleRegular primaryFill={tokens.colorPaletteGreenForeground1} />
                <Text size={300}>{t.landing.compareNewItem2}</Text>
              </div>
              <div className={styles.compareItem}>
                <CheckmarkCircleRegular primaryFill={tokens.colorPaletteGreenForeground1} />
                <Text size={300}>{t.landing.compareNewItem3}</Text>
              </div>
              <div className={styles.compareItem}>
                <CheckmarkCircleRegular primaryFill={tokens.colorPaletteGreenForeground1} />
                <Text size={300}>{t.landing.compareNewItem4}</Text>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* 6. Pricing Plans */}
      <section id="pricing" style={{ marginBottom: tokens.spacingVerticalXXL }}>
        <div className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>{t.landing.pricingTitle}</Text>
          <Text className={styles.sectionSubtitle}>{t.landing.pricingSubtitle}</Text>
        </div>

        <div className={styles.pricingGrid}>
          <Card className={styles.pricingCard}>
            <div>
              <Text size={500} weight="bold" style={{ display: 'block', marginBottom: '4px' }}>
                {t.landing.planFreeTitle}
              </Text>
              <Text size={600} weight="bold" style={{ color: tokens.colorBrandForeground1, display: 'block', marginBottom: '8px' }}>
                {t.landing.planFreePrice}
              </Text>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: '16px' }}>
                {t.landing.planFreeDesc}
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div>✓ Hanggang 30 Produkto</div>
                <div>✓ Hanggang 30 Utang Debtors</div>
                <div>✓ 30 GCash Txns bawat buwan</div>
                <div>✓ 100% Offline POS & Kaha</div>
              </div>
            </div>
            <Button
              appearance="secondary"
              onClick={() => {
                const el = document.getElementById('login-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{ marginTop: '20px' }}
            >
              {t.landing.startNowBtn}
            </Button>
          </Card>

          <Card
            className={mergeClasses(styles.pricingCard, styles.pricingCardHighlighted)}
            style={{ overflow: 'visible' }}
          >
            <Badge
              appearance="filled"
              color="warning"
              icon={<StarFilled />}
              className={styles.popularBadge}
            >
              {t.subscription.popularBadge}
            </Badge>
            <div>
              <Text size={500} weight="bold" style={{ display: 'block', marginBottom: '4px' }}>
                {t.landing.planProTitle}
              </Text>
              <Text size={600} weight="bold" style={{ color: tokens.colorBrandForeground1, display: 'block', marginBottom: '8px' }}>
                {t.landing.planProPrice}
              </Text>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: '16px' }}>
                {t.landing.planProDesc}
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div>✓ Walang Limitasyong Produkto</div>
                <div>✓ Walang Limitasyong Utang Debtors</div>
                <div>✓ Walang Limitasyong GCash Txns</div>
                <div>✓ Detalyadong Profit & Margin Analytics</div>
                <div>✓ Resibong walang watermark</div>
                <div>✓ CSV Bulk Catalog Import</div>
              </div>
            </div>
            <Button
              appearance="primary"
              onClick={() => {
                const el = document.getElementById('login-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{ marginTop: '20px' }}
            >
              {t.landing.startNowBtn}
            </Button>
          </Card>

          <Card className={styles.pricingCard}>
            <div>
              <Text size={500} weight="bold" style={{ display: 'block', marginBottom: '4px' }}>
                {t.landing.planPlusTitle}
              </Text>
              <Text size={600} weight="bold" style={{ color: tokens.colorBrandForeground1, display: 'block', marginBottom: '8px' }}>
                {t.landing.planPlusPrice}
              </Text>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginBottom: '16px' }}>
                {t.landing.planPlusDesc}
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div>✓ Lahat ng nasa Tindahan Pro</div>
                <div>✓ Hanggang 5 Staff Cashiers na may PIN</div>
                <div>✓ Sabay-sabay na 4 Devices</div>
                <div>✓ Buong Staff Audit Trail Logs</div>
                <div>✓ Priority Cloud Database Backup</div>
              </div>
            </div>
            <Button
              appearance="secondary"
              onClick={() => {
                const el = document.getElementById('login-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{ marginTop: '20px' }}
            >
              {t.landing.startNowBtn}
            </Button>
          </Card>
        </div>
      </section>

      {/* 7. Testimonials */}
      <section style={{ marginBottom: tokens.spacingVerticalXXL }}>
        <div className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>{t.landing.testimonialsTitle}</Text>
          <Text className={styles.sectionSubtitle}>{t.landing.testimonialsSubtitle}</Text>
        </div>

        <div className={styles.testimonialsGrid}>
          <Card className={styles.testimonialCard}>
            <div style={{ display: 'flex', gap: '4px', color: tokens.colorPaletteGoldForeground2 }}>
              <StarFilled /><StarFilled /><StarFilled /><StarFilled /><StarFilled />
            </div>
            <Text size={300} style={{ fontStyle: 'italic', color: tokens.colorNeutralForeground2 }}>
              "Dati puro punit-punit na kuwaderno ang listahan ng pautang. Ngayon, isang pindot lang sa phone, alam agad ni kumare kung magkano ang bayarin niya nang walang samaan ng loob!"
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: tokens.colorBrandBackground2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                NS
              </div>
              <div>
                <Text weight="bold" size={300} style={{ display: 'block' }}>Aling Nena Santos</Text>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Nena’s Store • Tondo, Maynila</Text>
              </div>
            </div>
          </Card>

          <Card className={styles.testimonialCard}>
            <div style={{ display: 'flex', gap: '4px', color: tokens.colorPaletteGoldForeground2 }}>
              <StarFilled /><StarFilled /><StarFilled /><StarFilled /><StarFilled />
            </div>
            <Text size={300} style={{ fontStyle: 'italic', color: tokens.colorNeutralForeground2 }}>
              "Napakalaking tulong ng GCash fee calculator! Hindi na ako nalulugi sa bawas ng digital balance, at tugma lagi ang kaha ko sa gabi kapag nagbibilang ng cash."
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: tokens.colorBrandBackground2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                JM
              </div>
              <div>
                <Text weight="bold" size={300} style={{ display: 'block' }}>Kuya Jun Morales</Text>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>JM Sari-Sari & Remittance • Cavite</Text>
              </div>
            </div>
          </Card>

          <Card className={styles.testimonialCard}>
            <div style={{ display: 'flex', gap: '4px', color: tokens.colorPaletteGoldForeground2 }}>
              <StarFilled /><StarFilled /><StarFilled /><StarFilled /><StarFilled />
            </div>
            <Text size={300} style={{ fontStyle: 'italic', color: tokens.colorNeutralForeground2 }}>
              "Kahit brownout at walang internet sa barangay namin, tuloy-tuloy ang pagtitinda gamit ang lumang tablet. Pagbalik ng kuryente, kusa nang nag-sync sa cloud!"
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: tokens.colorBrandBackground2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                MR
              </div>
              <div>
                <Text weight="bold" size={300} style={{ display: 'block' }}>Ate Maria Rodriguez</Text>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Maria’s Mart • Mandaue City, Cebu</Text>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* 8. FAQ Section */}
      <section className={styles.faqContainer}>
        <div className={styles.sectionHeader}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <QuestionCircleRegular fontSize={24} color={tokens.colorBrandForeground1} />
            <Text className={styles.sectionTitle} style={{ marginBottom: 0 }}>{t.landing.faqTitle}</Text>
          </div>
          <Text className={styles.sectionSubtitle}>{t.landing.faqSubtitle}</Text>
        </div>

        <Accordion collapsible defaultOpenItems={['faq-1', 'faq-2']}>
          <AccordionItem value="faq-1">
            <AccordionHeader>{t.landing.faq1Q}</AccordionHeader>
            <AccordionPanel>
              <Text size={300} style={{ color: tokens.colorNeutralForeground2 }}>{t.landing.faq1A}</Text>
            </AccordionPanel>
          </AccordionItem>
          <AccordionItem value="faq-2">
            <AccordionHeader>{t.landing.faq2Q}</AccordionHeader>
            <AccordionPanel>
              <Text size={300} style={{ color: tokens.colorNeutralForeground2 }}>{t.landing.faq2A}</Text>
            </AccordionPanel>
          </AccordionItem>
          <AccordionItem value="faq-3">
            <AccordionHeader>{t.landing.faq3Q}</AccordionHeader>
            <AccordionPanel>
              <Text size={300} style={{ color: tokens.colorNeutralForeground2 }}>{t.landing.faq3A}</Text>
            </AccordionPanel>
          </AccordionItem>
          <AccordionItem value="faq-4">
            <AccordionHeader>{t.landing.faq4Q}</AccordionHeader>
            <AccordionPanel>
              <Text size={300} style={{ color: tokens.colorNeutralForeground2 }}>{t.landing.faq4A}</Text>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </section>

      {/* 9. Final CTA Banner */}
      <section className={styles.ctaBanner}>
        <Text size={700} weight="bold" style={{ display: 'block', marginBottom: '12px' }}>
          {t.landing.ctaTitle}
        </Text>
        <Text size={400} style={{ display: 'block', maxWidth: '640px', marginLeft: 'auto', marginRight: 'auto', marginBottom: '24px', opacity: 0.9 }}>
          {t.landing.ctaDesc}
        </Text>
        <Button
          appearance="primary"
          size="large"
          style={{ backgroundColor: tokens.colorNeutralBackground1, color: tokens.colorBrandForeground1, fontWeight: 'bold' }}
          onClick={() => {
            const el = document.getElementById('login-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          {t.landing.ctaBtn}
        </Button>
      </section>

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

export default LandingPage;
