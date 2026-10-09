import { create } from 'zustand';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
  subtotal: number;
}

interface CartState {
  items: CartItem[];
  customerId: string | null;
  customerName: string | null;
  paymentMethod: 'Cash' | 'GCash' | 'Split' | 'Utang';
  cashReceived: number;
  splitCashAmount: number;
  splitGCashAmount: number;
  notes: string;
  
  addItem: (product: { id: string; name: string; price: number }) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  setCustomer: (id: string | null, name: string | null) => void;
  setPaymentMethod: (method: 'Cash' | 'GCash' | 'Split' | 'Utang') => void;
  setCashReceived: (amount: number) => void;
  setSplitAmounts: (cash: number, gcash: number) => void;
  setNotes: (notes: string) => void;
  clearCart: () => void;
  getTotalAmount: () => number;
  getTotalCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customerId: null,
  customerName: null,
  paymentMethod: 'Cash',
  cashReceived: 0,
  splitCashAmount: 0,
  splitGCashAmount: 0,
  notes: '',

  addItem: (product) => {
    set((state) => {
      const existing = state.items.find((item) => item.productId === product.id);
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.productId === product.id
              ? {
                  ...item,
                  qty: item.qty + 1,
                  subtotal: (item.qty + 1) * item.price
                }
              : item
          )
        };
      }
      return {
        items: [
          ...state.items,
          {
            productId: product.id,
            name: product.name,
            price: product.price,
            qty: 1,
            subtotal: product.price
          }
        ]
      };
    });
  },

  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter((item) => item.productId !== productId)
    }));
  },

  updateQty: (productId, qty) => {
    if (qty <= 0) {
      get().removeItem(productId);
      return;
    }
    set((state) => ({
      items: state.items.map((item) =>
        item.productId === productId
          ? {
              ...item,
              qty,
              subtotal: qty * item.price
            }
          : item
      )
    }));
  },

  setCustomer: (id, name) => set({ customerId: id, customerName: name }),

  setPaymentMethod: (method) => set({ paymentMethod: method }),

  setCashReceived: (amount) => set({ cashReceived: amount }),

  setSplitAmounts: (cash, gcash) => set({ splitCashAmount: cash, splitGCashAmount: gcash }),

  setNotes: (notes) => set({ notes }),

  clearCart: () =>
    set({
      items: [],
      customerId: null,
      customerName: null,
      paymentMethod: 'Cash',
      cashReceived: 0,
      splitCashAmount: 0,
      splitGCashAmount: 0,
      notes: ''
    }),

  getTotalAmount: () => {
    return get().items.reduce((sum, item) => sum + item.subtotal, 0);
  },

  getTotalCount: () => {
    return get().items.reduce((sum, item) => sum + item.qty, 0);
  }
}));
