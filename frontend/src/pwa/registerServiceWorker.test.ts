import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initServiceWorker,
  reloadAppForUpdate,
  _resetUpdateSWFunctionForTest,
  _getUpdateIntervalIdForTest,
  _isReloadDeferredForTest
} from './registerServiceWorker';
import { usePwaStore } from '../state/pwaStore';
import { useCartStore } from '../state/cartStore';
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
    vi.useRealTimers();
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

  it('does not reload page via onNeedReload when active cart has items', async () => {
    const originalLocation = window.location;
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      configurable: true,
      writable: true
    });

    useCartStore.getState().addItem({ id: 'p1', name: 'Open Sale Item', price: 50 });

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn() },
      configurable: true,
      writable: true
    });

    await initServiceWorker();

    const options = (registerSW as any).mock.calls[0][0];
    expect(options.onNeedReload).toBeDefined();

    options.onNeedReload();

    expect(reloadMock).not.toHaveBeenCalled();
    expect(_isReloadDeferredForTest()).toBe(true);
    expect(usePwaStore.getState().needRefresh).toBe(false);

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true
    });
  });

  it('reloads automatically after an active cart is cleared via deferred reload', async () => {
    vi.useFakeTimers();
    const originalLocation = window.location;
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      configurable: true,
      writable: true
    });

    useCartStore.getState().addItem({ id: 'p1', name: 'Open Sale Item', price: 50 });

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn() },
      configurable: true,
      writable: true
    });

    await initServiceWorker();

    const options = (registerSW as any).mock.calls[0][0];
    options.onNeedReload();

    // Not reloaded while items are present
    expect(reloadMock).not.toHaveBeenCalled();
    expect(_isReloadDeferredForTest()).toBe(true);

    // Cart is cleared without active sale
    useCartStore.getState().clearCart();

    expect(reloadMock).not.toHaveBeenCalled();

    // Debounce advances 500ms
    vi.advanceTimersByTime(500);

    expect(reloadMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true
    });
    vi.useRealTimers();
  });

  it('does not reload automatically while an update is available during a sale, but reloads once finished', async () => {
    vi.useFakeTimers();
    const originalLocation = window.location;
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      configurable: true,
      writable: true
    });

    useCartStore.getState().addItem({ id: 'p1', name: 'Open Sale Item', price: 50 });

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn() },
      configurable: true,
      writable: true
    });

    await initServiceWorker();

    const options = (registerSW as any).mock.calls[0][0];
    options.onNeedReload();

    // Sale begins: transaction is active and receipt modal is displayed
    usePwaStore.getState().setIsSaleInProgress(true);
    usePwaStore.getState().setHasActiveReceipt(true);
    useCartStore.getState().clearCart();

    // Even though cart was cleared, reload must NOT fire while receipt is active
    expect(reloadMock).not.toHaveBeenCalled();

    // Dexie write completes, sale is no longer writing
    usePwaStore.getState().setIsSaleInProgress(false);
    expect(reloadMock).not.toHaveBeenCalled();

    // Cashier dismisses receipt modal
    usePwaStore.getState().setHasActiveReceipt(false);
    expect(reloadMock).not.toHaveBeenCalled();

    // Debounce timer completes
    vi.advanceTimersByTime(500);

    expect(reloadMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true
    });
    vi.useRealTimers();
  });

  it('reloads page via onNeedReload when cart is empty and no sale in progress', async () => {
    const originalLocation = window.location;
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      configurable: true,
      writable: true
    });

    useCartStore.getState().clearCart();

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn() },
      configurable: true,
      writable: true
    });

    await initServiceWorker();

    const options = (registerSW as any).mock.calls[0][0];
    options.onNeedReload();

    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(usePwaStore.getState().needRefresh).toBe(false);

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true
    });
  });

  it('calls updateSW(true) and reloads page when reloadAppForUpdate is executed', async () => {
    const originalLocation = window.location;
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      configurable: true,
      writable: true
    });

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
    expect(reloadMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true
    });
  });

  it('posts SKIP_WAITING to registration.waiting when waiting worker exists', async () => {
    const originalLocation = window.location;
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      configurable: true,
      writable: true
    });

    const postMessageMock = vi.fn();
    const mockRegistration = {
      waiting: {
        postMessage: postMessageMock
      }
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn(),
        getRegistration: vi.fn().mockResolvedValue(mockRegistration)
      },
      configurable: true,
      writable: true
    });

    await reloadAppForUpdate();

    expect(postMessageMock).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reloadMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true
    });
  });

  it('falls back to window.location.reload when the service worker update rejects', async () => {
    const originalLocation = window.location;
    const reloadMock = vi.fn();
    const mockUpdate = vi.fn().mockRejectedValue(new Error('SW update failed'));
    vi.mocked(registerSW).mockReturnValue(mockUpdate);

    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      configurable: true,
      writable: true
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn() },
      configurable: true,
      writable: true
    });

    await initServiceWorker();
    await reloadAppForUpdate();

    expect(mockUpdate).toHaveBeenCalledWith(true);
    expect(reloadMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true
    });
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

  it('clears needRefresh state immediately when reloadAppForUpdate is executed', async () => {
    const originalLocation = window.location;
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      configurable: true,
      writable: true
    });

    usePwaStore.setState({ needRefresh: true });
    expect(usePwaStore.getState().needRefresh).toBe(true);

    _resetUpdateSWFunctionForTest();
    await reloadAppForUpdate();

    expect(usePwaStore.getState().needRefresh).toBe(false);
    expect(reloadMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true
    });
  });

  it('messages all waiting workers returned by getRegistrations', async () => {
    const originalLocation = window.location;
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      configurable: true,
      writable: true
    });

    const postMessageMock1 = vi.fn();
    const postMessageMock2 = vi.fn();
    const mockRegs = [
      { waiting: { postMessage: postMessageMock1 } },
      { waiting: null },
      { waiting: { postMessage: postMessageMock2 } }
    ];

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn(),
        getRegistrations: vi.fn().mockResolvedValue(mockRegs)
      },
      configurable: true,
      writable: true
    });

    _resetUpdateSWFunctionForTest();
    await reloadAppForUpdate();

    expect(postMessageMock1).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(postMessageMock2).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reloadMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true
    });
  });

  it('registers a controllerchange event listener on navigator.serviceWorker', async () => {
    const originalLocation = window.location;
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      configurable: true,
      writable: true
    });

    const addEventListenerMock = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn(),
        addEventListener: addEventListenerMock
      },
      configurable: true,
      writable: true
    });

    _resetUpdateSWFunctionForTest();
    await reloadAppForUpdate();

    expect(addEventListenerMock).toHaveBeenCalledWith('controllerchange', expect.any(Function), { once: true });

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true
    });
  });

  it('triggers executeReload when controllerchange event fires', async () => {
    const originalLocation = window.location;
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      configurable: true,
      writable: true
    });

    let controllerChangeCallback: (() => void) | undefined;
    const addEventListenerMock = vi.fn((event: string, cb: () => void) => {
      if (event === 'controllerchange') {
        controllerChangeCallback = cb;
      }
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn(),
        addEventListener: addEventListenerMock
      },
      configurable: true,
      writable: true
    });

    _resetUpdateSWFunctionForTest();
    await reloadAppForUpdate();

    expect(reloadMock).not.toHaveBeenCalled();

    // Trigger controllerchange from activating SW
    controllerChangeCallback?.();

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

  it('prevents concurrent duplicate registration in React StrictMode when called twice without awaiting', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      },
      configurable: true,
      writable: true
    });

    const p1 = initServiceWorker();
    const p2 = initServiceWorker();

    await Promise.all([p1, p2]);

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

  it('triggers hard navigation fallback with window.location.assign after 1200ms timeout', async () => {
    vi.useFakeTimers();
    const originalLocation = window.location;
    const reloadMock = vi.fn();
    const assignMock = vi.fn();

    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock, assign: assignMock, href: 'http://localhost:5173/' },
      configurable: true,
      writable: true
    });

    _resetUpdateSWFunctionForTest();
    await reloadAppForUpdate();

    expect(assignMock).not.toHaveBeenCalled();

    // Advance 1200ms to trigger the hard navigation fallback
    vi.advanceTimersByTime(1200);

    expect(assignMock).toHaveBeenCalledWith('http://localhost:5173/');

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true
    });
    vi.useRealTimers();
  });
});
