import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { SettingsPage } from './SettingsPage';
import { sariSariLightTheme } from '../theme/theme';
import { useAuthStore } from '../state/authStore';
import { useLanguageStore } from '../state/languageStore';
import { useThemeStore } from '../state/themeStore';
import { useSyncStore } from '../sync/syncEngine';
import { usePwaStore } from '../state/pwaStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { useDisclaimerStore } from '../state/disclaimerStore';
import { useTermsStore } from '../state/termsStore';
import { db } from '../db/db';
import { DEFAULT_GCASH_FEE_TIERS, GCASH_FEE_STORAGE_KEY, useGCashFeeStore } from '../state/gcashFeeStore';

describe('SettingsPage', () => {
  beforeEach(async () => {
    useGCashFeeStore.setState({ feesByTenant: {} });
    useAuthStore.setState({
      tenantId: 'settings-test-tenant',
      businessName: "Aling Nena's Tindahan & GCash",
      role: 'Owner'
    });
    useSyncStore.setState({
      isOnline: true,
      isSyncing: false,
      lastSyncedAt: null,
      pendingCount: 0,
      deadLetterCount: 0,
      lastErrorMessage: null
    });
    useSubscriptionStore.setState({
      tier: 'Libre',
      subscriptionEndDate: null,
      daysRemaining: null,
      isUpgradeModalOpen: false
    });
    useLanguageStore.setState({ language: 'tl' });
    useThemeStore.setState({ themeMode: 'light', isDarkMode: false });
    useDisclaimerStore.setState({ isDisclaimerOpen: false });
    usePwaStore.setState({ isInstallable: false, isStandalone: false, isInstalled: false, isIos: false });
    await db.products.clear();
    await db.customers.clear();
    await db.sales.clear();
    await db.saleItems.clear();
    await db.utangLedger.clear();
    await db.gcashTxns.clear();
    await db.gcashTxnResolutions.clear();
    await db.tenants.clear();
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
    await db.products.bulkAdd([
      {
        id: 'active-product',
        tenantId: 'settings-test-tenant',
        name: 'Active Product',
        price: 10,
        cost: 8,
        stockQty: 1,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'other-product',
        tenantId: 'other-tenant',
        name: 'Other Product',
        price: 10,
        cost: 8,
        stockQty: 1,
        updatedAt: new Date().toISOString()
      }
    ]);

    renderSettings();

    const resetBtn = screen.getByRole('button', { name: /I-reset.*(Seeder|Sample)/i });
    expect(resetBtn).toBeInTheDocument();
    fireEvent.click(resetBtn);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(async () => {
      expect(await db.products.where('tenantId').equals('settings-test-tenant').count()).toBe(50);
    });
    expect(await db.products.get('other-product')).toBeDefined();
    expect(await db.products.get('active-product')).toBeUndefined();
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

  it('displays saved last sync time from persisted storage even when all data is synced', async () => {
    const lastSyncedAt = new Date('2026-10-14T07:39:00.000Z');
    useSyncStore.getState().setLastSyncedAt(lastSyncedAt);
    useSyncStore.setState({ pendingCount: 0, deadLetterCount: 0 });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText(/Lahat ay naka-sync sa cloud|All data synced/i)).toBeInTheDocument();
      expect(screen.getByText(/Last sync:/i)).not.toHaveTextContent('Never');
      expect(screen.getByText(/Last sync:/i)).toHaveTextContent(lastSyncedAt.toLocaleString());
    });
  });

  it('resets in-memory sync time and shows Never when onboarding a new tenant', async () => {
    const previousSyncTime = new Date('2026-10-14T07:39:00.000Z');
    useSyncStore.getState().setLastSyncedAt(previousSyncTime);
    expect(useSyncStore.getState().lastSyncedAt).toEqual(previousSyncTime);

    act(() => {
      useAuthStore.getState().completeOnboarding({
        businessName: 'Bagong Tindahan',
        tenantId: 'new-onboarded-tenant-uuid'
      });
    });

    expect(useSyncStore.getState().lastSyncedAt).toBeNull();

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText(/Last sync:/i)).toHaveTextContent('Never');
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

  it('saves tenant-specific fixed GCash fees from the bracket table', () => {
    renderSettings();

    const firstBracketFee = screen.getByRole('spinbutton', { name: /₱1-₱500/i });
    fireEvent.change(firstBracketFee, { target: { value: '' } });
    expect(firstBracketFee).toHaveProperty('value', '');

    fireEvent.change(firstBracketFee, { target: { value: '7' } });

    const tenantId = useAuthStore.getState().tenantId;
    expect(useGCashFeeStore.getState().feesByTenant[tenantId]).toEqual([7, ...DEFAULT_GCASH_FEE_TIERS.slice(1)]);
    expect(JSON.parse(localStorage.getItem(GCASH_FEE_STORAGE_KEY) || '{}')[tenantId][0]).toBe(7);
  });

  it('hides GCash fee settings from Staff', () => {
    useAuthStore.setState({ role: 'Staff' });

    renderSettings();

    expect(screen.queryByRole('spinbutton', { name: /₱1-₱500/i })).not.toBeInTheDocument();
    expect(screen.getByText("Aling Nena's Tindahan & GCash")).toBeInTheDocument();
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

  it('triggers openOnboarding in edit mode when clicking edit profile button', () => {
    useAuthStore.setState({
      businessName: 'My Tindahan',
      ownerName: 'Maria Santos',
      userPhone: '09171112233'
    });

    renderSettings();

    expect(screen.getByText('My Tindahan')).toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('09171112233')).toBeInTheDocument();

    const editBtn = screen.getByRole('button', { name: /I-edit ang Profile|Edit Store Profile/i });
    expect(editBtn).toBeInTheDocument();

    fireEvent.click(editBtn);

    expect(useAuthStore.getState().isOnboardingOpen).toBe(true);
    expect(useAuthStore.getState().onboardingMode).toBe('edit');
  });

  it('renders legal & compliance section with disclaimer, privacy notice, and terms triggers', () => {
    useAuthStore.setState({ consentAccepted: true });
    renderSettings();

    const disclaimerBtn = screen.getByTestId('settings-open-disclaimer-btn');
    expect(disclaimerBtn).toBeInTheDocument();

    fireEvent.click(disclaimerBtn);
    expect(useDisclaimerStore.getState().isDisclaimerOpen).toBe(true);

    const privacyBtn = screen.getByTestId('settings-open-privacy-btn');
    expect(privacyBtn).toBeInTheDocument();

    fireEvent.click(privacyBtn);
    expect(useAuthStore.getState().consentAccepted).toBe(true);
    expect(useAuthStore.getState().isPrivacyNoticeOpen).toBe(true);

    const termsBtn = screen.getByTestId('settings-open-terms-btn');
    expect(termsBtn).toBeInTheDocument();

    fireEvent.click(termsBtn);
    expect(useTermsStore.getState().isTermsOpen).toBe(true);
  });
});


