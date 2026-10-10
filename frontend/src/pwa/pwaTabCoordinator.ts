import { useCartStore } from '../state/cartStore';
import { usePwaStore } from '../state/pwaStore';

export const PWA_CART_CHANNEL_NAME = 'fluent_tindahan_cart_coordination';

export interface CartStatusMessage {
  type: 'CART_STATUS';
  tabId: string;
  hasItems: boolean;
}

export interface QueryCartStatusMessage {
  type: 'QUERY_CART_STATUS';
  requesterTabId: string;
}

export interface TabClosedMessage {
  type: 'TAB_CLOSED';
  tabId: string;
}

export type PwaTabMessage = CartStatusMessage | QueryCartStatusMessage | TabClosedMessage;

let tabId: string = '';
let broadcastChannel: BroadcastChannel | null = null;
const activeRemoteCartTabs = new Set<string>();
let unsubscribeCartStore: (() => void) | null = null;

export function getTabId(): string {
  if (!tabId) {
    tabId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  }
  return tabId;
}

export function initPwaTabCoordinator(): () => void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return () => {};
  }

  const currentTabId = getTabId();

  try {
    broadcastChannel = new BroadcastChannel(PWA_CART_CHANNEL_NAME);
  } catch (err) {
    console.warn('[PWA] BroadcastChannel not supported or failed to initialize:', err);
    return () => {};
  }

  const updateOtherTabsState = () => {
    usePwaStore.getState().setOtherTabsHaveCart(activeRemoteCartTabs.size > 0);
  };

  broadcastChannel.onmessage = (event: MessageEvent<PwaTabMessage>) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'QUERY_CART_STATUS') {
      if (data.requesterTabId !== currentTabId && broadcastChannel) {
        const localHasItems = useCartStore.getState().items.length > 0;
        broadcastChannel.postMessage({
          type: 'CART_STATUS',
          tabId: currentTabId,
          hasItems: localHasItems
        });
      }
    } else if (data.type === 'CART_STATUS') {
      if (data.tabId !== currentTabId) {
        if (data.hasItems) {
          activeRemoteCartTabs.add(data.tabId);
        } else {
          activeRemoteCartTabs.delete(data.tabId);
        }
        updateOtherTabsState();
      }
    } else if (data.type === 'TAB_CLOSED') {
      if (data.tabId !== currentTabId) {
        activeRemoteCartTabs.delete(data.tabId);
        updateOtherTabsState();
      }
    }
  };

  // Broadcast current cart state immediately to peers and ask peers for their status
  const localHasItems = useCartStore.getState().items.length > 0;
  broadcastChannel.postMessage({
    type: 'CART_STATUS',
    tabId: currentTabId,
    hasItems: localHasItems
  });
  broadcastChannel.postMessage({
    type: 'QUERY_CART_STATUS',
    requesterTabId: currentTabId
  });

  // Listen for local cart mutations
  let prevHasItems = localHasItems;
  unsubscribeCartStore = useCartStore.subscribe((state) => {
    const currentHasItems = state.items.length > 0;
    if (currentHasItems !== prevHasItems) {
      prevHasItems = currentHasItems;
      broadcastChannel?.postMessage({
        type: 'CART_STATUS',
        tabId: currentTabId,
        hasItems: currentHasItems
      });
    }
  });

  const handleBeforeUnload = () => {
    try {
      broadcastChannel?.postMessage({
        type: 'TAB_CLOSED',
        tabId: currentTabId
      });
    } catch {
      // ignore
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    if (unsubscribeCartStore) {
      unsubscribeCartStore();
      unsubscribeCartStore = null;
    }
    try {
      broadcastChannel?.postMessage({
        type: 'TAB_CLOSED',
        tabId: currentTabId
      });
      broadcastChannel?.close();
    } catch {
      // ignore
    }
    broadcastChannel = null;
    activeRemoteCartTabs.clear();
    updateOtherTabsState();
  };
}

/**
 * Resets coordinator state for testing.
 * @internal
 */
export function _resetPwaTabCoordinatorForTest(): void {
  activeRemoteCartTabs.clear();
  tabId = '';
  if (broadcastChannel) {
    broadcastChannel.close();
    broadcastChannel = null;
  }
  if (unsubscribeCartStore) {
    unsubscribeCartStore();
    unsubscribeCartStore = null;
  }
  usePwaStore.getState().setOtherTabsHaveCart(false);
}
