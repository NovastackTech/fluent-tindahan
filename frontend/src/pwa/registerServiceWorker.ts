import { usePwaStore } from '../state/pwaStore';
import { useCartStore } from '../state/cartStore';

let updateSWFunction: ((reloadPage?: boolean) => Promise<void>) | null = null;
let updateIntervalId: ReturnType<typeof setInterval> | null = null;
let initPromise: Promise<void> | null = null;
let deferredReloadUnsubscribe: (() => void) | null = null;

/**
 * Defers reload until the active cart is empty (e.g. sale completes or is cleared).
 * Once items.length === 0, immediately triggers window.location.reload()
 * so the page doesn't continue running old JS that could 404 on evicted lazy chunks.
 */
export function triggerDeferredReloadSubscription(): void {
  usePwaStore.getState().setReloadDeferred(true);

  if (!deferredReloadUnsubscribe) {
    deferredReloadUnsubscribe = useCartStore.subscribe((state) => {
      if (state.items.length === 0) {
        if (deferredReloadUnsubscribe) {
          deferredReloadUnsubscribe();
          deferredReloadUnsubscribe = null;
        }
        usePwaStore.getState().setReloadDeferred(false);
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
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
          if (hasLocalCart) {
            console.warn('[PWA] Service Worker update active, but reload deferred until current cart is completed.');
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
  if (deferredReloadUnsubscribe) {
    deferredReloadUnsubscribe();
    deferredReloadUnsubscribe = null;
  }
  usePwaStore.getState().setReloadDeferred(false);
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
