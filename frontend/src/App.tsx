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
import { sariSariLightTheme, sariSariDarkTheme } from './theme/theme';
import { useThemeStore } from './state/themeStore';
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
import { initSyncEngine } from './sync/syncEngine';
import { usePwaStore, initPwaListeners } from './state/pwaStore';
import { initServiceWorker } from './pwa/registerServiceWorker';
import { initPwaTabCoordinator } from './pwa/pwaTabCoordinator';
import { useSubscriptionStore } from './state/subscriptionStore';
import { useAuthStore } from './state/authStore';
import { db } from './db/db';
import { DEFAULT_TENANT_ID } from './db/seedData';

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

export function getInitialNavTab(): NavTab {
  if (typeof window === 'undefined') return 'dashboard';
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab') as NavTab | null;
  const validTabs: NavTab[] = ['dashboard', 'pos', 'inventory', 'utang', 'gcash', 'import', 'settings', 'landing', 'login'];
  if (tabParam && validTabs.includes(tabParam)) {
    return tabParam;
  }
  const path = window.location.pathname.replace(/^\//, '').toLowerCase() as NavTab;
  if (validTabs.includes(path)) {
    return path;
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
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);
  const isOnboardingStatusReady = useAuthStore((s) => s.isOnboardingStatusReady);
  const isOnboardingOpen = useAuthStore((s) => s.isOnboardingOpen);
  const [activeTab, setActiveTab] = useState<NavTab>(getInitialNavTab);
  const [billingSuccessMessage, setBillingSuccessMessage] = useState<string | null>(null);
  const storeServicesStarted = useRef(false);

  const handleTabChange = (newTab: NavTab) => {
    setActiveTab(newTab);
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', newTab);
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  };

  useEffect(() => {
    if (!isOnboardingStatusReady) return;
    if (!isOnboarded && activeTab !== 'landing' && activeTab !== 'login') {
      handleTabChange('login');
    }
  }, [isOnboarded, isOnboardingStatusReady, activeTab]);

  useEffect(() => {
    // Graceful recovery if Vite dynamic import chunk fails due to cache update
    const handlePreloadError = (event: Event) => {
      event.preventDefault();
      console.warn('[PWA] Vite dynamic chunk preload error detected.');
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
    if (!isOnboardingStatusReady || !isOnboarded || storeServicesStarted.current) return;
    storeServicesStarted.current = true;

    initSyncEngine();

    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const isBillingSuccess = searchParams?.get('billing') === 'success';

    const handleBillingReturn = async () => {
      const hasStoredCheckoutSession = typeof window !== 'undefined' && !!localStorage.getItem('fluent_last_checkout_session_id');

      if (isBillingSuccess || hasStoredCheckoutSession) {
        await useSubscriptionStore.getState().confirmCheckoutSession();
      }

      await useSubscriptionStore.getState().refreshSubscription();

      if (isBillingSuccess) {
        setBillingSuccessMessage('Salamat sa iyong pag-upgrade! Matagumpay ang iyong subscription sa Fluent Tindahan.');
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
  }, [isOnboarded, isOnboardingStatusReady]);

  return (
    <FluentProvider theme={isDarkMode ? sariSariDarkTheme : sariSariLightTheme}>
      <div className={styles.appContainer}>
        <Header onNavigate={handleTabChange} activeTab={activeTab} />
        <PwaUpdateToast />
        <PwaInstallBanner />
        <OfflineSyncBanner />
        {billingSuccessMessage && (
          <div style={{ padding: '0 16px 8px 16px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            <MessageBar intent="success" layout="multiline">
              <MessageBarBody>
                <MessageBarTitle>{billingSuccessMessage}</MessageBarTitle>
              </MessageBarBody>
              <MessageBarActions
                containerAction={
                  <Button
                    appearance="subtle"
                    aria-label="Dismiss"
                    icon={<DismissRegular />}
                    onClick={() => setBillingSuccessMessage(null)}
                  />
                }
              />
            </MessageBar>
          </div>
        )}

        <main className={styles.content}>
          <Suspense fallback={
            <div className={styles.loadingContainer}>
              <Spinner label="Naglo-load..." size="medium" />
            </div>
          }>
            {activeTab === 'dashboard' && <DashboardPage onNavigate={handleTabChange} />}
            {activeTab === 'pos' && <POSPage onNavigate={handleTabChange} />}
            {activeTab === 'inventory' && <InventoryPage onNavigate={handleTabChange} />}
            {activeTab === 'utang' && <UtangPage />}
            {activeTab === 'gcash' && <GCashPage />}
            {activeTab === 'import' && <ImportPage />}
            {activeTab === 'settings' && <SettingsPage onNavigate={handleTabChange} />}
            {activeTab === 'landing' && <LandingPage onNavigate={handleTabChange} />}
            {activeTab === 'login' && <LoginPage onNavigate={handleTabChange} />}
          </Suspense>
        </main>

        {activeTab !== 'landing' && activeTab !== 'login' && <Navigation activeTab={activeTab} onTabChange={handleTabChange} />}
        <PrivacyConsentDialog />
        {isOnboardingOpen && <OnboardingModal />}
        <SessionLockModal />
        <DisclaimerModal />
        <TermsModal />
      </div>
    </FluentProvider>
  );
};

export default App;
