import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { Header, resolveHeaderLogoDestination } from './Header';
import { sariSariLightTheme } from '../theme/theme';
import { useAuthStore } from '../state/authStore';
import { useThemeStore } from '../state/themeStore';
import { useLanguageStore } from '../state/languageStore';
import { usePwaStore } from '../state/pwaStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { useDisclaimerStore } from '../state/disclaimerStore';

describe('Header', () => {
  beforeEach(() => {
    useAuthStore.setState({ businessName: "Aling Nena's Store", isOnboarded: true });
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

  it('sends authenticated users to the dashboard when the logo is clicked', () => {
    const onNavigate = vi.fn();
    const inAppTabs = ['dashboard', 'pos', 'inventory', 'utang', 'gcash', 'import', 'settings', 'landing', 'login'] as const;

    for (const activeTab of inAppTabs) {
      onNavigate.mockClear();
      const { unmount } = renderHeader({ onNavigate, activeTab });

      fireEvent.click(screen.getByTestId('header-logo'));

      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith('dashboard');
      expect(screen.getByTestId('header-logo')).toHaveAttribute('title', 'Dashboard');
      unmount();
    }
  });

  it('sends unauthenticated visitors on public pages to the landing page', () => {
    useAuthStore.setState({ businessName: '', isOnboarded: false });
    const onNavigate = vi.fn();
    const { unmount } = renderHeader({ onNavigate, activeTab: 'login' });

    fireEvent.click(screen.getByTestId('header-logo'));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('landing');
    unmount();

    onNavigate.mockClear();
    renderHeader({ onNavigate, activeTab: 'landing' });

    // Already on the landing page, the public logo shortcut continues to login.
    fireEvent.click(screen.getByTestId('header-logo'));
    expect(onNavigate).toHaveBeenCalledWith('login');
  });

  it('keeps the explore shortcut pointed at the landing page for signed-in users', () => {
    const onNavigate = vi.fn();
    renderHeader({ onNavigate, activeTab: 'utang' });

    fireEvent.click(screen.getByTestId('header-landing-toggle-btn'));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('landing');
  });

  it('resolves the logo destination from auth state and the current page', () => {
    expect(resolveHeaderLogoDestination('utang', true)).toBe('dashboard');
    expect(resolveHeaderLogoDestination('dashboard', true)).toBe('dashboard');
    expect(resolveHeaderLogoDestination('landing', true)).toBe('dashboard');
    expect(resolveHeaderLogoDestination('login', false)).toBe('landing');
    expect(resolveHeaderLogoDestination('landing', false)).toBe('login');
    expect(resolveHeaderLogoDestination(undefined, false)).toBe('landing');
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
});


