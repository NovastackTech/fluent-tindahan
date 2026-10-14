import { StrictMode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { SubscriptionModal } from './SubscriptionModal';
import { sariSariLightTheme } from '../theme/theme';
import { SUBSCRIPTION_REFRESH_ERROR, useSubscriptionStore } from '../state/subscriptionStore';
import { useAuthStore } from '../state/authStore';
import { useLanguageStore } from '../state/languageStore';
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
      subscriptionEndDate: null
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

  it('renders all 3 tier cards when open', () => {
    useSubscriptionStore.setState({ isUpgradeModalOpen: true });
    renderModal();

    expect(screen.getByText(/Mga Plano at Subscription ng Tindahan/i)).toBeInTheDocument();
    expect(screen.getByText('Libre')).toBeInTheDocument();
    expect(screen.getByText('Tindahan Pro')).toBeInTheDocument();
    expect(screen.getByText('Negosyo Plus')).toBeInTheDocument();
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

  it('toggles pricing between Monthly and Sachet Weekly', () => {
    useSubscriptionStore.setState({ isUpgradeModalOpen: true });
    renderModal();

    // Default is Monthly: ₱129.00 and ₱349.00
    expect(screen.getByText('₱129.00')).toBeInTheDocument();
    expect(screen.getByText('₱349.00')).toBeInTheDocument();

    // Switch to Weekly Sachet
    const weeklyBtn = screen.getByRole('button', { name: /Lingguhan|Weekly/i });
    fireEvent.click(weeklyBtn);

    expect(screen.getByText('₱35.00')).toBeInTheDocument();
    expect(screen.getByText('₱89.00')).toBeInTheDocument();
  });

  it('keeps plan prices visible and offers retry when subscription refresh fails', () => {
    useSubscriptionStore.setState({ isUpgradeModalOpen: true, error: SUBSCRIPTION_REFRESH_ERROR });
    renderModal();

    expect(screen.getByText('₱129.00')).toBeInTheDocument();
    expect(screen.getByText('₱349.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subukan muli|Retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mag-upgrade sa Pro|Upgrade to Pro/i })).toBeEnabled();
    expect(screen.queryByText(/Request failed with status code 500/i)).not.toBeInTheDocument();
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
    // First simulate button is for Tindahan Pro
    fireEvent.click(testUpgradeBtns[0]);

    await waitFor(() => {
      expect(useSubscriptionStore.getState().tier).toBe('TindahanPro');
      expect(useAuthStore.getState().tier).toBe('TindahanPro');
      expect(localStorage.getItem('fluent_tindahan_tier_v1')).toBe('TindahanPro');
    });
  });
});
