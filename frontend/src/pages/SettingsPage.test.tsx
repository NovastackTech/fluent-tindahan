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
import * as authService from '../services/authService';

vi.mock('../services/authService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/authService')>();
  return {
    ...actual,
    updatePin: vi.fn().mockImplementation(async ({ pin }) => ({
      success: true,
      hasPin: Boolean(pin && pin.trim())
    }))
  };
});

describe('SettingsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useGCashFeeStore.setState({ feesByTenant: {} });
    useAuthStore.setState({
      tenantId: 'settings-test-tenant',
      businessName: "Aling Nena's Tindahan & GCash",
      userEmail: 'nena@fluent-tindahan.ph',
      hasPin: false,
      isSessionLocked: false,
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

  const renderSettings = (onNavigate?: (tab: any) => void) => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <SettingsPage onNavigate={onNavigate} />
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

  it('allows dismissing individual DLQ items and clearing the entire DLQ', async () => {
    await db.deadLetterQueue.bulkAdd([
      {
        id: 'dlq-a',
        entity: 'Product',
        action: 'Insert',
        timestamp: new Date().toISOString(),
        payload: { id: 'p-a' },
        retryCount: 3,
        errorMessage: 'Invalid product price',
        failedAt: new Date().toISOString()
      },
      {
        id: 'dlq-b',
        entity: 'Sale',
        action: 'Insert',
        timestamp: new Date().toISOString(),
        payload: { id: 's-b' },
        retryCount: 3,
        errorMessage: 'Invalid sale amount',
        failedAt: new Date().toISOString()
      }
    ]);
    useSyncStore.setState({ deadLetterCount: 2 });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText(/Invalid product price/i)).toBeInTheDocument();
      expect(screen.getByText(/Invalid sale amount/i)).toBeInTheDocument();
    });

    // Dismiss first item
    const dismissButtons = screen.getAllByRole('button', { name: /I-dismiss|Dismiss/i });
    expect(dismissButtons.length).toBe(2);
    fireEvent.click(dismissButtons[0]);

    // Dialog opens; confirm dismissal
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dismiss-dlq-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('confirm-dismiss-dlq-btn'));

    await waitFor(async () => {
      const remaining = await db.deadLetterQueue.toArray();
      expect(remaining).toHaveLength(1);
    });

    // Clear entire DLQ
    const clearBtn = screen.getByRole('button', { name: /Linisin ang DLQ|Clear DLQ/i });
    fireEvent.click(clearBtn);

    // Dialog opens; confirm clear
    await waitFor(() => {
      expect(screen.getByTestId('confirm-clear-dlq-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('confirm-clear-dlq-btn'));

    await waitFor(async () => {
      const remaining = await db.deadLetterQueue.toArray();
      expect(remaining).toHaveLength(0);
      expect(useSyncStore.getState().deadLetterCount).toBe(0);
    });
  });

  it('renders Edit button for product DLQ items and opens fix dialog', async () => {
    await db.products.put({
      id: 'prod-dlq-edit',
      tenantId: 'settings-test-tenant',
      name: 'Corrupted Price Item',
      price: 99999999999,
      cost: 20,
      stockQty: 5,
      updatedAt: new Date().toISOString()
    });

    await db.deadLetterQueue.add({
      id: 'dlq-edit-1',
      entity: 'Product',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: {
        id: 'prod-dlq-edit',
        name: 'Corrupted Price Item',
        price: 99999999999,
        cost: 20,
        stockQty: 5
      },
      retryCount: 3,
      errorMessage: 'Price out of range',
      failedAt: new Date().toISOString()
    });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText(/Price out of range/i)).toBeInTheDocument();
    });

    const editBtn = screen.getByRole('button', { name: /Ayusin|Edit \/ Fix/i });
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);

    await waitFor(() => {
      expect(screen.getByText(/Ayusin ang Paninda \(Dead Letter Queue\)|Fix Product \(Dead Letter Queue\)/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('Corrupted Price Item')).toBeInTheDocument();
    });
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
    expect(screen.getByText(/Naipadala ang test receipt sa printer!|Test receipt sent to printer!/i)).toBeInTheDocument();

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

  it('opens confirmation dialog naming the entity when clicking dismiss on a DLQ item', async () => {
    await db.deadLetterQueue.add({
      id: 'dlq-test-sale',
      entity: 'Sale',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: {
        id: 'sale-999',
        totalAmount: 250,
        paymentMethod: 'Cash'
      },
      retryCount: 3,
      errorMessage: 'Validation failed on server',
      failedAt: new Date().toISOString()
    });
    useSyncStore.setState({ deadLetterCount: 1 });

    renderSettings();

    // The item should appear in DLQ
    await waitFor(() => {
      expect(screen.getByText(/Sale \(Insert\)/)).toBeInTheDocument();
    });

    // Click Dismiss button
    const dismissBtn = screen.getByTitle(/I-dismiss|Dismiss/i);
    fireEvent.click(dismissBtn);

    // Dialog should open naming the entity
    await waitFor(() => {
      expect(screen.getByText('Benta (Sale)')).toBeInTheDocument();
      expect(screen.getByText(/Kumpirmahin ang Pag-dismiss ng Datos/i)).toBeInTheDocument();
      expect(screen.getByText(/250.00/)).toBeInTheDocument();
    });

    // Item must still exist in Dexie because user has not confirmed
    let dlqCount = await db.deadLetterQueue.count();
    expect(dlqCount).toBe(1);

    // Clicking cancel keeps the item
    const cancelBtn = screen.getByTestId('cancel-dismiss-dlq-btn');
    fireEvent.click(cancelBtn);

    dlqCount = await db.deadLetterQueue.count();
    expect(dlqCount).toBe(1);

    // Click dismiss again and confirm
    fireEvent.click(screen.getByTitle(/I-dismiss|Dismiss/i));
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dismiss-dlq-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('confirm-dismiss-dlq-btn'));

    await waitFor(async () => {
      const remaining = await db.deadLetterQueue.count();
      expect(remaining).toBe(0);
    });
  });

  it('opens confirmation dialog when clicking Clear DLQ', async () => {
    await db.deadLetterQueue.add({
      id: 'dlq-test-gcash',
      entity: 'GCashTxn',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: { id: 'g-1', amount: 500, fee: 10 },
      retryCount: 3,
      failedAt: new Date().toISOString()
    });
    useSyncStore.setState({ deadLetterCount: 1 });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText(/GCashTxn \(Insert\)/)).toBeInTheDocument();
    });

    const clearBtn = screen.getByRole('button', { name: /Linisin ang DLQ|Clear DLQ/i });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.getByText(/Linisin ang Lahat sa Dead Letter Queue\?|Clear All Items in Dead Letter Queue\?/i)).toBeInTheDocument();
    });

    // Verify item not cleared yet
    expect(await db.deadLetterQueue.count()).toBe(1);

    // Click confirm clear
    const confirmClearBtn = screen.getByTestId('confirm-clear-dlq-btn');
    fireEvent.click(confirmClearBtn);

    await waitFor(async () => {
      expect(await db.deadLetterQueue.count()).toBe(0);
    });
  });

  it('renders user email address and PIN status badge', () => {
    useAuthStore.setState({
      userEmail: 'nena@fluent-tindahan.ph',
      hasPin: true
    });

    renderSettings();

    expect(screen.getByText('nena@fluent-tindahan.ph')).toBeInTheDocument();
    expect(screen.getByText(/Naka-set \(Aktibo\)|Active \(Set\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /I-lock ang Kaha|Lock Till Screen/i })).toBeInTheDocument();
  });

  it('locks session when Lock Till button is clicked', () => {
    useAuthStore.setState({
      userEmail: 'nena@fluent-tindahan.ph',
      hasPin: true,
      isSessionLocked: false
    });

    renderSettings();

    const lockBtn = screen.getByRole('button', { name: /I-lock ang Kaha|Lock Till Screen/i });
    fireEvent.click(lockBtn);

    expect(useAuthStore.getState().isSessionLocked).toBe(true);
  });

  it('opens PIN dialog and allows updating PIN', async () => {
    useAuthStore.setState({
      userEmail: 'nena@fluent-tindahan.ph',
      hasPin: false
    });

    renderSettings();

    const setPinBtn = screen.getByRole('button', { name: /Mag-set ng PIN|Set PIN/i });
    fireEvent.click(setPinBtn);

    await waitFor(() => {
      expect(screen.getByText(/Quick POS PIN Settings/i)).toBeInTheDocument();
    });

    const passInput = screen.getByPlaceholderText('••••••••');
    fireEvent.change(passInput, { target: { value: 'CurrentPass123' } });

    const pinInput = screen.getByPlaceholderText('4-6 digits');
    fireEvent.change(pinInput, { target: { value: '5678' } });

    const saveBtn = screen.getByRole('button', { name: /I-save|Save/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(authService.updatePin).toHaveBeenCalledWith({
        email: 'nena@fluent-tindahan.ph',
        password: 'CurrentPass123',
        pin: '5678'
      });
      expect(useAuthStore.getState().hasPin).toBe(true);
    });
  });

  it('shows safe logout warning when pending mutations exist in syncQueue and allows cancelling', async () => {
    await db.syncQueue.add({
      id: 'sync-1',
      entity: 'Sale',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: { id: 'sale-1', total: 100 },
      status: 'Pending',
      retryCount: 0
    });

    renderSettings();

    const logoutBtn = screen.getByRole('button', { name: /Mag-log Out|Log Out/i });
    await act(async () => {
      fireEvent.click(logoutBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/May 1 transaksyon na hindi pa nai-sync sa cloud|You have 1 unsynced transactions/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /I-log Out Pa Rin|Force Log Out/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /I-sync Muna Bago Mag-logout|Sync First/i })).toBeInTheDocument();
    });

    // Clicking cancel should keep user logged in and dismiss dialog
    const cancelBtn = screen.getByRole('button', { name: /Kanselahin|Cancel/i });
    fireEvent.click(cancelBtn);
    expect(useAuthStore.getState().tenantId).toBe('settings-test-tenant');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('allows force logout when pending mutations exist in syncQueue', async () => {
    await db.syncQueue.add({
      id: 'sync-1',
      entity: 'Sale',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: { id: 'sale-1', total: 100 },
      status: 'Pending',
      retryCount: 0
    });

    renderSettings();

    const logoutBtn = screen.getByRole('button', { name: /Mag-log Out|Log Out/i });
    await act(async () => {
      fireEvent.click(logoutBtn);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /I-log Out Pa Rin|Force Log Out/i })).toBeInTheDocument();
    });

    const forceLogoutBtn = screen.getByRole('button', { name: /I-log Out Pa Rin|Force Log Out/i });
    await act(async () => {
      fireEvent.click(forceLogoutBtn);
    });

    await waitFor(() => {
      expect(useAuthStore.getState().userEmail).toBe('');
      expect(useAuthStore.getState().isOnboarded).toBe(false);
      expect(useAuthStore.getState().isOnboardingOpen).toBe(false);
    });
  });

  it('completes safe logout without warning when syncQueue is empty', async () => {
    expect(await db.syncQueue.count()).toBe(0);

    renderSettings();

    const logoutBtn = screen.getByRole('button', { name: /Mag-log Out|Log Out/i });
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(screen.getByText(/Sigurado ka bang magla-log out\?|Are you sure you want to log out\?/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/hindi pa nai-sync|unsynced transaction/i)).not.toBeInTheDocument();

    const confirmLogoutBtn = screen.getAllByRole('button', { name: /Mag-log Out|Log Out/i })[1];
    await act(async () => {
      fireEvent.click(confirmLogoutBtn);
    });

    await waitFor(() => {
      expect(useAuthStore.getState().userEmail).toBe('');
      expect(useAuthStore.getState().isOnboarded).toBe(false);
      expect(useAuthStore.getState().isOnboardingOpen).toBe(false);
    });
  });
});



