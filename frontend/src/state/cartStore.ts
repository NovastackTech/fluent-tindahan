import { create } from 'zustand';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
  subtotal: number;
  priceCentavos?: number;
  subtotalCentavos?: number;
}

export const CART_STORAGE_KEY = 'fluent_tindahan_cart_state';

/** Convert pesos to integer centavos, avoiding JS float imprecision */
export const toCentavos = (amount: number): number => {
  return Math.round((Number(amount) || 0) * 100);
};

/** Convert integer centavos to pesos */
export const fromCentavos = (centavos: number): number => {
  return Math.round(centavos) / 100;
};

/** Calculate item subtotal in pesos and centavos using integer centavo arithmetic */
export const calculateItemSubtotal = (price: number, qty: number): { subtotal: number; subtotalCentavos: number } => {
  const priceCentavos = toCentavos(price);
  const subtotalCentavos = priceCentavos * qty;
  return {
    subtotal: fromCentavos(subtotalCentavos),
    subtotalCentavos
  };
};

export interface PersistedCartState {
  items: CartItem[];
  customerId: string | null;
  customerName: string | null;
  paymentMethod: 'Cash' | 'GCash' | 'Split' | 'Utang';
  cashReceived: number;
  splitCashAmount: number;
  splitGCashAmount: number;
  notes: string;
}

export const loadPersistedCart = (): Partial<PersistedCartState> => {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return {};
  }
  try {
    const raw = window.sessionStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};

    const items = Array.isArray(parsed.items)
      ? parsed.items.map((item: any) => {
          const price = Number(item.price) || 0;
          const qty = Number(item.qty) || 0;
          const { subtotal, subtotalCentavos } = calculateItemSubtotal(price, qty);
          return {
            productId: String(item.productId),
            name: String(item.name),
            price,
            qty,
            subtotal,
            priceCentavos: toCentavos(price),
            subtotalCentavos
          };
        })
      : [];

    return {
      items,
      customerId: parsed.customerId ?? null,
      customerName: parsed.customerName ?? null,
      paymentMethod: parsed.paymentMethod ?? 'Cash',
      cashReceived: typeof parsed.cashReceived === 'number' ? parsed.cashReceived : 0,
      splitCashAmount: typeof parsed.splitCashAmount === 'number' ? parsed.splitCashAmount : 0,
      splitGCashAmount: typeof parsed.splitGCashAmount === 'number' ? parsed.splitGCashAmount : 0,
      notes: typeof parsed.notes === 'string' ? parsed.notes : ''
    };
  } catch {
    return {};
  }
};

export const savePersistedCart = (state: PersistedCartState) => {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return;
  }
  try {
    if (
      (!state.items || state.items.length === 0) &&
      !state.customerId &&
      !state.notes &&
      state.cashReceived === 0 &&
      state.splitCashAmount === 0 &&
      state.splitGCashAmount === 0
    ) {
      window.sessionStorage.removeItem(CART_STORAGE_KEY);
      return;
    }

    const data: PersistedCartState = {
      items: state.items || [],
      customerId: state.customerId ?? null,
      customerName: state.customerName ?? null,
      paymentMethod: state.paymentMethod || 'Cash',
      cashReceived: state.cashReceived || 0,
      splitCashAmount: state.splitCashAmount || 0,
      splitGCashAmount: state.splitGCashAmount || 0,
      notes: state.notes || ''
    };
    window.sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota or serialization errors
  }
};

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
  getTotalCentavos: () => number;
  getTotalCount: () => number;
}

const initialPersisted = loadPersistedCart();

export const useCartStore = create<CartState>((set, get) => ({
  items: initialPersisted.items ?? [],
  customerId: initialPersisted.customerId ?? null,
  customerName: initialPersisted.customerName ?? null,
  paymentMethod: initialPersisted.paymentMethod ?? 'Cash',
  cashReceived: initialPersisted.cashReceived ?? 0,
  splitCashAmount: initialPersisted.splitCashAmount ?? 0,
  splitGCashAmount: initialPersisted.splitGCashAmount ?? 0,
  notes: initialPersisted.notes ?? '',

  addItem: (product) => {
    set((state) => {
      const existing = state.items.find((item) => item.productId === product.id);
      if (existing) {
        const newQty = existing.qty + 1;
        const { subtotal, subtotalCentavos } = calculateItemSubtotal(existing.price, newQty);
        return {
          items: state.items.map((item) =>
            item.productId === product.id
              ? {
                  ...item,
                  qty: newQty,
                  subtotal,
                  subtotalCentavos,
                  priceCentavos: toCentavos(item.price)
                }
              : item
          )
        };
      }
      const { subtotal, subtotalCentavos } = calculateItemSubtotal(product.price, 1);
      return {
        items: [
          ...state.items,
          {
            productId: product.id,
            name: product.name,
            price: product.price,
            priceCentavos: toCentavos(product.price),
            qty: 1,
            subtotal,
            subtotalCentavos
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
      items: state.items.map((item) => {
        if (item.productId === productId) {
          const { subtotal, subtotalCentavos } = calculateItemSubtotal(item.price, qty);
          return {
            ...item,
            qty,
            subtotal,
            subtotalCentavos,
            priceCentavos: toCentavos(item.price)
          };
        }
        return item;
      })
    }));
  },

  setCustomer: (id, name) => set({ customerId: id, customerName: name }),

  setPaymentMethod: (method) => set({ paymentMethod: method }),

  setCashReceived: (amount) => set({ cashReceived: amount }),

  setSplitAmounts: (cash, gcash) => set({ splitCashAmount: cash, splitGCashAmount: gcash }),

  setNotes: (notes) => set({ notes }),

  clearCart: () => {
    set({
      items: [],
      customerId: null,
      customerName: null,
      paymentMethod: 'Cash',
      cashReceived: 0,
      splitCashAmount: 0,
      splitGCashAmount: 0,
      notes: ''
    });
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(CART_STORAGE_KEY);
    }
  },

  getTotalCentavos: () => {
    return get().items.reduce((sum, item) => {
      const centavos = item.subtotalCentavos ?? toCentavos(item.subtotal);
      return sum + centavos;
    }, 0);
  },

  getTotalAmount: () => {
    return fromCentavos(get().getTotalCentavos());
  },

  getTotalCount: () => {
    return get().items.reduce((sum, item) => sum + item.qty, 0);
  }
}));

// Automatically sync state mutations to sessionStorage
useCartStore.subscribe((state) => {
  savePersistedCart(state);
});
