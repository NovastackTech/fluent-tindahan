import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePwaStore, initPwaListeners, detectIsStandalone, detectIsIos, type BeforeInstallPromptEvent } from './pwaStore';

describe('pwaStore', () => {
  beforeEach(() => {
    localStorage.clear();
    usePwaStore.setState({
      isStandalone: false,
      isInstalled: false,
      isInstallable: false,
      isIos: false,
      isDismissed: false,
      deferredPrompt: null,
      needRefresh: false,
      offlineReady: false,
      otherTabsHaveCart: false,
      reloadDeferred: false,
      isSaleInProgress: false,
      hasActiveReceipt: false
    });
  });

  it('detects standalone mode correctly', () => {
    expect(detectIsStandalone()).toBe(false);

    // Mock matchMedia standalone
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('display-mode: standalone'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(detectIsStandalone()).toBe(true);
    window.matchMedia = originalMatchMedia;
  });

  it('detects iOS devices correctly', () => {
    const originalUA = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      configurable: true
    });

    expect(detectIsIos()).toBe(true);

    Object.defineProperty(navigator, 'userAgent', {
      value: originalUA,
      configurable: true
    });
  });

  it('sets deferredPrompt and updates isInstallable', () => {
    const mockPrompt = {
      platforms: ['web'],
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
      prompt: vi.fn().mockResolvedValue(undefined)
    } as unknown as BeforeInstallPromptEvent;

    usePwaStore.getState().setDeferredPrompt(mockPrompt);

    const state = usePwaStore.getState();
    expect(state.isInstallable).toBe(true);
    expect(state.deferredPrompt).toBe(mockPrompt);
  });

  it('handles promptInstall accepting installation', async () => {
    const promptFn = vi.fn().mockResolvedValue(undefined);
    const mockPrompt = {
      platforms: ['web'],
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
      prompt: promptFn
    } as unknown as BeforeInstallPromptEvent;

    usePwaStore.getState().setDeferredPrompt(mockPrompt);

    const result = await usePwaStore.getState().promptInstall();
    expect(promptFn).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);

    const state = usePwaStore.getState();
    expect(state.isStandalone).toBe(false);
    expect(state.isInstalled).toBe(true);
    expect(state.isInstallable).toBe(false);
    expect(state.deferredPrompt).toBeNull();
  });

  it('handles promptInstall dismissing installation', async () => {
    const promptFn = vi.fn().mockResolvedValue(undefined);
    const mockPrompt = {
      platforms: ['web'],
      userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' }),
      prompt: promptFn
    } as unknown as BeforeInstallPromptEvent;

    usePwaStore.getState().setDeferredPrompt(mockPrompt);

    const result = await usePwaStore.getState().promptInstall();
    expect(promptFn).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);

    const state = usePwaStore.getState();
    expect(state.isDismissed).toBe(true);
    expect(state.isInstallable).toBe(false);
    expect(state.deferredPrompt).toBeNull();
    expect(state.isStandalone).toBe(false);
    expect(localStorage.getItem('fluent_tindahan_pwa_install_dismissed')).toBe('true');
  });

  it('handles promptInstall error by clearing deferredPrompt and setting isInstallable to false', async () => {
    const promptFn = vi.fn().mockRejectedValue(new Error('Prompt error'));
    const mockPrompt = {
      platforms: ['web'],
      userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' }),
      prompt: promptFn
    } as unknown as BeforeInstallPromptEvent;

    usePwaStore.getState().setDeferredPrompt(mockPrompt);

    const result = await usePwaStore.getState().promptInstall();
    expect(result).toBe(false);

    const state = usePwaStore.getState();
    expect(state.isInstallable).toBe(false);
    expect(state.deferredPrompt).toBeNull();
  });

  it('dismissPrompt marks dismissed in state and localStorage', () => {
    usePwaStore.getState().dismissPrompt();

    expect(usePwaStore.getState().isDismissed).toBe(true);
    expect(localStorage.getItem('fluent_tindahan_pwa_install_dismissed')).toBe('true');
  });

  it('initPwaListeners attaches window event handlers and unregisters cleanly', () => {
    const cleanup = initPwaListeners();

    const mockPrompt = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
    Object.defineProperty(mockPrompt, 'preventDefault', { value: vi.fn() });
    window.dispatchEvent(mockPrompt);

    expect(usePwaStore.getState().isInstallable).toBe(true);

    window.dispatchEvent(new Event('appinstalled'));
    expect(usePwaStore.getState().isInstalled).toBe(true);
    expect(usePwaStore.getState().isStandalone).toBe(false);
    expect(usePwaStore.getState().isInstallable).toBe(false);

    cleanup();
  });
});
