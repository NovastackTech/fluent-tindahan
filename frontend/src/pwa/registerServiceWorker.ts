import { usePwaStore } from '../state/pwaStore';
import { useCartStore } from '../state/cartStore';

let updateSWFunction: ((reloadPage?: boolean) => Promise<void>) | null = null;
let updateIntervalId: ReturnType<typeof setInterval> | null = null;
let initPromise: Promise<void> | null = null;
let isReloading = false;
let reloadExecuted = false;
let fallbackReloadTimer: ReturnType<typeof setTimeout> | null = null;
let fallbackHardNavTimer: ReturnType<typeof setTimeout> | null = null;
let deferredReloadUnsubscribe: (() => void) | null = null;
let deferredReloadTimer: ReturnType<typeof setTimeout> | null = null;

function executeReload(): void {
  if (reloadExecuted) return;
  reloadExecuted = true;

  if (fallbackReloadTimer) {
    clearTimeout(fallbackReloadTimer);
    fallbackReloadTimer = null;
  }
  if (fallbackHardNavTimer) {
    clearTimeout(fallbackHardNavTimer);
    fallbackHardNavTimer = null;
  }
  if (deferredReloadTimer) {
    clearTimeout(deferredReloadTimer);
    deferredReloadTimer = null;
  }
  if (deferredReloadUnsubscribe) {
    deferredReloadUnsubscribe();
    deferredReloadUnsubscribe = null;
  }
  if (typeof window === 'undefined') return;
  try {
    window.location.reload();
  } catch {
    if (typeof window.location?.assign === 'function') {
      window.location.assign(window.location.href);
    } else if (typeof window.location?.replace === 'function') {
      window.location.replace(window.location.href);
    }
  }
}

function canSafelyReload(): boolean {
  const hasLocalCart = useCartStore.getState().items.length > 0;
  const pwaState = usePwaStore.getState();
  return !hasLocalCart && !pwaState.isSaleInProgress && !pwaState.hasActiveReceipt && !pwaState.otherTabsHaveCart;
}

function triggerDeferredReloadSubscription(): void {
  if (deferredReloadUnsubscribe) return;

  const checkSafeAndReload = () => {
    if (!canSafelyReload()) {
      return;
    }

    if (deferredReloadTimer) {
      clearTimeout(deferredReloadTimer);
    }

    deferredReloadTimer = setTimeout(() => {
      deferredReloadTimer = null;
      if (canSafelyReload()) {
        if (deferredReloadUnsubscribe) {
          deferredReloadUnsubscribe();
          deferredReloadUnsubscribe = null;
        }
        executeReload();
      }
    }, 500);
  };

  const unsubCart = useCartStore.subscribe(checkSafeAndReload);
  const unsubPwa = usePwaStore.subscribe(checkSafeAndReload);
  deferredReloadUnsubscribe = () => {
    unsubCart();
    unsubPwa();
  };
}

function handleControllingReload(): void {
  if (canSafelyReload()) {
    executeReload();
  } else {
    triggerDeferredReloadSubscription();
  }
}

/**
 * Initializes Service Worker registration via vite-plugin-pwa.
 *
 * Uses registerType: 'prompt' mode (configured in vite.config.ts).
 * The virtual:pwa-register module is loaded at runtime; in environments
 * where it is unavailable (e.g. Vitest), the import is gracefully bypassed.
 */
export function initServiceWorker(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve();
  }

  // Guard against duplicate registration in dev (React StrictMode mounts effects twice synchronously)
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const { registerSW } = await import('virtual:pwa-register');

      updateSWFunction = registerSW({
        immediate: true,
        onNeedRefresh() {
          usePwaStore.getState().setNeedRefresh(true);
        },
        onOfflineReady() {
          usePwaStore.getState().setOfflineReady(true);
        },
        onNeedReload() {
          handleControllingReload();
        },
        onRegisteredSW(_swUrl: string, registration?: ServiceWorkerRegistration) {
          if (registration) {
            if (updateIntervalId) {
              clearInterval(updateIntervalId);
            }
            // Check for service worker updates periodically if online (hourly)
            updateIntervalId = setInterval(() => {
              if (typeof navigator !== 'undefined' && navigator.onLine) {
                registration.update().catch(console.error);
              }
            }, 60 * 60 * 1000);
          }
        },
        onRegisterError(error: unknown) {
          console.error('[PWA] Service Worker registration error:', error);
        }
      });
    } catch {
      // In Vitest or non-Vite bundled environments, virtual:pwa-register is safely bypassed
    }
  })();

  return initPromise;
}

/**
 * Invokes the Service Worker update reload.
 * Called by PwaUpdateToast when the cashier taps "Reload & Update".
 */
export async function reloadAppForUpdate(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if (isReloading) {
    return;
  }
  isReloading = true;

  // 1. Listen for controllerchange: when the new service worker activates and claims the page,
  // reload immediately so the page fetches from the new service worker.
  let controllerChangeFired = false;
  if ('serviceWorker' in navigator && typeof navigator.serviceWorker.addEventListener === 'function') {
    try {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        controllerChangeFired = true;
        handleControllingReload();
      }, { once: true });
    } catch {
      // ignore
    }
  }

  // 2. Instruct waiting worker to skip waiting via updateSWFunction (bounded by timeout)
  if (updateSWFunction) {
    try {
      await Promise.race([
        updateSWFunction(true),
        new Promise((resolve) => setTimeout(resolve, 300))
      ]);
    } catch (error) {
      console.error('[PWA] Service worker update failed, falling back to browser reload:', error);
    }
  }

  // 3. Directly post SKIP_WAITING to all registrations and waiting service workers (bounded by timeout)
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const fetchRegs = async (): Promise<readonly ServiceWorkerRegistration[]> => {
        if (typeof navigator.serviceWorker.getRegistrations === 'function') {
          return await navigator.serviceWorker.getRegistrations();
        }
        if (typeof navigator.serviceWorker.getRegistration === 'function') {
          const reg = await navigator.serviceWorker.getRegistration();
          return reg ? [reg] : [];
        }
        return [];
      };

      const registrations = await Promise.race([
        fetchRegs(),
        new Promise<readonly ServiceWorkerRegistration[]>((resolve) => setTimeout(() => resolve([]), 300))
      ]);

      for (const reg of registrations) {
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }
    } catch (error) {
      console.error('[PWA] Failed to message waiting service worker:', error);
    }
  }

  // 4. If controllerchange already fired or serviceWorker event listeners are unavailable, reload directly.
  // Otherwise, allow a window (1000ms) for controllerchange to trigger executeReload before fallback.
  if (controllerChangeFired || !('serviceWorker' in navigator) || typeof navigator.serviceWorker.addEventListener !== 'function') {
    handleControllingReload();
  } else {
    fallbackReloadTimer = setTimeout(() => {
      fallbackReloadTimer = null;
      handleControllingReload();
    }, 1000);
  }

  // 5. Hard navigation fallback: force assign location href if reload calls were ignored
  fallbackHardNavTimer = setTimeout(() => {
    fallbackHardNavTimer = null;
    try {
      if (canSafelyReload() && typeof window !== 'undefined' && typeof window.location?.assign === 'function') {
        window.location.assign(window.location.href);
      }
    } catch {
      // ignore
    } finally {
      isReloading = false;
    }
  }, 1200);
}

/**
 * Resets internal update function reference, init promise, and interval for test isolation.
 * @internal
 */
export function _resetUpdateSWFunctionForTest(): void {
  updateSWFunction = null;
  initPromise = null;
  isReloading = false;
  reloadExecuted = false;
  if (updateIntervalId) {
    clearInterval(updateIntervalId);
    updateIntervalId = null;
  }
  if (fallbackReloadTimer) {
    clearTimeout(fallbackReloadTimer);
    fallbackReloadTimer = null;
  }
  if (fallbackHardNavTimer) {
    clearTimeout(fallbackHardNavTimer);
    fallbackHardNavTimer = null;
  }
  if (deferredReloadTimer) {
    clearTimeout(deferredReloadTimer);
    deferredReloadTimer = null;
  }
  if (deferredReloadUnsubscribe) {
    deferredReloadUnsubscribe();
    deferredReloadUnsubscribe = null;
  }
  usePwaStore.getState().setIsSaleInProgress(false);
  usePwaStore.getState().setHasActiveReceipt(false);
}

/**
 * Returns whether deferred reload subscription is currently active.
 * @internal
 */
export function _isReloadDeferredForTest(): boolean {
  return Boolean(deferredReloadUnsubscribe);
}

/**
 * Returns the current periodic update interval ID (if any).
 * @internal
 */
export function _getUpdateIntervalIdForTest(): ReturnType<typeof setInterval> | null {
  return updateIntervalId;
}
