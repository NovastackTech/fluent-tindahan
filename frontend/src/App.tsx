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
import { PrivacyConsentDialog } from './components/PrivacyConsentDialog';
import { initSyncEngine } from './sync/syncEngine';
import { seedDexieDatabaseIfNeeded } from './db/seedData';

// Route-level code splitting for performance on low-end Android devices (Section 1 & 11)
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const POSPage = lazy(() => import('./pages/POSPage').then(m => ({ default: m.POSPage })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then(m => ({ default: m.InventoryPage })));
const UtangPage = lazy(() => import('./pages/UtangPage').then(m => ({ default: m.UtangPage })));
const GCashPage = lazy(() => import('./pages/GCashPage').then(m => ({ default: m.GCashPage })));
const ImportPage = lazy(() => import('./pages/ImportPage').then(m => ({ default: m.ImportPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));

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
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  useEffect(() => {
    // 1. Initialize local Dexie database seed
    seedDexieDatabaseIfNeeded().catch(console.error);

    // 2. Initialize offline sync engine and storage persistence
    initSyncEngine();
  }, []);

  return (
    <FluentProvider theme={isDarkMode ? sariSariDarkTheme : sariSariLightTheme}>
      <div className={styles.appContainer}>
        <Header />
        <OfflineSyncBanner />

        <main className={styles.content}>
          <Suspense fallback={
            <div className={styles.loadingContainer}>
              <Spinner label="Naglo-load..." size="medium" />
            </div>
          }>
            {activeTab === 'dashboard' && <DashboardPage onNavigate={setActiveTab} />}
            {activeTab === 'pos' && <POSPage />}
            {activeTab === 'inventory' && <InventoryPage onNavigate={setActiveTab} />}
            {activeTab === 'utang' && <UtangPage />}
            {activeTab === 'gcash' && <GCashPage />}
            {activeTab === 'import' && <ImportPage />}
            {activeTab === 'settings' && <SettingsPage />}
          </Suspense>
        </main>

        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
        <PrivacyConsentDialog />
      </div>
    </FluentProvider>
  );
};

export default App;
