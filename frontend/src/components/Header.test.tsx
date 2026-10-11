import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { Header } from './Header';
import { sariSariLightTheme } from '../theme/theme';
import { useAuthStore } from '../state/authStore';
import { useThemeStore } from '../state/themeStore';
import { useLanguageStore } from '../state/languageStore';
import { usePwaStore } from '../state/pwaStore';
import { useSubscriptionStore } from '../state/subscriptionStore';

describe('Header', () => {
  beforeEach(() => {
    useAuthStore.setState({ businessName: "Aling Nena's Store" });
    useSubscriptionStore.setState({ tier: 'Libre', isUpgradeModalOpen: false });
    useThemeStore.setState({ themeMode: 'light', isDarkMode: false });
    useLanguageStore.setState({ language: 'tl' });
    usePwaStore.setState({ isInstallable: false, isStandalone: false, isInstalled: false });
  });

  const renderHeader = () => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <Header />
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

    const langBtn = screen.getByText('🇵🇭 TL').closest('button')!;
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
});

