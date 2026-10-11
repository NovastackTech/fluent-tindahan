import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { SettingsPage } from './SettingsPage';
import { sariSariLightTheme } from '../theme/theme';
import { useAuthStore } from '../state/authStore';
import { useLanguageStore } from '../state/languageStore';
import { useThemeStore } from '../state/themeStore';
import { useSyncStore } from '../sync/syncEngine';
import { usePwaStore } from '../state/pwaStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { db } from '../db/db';

describe('SettingsPage', () => {
  beforeEach(async () => {
    useAuthStore.setState({
      businessName: "Aling Nena's Tindahan & GCash",
      role: 'Owner'
    });
    useSubscriptionStore.setState({
      tier: 'Libre',
      subscriptionEndDate: null,
      daysRemaining: null,
      isUpgradeModalOpen: false
    });
    useLanguageStore.setState({ language: 'tl' });
    useThemeStore.setState({ themeMode: 'light', isDarkMode: false });
    usePwaStore.setState({ isInstallable: false, isStandalone: false, isInstalled: false, isIos: false });
    await db.syncQueue.clear();
    await db.deadLetterQueue.clear();
  });

  const renderSettings = () => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <SettingsPage />
      </FluentProvider>
    );
  };

  it('renders store details and business name', () => {
    renderSettings();

    expect(screen.getByText(/Aling Nena's Tindahan & GCash/)).toBeInTheDocument();
  });

  it('allows switching language between Tagalog and English', () => {
    renderSettings();

    const enBtn = screen.getByRole('button', { name: /English/i });
    fireEvent.click(enBtn);

    expect(useLanguageStore.getState().language).toBe('en');

    const tlBtn = screen.getByRole('button', { name: /Taglish|Filipino/i });
    fireEvent.click(tlBtn);

    expect(useLanguageStore.getState().language).toBe('tl');
  });

  it('allows switching interface theme between light, dark, and system', () => {
    renderSettings();

    const darkBtn = screen.getByRole('button', { name: /Madilim|Dark/i });
    fireEvent.click(darkBtn);
    expect(useThemeStore.getState().themeMode).toBe('dark');
    expect(useThemeStore.getState().isDarkMode).toBe(true);

    const systemBtn = screen.getByRole('button', { name: /Sistema|System/i });
    fireEvent.click(systemBtn);
    expect(useThemeStore.getState().themeMode).toBe('system');

    const lightBtn = screen.getByRole('button', { name: /Maliwanag|Light/i });
    fireEvent.click(lightBtn);
    expect(useThemeStore.getState().themeMode).toBe('light');
    expect(useThemeStore.getState().isDarkMode).toBe(false);
  });

  it('renders offline-first and storage diagnostics', () => {
    renderSettings();

    expect(screen.getByText(/IndexedDB Storage/i)).toBeInTheDocument();
    expect(screen.getByText(/Cloud Synchronization/i)).toBeInTheDocument();
  });

  it('triggers force sync when force sync button is clicked', async () => {
    useSyncStore.setState({ isOnline: true, isSyncing: false });
    renderSettings();

    const syncBtn = screen.getByRole('button', { name: /Puwersahing Mag-Sync|Force Sync/i });
    expect(syncBtn).toBeInTheDocument();
    expect(syncBtn).not.toBeDisabled();
    fireEvent.click(syncBtn);
  });

  it('triggers reset seed data when confirmed by user', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderSettings();

    const resetBtn = screen.getByRole('button', { name: /I-reset.*(Seeder|Sample)/i });
    expect(resetBtn).toBeInTheDocument();
    fireEvent.click(resetBtn);

    expect(window.confirm).toHaveBeenCalled();
  });

  it('renders pending queue items and dead letter queue items', async () => {
    await db.syncQueue.add({
      id: 'sq-1',
      entity: 'Product',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: { id: 'p-test', name: 'Test Prod' },
      status: 'Pending',
      retryCount: 0
    });

    await db.deadLetterQueue.add({
      id: 'dlq-1',
      entity: 'Sale',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: { id: 's-test' },
      retryCount: 5,
      errorMessage: 'Network timeout 500',
      failedAt: new Date().toISOString()
    });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText(/Network timeout 500/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Insert/i).length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it('matches the header queue count and never claims all synced while work is pending', async () => {
    const lastSyncedAt = new Date('2026-10-12T01:30:00.000Z');
    await db.syncQueue.bulkAdd(Array.from({ length: 8 }, (_, index) => ({
      id: `sq-pending-${index}`,
      entity: 'Product' as const,
      action: 'Insert' as const,
      timestamp: new Date().toISOString(),
      payload: { id: `product-${index}` },
      status: 'Pending' as const,
      retryCount: 0
    })));
    useSyncStore.setState({ pendingCount: 8, lastSyncedAt, deadLetterCount: 0 });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByTestId('sync-pending-count')).toHaveTextContent('8');
      expect(screen.queryByText(/Lahat ay naka-sync sa cloud|All data synced/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Last sync:/i)).not.toHaveTextContent('Never');
    });
  });

  it('allows configuring printer paper width and running test print', () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    renderSettings();

    expect(screen.getByText(/Resibo at Printer|Receipt & Printer/i)).toBeInTheDocument();

    const btn80 = screen.getByRole('button', { name: /80mm/i });
    fireEvent.click(btn80);
    expect(localStorage.getItem('fluent_tindahan_paper_width')).toBe('80mm');

    const btn58 = screen.getByRole('button', { name: /58mm/i });
    fireEvent.click(btn58);
    expect(localStorage.getItem('fluent_tindahan_paper_width')).toBe('58mm');

    const testPrintBtn = screen.getByRole('button', { name: /Subukang Mag-Print|Test Receipt/i });
    fireEvent.click(testPrintBtn);
    expect(window.alert).toHaveBeenCalled();

    printSpy.mockRestore();
  });

  it('renders PWA section and allows installing app when installable', () => {
    const promptInstallSpy = vi.fn().mockResolvedValue(true);
    usePwaStore.setState({
      isInstallable: true,
      isStandalone: false,
      promptInstall: promptInstallSpy
    });

    renderSettings();

    expect(screen.getByText(/PWA \(Progressive Web App\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Tumatakbo sa Web Browser|Running in Web Browser/i)).toBeInTheDocument();

    const installBtn = screen.getByRole('button', { name: /I-install ang App|Install App/i });
    expect(installBtn).toBeInTheDocument();

    fireEvent.click(installBtn);
    expect(promptInstallSpy).toHaveBeenCalledTimes(1);
  });

  it('shows standalone installed badge when app is running as installed PWA', () => {
    usePwaStore.setState({
      isInstallable: false,
      isStandalone: true
    });

    renderSettings();

    expect(screen.getByText(/Naka-install bilang Standalone App|Installed as Standalone PWA/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /I-install ang App|Install App/i })).not.toBeInTheDocument();
  });

  it('renders SaaS subscription card and opens upgrade modal on click', () => {
    renderSettings();

    expect(screen.getByText(/Plano at Subscription|Subscription & Plans/i)).toBeInTheDocument();
    expect(screen.getByText('LIBRE')).toBeInTheDocument();

    const upgradeBtn = screen.getByRole('button', { name: /Mag-upgrade Ngayon|Upgrade Now/i });
    expect(upgradeBtn).toBeInTheDocument();

    fireEvent.click(upgradeBtn);
    expect(useSubscriptionStore.getState().isUpgradeModalOpen).toBe(true);
  });
});


