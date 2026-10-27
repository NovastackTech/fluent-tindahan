import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import {
  FluentProvider,
  makeStyles,
  tokens,
  Spinner,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  MessageBarActions,
  Button
} from '@fluentui/react-components';
import { DismissRegular } from '@fluentui/react-icons';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { sariSariLightTheme, sariSariDarkTheme } from './theme/theme';
import { useThemeStore } from './state/themeStore';
import { useLanguageStore } from './state/languageStore';
import { Header } from './components/Header';
import { Navigation, type NavTab } from './components/Navigation';
import { OfflineSyncBanner } from './components/OfflineSyncBanner';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { PwaUpdateToast } from './components/PwaUpdateToast';
import { PrivacyConsentDialog } from './components/PrivacyConsentDialog';
import { OnboardingModal } from './components/OnboardingModal';
import { SessionLockModal } from './components/SessionLockModal';
import { DisclaimerModal } from './components/DisclaimerModal';
import { TermsModal } from './components/TermsModal';
import { initSyncEngine, restoreTenantDataFromServer } from './sync/syncEngine';
import { usePwaStore, initPwaListeners } from './state/pwaStore';
import { initServiceWorker } from './pwa/registerServiceWorker';
import { initPwaTabCoordinator } from './pwa/pwaTabCoordinator';
import {
  clearPendingBillingReference,
  getPendingBillingReference,
  scheduleExpiry,
  useSubscriptionStore
} from './state/subscriptionStore';
import { useAuthStore } from './state/authStore';
import { db } from './db/db';
import { DEFAULT_TENANT_ID } from './db/seedData';
import { useTranslation } from './state/languageStore';

const STORAGE_KEY_ONBOARDING_STARTED = 'fluent_tindahan_onboarding_started_v1';

// Route-level code splitting for performance on low-end Android devices (Section 1 & 11)
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const POSPage = lazy(() => import('./pages/POSPage').then(m => ({ default: m.POSPage })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then(m => ({ default: m.InventoryPage })));
const UtangPage = lazy(() => import('./pages/UtangPage').then(m => ({ default: m.UtangPage })));
const GCashPage = lazy(() => import('./pages/GCashPage').then(m => ({ default: m.GCashPage })));
const ImportPage = lazy(() => import('./pages/ImportPage').then(m => ({ default: m.ImportPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));

const VALID_NAV_TABS: NavTab[] = ['dashboard', 'pos', 'inventory', 'utang', 'gcash', 'import', 'settings', 'landing', 'login'];

function getInitialNavTab(): NavTab {
  if (typeof window === 'undefined') return 'dashboard';
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab')?.toLowerCase();
  const intentParam = params.get('intent')?.toLowerCase();

  const isAuth = useAuthStore.getState().isOnboarded && !useAuthStore.getState().reauthRequested;
  if (isAuth && (tabParam === 'signup' || tabParam === 'register' || tabParam === 'login')) {
    return 'dashboard';
  }

  if (tabParam === 'signup' || tabParam === 'register') {
    return 'login';
  }
  if (tabParam === 'delete-account' || intentParam === 'delete-account') {
    return 'settings';
  }
  if (tabParam && VALID_NAV_TABS.includes(tabParam as NavTab)) {
    return tabParam as NavTab;
  }
  const path = window.location.pathname.replace(/^\//, '').toLowerCase();
  if (isAuth && (path === 'signup' || path === 'register' || path === 'login')) {
    return 'dashboard';
  }
  if (path === 'signup' || path === 'register') {
    return 'login';
  }
  if (path === 'delete-account') {
    return 'settings';
  }
  if (VALID_NAV_TABS.includes(path as NavTab)) {
    return path as NavTab;
  }
  return 'dashboard';
}

const useStyles = makeStyles({
  appContainer: {
    minHeight: '100vh',
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
    fontFamily: 'Segoe UI, Inter, -apple-system, BlinkMacSystemFont, Roboto, sans-serif'
  },
  content: {
    minHeight: 'calc(100vh - 54px)'
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '50vh'
  }
});

export const App: React.FC = () => {
  const styles = useStyles();
  const { t } = useTranslation();
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const language = useLanguageStore((s) => s.language);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);
  const isOnboardingStatusReady = useAuthStore((s) => s.isOnboardingStatusReady);
  const isOnboardingOpen = useAuthStore((s) => s.isOnboardingOpen);
  const reauthRequested = useAuthStore((s) => s.reauthRequested);
  const [activeTab, setActiveTab] = useState<NavTab>(getInitialNavTab);
  const [billingNotice, setBillingNotice] = useState<'success' | 'cancel' | null>(null);
  const storeServicesStarted = useRef(false);

  const visibleTab: NavTab = reauthRequested ? 'login' : activeTab;

  const handleTabChange = (newTab: NavTab, options?: { replace?: boolean }) => {
    if (useAuthStore.getState().reauthRequested) {
      useAuthStore.getState().clearReauthRequest();
    }
    setActiveTab(newTab);
    if (typeof window !== 'undefined' && window.history) {
      const url = new URL(window.location.href);
      if (newTab === 'login' && (url.searchParams.get('tab') === 'delete-account' || url.pathname.replace(/^\//, '').toLowerCase() === 'delete-account')) {
        url.searchParams.set('intent', 'delete-account');
      } else if (newTab !== 'login' && newTab !== 'settings') {
        url.searchParams.delete('intent');
      }
      const previousTab = url.searchParams.get('tab')?.toLowerCase();
      url.searchParams.set('tab', newTab);
      const newUrl = url.pathname + url.search;
      if (options?.replace || previousTab === newTab) {
        window.history.replaceState?.(null, '', newUrl);
      } else {
        window.history.pushState?.(null, '', newUrl);
      }
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const nextTab = getInitialNavTab();
      setActiveTab(nextTab);
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        const isAuth = useAuthStore.getState().isOnboarded && !useAuthStore.getState().reauthRequested;
        const url = new URL(window.location.href);
        const rawTab = url.searchParams.get('tab')?.toLowerCase();
        const path = url.pathname.replace(/^\//, '').toLowerCase();
        if (isAuth && (rawTab === 'signup' || rawTab === 'register' || rawTab === 'login' || path === 'signup' || path === 'register' || path === 'login')) {
          url.searchParams.set('tab', nextTab);
          if (path === 'signup' || path === 'register' || path === 'login') {
            url.pathname = '/';
          }
          window.history.replaceState(null, '', url.pathname + url.search);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.history?.replaceState) return;
    const isAuth = isOnboarded && !reauthRequested;
    const url = new URL(window.location.href);
    const rawTab = url.searchParams.get('tab')?.toLowerCase();
    const path = url.pathname.replace(/^\//, '').toLowerCase();

    if (isAuth && (rawTab === 'signup' || rawTab === 'register' || rawTab === 'login' || path === 'signup' || path === 'register' || path === 'login')) {
      url.searchParams.set('tab', activeTab === 'login' ? 'dashboard' : activeTab);
      if (path === 'signup' || path === 'register' || path === 'login') {
        url.pathname = '/';
      }
      window.history.replaceState(null, '', url.pathname + url.search);
      return;
    }

    if (rawTab && !VALID_NAV_TABS.includes(rawTab as NavTab) && rawTab !== 'signup' && rawTab !== 'register' && rawTab !== 'delete-account') {
      url.searchParams.set('tab', activeTab);
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  }, [activeTab, isOnboarded, reauthRequested]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    const billingParam = searchParams.get('billing')?.toLowerCase();
    if (billingParam === 'cancel') {
      try {
        clearPendingBillingReference();
      } catch {
        // Ignore
      }
      // oxlint-disable-next-line react/set-state-in-effect - Initialize billing cancellation notification from URL params
      setBillingNotice('cancel');
      if (window.history && window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete('billing');
        url.searchParams.delete('mock_paid');
        url.searchParams.delete('ref');
        url.searchParams.delete('tier');
        window.history.replaceState(null, '', url.pathname + url.search);
      }
    }
  }, []);

  useEffect(() => {
    if (!isOnboardingStatusReady) return;
    if (!isOnboarded && activeTab !== 'landing' && activeTab !== 'login') {
      // oxlint-disable-next-line react/set-state-in-effect - Route unauthenticated non-landing users to login when onboarding state is confirmed
      handleTabChange('login', { replace: true });
    }
  }, [isOnboarded, isOnboardingStatusReady, activeTab]);

  useEffect(() => {
    // Graceful recovery if Vite dynamic import chunk fails due to cache update
    const handlePreloadError = (event: Event) => {
      event.preventDefault();
      console.warn('[PWA] Vite dynamic chunk preload error detected.');
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }
      usePwaStore.getState().setNeedRefresh(true);
    };
    window.addEventListener('vite:preloadError', handlePreloadError);

    // Resolve legacy stores before showing onboarding; fresh stores stay empty until setup completes.
    const initializeLocalStore = async () => {
      const auth = useAuthStore.getState();
      const onboardingWasStarted = localStorage.getItem(STORAGE_KEY_ONBOARDING_STARTED) === 'true';
      let hasExistingStore = auth.isOnboarded || (auth.consentAccepted && !onboardingWasStarted);

      if (!hasExistingStore || auth.tenantId === DEFAULT_TENANT_ID) {
        try {
          const tenantId = auth.tenantId;
          const [productCount, salesCount, saleItemCount, customerCount, ledgerCount, gcashCount, resolutionCount, tenant, persistedTenants] = await Promise.all([
            db.products.where('tenantId').equals(tenantId).count(),
            db.sales.where('tenantId').equals(tenantId).count(),
            db.saleItems.where('tenantId').equals(tenantId).count(),
            db.customers.where('tenantId').equals(tenantId).count(),
            db.utangLedger.where('tenantId').equals(tenantId).count(),
            db.gcashTxns.where('tenantId').equals(tenantId).count(),
            db.gcashTxnResolutions.where('tenantId').equals(tenantId).count(),
            db.tenants.get(tenantId),
            db.tenants.toArray()
          ]);

          const otherTenants = persistedTenants.filter((candidate) => candidate.id !== DEFAULT_TENANT_ID);

          if (tenantId === DEFAULT_TENANT_ID && otherTenants.length > 0) {
            // Sort descending by updatedAt to recover the most recently active tenant
            const sortedTenants = [...otherTenants].sort((a, b) => {
              const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
              const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
              return timeB - timeA;
            });
            const recoveredTenant = sortedTenants[0];
            if (recoveredTenant) {
              hasExistingStore = true;
              const currentAuth = useAuthStore.getState();
              currentAuth.setTenantId(recoveredTenant.id);
              currentAuth.setSubscription(recoveredTenant.tier || 'Libre', recoveredTenant.subscriptionEndDate);
              if (recoveredTenant.businessName) {
                currentAuth.setBusinessName(recoveredTenant.businessName);
              }
            }
          } else {
            hasExistingStore = productCount > 0
              || salesCount > 0
              || saleItemCount > 0
              || customerCount > 0
              || ledgerCount > 0
              || gcashCount > 0
              || resolutionCount > 0
              || Boolean(tenant && tenant.id !== DEFAULT_TENANT_ID)
              || (auth.consentAccepted && !onboardingWasStarted);
          }

          // Invariant: never mark onboarded while still on DEFAULT_TENANT_ID if other tenants exist.
          if (useAuthStore.getState().tenantId === DEFAULT_TENANT_ID && otherTenants.length > 0) {
            hasExistingStore = false;
          }
        } catch (error) {
          console.error('[Onboarding] Could not inspect existing local store data:', error);
        }
      }

      if (!hasExistingStore) {
        localStorage.setItem(STORAGE_KEY_ONBOARDING_STARTED, 'true');
      }
      useAuthStore.getState().resolveOnboardingStatus(hasExistingStore);
    };
    initializeLocalStore().catch(console.error);

    // Initialize PWA event listeners, multi-tab coordination, and Service Worker
    const cleanupPwa = initPwaListeners();
    const cleanupTabCoord = initPwaTabCoordinator();
    initServiceWorker().catch(console.error);

    return () => {
      window.removeEventListener('vite:preloadError', handlePreloadError);
      cleanupPwa();
      cleanupTabCoord();
    };
  }, []);

  useEffect(() => {
    if (!isOnboarded) {
      storeServicesStarted.current = false;
      return;
    }
    if (!isOnboardingStatusReady || storeServicesStarted.current) return;
    storeServicesStarted.current = true;

    initSyncEngine();

    const checkAndPullCatalog = async () => {
      const activeTenantId = useAuthStore.getState().tenantId;
      if (activeTenantId) {
        const [prodCount, custCount, utangCount, gcashCount] = await Promise.all([
          db.products.where('tenantId').equals(activeTenantId).count(),
          db.customers.where('tenantId').equals(activeTenantId).count(),
          db.utangLedger.where('tenantId').equals(activeTenantId).count(),
          db.gcashTxns.where('tenantId').equals(activeTenantId).count()
        ]);
        if (prodCount === 0 && custCount === 0 && utangCount === 0 && gcashCount === 0) {
          await restoreTenantDataFromServer();
        }
      }
    };
    checkAndPullCatalog().catch(console.error);

    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const isBillingSuccess = searchParams?.get('billing') === 'success';
    let confirmInFlight: Promise<boolean> | undefined;
    let focusTimer: number | undefined;
    const confirmOnce = () => {
      if (!confirmInFlight) {
        confirmInFlight = useSubscriptionStore.getState().confirmCheckoutSession()
          .finally(() => { confirmInFlight = undefined; });
      }
      return confirmInFlight;
    };

    const handleBillingReturn = async () => {
      const hasStoredCheckoutSession = !!getPendingBillingReference();
      let confirmed = false;

      if (isBillingSuccess || hasStoredCheckoutSession) {
        confirmed = await confirmOnce();
        if (!confirmed && isBillingSuccess) {
          for (let attempt = 0; attempt < 2 && !confirmed; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            confirmed = await confirmOnce();
          }
        }
      }

      await useSubscriptionStore.getState().refreshSubscription();

      if (isBillingSuccess && confirmed) {
        setBillingNotice('success');
        if (window.history && window.history.replaceState) {
          const url = new URL(window.location.href);
          url.searchParams.delete('billing');
          url.searchParams.delete('mock_paid');
          url.searchParams.delete('ref');
          url.searchParams.delete('tier');
          window.history.replaceState(null, '', url.pathname + url.search);
        }
      }
    };

    handleBillingReturn().catch(console.error);

    const handleVisibilityRefresh = () => {
      if (document.visibilityState !== 'visible') return;
      scheduleExpiry(useAuthStore.getState().subscriptionEndDate);
      if (getPendingBillingReference()) {
        window.clearTimeout(focusTimer);
        focusTimer = window.setTimeout(() => {
          if (!getPendingBillingReference()) return;
          void confirmOnce().then(() => useSubscriptionStore.getState().refreshSubscription());
        }, 250);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityRefresh);
    window.addEventListener('focus', handleVisibilityRefresh);
    window.addEventListener('online', handleVisibilityRefresh);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
      window.removeEventListener('focus', handleVisibilityRefresh);
      window.removeEventListener('online', handleVisibilityRefresh);
    };
  }, [isOnboarded, isOnboardingStatusReady]);

  const billingMessage = billingNotice === 'success'
    ? (language === 'tl'
        ? 'Salamat sa iyong pag-upgrade! Matagumpay ang iyong subscription sa Fluent Tindahan.'
        : 'Thank you for upgrading! Your Fluent Tindahan subscription is active.')
    : billingNotice === 'cancel'
    ? (language === 'tl'
        ? 'Kanselado ang pagsingil; walang siningil sa iyo.'
        : 'Billing cancelled; no charge was made.')
    : null;

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || 'fluent-tindahan-dev.apps.googleusercontent.com';

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <FluentProvider theme={isDarkMode ? sariSariDarkTheme : sariSariLightTheme}>
        <div className={styles.appContainer}>
        <Header onNavigate={handleTabChange} activeTab={visibleTab} />
        <PwaUpdateToast />
        <PwaInstallBanner />
        <OfflineSyncBanner />
        {billingNotice === 'success' && (
          <div style={{ padding: '0 16px 8px 16px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            <MessageBar intent="success" layout="multiline">
              <MessageBarBody>
                <MessageBarTitle>{billingMessage}</MessageBarTitle>
              </MessageBarBody>
              <MessageBarActions
                containerAction={
                  <Button
                    appearance="subtle"
                    aria-label="Dismiss"
                    icon={<DismissRegular />}
                    onClick={() => setBillingNotice(null)}
                  />
                }
              />
            </MessageBar>
          </div>
        )}

        {billingNotice === 'cancel' && (
          <div style={{ padding: '0 16px 8px 16px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            <MessageBar intent="info" layout="multiline">
              <MessageBarBody>
                <MessageBarTitle>{billingMessage}</MessageBarTitle>
              </MessageBarBody>
              <MessageBarActions
                containerAction={
                  <Button
                    appearance="subtle"
                    aria-label="Dismiss"
                    icon={<DismissRegular />}
                    onClick={() => setBillingNotice(null)}
                  />
                }
              />
            </MessageBar>
          </div>
        )}

        <main className={styles.content}>
          <Suspense fallback={
            <div className={styles.loadingContainer}>
              <Spinner label={t.common.loading} size="medium" />
            </div>
          }>
            {visibleTab === 'dashboard' && <DashboardPage onNavigate={handleTabChange} />}
            {visibleTab === 'pos' && <POSPage onNavigate={handleTabChange} />}
            {visibleTab === 'inventory' && <InventoryPage onNavigate={handleTabChange} />}
            {visibleTab === 'utang' && <UtangPage />}
            {visibleTab === 'gcash' && <GCashPage />}
            {visibleTab === 'import' && <ImportPage />}
            {visibleTab === 'settings' && <SettingsPage onNavigate={handleTabChange} />}
            {visibleTab === 'landing' && <LandingPage onNavigate={handleTabChange} />}
            {visibleTab === 'login' && <LoginPage onNavigate={handleTabChange} />}
          </Suspense>
        </main>

        {visibleTab !== 'landing' && visibleTab !== 'login' && <Navigation activeTab={visibleTab} onTabChange={handleTabChange} />}
        <PrivacyConsentDialog />
        {isOnboardingOpen && <OnboardingModal />}
        <SessionLockModal />
        <DisclaimerModal />
        <TermsModal />
      </div>
    </FluentProvider>
  </GoogleOAuthProvider>
  );
};

export default App;
