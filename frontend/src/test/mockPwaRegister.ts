/**
 * Test mock for VitePWA virtual:pwa-register module.
 */
export interface RegisterSWOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
  onRegisteredSW?: (swScriptUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: unknown) => void;
}

export function registerSW(_options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void> {
  return async (_reloadPage?: boolean) => {};
}
