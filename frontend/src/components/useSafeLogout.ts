import { useCallback, useState } from 'react';
import { db } from '../db/db';
import { useAuthStore } from '../state/authStore';
import { processSyncQueue } from '../sync/syncEngine';

async function countPendingSyncItems(): Promise<number> {
  try {
    return await db.syncQueue.count();
  } catch (error) {
    console.warn(error);
    return 0;
  }
}

export interface UseSafeLogoutOptions {
  onLoggedOut?: () => void;
}

/**
 * Shared safe-logout flow used by Settings and the header account menu.
 * Always confirms, and warns when IndexedDB still has unsynced mutations.
 */
export function useSafeLogout(options?: UseSafeLogoutOptions) {
  const logout = useAuthStore((state) => state.logout);
  const onLoggedOut = options?.onLoggedOut;
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [logoutUnsyncedCount, setLogoutUnsyncedCount] = useState(0);

  const initiateLogout = useCallback(async () => {
    const pending = await countPendingSyncItems();
    setLogoutUnsyncedCount(pending);
    setIsLogoutConfirmOpen(true);
  }, []);

  const initiateSwitchAccount = useCallback(async () => {
    const pending = await countPendingSyncItems();
    if (pending > 0) {
      setLogoutUnsyncedCount(pending);
      setIsLogoutConfirmOpen(true);
      return;
    }
    onLoggedOut?.();
    await logout(true);
  }, [logout, onLoggedOut]);

  const cancelLogout = useCallback(() => {
    setIsLogoutConfirmOpen(false);
  }, []);

  const syncFirst = useCallback(async () => {
    setIsLogoutConfirmOpen(false);
    await processSyncQueue({ force: true });
  }, []);

  const confirmLogout = useCallback(async () => {
    setIsLogoutConfirmOpen(false);
    onLoggedOut?.();
    await logout(true);
  }, [logout, onLoggedOut]);

  return {
    isLogoutConfirmOpen,
    logoutUnsyncedCount,
    initiateLogout,
    initiateSwitchAccount,
    cancelLogout,
    syncFirst,
    confirmLogout
  };
}
