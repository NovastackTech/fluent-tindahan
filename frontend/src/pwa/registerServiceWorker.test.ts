import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initServiceWorker,
  reloadAppForUpdate,
  notifySaleFinished,
  _resetUpdateSWFunctionForTest,
  _getUpdateIntervalIdForTest
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
    expect(usePwaStore.getState().reloadDeferred).toBe(true);

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true
    });
  });

  it('defers reload when cart has items, then reloads automatically after debounce when cart is cleared', async () => {
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
    expect(usePwaStore.getState().reloadDeferred).toBe(true);

    // Cart is cleared without active sale
    useCartStore.getState().clearCart();

    // Debounce is in flight (500ms), not reloaded synchronously
    expect(reloadMock).not.toHaveBeenCalled();

    // Advance 500ms
    vi.advanceTimersByTime(500);

    // Now reload is safely triggered!
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(usePwaStore.getState().reloadDeferred).toBe(false);

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true
    });
    vi.useRealTimers();
  });

  it('does not reload while isSaleInProgress or hasActiveReceipt is true, and reloads only after notifySaleFinished', async () => {
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
    expect(usePwaStore.getState().reloadDeferred).toBe(true);

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
    notifySaleFinished();

    // Now reload is safely triggered
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(usePwaStore.getState().reloadDeferred).toBe(false);

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true
    });
  });

  it('reloads page via onNeedReload when cart is empty', async () => {
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

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true
    });
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
});
