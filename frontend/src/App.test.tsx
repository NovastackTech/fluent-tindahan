import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from './App';
import { usePwaStore } from './state/pwaStore';
import { useCartStore } from './state/cartStore';
import { useAuthStore } from './state/authStore';
import { useSubscriptionStore } from './state/subscriptionStore';
import { DEFAULT_TENANT_ID } from './db/seedData';
import { db } from './db/db';
import { _resetUpdateSWFunctionForTest } from './pwa/registerServiceWorker';
import { _resetPwaTabCoordinatorForTest } from './pwa/pwaTabCoordinator';

describe('App', () => {
  const originalLocation = window.location;
  let reloadMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    await db.products.clear();
    await db.customers.clear();
    await db.sales.clear();
    await db.saleItems.clear();
    await db.utangLedger.clear();
    await db.gcashTxns.clear();
    await db.gcashTxnResolutions.clear();
    await db.tenants.clear();
    useAuthStore.getState().setConsentAccepted(true);
    useAuthStore.setState({
      tenantId: DEFAULT_TENANT_ID,
      isOnboarded: false,
      isOnboardingStatusReady: false
    });
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

  it('recognizes a legacy store with sales and skips onboarding', async () => {
    useAuthStore.setState({ consentAccepted: false });
    await db.sales.add({
      id: 'legacy-sale',
      tenantId: DEFAULT_TENANT_ID,
      totalAmount: 42,
      paymentMethod: 'Cash',
      date: new Date().toISOString(),
      userId: 'legacy-user'
    });

    render(<App />);

    await waitFor(() => expect(useAuthStore.getState().isOnboardingStatusReady).toBe(true));
    expect(useAuthStore.getState().isOnboarded).toBe(true);
    expect(screen.queryByText(/Welcome to Fluent Tindahan|Maligayang Pagdating sa Fluent Tindahan/i)).not.toBeInTheDocument();
  });

  it('recovers an existing tenant when auth storage points to the default tenant', async () => {
    const tenantId = crypto.randomUUID();
    localStorage.setItem('fluent_tindahan_onboarding_started_v1', 'true');
    useAuthStore.setState({
      tenantId: DEFAULT_TENANT_ID,
      consentAccepted: true,
      tier: 'Libre',
      isOnboarded: false,
      isOnboardingStatusReady: false
    });
    await db.tenants.put({
      id: tenantId,
      businessName: 'Existing Store',
      tier: 'TindahanPro',
      subscriptionEndDate: '2030-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString()
    });
    await db.products.bulkAdd(Array.from({ length: 50 }, (_, index) => ({
      id: `existing-product-${index}`,
      tenantId,
      name: `Existing Product ${index}`,
      price: 10,
      cost: 8,
      stockQty: 5,
      updatedAt: new Date().toISOString()
    })));
    useSubscriptionStore.setState({
      tier: 'Libre',
      isUpgradeModalOpen: false
    });
    vi.spyOn(useSubscriptionStore.getState(), 'refreshSubscription').mockResolvedValue();

    render(<App />);

    await waitFor(() => {
      expect(useAuthStore.getState().isOnboardingStatusReady).toBe(true);
      expect(useAuthStore.getState().isOnboarded).toBe(true);
      expect(useAuthStore.getState().tenantId).toBe(tenantId);
    });

    expect(useAuthStore.getState().tier).toBe('TindahanPro');
    expect((await db.tenants.get(tenantId))?.tier).toBe('TindahanPro');
    expect(await db.products.where('tenantId').equals(tenantId).count()).toBe(50);
    expect(screen.queryByText(/Welcome to Fluent Tindahan|Maligayang Pagdating sa Fluent Tindahan/i)).not.toBeInTheDocument();
  });

  it('recovers the most recently updated tenant when multiple non-default tenants exist and auth points to default tenant', async () => {
    const olderTenantId = crypto.randomUUID();
    const newerTenantId = crypto.randomUUID();
    localStorage.setItem('fluent_tindahan_onboarding_started_v1', 'true');
    useAuthStore.setState({
      tenantId: DEFAULT_TENANT_ID,
      consentAccepted: true,
      tier: 'Libre',
      isOnboarded: false,
      isOnboardingStatusReady: false
    });

    await db.tenants.bulkPut([
      {
        id: olderTenantId,
        businessName: 'Older Tindahan',
        tier: 'Libre',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: newerTenantId,
        businessName: 'Newer Tindahan',
        tier: 'NegosyoPlus',
        subscriptionEndDate: '2030-01-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z'
      }
    ]);

    useSubscriptionStore.setState({
      tier: 'Libre',
      isUpgradeModalOpen: false
    });
    vi.spyOn(useSubscriptionStore.getState(), 'refreshSubscription').mockResolvedValue();

    render(<App />);

    await waitFor(() => {
      expect(useAuthStore.getState().isOnboardingStatusReady).toBe(true);
      expect(useAuthStore.getState().isOnboarded).toBe(true);
      expect(useAuthStore.getState().tenantId).toBe(newerTenantId);
    });

    expect(useAuthStore.getState().tier).toBe('NegosyoPlus');
    expect(useAuthStore.getState().businessName).toBe('Newer Tindahan');
    expect(screen.queryByText(/Welcome to Fluent Tindahan|Maligayang Pagdating sa Fluent Tindahan/i)).not.toBeInTheDocument();
  });

  it('recovers concrete tenant instead of skipping onboarding on default tenant when consent was accepted without onboarding started flag', async () => {
    const existingTenantId = crypto.randomUUID();
    // Do NOT set fluent_tindahan_onboarding_started_v1
    useAuthStore.setState({
      tenantId: DEFAULT_TENANT_ID,
      consentAccepted: true,
      tier: 'Libre',
      isOnboarded: false,
      isOnboardingStatusReady: false
    });

    await db.tenants.put({
      id: existingTenantId,
      businessName: 'Existing Negosyo',
      tier: 'TindahanPro',
      updatedAt: '2026-05-01T00:00:00.000Z'
    });

    vi.spyOn(useSubscriptionStore.getState(), 'refreshSubscription').mockResolvedValue();

    render(<App />);

    await waitFor(() => {
      expect(useAuthStore.getState().isOnboardingStatusReady).toBe(true);
      expect(useAuthStore.getState().isOnboarded).toBe(true);
      expect(useAuthStore.getState().tenantId).toBe(existingTenantId);
    });

    expect(useAuthStore.getState().businessName).toBe('Existing Negosyo');
  });

  it('migrates a previously consented install without changing its tenant', async () => {
    render(<App />);

    await waitFor(() => expect(useAuthStore.getState().isOnboardingStatusReady).toBe(true));

    expect(useAuthStore.getState().isOnboarded).toBe(true);
    expect(useAuthStore.getState().tenantId).toBe(DEFAULT_TENANT_ID);
    expect(localStorage.getItem('fluent_tindahan_onboarded_v1')).toBe('true');
    expect(screen.queryByText(/Welcome to Fluent Tindahan|Maligayang Pagdating sa Fluent Tindahan/i)).not.toBeInTheDocument();
  });

  it('does not seed demo data before a fresh tenant completes onboarding', async () => {
    useAuthStore.setState({ consentAccepted: false });
    render(<App />);

    await waitFor(() => expect(useAuthStore.getState().isOnboardingStatusReady).toBe(true));

    expect(await db.products.count()).toBe(0);
    expect(await db.customers.count()).toBe(0);
    expect(await db.utangLedger.count()).toBe(0);
    expect(await db.gcashTxns.count()).toBe(0);
    expect(await db.tenants.get(DEFAULT_TENANT_ID)).toBeUndefined();
  });

  it('keeps onboarding available if a fresh user accepts consent and reloads before setup', async () => {
    useAuthStore.setState({ consentAccepted: false });
    const firstRender = render(<App />);

    await waitFor(() => expect(useAuthStore.getState().isOnboardingStatusReady).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /Sumasang-ayon Ako|I Agree/i }));

    expect(await screen.findByText(/Welcome to Fluent Tindahan|Maligayang Pagdating sa Fluent Tindahan/i)).toBeInTheDocument();
    expect(useAuthStore.getState().isOnboarded).toBe(false);

    firstRender.unmount();
    localStorage.setItem('fluent_tindahan_tier_v1', 'TindahanPro');
    localStorage.setItem('fluent_tindahan_subs_end_v1', '2030-01-01T00:00:00.000Z');
    await db.tenants.put({
      id: DEFAULT_TENANT_ID,
      businessName: 'Demo Tindahan',
      tier: 'TindahanPro',
      subscriptionEndDate: '2030-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString()
    });
    useAuthStore.setState({
      consentAccepted: true,
      tenantId: DEFAULT_TENANT_ID,
      tier: 'TindahanPro',
      subscriptionEndDate: '2030-01-01T00:00:00.000Z',
      isOnboarded: false,
      isOnboardingStatusReady: false,
      isOnboardingOpen: false
    });

    render(<App />);
    await waitFor(() => expect(useAuthStore.getState().isOnboardingStatusReady).toBe(true));

    expect(useAuthStore.getState().isOnboarded).toBe(false);
    expect(await screen.findByText(/Welcome to Fluent Tindahan|Maligayang Pagdating sa Fluent Tindahan/i)).toBeInTheDocument();
  });

  it('starts store services and refreshes subscription only after onboarding completes', async () => {
    localStorage.setItem('fluent_tindahan_onboarding_started_v1', 'true');
    useAuthStore.setState({
      consentAccepted: true,
      isOnboarded: false,
      isOnboardingStatusReady: false
    });
    const refreshSpy = vi.spyOn(useSubscriptionStore.getState(), 'refreshSubscription').mockResolvedValue();

    render(<App />);
    await waitFor(() => expect(useAuthStore.getState().isOnboardingStatusReady).toBe(true));
    expect(refreshSpy).not.toHaveBeenCalled();

    useAuthStore.getState().completeOnboarding({
      businessName: 'Tindahan ni Maria',
      tenantId: crypto.randomUUID(),
      userId: crypto.randomUUID()
    });

    await waitFor(() => expect(refreshSpy).toHaveBeenCalledOnce());
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
