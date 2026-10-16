import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { Header } from './Header';
import { sariSariLightTheme } from '../theme/theme';
import { useAuthStore } from '../state/authStore';
import { db } from '../db/db';
import * as syncEngine from '../sync/syncEngine';
import { useThemeStore } from '../state/themeStore';
import { useLanguageStore } from '../state/languageStore';
import { usePwaStore } from '../state/pwaStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { useDisclaimerStore } from '../state/disclaimerStore';

describe('Header', () => {
  beforeEach(async () => {
    useAuthStore.setState({
      businessName: "Aling Nena's Store",
      isOnboarded: true,
      userEmail: 'nena@fluent-tindahan.ph',
      refreshToken: null
    });
    await db.syncQueue.clear();
    useSubscriptionStore.setState({ tier: 'Libre', isUpgradeModalOpen: false });
    useDisclaimerStore.setState({ isDisclaimerOpen: false });
    useThemeStore.setState({ themeMode: 'light', isDarkMode: false });
    useLanguageStore.setState({ language: 'tl' });
    usePwaStore.setState({ isInstallable: false, isStandalone: false, isInstalled: false });
  });

  const renderHeader = (props?: Partial<React.ComponentProps<typeof Header>>) => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <Header {...props} />
      </FluentProvider>
    );
  };

  it('renders app logo, title, and store name', () => {
    renderHeader();

    expect(screen.getByText('FT')).toBeInTheDocument();
    expect(screen.getByText(/Fluent Tindahan/i)).toBeInTheDocument();
    expect(screen.getByText(/Aling Nena's Store/i)).toBeInTheDocument();
  });

  it('toggles language when language button is clicked', () => {
    renderHeader();

    const langBtn = screen.getByTestId('language-toggle-btn');
    fireEvent.click(langBtn);

    expect(useLanguageStore.getState().language).toBe('en');
  });

  it('cycles theme mode between light, dark, and system when theme button is clicked', () => {
    renderHeader();

    const buttons = screen.getAllByRole('button');
    // The theme button is the last button in the header
    const themeBtn = buttons[buttons.length - 1];

    // Starts at light, click moves to dark
    fireEvent.click(themeBtn);
    expect(useThemeStore.getState().themeMode).toBe('dark');
    expect(useThemeStore.getState().isDarkMode).toBe(true);

    // Click moves to system
    fireEvent.click(themeBtn);
    expect(useThemeStore.getState().themeMode).toBe('system');

    // Click moves back to light
    fireEvent.click(themeBtn);
    expect(useThemeStore.getState().themeMode).toBe('light');
    expect(useThemeStore.getState().isDarkMode).toBe(false);
  });

  it('renders PWA install button when app is installable and not in standalone mode', () => {
    const promptInstallSpy = vi.fn().mockResolvedValue(true);
    usePwaStore.setState({
      isInstallable: true,
      isStandalone: false,
      promptInstall: promptInstallSpy
    });

    renderHeader();

    const installBtn = screen.getByRole('button', { name: /I-install ang Fluent Tindahan sa device|Install Fluent Tindahan to device/i });
    expect(installBtn).toBeInTheDocument();

    fireEvent.click(installBtn);
    expect(promptInstallSpy).toHaveBeenCalledTimes(1);
  });

  it('does not render PWA install button when isInstalled is true', () => {
    usePwaStore.setState({
      isInstallable: true,
      isStandalone: false,
      isInstalled: true
    });

    renderHeader();

    expect(screen.queryByRole('button', { name: /I-install ang Fluent Tindahan sa device|Install Fluent Tindahan to device/i })).not.toBeInTheDocument();
  });

  it('renders plan tier badge and opens upgrade modal on click', () => {
    useSubscriptionStore.setState({ tier: 'TindahanPro' });
    renderHeader();

    expect(screen.getByText('PRO')).toBeInTheDocument();

    const planBtn = screen.getByTitle('View Subscription Plans');
    fireEvent.click(planBtn);

    expect(useSubscriptionStore.getState().isUpgradeModalOpen).toBe(true);
  });

  it('renders disclaimer button and opens disclaimer modal on click', () => {
    renderHeader();

    const disclaimerBtn = screen.getByTestId('header-disclaimer-btn');
    expect(disclaimerBtn).toBeInTheDocument();

    fireEvent.click(disclaimerBtn);
    expect(useDisclaimerStore.getState().isDisclaimerOpen).toBe(true);
  });

  it('hides store subtitle, plan tier badge, and sync indicators when activeTab is login', () => {
    useAuthStore.setState({ businessName: "Aling Nena's Store", isOnboarded: true });
    renderHeader({ activeTab: 'login' });

    expect(screen.getByText('FT')).toBeInTheDocument();
    expect(screen.getByText(/Fluent Tindahan/i)).toBeInTheDocument();
    expect(screen.queryByText(/Aling Nena's Store/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle('View Subscription Plans')).not.toBeInTheDocument();
    expect(screen.queryByText(/Naka-online|Online/i)).not.toBeInTheDocument();
  });

  it('hides store subtitle and sync indicators when user is not onboarded (logged out)', () => {
    useAuthStore.setState({ businessName: '', isOnboarded: false });
    renderHeader();

    expect(screen.getByText('FT')).toBeInTheDocument();
    expect(screen.getByText(/Fluent Tindahan/i)).toBeInTheDocument();
    expect(screen.queryByText(/Aling Nena's/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle('View Subscription Plans')).not.toBeInTheDocument();
    expect(screen.queryByText(/Naka-online|Online/i)).not.toBeInTheDocument();
  });

  it('translates landing shortcut button to Tuklasin in TL and Explore in EN', () => {
    const mockNavigate = vi.fn();
    const { unmount } = renderHeader({ onNavigate: mockNavigate, activeTab: 'dashboard' });

    // Default language is 'tl'
    expect(screen.getByText('Tuklasin')).toBeInTheDocument();
    unmount();

    useLanguageStore.setState({ language: 'en' });
    renderHeader({ onNavigate: mockNavigate, activeTab: 'dashboard' });
    expect(screen.getByText('Explore')).toBeInTheDocument();

    useLanguageStore.setState({ language: 'tl' });
  });

  async function openAccountMenu() {
    fireEvent.click(screen.getByTestId('header-account-menu'));
    await waitFor(() => {
      expect(screen.getByTestId('header-logout-item')).toBeInTheDocument();
    });
  }

  it('shows a logout menu on the store name for signed-in users', async () => {
    renderHeader({ activeTab: 'pos' });

    const accountMenu = screen.getByTestId('header-account-menu');
    expect(accountMenu).toHaveAccessibleName(/Aling Nena's Store/i);
    expect(screen.getByText(/Aling Nena's Store/i)).toBeInTheDocument();

    await openAccountMenu();
    expect(screen.getByRole('menuitem', { name: /Mag-log Out/i })).toBeInTheDocument();
  });

  it('uses the English logout label when the language is English', async () => {
    useLanguageStore.setState({ language: 'en' });
    renderHeader({ activeTab: 'dashboard' });

    await openAccountMenu();
    expect(screen.getByRole('menuitem', { name: 'Log Out' })).toBeInTheDocument();
  });

  it('hides the account menu from visitors who are not signed in', () => {
    useAuthStore.setState({ businessName: '', isOnboarded: false, userEmail: '' });
    renderHeader({ activeTab: 'landing' });

    expect(screen.queryByTestId('header-account-menu')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Mag-log Out|Log Out/i })).not.toBeInTheDocument();
  });

  it('hides the account menu on the login page', () => {
    renderHeader({ activeTab: 'login' });

    expect(screen.queryByTestId('header-account-menu')).not.toBeInTheDocument();
    expect(screen.queryByText(/Aling Nena's Store/i)).not.toBeInTheDocument();
  });

  it('still offers logout when a signed-in store has no business name yet', async () => {
    useAuthStore.setState({ businessName: '', isOnboarded: true });
    renderHeader({ activeTab: 'pos' });

    const accountMenu = screen.getByTestId('header-account-menu');
    expect(accountMenu).toHaveAccessibleName(/Mag-log Out/i);
    await openAccountMenu();
    expect(screen.getByRole('menuitem', { name: /Mag-log Out/i })).toBeInTheDocument();
  });

  it('opens the account menu without following the logo navigation', async () => {
    const onNavigate = vi.fn();
    renderHeader({ onNavigate, activeTab: 'utang' });

    await openAccountMenu();

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('confirms logout from the header when nothing is waiting to sync', async () => {
    const onNavigate = vi.fn();
    renderHeader({ onNavigate, activeTab: 'settings' });

    await openAccountMenu();
    await act(async () => {
      fireEvent.click(screen.getByTestId('header-logout-item'));
    });

    await waitFor(() => {
      expect(screen.getByText(/Sigurado ka bang magla-log out\?/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/hindi pa nai-sync|unsynced transaction/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /I-sync Muna Bago Mag-logout/i })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('safe-logout-confirm-btn'));
    });

    await waitFor(() => {
      expect(useAuthStore.getState().isOnboarded).toBe(false);
      expect(useAuthStore.getState().userEmail).toBe('');
    });
    expect(onNavigate).toHaveBeenCalledWith('login');
  });

  it('warns about unsynced transactions and can sync before logging out', async () => {
    const syncSpy = vi.spyOn(syncEngine, 'processSyncQueue').mockResolvedValue({
      processed: 1,
      conflicts: 0,
      errors: 0
    });
    await db.syncQueue.add({
      id: 'sync-header-1',
      entity: 'Sale',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: { id: 'sale-header-1', total: 100 },
      status: 'Pending',
      retryCount: 0
    });

    const onNavigate = vi.fn();
    renderHeader({ onNavigate, activeTab: 'pos' });

    await openAccountMenu();
    await act(async () => {
      fireEvent.click(screen.getByTestId('header-logout-item'));
    });

    await waitFor(() => {
      expect(screen.getByText(/May 1 transaksyon na hindi pa nai-sync sa cloud/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /I-log Out Pa Rin/i })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /I-sync Muna Bago Mag-logout/i }));
    });

    await waitFor(() => {
      expect(syncSpy).toHaveBeenCalledTimes(1);
    });
    expect(useAuthStore.getState().isOnboarded).toBe(true);
    expect(useAuthStore.getState().userEmail).toBe('nena@fluent-tindahan.ph');
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    syncSpy.mockRestore();
  });

  it('can still log out from the header when unsynced transactions remain', async () => {
    await db.syncQueue.add({
      id: 'sync-header-2',
      entity: 'Sale',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: { id: 'sale-header-2', total: 50 },
      status: 'Pending',
      retryCount: 0
    });

    const onNavigate = vi.fn();
    renderHeader({ onNavigate, activeTab: 'gcash' });

    await openAccountMenu();
    await act(async () => {
      fireEvent.click(screen.getByTestId('header-logout-item'));
    });

    const cancelBtn = await screen.findByRole('button', { name: /Kanselahin/i });
    fireEvent.click(cancelBtn);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(useAuthStore.getState().isOnboarded).toBe(true);

    await openAccountMenu();
    await act(async () => {
      fireEvent.click(screen.getByTestId('header-logout-item'));
    });

    const forceLogoutBtn = await screen.findByRole('button', { name: /I-log Out Pa Rin/i });
    await act(async () => {
      fireEvent.click(forceLogoutBtn);
    });

    await waitFor(() => {
      expect(useAuthStore.getState().isOnboarded).toBe(false);
      expect(useAuthStore.getState().userEmail).toBe('');
    });
    expect(onNavigate).toHaveBeenCalledWith('login');
  });
});


