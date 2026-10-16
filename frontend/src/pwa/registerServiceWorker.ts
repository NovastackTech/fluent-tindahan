import { usePwaStore } from '../state/pwaStore';

let updateSWFunction: ((reloadPage?: boolean) => Promise<void>) | null = null;
let updateIntervalId: ReturnType<typeof setInterval> | null = null;
let initPromise: Promise<void> | null = null;
let isReloading = false;

function executeReload(): void {
  if (typeof window === 'undefined') return;
  usePwaStore.getState().setNeedRefresh(false);
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
          usePwaStore.getState().setNeedRefresh(true);
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

  // Clear banner state immediately so it does not linger
  usePwaStore.getState().setNeedRefresh(false);

  // 1. Listen for controllerchange: if the service worker updates and takes control,
  // reload immediately so the page fetches from the new service worker.
  if ('serviceWorker' in navigator && typeof navigator.serviceWorker.addEventListener === 'function') {
    try {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        executeReload();
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

  // 4. Guaranteed execution: trigger reload directly
  executeReload();

  // 5. Fallback timer: in case the first reload was queued or ignored by the browser
  setTimeout(() => {
    executeReload();
  }, 500);

  // 6. Hard navigation fallback: force assign location href if reload calls were ignored
  setTimeout(() => {
    try {
      if (typeof window !== 'undefined' && typeof window.location?.assign === 'function') {
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
  if (updateIntervalId) {
    clearInterval(updateIntervalId);
    updateIntervalId = null;
  }
  usePwaStore.getState().setIsSaleInProgress(false);
  usePwaStore.getState().setHasActiveReceipt(false);
}

/**
 * Returns the current periodic update interval ID (if any).
 * @internal
 */
export function _getUpdateIntervalIdForTest(): ReturnType<typeof setInterval> | null {
  return updateIntervalId;
}
