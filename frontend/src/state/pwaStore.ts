import { create } from 'zustand';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface PwaState {
  isStandalone: boolean;
  isInstalled: boolean;
  isInstallable: boolean;
  isIos: boolean;
  isDismissed: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
  needRefresh: boolean;
  offlineReady: boolean;
  otherTabsHaveCart: boolean;
  reloadDeferred: boolean;

  setDeferredPrompt: (e: BeforeInstallPromptEvent | null) => void;
  promptInstall: () => Promise<boolean>;
  dismissPrompt: () => void;
  setNeedRefresh: (need: boolean) => void;
  setOfflineReady: (ready: boolean) => void;
  setOtherTabsHaveCart: (have: boolean) => void;
  setReloadDeferred: (deferred: boolean) => void;
  checkEnvironment: () => void;
}

export function detectIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const isMatchMediaStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isNavigatorStandalone = Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
  const isAndroidApp = typeof document !== 'undefined' && document.referrer.includes('android-app://');
  return isMatchMediaStandalone || isNavigatorStandalone || isAndroidApp;
}

export function detectIsIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIosDevice = /iPad|iPhone|iPod/.test(ua);
  const isIpadOs = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
  return isIosDevice || isIpadOs;
}

const STORAGE_DISMISSED_KEY = 'fluent_tindahan_pwa_install_dismissed';

export const usePwaStore = create<PwaState>((set, get) => ({
  isStandalone: detectIsStandalone(),
  isInstalled: false,
  isInstallable: false,
  isIos: detectIsIos() && !detectIsStandalone(),
  isDismissed: typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_DISMISSED_KEY) === 'true',
  deferredPrompt: null,
  needRefresh: false,
  offlineReady: false,
  otherTabsHaveCart: false,
  reloadDeferred: false,

  setDeferredPrompt: (prompt) => {
    set({
      deferredPrompt: prompt,
      isInstallable: Boolean(prompt) && !get().isStandalone && !get().isInstalled
    });
  },

  promptInstall: async () => {
    const prompt = get().deferredPrompt;
    if (!prompt) return false;

    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') {
        set({
          isInstallable: false,
          deferredPrompt: null,
          isInstalled: true
        });
        return true;
      } else {
        get().dismissPrompt();
        set({
          isInstallable: false,
          deferredPrompt: null
        });
        return false;
      }
    } catch (err) {
      console.error('Error during PWA installation prompt:', err);
      set({
        isInstallable: false,
        deferredPrompt: null
      });
      return false;
    }
  },

  dismissPrompt: () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_DISMISSED_KEY, 'true');
    }
    set({ isDismissed: true });
  },

  setNeedRefresh: (need) => set({ needRefresh: need }),
  setOfflineReady: (ready) => set({ offlineReady: ready }),
  setOtherTabsHaveCart: (have) => set({ otherTabsHaveCart: have }),
  setReloadDeferred: (deferred) => set({ reloadDeferred: deferred }),

  checkEnvironment: () => {
    const standalone = detectIsStandalone();
    const ios = detectIsIos() && !standalone;
    set({
      isStandalone: standalone,
      isIos: ios,
      isInstallable: Boolean(get().deferredPrompt) && !standalone && !get().isInstalled
    });
  }
}));

/**
 * Initializes global PWA install event listeners.
 * Safe to call on window mount in main or App.
 */
export function initPwaListeners(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleBeforeInstallPrompt = (e: Event) => {
    e.preventDefault();
    usePwaStore.getState().setDeferredPrompt(e as BeforeInstallPromptEvent);
  };

  const handleAppInstalled = () => {
    usePwaStore.setState({
      isInstalled: true,
      isInstallable: false,
      deferredPrompt: null
    });
    console.log('[PWA] Fluent Tindahan installed successfully!');
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);

  // Check display-mode changes (e.g. user opens in PWA window)
  const mediaQuery = window.matchMedia('(display-mode: standalone)');
  const handleDisplayModeChange = () => {
    usePwaStore.getState().checkEnvironment();
  };
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleDisplayModeChange);
  }

  return () => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener('appinstalled', handleAppInstalled);
    if (mediaQuery.removeEventListener) {
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
    }
  };
}
