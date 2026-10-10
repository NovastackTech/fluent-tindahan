import { usePwaStore } from '../state/pwaStore';

let updateSWFunction: ((reloadPage?: boolean) => Promise<void>) | null = null;

/**
 * Initializes Service Worker registration via vite-plugin-pwa.
 * Gracefully handles environments where service workers or virtual modules are unsupported.
 */
export async function initServiceWorker(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

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
      onRegisteredSW(_swUrl: string, registration?: ServiceWorkerRegistration) {
        if (registration) {
          // Check for service worker updates periodically if online
          setInterval(() => {
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
}

/**
 * Invokes the Service Worker update reload.
 */
export async function reloadAppForUpdate(): Promise<void> {
  if (updateSWFunction) {
    await updateSWFunction(true);
  } else if (typeof window !== 'undefined') {
    window.location.reload();
  }
}
