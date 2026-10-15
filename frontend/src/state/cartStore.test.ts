import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore, CART_STORAGE_KEY, loadPersistedCart } from './cartStore';

describe('cartStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useCartStore.getState().clearCart();
  });

  it('initializes with default empty state', () => {
    const state = useCartStore.getState();
    expect(state.items).toEqual([]);
    expect(state.customerId).toBeNull();
    expect(state.customerName).toBeNull();
    expect(state.paymentMethod).toBe('Cash');
    expect(state.cashReceived).toBe(0);
    expect(state.splitCashAmount).toBe(0);
    expect(state.splitGCashAmount).toBe(0);
    expect(state.notes).toBe('');
    expect(state.getTotalAmount()).toBe(0);
    expect(state.getTotalCentavos()).toBe(0);
    expect(state.getTotalCount()).toBe(0);
  });

  it('adds a new item to the cart', () => {
    useCartStore.getState().addItem({ id: 'prod-1', name: 'Pancit Canton', price: 16 });

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toEqual({
      productId: 'prod-1',
      name: 'Pancit Canton',
      price: 16,
      priceCentavos: 1600,
      qty: 1,
      subtotal: 16,
      subtotalCentavos: 1600
    });
    expect(state.getTotalAmount()).toBe(16);
    expect(state.getTotalCentavos()).toBe(1600);
    expect(state.getTotalCount()).toBe(1);
  });

  it('increments quantity and subtotal when adding existing item', () => {
    const { addItem } = useCartStore.getState();
    addItem({ id: 'prod-1', name: 'Pancit Canton', price: 16 });
    addItem({ id: 'prod-1', name: 'Pancit Canton', price: 16 });

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].qty).toBe(2);
    expect(state.items[0].subtotal).toBe(32);
    expect(state.items[0].subtotalCentavos).toBe(3200);
    expect(state.getTotalAmount()).toBe(32);
    expect(state.getTotalCount()).toBe(2);
  });

  it('removes an item by productId', () => {
    const { addItem, removeItem } = useCartStore.getState();
    addItem({ id: 'prod-1', name: 'Pancit Canton', price: 16 });
    addItem({ id: 'prod-2', name: 'Coke Mismo', price: 18 });

    removeItem('prod-1');

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].productId).toBe('prod-2');
  });

  it('updates quantity and recalculates subtotal', () => {
    const { addItem, updateQty } = useCartStore.getState();
    addItem({ id: 'prod-1', name: 'Pancit Canton', price: 16 });

    updateQty('prod-1', 5);

    let state = useCartStore.getState();
    expect(state.items[0].qty).toBe(5);
    expect(state.items[0].subtotal).toBe(80);
    expect(state.items[0].subtotalCentavos).toBe(8000);
    expect(state.getTotalAmount()).toBe(80);
    expect(state.getTotalCount()).toBe(5);

    // Updating to 0 or negative removes item
    updateQty('prod-1', 0);
    state = useCartStore.getState();
    expect(state.items).toHaveLength(0);
  });

  it('prevents floating point drift using integer centavos', () => {
    const { addItem, updateQty } = useCartStore.getState();
    // Test 0.1 * 3 float drift
    addItem({ id: 'candy', name: 'Mentos Candy', price: 0.1 });
    updateQty('candy', 3);

    let state = useCartStore.getState();
    expect(state.items[0].subtotal).toBe(0.3);
    expect(state.items[0].subtotalCentavos).toBe(30);
    expect(state.getTotalAmount()).toBe(0.3);

    // Test 0.1 + 0.2 float drift across multiple items
    addItem({ id: 'bubblegum', name: 'Bubblegum', price: 0.2 });
    state = useCartStore.getState();
    // In raw JS float: 0.3 + 0.2 = 0.5000000000000001 or 0.1 + 0.2 = 0.30000000000000004
    expect(state.getTotalAmount()).toBe(0.5);
    expect(state.getTotalCentavos()).toBe(50);
  });

  it('persists cart state to sessionStorage on modification', () => {
    const store = useCartStore.getState();
    store.addItem({ id: 'item-1', name: 'Instant Noodles', price: 15.5 });
    store.setCustomer('cust-1', 'Ate Susan');
    store.setPaymentMethod('Split');
    store.setSplitAmounts(10, 5.5);
    store.setNotes('Partial payment via GCash');

    const storedRaw = sessionStorage.getItem(CART_STORAGE_KEY);
    expect(storedRaw).toBeTruthy();
    const stored = JSON.parse(storedRaw!);
    expect(stored.items).toHaveLength(1);
    expect(stored.items[0].name).toBe('Instant Noodles');
    expect(stored.customerId).toBe('cust-1');
    expect(stored.customerName).toBe('Ate Susan');
    expect(stored.paymentMethod).toBe('Split');
    expect(stored.splitCashAmount).toBe(10);
    expect(stored.splitGCashAmount).toBe(5.5);
    expect(stored.notes).toBe('Partial payment via GCash');

    // Rehydrate test via loadPersistedCart
    const rehydrated = loadPersistedCart();
    expect(rehydrated.items).toHaveLength(1);
    expect(rehydrated.items![0].subtotal).toBe(15.5);
    expect(rehydrated.items![0].subtotalCentavos).toBe(1550);
  });

  it('clears cart and removes persisted state from sessionStorage', () => {
    const store = useCartStore.getState();
    store.addItem({ id: 'prod-1', name: 'Bear Brand', price: 14 });
    store.setCustomer('cust-1', 'Mang Juan');
    store.setPaymentMethod('Utang');
    store.setNotes('Bayaran sa sabado');

    expect(sessionStorage.getItem(CART_STORAGE_KEY)).toBeTruthy();

    store.clearCart();

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(0);
    expect(state.customerId).toBeNull();
    expect(state.customerName).toBeNull();
    expect(state.paymentMethod).toBe('Cash');
    expect(state.notes).toBe('');
    expect(state.getTotalAmount()).toBe(0);
    expect(sessionStorage.getItem(CART_STORAGE_KEY)).toBeNull();
  });

  it('caps item quantity at maxStock when addItem is called multiple times', () => {
    const store = useCartStore.getState();
    const product = { id: 'qa-soda', name: 'QA-TEST Soda', price: 15, maxStock: 3 };

    const res1 = store.addItem(product);
    expect(res1).toEqual({ added: true, capped: false });
    expect(useCartStore.getState().items[0].qty).toBe(1);

    const res2 = store.addItem(product);
    expect(res2).toEqual({ added: true, capped: false });
    expect(useCartStore.getState().items[0].qty).toBe(2);

    const res3 = store.addItem(product);
    expect(res3).toEqual({ added: true, capped: false });
    expect(useCartStore.getState().items[0].qty).toBe(3);

    // 4th and 5th attempts should be capped at maxStock 3
    const res4 = store.addItem(product);
    expect(res4).toEqual({ added: false, capped: true });
    expect(useCartStore.getState().items[0].qty).toBe(3);

    const res5 = store.addItem(product);
    expect(res5).toEqual({ added: false, capped: true });
    expect(useCartStore.getState().items[0].qty).toBe(3);
    expect(useCartStore.getState().getTotalCount()).toBe(3);
    expect(useCartStore.getState().getTotalAmount()).toBe(45);
  });

  it('does not add product when maxStock is 0', () => {
    const store = useCartStore.getState();
    const outOfStockProd = { id: 'qa-empty', name: 'Out of Stock Soda', price: 20, maxStock: 0 };

    const res = store.addItem(outOfStockProd);
    expect(res).toEqual({ added: false, capped: true });
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('caps quantity at maxStock when updateQty is called beyond available stock', () => {
    const store = useCartStore.getState();
    store.addItem({ id: 'qa-soda', name: 'QA-TEST Soda', price: 15, maxStock: 3 });

    const res = store.updateQty('qa-soda', 10, 3);
    expect(res).toEqual({ updated: true, capped: true });
    expect(useCartStore.getState().items[0].qty).toBe(3);
    expect(useCartStore.getState().items[0].subtotal).toBe(45);
  });
});
