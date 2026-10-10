import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initServiceWorker, reloadAppForUpdate, _resetUpdateSWFunctionForTest, _getUpdateIntervalIdForTest } from './registerServiceWorker';
import { usePwaStore } from '../state/pwaStore';
import { registerSW } from 'virtual:pwa-register';

describe('registerServiceWorker', () => {
  const originalServiceWorker = navigator.serviceWorker;

  beforeEach(() => {
    _resetUpdateSWFunctionForTest();
    usePwaStore.setState({
      needRefresh: false,
      offlineReady: false
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalServiceWorker) {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: originalServiceWorker,
        configurable: true,
        writable: true
      });
    } else {
      delete (navigator as any).serviceWorker;
    }
  });

  it('bypasses registration if serviceWorker is not supported in navigator', async () => {
    delete (navigator as any).serviceWorker;

    await initServiceWorker();

    expect(registerSW).not.toHaveBeenCalled();
  });

  it('registers service worker with prompt options when serviceWorker is available', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      },
      configurable: true,
      writable: true
    });

    await initServiceWorker();

    expect(registerSW).toHaveBeenCalledTimes(1);
    expect(registerSW).toHaveBeenCalledWith(
      expect.objectContaining({
        immediate: true,
        onNeedRefresh: expect.any(Function),
        onOfflineReady: expect.any(Function),
        onRegisterError: expect.any(Function)
      })
    );
  });

  it('sets needRefresh to true when onNeedRefresh callback is triggered', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn() },
      configurable: true,
      writable: true
    });

    await initServiceWorker();

    const options = (registerSW as any).mock.calls[0][0];
    expect(usePwaStore.getState().needRefresh).toBe(false);

    options.onNeedRefresh();
    expect(usePwaStore.getState().needRefresh).toBe(true);
  });

  it('sets offlineReady to true when onOfflineReady callback is triggered', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn() },
      configurable: true,
      writable: true
    });

    await initServiceWorker();

    const options = (registerSW as any).mock.calls[0][0];
    expect(usePwaStore.getState().offlineReady).toBe(false);

    options.onOfflineReady();
    expect(usePwaStore.getState().offlineReady).toBe(true);
  });

  it('logs registration errors via onRegisterError callback', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn() },
      configurable: true,
      writable: true
    });

    await initServiceWorker();

    const options = (registerSW as any).mock.calls[0][0];
    const testError = new Error('Test SW error');
    options.onRegisterError(testError);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[PWA] Service Worker registration error:',
      testError
    );

    consoleSpy.mockRestore();
  });

  it('calls updateSW(true) when reloadAppForUpdate is executed', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    vi.mocked(registerSW).mockReturnValue(mockUpdate);

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn() },
      configurable: true,
      writable: true
    });

    await initServiceWorker();

    await reloadAppForUpdate();

    expect(mockUpdate).toHaveBeenCalledWith(true);
  });

  it('falls back to window.location.reload when updateSW is not initialized', async () => {
    const originalLocation = window.location;
    const reloadMock = vi.fn();

    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      configurable: true,
      writable: true
    });

    _resetUpdateSWFunctionForTest();
    await reloadAppForUpdate();

    expect(reloadMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true
    });
  });

  it('guards against duplicate registration when initServiceWorker is called multiple times', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      },
      configurable: true,
      writable: true
    });

    await initServiceWorker();
    expect(registerSW).toHaveBeenCalledTimes(1);

    await initServiceWorker();
    expect(registerSW).toHaveBeenCalledTimes(1);
  });

  it('registers periodic check interval and cleans it up via _resetUpdateSWFunctionForTest', async () => {
    vi.useFakeTimers();
    const updateSpy = vi.fn().mockResolvedValue(undefined);
    const mockRegistration = {
      update: updateSpy
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn() },
      configurable: true,
      writable: true
    });
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true
    });

    await initServiceWorker();

    const options = (registerSW as any).mock.calls[0][0];
    expect(options.onRegisteredSW).toBeDefined();

    options.onRegisteredSW('/sw.js', mockRegistration);
    expect(_getUpdateIntervalIdForTest()).not.toBeNull();

    // Advance 1 hour
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(updateSpy).toHaveBeenCalledTimes(1);

    _resetUpdateSWFunctionForTest();
    expect(_getUpdateIntervalIdForTest()).toBeNull();
    vi.useRealTimers();
  });
});
