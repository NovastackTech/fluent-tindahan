import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from './cartStore';

describe('cartStore', () => {
  beforeEach(() => {
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
      qty: 1,
      subtotal: 16
    });
    expect(state.getTotalAmount()).toBe(16);
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
    expect(state.getTotalAmount()).toBe(80);
    expect(state.getTotalCount()).toBe(5);

    // Updating to 0 or negative removes item
    updateQty('prod-1', 0);
    state = useCartStore.getState();
    expect(state.items).toHaveLength(0);
  });

  it('sets customer details', () => {
    useCartStore.getState().setCustomer('cust-123', 'Ate Susan');

    const state = useCartStore.getState();
    expect(state.customerId).toBe('cust-123');
    expect(state.customerName).toBe('Ate Susan');
  });

  it('sets payment method, cash received, split amounts, and notes', () => {
    const store = useCartStore.getState();
    store.setPaymentMethod('Split');
    store.setCashReceived(500);
    store.setSplitAmounts(300, 200);
    store.setNotes('Half cash, half gcash');

    const state = useCartStore.getState();
    expect(state.paymentMethod).toBe('Split');
    expect(state.cashReceived).toBe(500);
    expect(state.splitCashAmount).toBe(300);
    expect(state.splitGCashAmount).toBe(200);
    expect(state.notes).toBe('Half cash, half gcash');
  });

  it('clears cart and resets all checkout state', () => {
    const store = useCartStore.getState();
    store.addItem({ id: 'prod-1', name: 'Bear Brand', price: 14 });
    store.setCustomer('cust-1', 'Mang Juan');
    store.setPaymentMethod('Utang');
    store.setNotes('Bayaran sa sabado');

    store.clearCart();

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(0);
    expect(state.customerId).toBeNull();
    expect(state.customerName).toBeNull();
    expect(state.paymentMethod).toBe('Cash');
    expect(state.notes).toBe('');
    expect(state.getTotalAmount()).toBe(0);
  });
});
