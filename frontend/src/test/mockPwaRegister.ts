/**
 * Test mock for VitePWA virtual:pwa-register module.
 *
 * In production, this module is provided by vite-plugin-pwa at build time.
 * The registerType: 'prompt' config means registerSW does NOT auto-update;
 * it calls onNeedRefresh when a new SW is waiting, and updateSW(true) triggers
 * skipWaiting + reload only when the user explicitly confirms.
 */
import { vi } from 'vitest';

export interface RegisterSWOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onNeedReload?: () => void;
  onRegisteredSW?: (swScriptUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: unknown) => void;
}

/** Captured options from the most recent registerSW call (for test assertions). */
export const lastRegisterSWOptions: RegisterSWOptions = {};

export const mockUpdateSW = vi.fn().mockResolvedValue(undefined);
export const updateSW = mockUpdateSW;

export const registerSW = vi.fn((options?: RegisterSWOptions): ((reloadPage?: boolean) => Promise<void>) => {
  if (options) {
    Object.assign(lastRegisterSWOptions, options);
  }
  return mockUpdateSW;
});

