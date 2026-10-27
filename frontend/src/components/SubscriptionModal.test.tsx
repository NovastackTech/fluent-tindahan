import { StrictMode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { SubscriptionModal } from './SubscriptionModal';
import { sariSariLightTheme } from '../theme/theme';
import { SUBSCRIPTION_REFRESH_ERROR, useSubscriptionStore } from '../state/subscriptionStore';
import { useAuthStore } from '../state/authStore';
import { useLanguageStore } from '../state/languageStore';
import { translations } from '../i18n/translations';
import { db } from '../db/db';
import { apiClient } from '../services/apiClient';
import { DEFAULT_TENANT_ID } from '../db/seedData';

describe('SubscriptionModal', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await db.tenants.clear();
    useLanguageStore.setState({ language: 'tl' });
    useAuthStore.setState({
      tenantId: DEFAULT_TENANT_ID,
      tier: 'Libre',
      subscriptionEndDate: null,
      isDemo: false
    });
    vi.spyOn(apiClient, 'put').mockResolvedValue({
      data: { tenantId: DEFAULT_TENANT_ID }
    } as any);
    useSubscriptionStore.setState({
      tier: 'Libre',
      subscriptionEndDate: null,
      isActive: false,
      daysRemaining: null,
      isLoading: false,
      error: null,
      isUpgradeModalOpen: false
    });
  });

  const renderModal = () => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <StrictMode>
          <SubscriptionModal />
        </StrictMode>
      </FluentProvider>
    );
  };

  it('renders nothing when isUpgradeModalOpen is false', () => {
    renderModal();
    expect(screen.queryByText(/Mga Plano at Subscription ng Tindahan/i)).not.toBeInTheDocument();
  });

  it('renders Libre and Tindahan Pro tier cards when open', () => {
    useSubscriptionStore.setState({ isUpgradeModalOpen: true });
    renderModal();

    expect(screen.getByText(/Mga Plano at Subscription ng Tindahan/i)).toBeInTheDocument();
    expect(screen.getByText('Libre')).toBeInTheDocument();
    expect(screen.getByText('Tindahan Pro')).toBeInTheDocument();
    expect(screen.queryByText('Negosyo Plus')).not.toBeInTheDocument();
  });

  it('does not emit Keyborg disposal warnings under StrictMode', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    useSubscriptionStore.setState({ isUpgradeModalOpen: true });

    const view = renderModal();
    view.unmount();

    const warnings = [...consoleError.mock.calls, ...consoleWarn.mock.calls].flat().join(' ');
    consoleError.mockRestore();
    consoleWarn.mockRestore();

    expect(warnings).not.toMatch(/Keyborg instance .* disposed incorrectly|mergeClasses\(\):.*multiple identifiers/i);
  });

  it('renders monthly pricing without Sachet Weekly or Negosyo Plus', () => {
    useSubscriptionStore.setState({ isUpgradeModalOpen: true });
    renderModal();

    expect(screen.getByText('₱129.00')).toBeInTheDocument();
    expect(screen.queryByText('₱349.00')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lingguhan|Weekly|Sachet/i })).not.toBeInTheDocument();
  });

  it('offers QR Ph only', () => {
    useLanguageStore.setState({ language: 'en' });
    useSubscriptionStore.setState({ isUpgradeModalOpen: true });
    renderModal();

    expect(screen.getByRole('button', { name: /Pay via QR Ph/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Upgrade to Pro|Renew Pro/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/PayMongo gateway|7-Eleven|Cards/i)).not.toBeInTheDocument();
  });

  it('keeps plan prices visible and offers retry when subscription refresh fails', () => {
    useSubscriptionStore.setState({ isUpgradeModalOpen: true, error: SUBSCRIPTION_REFRESH_ERROR });
    renderModal();

    expect(screen.getByText('₱129.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subukan muli|Retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Magbayad gamit ang QR Ph|Pay via QR Ph/i })).toBeEnabled();
    expect(screen.queryByText(/Request failed with status code 500/i)).not.toBeInTheDocument();
  });

  it('hides subscription errors in demo mode', () => {
    useLanguageStore.setState({ language: 'en' });
    useAuthStore.setState({ isDemo: true });
    useSubscriptionStore.setState({
      isUpgradeModalOpen: true,
      error: translations.en.common.sessionReauthRequired
    });
    renderModal();

    expect(screen.getByText('Libre')).toBeInTheDocument();
    expect(screen.queryByText(translations.en.common.sessionReauthRequired)).not.toBeInTheDocument();
  });

  it('closes modal when close button is clicked', () => {
    useSubscriptionStore.setState({ isUpgradeModalOpen: true });
    renderModal();

    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);

    expect(useSubscriptionStore.getState().isUpgradeModalOpen).toBe(false);
  });

  it('allows simulating upgrade to Pro in development test mode', async () => {
    const newEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: { success: true, tier: 1, newEndDate }
    } as any);
    useSubscriptionStore.setState({ isUpgradeModalOpen: true });
    renderModal();

    const testUpgradeBtns = screen.getAllByRole('button', { name: /Subukan \(Simulate Test\)/i });
    fireEvent.click(testUpgradeBtns[0]);

    await waitFor(() => {
      expect(useSubscriptionStore.getState().tier).toBe('TindahanPro');
      expect(useAuthStore.getState().tier).toBe('TindahanPro');
      expect(localStorage.getItem('fluent_tindahan_tier_v1')).toBe('TindahanPro');
    });
  });

  it('switches embedded sync error text dynamically when language is toggled from Tagalog to English', () => {
    act(() => {
      useLanguageStore.setState({ language: 'tl' });
      useSubscriptionStore.setState({
        isUpgradeModalOpen: true,
        error: translations.tl.common.differentAccountSyncBlocked
      });
    });

    renderModal();

    expect(screen.getByText('Mga Plano at Subscription ng Tindahan')).toBeInTheDocument();
    expect(screen.getByText(translations.tl.common.differentAccountSyncBlocked)).toBeInTheDocument();

    act(() => {
      useLanguageStore.getState().toggleLanguage();
    });

    expect(screen.getByText('Tindahan Subscription Plans')).toBeInTheDocument();
    expect(screen.getByText(translations.en.common.differentAccountSyncBlocked)).toBeInTheDocument();
  });

  it('switches embedded tenant provisioning error text dynamically when language is toggled', () => {
    act(() => {
      useLanguageStore.setState({ language: 'tl' });
      useSubscriptionStore.setState({
        isUpgradeModalOpen: true,
        error: translations.tl.common.tenantProvisioningSyncBlocked
      });
    });

    renderModal();

    expect(screen.getByText(translations.tl.common.tenantProvisioningSyncBlocked)).toBeInTheDocument();

    act(() => {
      useLanguageStore.getState().toggleLanguage();
    });

    expect(screen.getByText(translations.en.common.tenantProvisioningSyncBlocked)).toBeInTheDocument();
  });

  it('switches subscription refresh error warning text dynamically when language is toggled', () => {
    act(() => {
      useLanguageStore.setState({ language: 'tl' });
      useSubscriptionStore.setState({
        isUpgradeModalOpen: true,
        error: SUBSCRIPTION_REFRESH_ERROR
      });
    });

    renderModal();

    expect(screen.getByText(/Hindi ma-refresh ang detalye ng subscription/i)).toBeInTheDocument();

    act(() => {
      useLanguageStore.getState().toggleLanguage();
    });

    expect(screen.getByText(/Subscription details could not be refreshed/i)).toBeInTheDocument();
  });
});
