import { usePwaStore } from '../state/pwaStore';
import { useCartStore } from '../state/cartStore';

let updateSWFunction: ((reloadPage?: boolean) => Promise<void>) | null = null;
let updateIntervalId: ReturnType<typeof setInterval> | null = null;
let initPromise: Promise<void> | null = null;
let deferredReloadUnsubscribe: (() => void) | null = null;
let deferredReloadTimer: ReturnType<typeof setTimeout> | null = null;

function executeReload(): void {
  if (deferredReloadTimer) {
    clearTimeout(deferredReloadTimer);
    deferredReloadTimer = null;
  }
  if (deferredReloadUnsubscribe) {
    deferredReloadUnsubscribe();
    deferredReloadUnsubscribe = null;
  }
  usePwaStore.getState().setReloadDeferred(false);
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

/**
 * Notifies the PWA coordinator that a sale has completed and the receipt is dismissed.
 * If an update reload was deferred, triggers the reload once the active sale lifecycle is finished.
 */
export function notifySaleFinished(): void {
  const pwaState = usePwaStore.getState();
  const cartState = useCartStore.getState();
  if (
    pwaState.reloadDeferred &&
    cartState.items.length === 0 &&
    !pwaState.isSaleInProgress &&
    !pwaState.hasActiveReceipt
  ) {
    executeReload();
  }
}

/**
 * Defers reload until the active transaction is finished (sale written to Dexie,
 * receipt dismissed, and cart empty).
 */
export function triggerDeferredReloadSubscription(): void {
  usePwaStore.getState().setReloadDeferred(true);

  if (!deferredReloadUnsubscribe) {
    deferredReloadUnsubscribe = useCartStore.subscribe((state) => {
      if (state.items.length === 0) {
        const pwaState = usePwaStore.getState();
        // If a sale write is currently resolving or receipt modal is visible,
        // do not reload yet; wait for explicit notifySaleFinished() once receipt is dismissed.
        if (pwaState.isSaleInProgress || pwaState.hasActiveReceipt) {
          return;
        }

        // Defer with setTimeout + re-check rather than reloading synchronously on any empty-cart transition.
        if (deferredReloadTimer) {
          clearTimeout(deferredReloadTimer);
        }
        deferredReloadTimer = setTimeout(() => {
          deferredReloadTimer = null;
          const currentPwa = usePwaStore.getState();
          const currentCart = useCartStore.getState();
          if (
            currentPwa.reloadDeferred &&
            currentCart.items.length === 0 &&
            !currentPwa.isSaleInProgress &&
            !currentPwa.hasActiveReceipt
          ) {
            executeReload();
          }
        }, 500);
      }
    });
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
          const hasLocalCart = useCartStore.getState().items.length > 0;
          const pwaState = usePwaStore.getState();
          if (hasLocalCart || pwaState.isSaleInProgress || pwaState.hasActiveReceipt) {
            console.warn('[PWA] Service Worker update active, but reload deferred until current transaction is completed.');
            triggerDeferredReloadSubscription();
            return;
          }
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
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
  if (updateSWFunction) {
    await updateSWFunction(true);
  } else if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

/**
 * Resets internal update function reference, init promise, and interval for test isolation.
 * @internal
 */
export function _resetUpdateSWFunctionForTest(): void {
  updateSWFunction = null;
  initPromise = null;
  if (updateIntervalId) {
    clearInterval(updateIntervalId);
    updateIntervalId = null;
  }
  if (deferredReloadTimer) {
    clearTimeout(deferredReloadTimer);
    deferredReloadTimer = null;
  }
  if (deferredReloadUnsubscribe) {
    deferredReloadUnsubscribe();
    deferredReloadUnsubscribe = null;
  }
  usePwaStore.getState().setReloadDeferred(false);
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
