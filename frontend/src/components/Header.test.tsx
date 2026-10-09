import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { Header } from './Header';
import { sariSariLightTheme } from '../theme/theme';
import { useAuthStore } from '../state/authStore';
import { useThemeStore } from '../state/themeStore';
import { useLanguageStore } from '../state/languageStore';

describe('Header', () => {
  beforeEach(() => {
    useAuthStore.setState({ businessName: "Aling Nena's Store" });
    useThemeStore.setState({ themeMode: 'light', isDarkMode: false });
    useLanguageStore.setState({ language: 'tl' });
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
});
