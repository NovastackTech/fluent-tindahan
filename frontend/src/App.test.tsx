import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from './App';
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

  it('keeps in-app navigation and does not reload while an update is available', async () => {
    useCartStore.getState().addItem({ id: 'p1', name: 'Open Sale Item', price: 25 });
    usePwaStore.getState().setNeedRefresh(true);

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
    it('prevents default and presents an update prompt without reloading', () => {
      render(<App />);

      const event = new Event('vite:preloadError', { cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(reloadMock).not.toHaveBeenCalled();
      expect(usePwaStore.getState().needRefresh).toBe(true);
    });

    it('does not reload after repeated chunk preload errors', () => {
      render(<App />);

      const event = new Event('vite:preloadError', { cancelable: true });
      window.dispatchEvent(event);
      window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));

      expect(reloadMock).not.toHaveBeenCalled();
      expect(usePwaStore.getState().needRefresh).toBe(true);
    });

    it('defers reload and does not immediately reload if cart has active items', () => {
      useCartStore.getState().addItem({ id: 'p1', name: 'Active Sale Product', price: 99 });

      render(<App />);

      const event = new Event('vite:preloadError', { cancelable: true });
      window.dispatchEvent(event);

      expect(reloadMock).not.toHaveBeenCalled();
      expect(usePwaStore.getState().needRefresh).toBe(true);
    });
  });
});
