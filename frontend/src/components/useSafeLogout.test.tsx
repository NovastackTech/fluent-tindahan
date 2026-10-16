import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { SafeLogoutDialog } from './SafeLogoutDialog';
import { useSafeLogout } from './useSafeLogout';
import { sariSariLightTheme } from '../theme/theme';
import { useAuthStore } from '../state/authStore';
import { useLanguageStore } from '../state/languageStore';
import { db } from '../db/db';
import * as syncEngine from '../sync/syncEngine';

function SafeLogoutHarness({ onLoggedOut }: { onLoggedOut?: () => void }) {
  const logout = useSafeLogout({ onLoggedOut });
  return (
    <FluentProvider theme={sariSariLightTheme}>
      <button type="button" onClick={() => void logout.initiateLogout()}>
        start-logout
      </button>
      <button type="button" onClick={() => void logout.initiateSwitchAccount()}>
        start-switch
      </button>
      <SafeLogoutDialog
        open={logout.isLogoutConfirmOpen}
        unsyncedCount={logout.logoutUnsyncedCount}
        onDismiss={logout.cancelLogout}
        onSyncFirst={logout.syncFirst}
        onConfirmLogout={logout.confirmLogout}
      />
    </FluentProvider>
  );
}

describe('useSafeLogout', () => {
  beforeEach(async () => {
    useAuthStore.setState({
      tenantId: 'safe-logout-tenant',
      businessName: "Aling Nena's Store",
      userEmail: 'nena@fluent-tindahan.ph',
      isOnboarded: true,
      refreshToken: null
    });
    useLanguageStore.setState({ language: 'tl' });
    await db.syncQueue.clear();
  });

  it('asks for confirmation even when the sync queue is empty', async () => {
    const onLoggedOut = vi.fn();
    render(<SafeLogoutHarness onLoggedOut={onLoggedOut} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'start-logout' }));
    });

    expect(await screen.findByText(/Sigurado ka bang magla-log out\?/i)).toBeInTheDocument();
    expect(screen.queryByText(/hindi pa nai-sync/i)).not.toBeInTheDocument();
    expect(onLoggedOut).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isOnboarded).toBe(true);
  });

  it('logs out and notifies the caller after confirmation', async () => {
    const onLoggedOut = vi.fn();
    render(<SafeLogoutHarness onLoggedOut={onLoggedOut} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'start-logout' }));
    });
    await act(async () => {
      fireEvent.click(await screen.findByTestId('safe-logout-confirm-btn'));
    });

    await waitFor(() => {
      expect(useAuthStore.getState().isOnboarded).toBe(false);
      expect(useAuthStore.getState().userEmail).toBe('');
    });
    expect(onLoggedOut).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when logout is cancelled', async () => {
    render(<SafeLogoutHarness />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'start-logout' }));
    });
    fireEvent.click(await screen.findByTestId('safe-logout-cancel-btn'));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(useAuthStore.getState().userEmail).toBe('nena@fluent-tindahan.ph');
    expect(useAuthStore.getState().isOnboarded).toBe(true);
  });

  it('warns with the unsynced count and syncs first without logging out', async () => {
    const syncSpy = vi.spyOn(syncEngine, 'processSyncQueue').mockResolvedValue({
      processed: 2,
      conflicts: 0,
      errors: 0
    });
    await db.syncQueue.bulkAdd([
      {
        id: 'sync-a',
        entity: 'Sale',
        action: 'Insert',
        timestamp: new Date().toISOString(),
        payload: { id: 'sale-a' },
        status: 'Pending',
        retryCount: 0
      },
      {
        id: 'sync-b',
        entity: 'UtangLedger',
        action: 'Insert',
        timestamp: new Date().toISOString(),
        payload: { id: 'utang-b' },
        status: 'Pending',
        retryCount: 0
      }
    ]);

    useLanguageStore.setState({ language: 'en' });
    const onLoggedOut = vi.fn();
    render(<SafeLogoutHarness onLoggedOut={onLoggedOut} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'start-logout' }));
    });

    expect(await screen.findByText(/You have 2 unsynced transactions/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync First' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Force Log Out' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sync First' }));
    });

    await waitFor(() => {
      expect(syncSpy).toHaveBeenCalledTimes(1);
    });
    expect(onLoggedOut).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isOnboarded).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    syncSpy.mockRestore();
  });

  it('switches accounts immediately when every transaction is already synced', async () => {
    const onLoggedOut = vi.fn();
    render(<SafeLogoutHarness onLoggedOut={onLoggedOut} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'start-switch' }));
    });

    await waitFor(() => {
      expect(useAuthStore.getState().isOnboarded).toBe(false);
    });
    expect(onLoggedOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reuses the unsynced warning when switching accounts with a pending queue', async () => {
    await db.syncQueue.add({
      id: 'sync-switch',
      entity: 'Sale',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: { id: 'sale-switch' },
      status: 'Pending',
      retryCount: 0
    });
    const onLoggedOut = vi.fn();
    render(<SafeLogoutHarness onLoggedOut={onLoggedOut} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'start-switch' }));
    });

    expect(await screen.findByText(/May 1 transaksyon na hindi pa nai-sync sa cloud/i)).toBeInTheDocument();
    expect(onLoggedOut).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isOnboarded).toBe(true);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /I-log Out Pa Rin/i }));
    });

    await waitFor(() => {
      expect(useAuthStore.getState().isOnboarded).toBe(false);
    });
    expect(onLoggedOut).toHaveBeenCalledTimes(1);
  });
});
