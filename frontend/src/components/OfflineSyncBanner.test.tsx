import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { OfflineSyncBanner } from './OfflineSyncBanner';
import { sariSariLightTheme } from '../theme/theme';
import { useSyncStore } from '../sync/syncEngine';
import { useAuthStore } from '../state/authStore';
import { useLanguageStore } from '../state/languageStore';
import { translations } from '../i18n/translations';

describe('OfflineSyncBanner', () => {
  beforeEach(() => {
    localStorage.removeItem('fluent_tindahan_pending_profile_update_v1');
    useSyncStore.setState({
      isOnline: true,
      pendingCount: 0,
      deadLetterCount: 0,
      lastErrorMessage: null
    });
    useAuthStore.setState({ reauthRequired: false, reauthRequested: false, isOnboarded: true });
  });

  const renderBanner = () => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <OfflineSyncBanner />
      </FluentProvider>
    );
  };

  it('renders nothing when not onboarded (e.g. login or landing screen) even with dead letters', () => {
    useAuthStore.setState({ isOnboarded: false });
    useSyncStore.setState({ isOnline: true, deadLetterCount: 6, lastErrorMessage: 'Poison pill' });
    const { container } = renderBanner();
    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it('renders nothing when fully online and queue is clear', () => {
    const { container } = renderBanner();
    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it('renders offline warning when isOnline is false', () => {
    useSyncStore.setState({ isOnline: false });
    renderBanner();

    expect(screen.getByText(/Naka-offline|Offline/i)).toBeInTheDocument();
  });

  it('renders pending queue counter when online and pendingCount > 0', () => {
    useSyncStore.setState({ isOnline: true, isSyncing: false, pendingCount: 3 });
    renderBanner();

    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Puwersahing mag-sync|Force Sync/i })).toBeInTheDocument();
    expect(screen.getByText(/hindi nito hinaharangan ang pag-save|does not block saving/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Nagsi-sync\.\.\.$|^Syncing\.\.\.$/)).not.toBeInTheDocument();
  });

  it('shows the syncing label only while a batch is actually in flight', () => {
    useSyncStore.setState({ isOnline: true, isSyncing: true, pendingCount: 3 });
    renderBanner();

    expect(screen.getAllByText(/Nagsi-sync\.\.\.|Syncing\.\.\./).length).toBeGreaterThan(0);
  });

  it('renders dead letter queue alert when deadLetterCount > 0 and handles retry click', async () => {
    useSyncStore.setState({ isOnline: true, deadLetterCount: 2 });
    renderBanner();

    expect(screen.getByText(/Dead Letter Queue \(2\)/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /Subukan(g)? Muli|Retry/i });
    expect(retryBtn).toBeInTheDocument();
    expect(retryBtn).not.toBeDisabled();
  });

  it('offers sign-in without forcing another sync when the session must be renewed', () => {
    useAuthStore.setState({ reauthRequired: true });
    useSyncStore.setState({
      isOnline: true,
      isSyncing: false,
      pendingCount: 3,
      deadLetterCount: 0,
      lastErrorMessage: null
    });
    renderBanner();

    const signInButtons = screen.getAllByRole('button', { name: /Mag-sign in muli|Sign in again/i });
    expect(signInButtons.length).toBeGreaterThan(0);
    signInButtons[0].click();

    expect(useAuthStore.getState().reauthRequested).toBe(true);
    expect(useSyncStore.getState().isSyncing).toBe(false);
    expect(window.location.search).toContain('tab=login');
  });

  it('renders sync error with dismiss button and clears on click', () => {
    useSyncStore.setState({
      isOnline: true,
      pendingCount: 0,
      deadLetterCount: 0,
      lastErrorMessage: 'The server could not verify this store.'
    });
    renderBanner();

    expect(screen.getByText(/Problema sa Pag-sync|Sync Error/i)).toBeInTheDocument();
    expect(screen.getByText('The server could not verify this store.')).toBeInTheDocument();

    const dismissBtn = screen.getByRole('button', { name: /Isara|Close|Dismiss/i });
    expect(dismissBtn).toBeInTheDocument();
    dismissBtn.click();
    expect(useSyncStore.getState().lastErrorMessage).toBeNull();
  });

  it('renders pending profile update notice when a queued profile update exists', () => {
    localStorage.setItem(
      'fluent_tindahan_pending_profile_update_v1',
      JSON.stringify({
        tenantId: '00000000-0000-0000-0000-000000000001',
        payload: { ownerName: 'Ate Linda' },
        timestamp: new Date().toISOString(),
        retryCount: 0
      })
    );

    renderBanner();

    expect(screen.getByText(/May nakabinbing profile update|Pending profile update/i)).toBeInTheDocument();
    expect(screen.getByText(/Nai-save sa device\. Isa-synchronize sa server pagbalik ng koneksyon\.|Saved locally\. Will sync to server when connection is restored\./i)).toBeInTheDocument();
  });

  it('switches sync error text dynamically when language is toggled from Tagalog to English', () => {
    act(() => {
      useLanguageStore.setState({ language: 'tl' });
      useSyncStore.setState({
        isOnline: true,
        pendingCount: 0,
        deadLetterCount: 0,
        lastErrorMessage: translations.tl.common.differentAccountSyncBlocked
      });
    });

    renderBanner();

    expect(screen.getByText('Problema sa Pag-sync')).toBeInTheDocument();
    expect(screen.getByText(translations.tl.common.differentAccountSyncBlocked)).toBeInTheDocument();

    act(() => {
      useLanguageStore.getState().toggleLanguage();
    });

    expect(screen.getByText('Sync Error')).toBeInTheDocument();
    expect(screen.getByText(translations.en.common.differentAccountSyncBlocked)).toBeInTheDocument();
  });

  it('switches DLQ error text dynamically when language is toggled from Tagalog to English', () => {
    const tlDlq = 'May mga produkto sa Dead Letter Queue na kailangang ayusin sa Settings bago ma-sync.';
    const enDlq = 'Some products in the Dead Letter Queue require editing in Settings before syncing.';

    act(() => {
      useLanguageStore.setState({ language: 'tl' });
      useSyncStore.setState({
        isOnline: true,
        pendingCount: 0,
        deadLetterCount: 2,
        lastErrorMessage: tlDlq
      });
    });

    renderBanner();

    expect(screen.getByText(tlDlq)).toBeInTheDocument();

    act(() => {
      useLanguageStore.getState().toggleLanguage();
    });

    expect(screen.getByText(enDlq)).toBeInTheDocument();
  });
});

