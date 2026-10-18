import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initPwaTabCoordinator, getTabId, _resetPwaTabCoordinatorForTest, PWA_CART_CHANNEL_NAME } from './pwaTabCoordinator';
import { useCartStore } from '../state/cartStore';
import { usePwaStore } from '../state/pwaStore';

describe('pwaTabCoordinator', () => {
  beforeEach(() => {
    _resetPwaTabCoordinatorForTest();
    useCartStore.getState().clearCart();
    usePwaStore.setState({ otherTabsHaveCart: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    _resetPwaTabCoordinatorForTest();
  });

  it('generates a stable RFC 4122 v4 UUID tabId', () => {
    const id1 = getTabId();
    const id2 = getTabId();
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    _resetPwaTabCoordinatorForTest();
    const id3 = getTabId();
    expect(id3).not.toBe(id1);
    expect(id3).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('falls back to a unique tab timestamp counter id when crypto is undefined', () => {
    vi.stubGlobal('crypto', undefined);

    const id1 = getTabId();
    expect(id1).toMatch(/^tab-\d+-\d+$/);

    _resetPwaTabCoordinatorForTest();
    const id2 = getTabId();
    expect(id2).toMatch(/^tab-\d+-\d+$/);
    expect(id2).not.toBe(id1);
  });

  it('broadcasts cart status when items are added and updates otherTabsHaveCart across tabs', () => {
    // Initialize coordinator for "Tab 1"
    const cleanupTab1 = initPwaTabCoordinator();

    // Create a mock channel representing "Tab 2"
    const tab2Channel = new BroadcastChannel(PWA_CART_CHANNEL_NAME);

    // Tab 2 reports that it has an active cart
    tab2Channel.postMessage({
      type: 'CART_STATUS',
      tabId: 'tab-2',
      hasItems: true
    });

    // Tab 1 should now reflect that another tab has an active cart
    expect(usePwaStore.getState().otherTabsHaveCart).toBe(true);

    // Tab 2 clears its cart
    tab2Channel.postMessage({
      type: 'CART_STATUS',
      tabId: 'tab-2',
      hasItems: false
    });

    // Tab 1 should reflect that no other tab has an active cart
    expect(usePwaStore.getState().otherTabsHaveCart).toBe(false);

    tab2Channel.close();
    cleanupTab1();
  });

  it('responds to QUERY_CART_STATUS from a newly opened peer tab', () => {
    // Put an item in local cart before initializing
    useCartStore.getState().addItem({ id: 'p1', name: 'Item 1', price: 10 });

    const cleanupTab1 = initPwaTabCoordinator();

    const tab2Channel = new BroadcastChannel(PWA_CART_CHANNEL_NAME);
    const messagesReceivedByTab2: any[] = [];
    tab2Channel.onmessage = (e) => {
      messagesReceivedByTab2.push(e.data);
    };

    // Tab 2 asks all tabs for their cart status
    tab2Channel.postMessage({
      type: 'QUERY_CART_STATUS',
      requesterTabId: 'tab-2'
    });

    // Tab 1 should reply that it has an active cart
    const reply = messagesReceivedByTab2.find((m) => m.type === 'CART_STATUS' && m.tabId !== 'tab-2');
    expect(reply).toBeDefined();
    expect(reply?.hasItems).toBe(true);

    tab2Channel.close();
    cleanupTab1();
  });

  it('removes tab from active list when it broadcasts TAB_CLOSED', () => {
    const cleanupTab1 = initPwaTabCoordinator();
    const tab2Channel = new BroadcastChannel(PWA_CART_CHANNEL_NAME);

    tab2Channel.postMessage({
      type: 'CART_STATUS',
      tabId: 'tab-2',
      hasItems: true
    });

    expect(usePwaStore.getState().otherTabsHaveCart).toBe(true);

    // Tab 2 closes or navigates away
    tab2Channel.postMessage({
      type: 'TAB_CLOSED',
      tabId: 'tab-2'
    });

    expect(usePwaStore.getState().otherTabsHaveCart).toBe(false);

    tab2Channel.close();
    cleanupTab1();
  });

  it('broadcasts local cart status changes to peer tabs', () => {
    const cleanupTab1 = initPwaTabCoordinator();
    const tab2Channel = new BroadcastChannel(PWA_CART_CHANNEL_NAME);
    const messagesReceivedByTab2: any[] = [];
    tab2Channel.onmessage = (e) => {
      messagesReceivedByTab2.push(e.data);
    };

    // Add item to Tab 1's cart
    useCartStore.getState().addItem({ id: 'p2', name: 'Item 2', price: 25 });

    const statusMsg = messagesReceivedByTab2.find((m) => m.type === 'CART_STATUS' && m.hasItems === true);
    expect(statusMsg).toBeDefined();

    tab2Channel.close();
    cleanupTab1();
  });
});
