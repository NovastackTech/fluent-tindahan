import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App, PRELOAD_ERROR_STORAGE_KEY } from './App';
import { usePwaStore } from './state/pwaStore';
import { useCartStore } from './state/cartStore';
import { useAuthStore } from './state/authStore';
import { _resetUpdateSWFunctionForTest } from './pwa/registerServiceWorker';
import { _resetPwaTabCoordinatorForTest } from './pwa/pwaTabCoordinator';

describe('App', () => {
  const originalLocation = window.location;
  let reloadMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    useAuthStore.getState().setConsentAccepted(true);
    useCartStore.getState().clearCart();
    _resetUpdateSWFunctionForTest();
    _resetPwaTabCoordinatorForTest();

    reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        href: 'http://localhost:5173/',
        pathname: '/',
        search: '',
        reload: reloadMock
      },
      configurable: true,
      writable: true
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true
    });
  });

  it('keeps in-app navigation and does not reload page when changing tabs even if reloadDeferred is true', async () => {
    useCartStore.getState().addItem({ id: 'p1', name: 'Open Sale Item', price: 25 });
    usePwaStore.getState().setReloadDeferred(true);

    render(<App />);

    // Click Inventory item in Navigation
    const inventoryBtn = screen.getByRole('button', { name: /Imbentaryo|Inventory/i });
    fireEvent.click(inventoryBtn);

    // Page must NOT have reloaded!
    expect(reloadMock).not.toHaveBeenCalled();
    // Cart is still intact
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].name).toBe('Open Sale Item');
  });

  describe('vite:preloadError handling', () => {
    it('prevents default and reloads when cart is empty and not in cooldown', () => {
      render(<App />);

      const event = new Event('vite:preloadError', { cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(reloadMock).toHaveBeenCalledTimes(1);
      expect(sessionStorage.getItem(PRELOAD_ERROR_STORAGE_KEY)).toBeTruthy();
    });

    it('prevents infinite reload loops when error occurs within cooldown window', () => {
      // Set timestamp within cooldown period
      const recentTs = Date.now() - 5000;
      sessionStorage.setItem(PRELOAD_ERROR_STORAGE_KEY, String(recentTs));

      render(<App />);

      const event = new Event('vite:preloadError', { cancelable: true });
      window.dispatchEvent(event);

      // Must not reload because cooldown is active
      expect(reloadMock).not.toHaveBeenCalled();
    });

    it('defers reload and does not immediately reload if cart has active items', () => {
      useCartStore.getState().addItem({ id: 'p1', name: 'Active Sale Product', price: 99 });

      render(<App />);

      const event = new Event('vite:preloadError', { cancelable: true });
      window.dispatchEvent(event);

      // Must NOT reload immediately because sale is open
      expect(reloadMock).not.toHaveBeenCalled();
      // Must have deferred the reload
      expect(usePwaStore.getState().reloadDeferred).toBe(true);
    });
  });
});
