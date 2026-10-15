import { create } from 'zustand';

export type StockValidationPolicy = 'warn' | 'block';

interface PosSettingsState {
  stockValidationPolicy: StockValidationPolicy;
  setStockValidationPolicy: (policy: StockValidationPolicy) => void;
}

export const POS_SETTINGS_STORAGE_KEY = 'fluent_tindahan_stock_policy';

const getInitialPolicy = (): StockValidationPolicy => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'warn';
  }
  const saved = localStorage.getItem(POS_SETTINGS_STORAGE_KEY);
  if (saved === 'block' || saved === 'warn') {
    return saved;
  }
  // Default to 'warn' for offline-first store resiliency:
  // In neighborhood retail, physical stock takes precedence over un-synced digital records.
  return 'warn';
};

export const usePosSettingsStore = create<PosSettingsState>((set) => ({
  stockValidationPolicy: getInitialPolicy(),
  setStockValidationPolicy: (policy: StockValidationPolicy) => {
    try {
      localStorage.setItem(POS_SETTINGS_STORAGE_KEY, policy);
    } catch {
      // ignore storage errors
    }
    set({ stockValidationPolicy: policy });
  }
}));
