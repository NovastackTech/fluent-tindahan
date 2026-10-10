import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
  FluentProvider,
  makeStyles,
  tokens,
  Spinner
} from '@fluentui/react-components';
import { sariSariLightTheme, sariSariDarkTheme } from './theme/theme';
import { useThemeStore } from './state/themeStore';
import { Header } from './components/Header';
import { Navigation, type NavTab } from './components/Navigation';
import { OfflineSyncBanner } from './components/OfflineSyncBanner';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { PwaUpdateToast } from './components/PwaUpdateToast';
import { PrivacyConsentDialog } from './components/PrivacyConsentDialog';
import { initSyncEngine } from './sync/syncEngine';
import { seedDexieDatabaseIfNeeded } from './db/seedData';
import { useCartStore } from './state/cartStore';
import { usePwaStore, initPwaListeners } from './state/pwaStore';
import { initServiceWorker, triggerDeferredReloadSubscription } from './pwa/registerServiceWorker';
import { initPwaTabCoordinator } from './pwa/pwaTabCoordinator';

export const PRELOAD_ERROR_STORAGE_KEY = 'fluent_tindahan_last_preload_reload';
export const PRELOAD_RELOAD_COOLDOWN_MS = 15000;

// Route-level code splitting for performance on low-end Android devices (Section 1 & 11)
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const POSPage = lazy(() => import('./pages/POSPage').then(m => ({ default: m.POSPage })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then(m => ({ default: m.InventoryPage })));
const UtangPage = lazy(() => import('./pages/UtangPage').then(m => ({ default: m.UtangPage })));
const GCashPage = lazy(() => import('./pages/GCashPage').then(m => ({ default: m.GCashPage })));
const ImportPage = lazy(() => import('./pages/ImportPage').then(m => ({ default: m.ImportPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));

export function getInitialNavTab(): NavTab {
  if (typeof window === 'undefined') return 'dashboard';
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab') as NavTab | null;
  const validTabs: NavTab[] = ['dashboard', 'pos', 'inventory', 'utang', 'gcash', 'import', 'settings'];
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
  const [activeTab, setActiveTab] = useState<NavTab>(getInitialNavTab);

  const handleTabChange = (newTab: NavTab) => {
    setActiveTab(newTab);
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', newTab);
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  };

  useEffect(() => {
    // Graceful recovery if Vite dynamic import chunk fails due to cache update
    const handlePreloadError = (event: Event) => {
      event.preventDefault();
      console.warn('[PWA] Vite dynamic chunk preload error detected.');

      // 1. One-shot / cooldown guard to prevent infinite reload loops
      const lastReload = typeof window !== 'undefined' && window.sessionStorage
        ? Number(window.sessionStorage.getItem(PRELOAD_ERROR_STORAGE_KEY) || '0')
        : 0;
      const now = Date.now();
      if (now - lastReload < PRELOAD_RELOAD_COOLDOWN_MS) {
        console.error('[PWA] Chunk preload failed but reload was already attempted recently; avoiding reload loop.');
        return;
      }

      // 2. Skip/defer reload if cart currently has items or sale in progress
      const hasCart = useCartStore.getState().items.length > 0;
      const pwaState = usePwaStore.getState();
      if (hasCart || pwaState.isSaleInProgress || pwaState.hasActiveReceipt) {
        console.warn('[PWA] Chunk preload error during active cart or sale; deferring reload until transaction completes.');
        triggerDeferredReloadSubscription();
        return;
      }

      // 3. Record reload timestamp in sessionStorage and trigger reload
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(PRELOAD_ERROR_STORAGE_KEY, String(now));
      }
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    };
    window.addEventListener('vite:preloadError', handlePreloadError);

    // 1. Initialize local Dexie database seed
    seedDexieDatabaseIfNeeded().catch(console.error);

    // 2. Initialize offline sync engine and storage persistence
    initSyncEngine();

    // 3. Initialize PWA event listeners, multi-tab coordination, and Service Worker
    const cleanupPwa = initPwaListeners();
    const cleanupTabCoord = initPwaTabCoordinator();
    initServiceWorker().catch(console.error);

    return () => {
      window.removeEventListener('vite:preloadError', handlePreloadError);
      cleanupPwa();
      cleanupTabCoord();
    };
  }, []);

  return (
    <FluentProvider theme={isDarkMode ? sariSariDarkTheme : sariSariLightTheme}>
      <div className={styles.appContainer}>
        <Header />
        <PwaUpdateToast />
        <PwaInstallBanner />
        <OfflineSyncBanner />

        <main className={styles.content}>
          <Suspense fallback={
            <div className={styles.loadingContainer}>
              <Spinner label="Naglo-load..." size="medium" />
            </div>
          }>
            {activeTab === 'dashboard' && <DashboardPage onNavigate={handleTabChange} />}
            {activeTab === 'pos' && <POSPage />}
            {activeTab === 'inventory' && <InventoryPage onNavigate={handleTabChange} />}
            {activeTab === 'utang' && <UtangPage />}
            {activeTab === 'gcash' && <GCashPage />}
            {activeTab === 'import' && <ImportPage />}
            {activeTab === 'settings' && <SettingsPage />}
          </Suspense>
        </main>

        <Navigation activeTab={activeTab} onTabChange={handleTabChange} />
        <PrivacyConsentDialog />
      </div>
    </FluentProvider>
  );
};

export default App;
