import { create } from 'zustand';

export const GCASH_FEE_STORAGE_KEY = 'fluent_tindahan_gcash_fee_tiers_v2';
const LEGACY_GCASH_FEE_STORAGE_KEY = 'fluent_tindahan_gcash_fee_tiers_v1';

export const GCASH_FEE_BRACKETS = [
  { label: '₱1-₱500', maxAmount: 500 },
  { label: '₱501-₱1,000', maxAmount: 1000 },
  { label: '₱1,001-₱2,000', maxAmount: 2000 },
  { label: '₱2,001-₱3,000', maxAmount: 3000 },
  { label: '₱3,001-₱4,000', maxAmount: 4000 },
  { label: '₱4,001-₱5,000', maxAmount: 5000 },
  { label: 'Per ₱1,000 above ₱5,000', maxAmount: null }
] as const;

export const DEFAULT_GCASH_FEE_TIERS = [5, 10, 30, 45, 60, 75, 15];

interface GCashFeeState {
  feesByTenant: Record<string, number[]>;
  setFeeForTenant: (tenantId: string, tierIndex: number, fee: number) => void;
}

function readSavedFees(): Record<string, number[]> {
  try {
    const storedFees = localStorage.getItem(GCASH_FEE_STORAGE_KEY);
    const isLegacy = storedFees === null;
    const saved = JSON.parse(storedFees ?? localStorage.getItem(LEGACY_GCASH_FEE_STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    const feesByTenant = Object.fromEntries(Object.entries(saved).map(([tenantId, value]) => {
      const fees = Array.isArray(value) ? value : [];
      const normalizedFees = DEFAULT_GCASH_FEE_TIERS.map((defaultFee, index) => {
        const savedFee = fees[index];
        if (isLegacy && index === 6) {
          const previousFee = fees[5];
          const increment = typeof savedFee === 'number' && typeof previousFee === 'number'
            ? savedFee - previousFee
            : Number.NaN;
          return isValidFee(increment) ? increment : defaultFee;
        }
        return isValidFee(savedFee) ? savedFee : defaultFee;
      });
      return [tenantId, normalizedFees];
    }));
    if (isLegacy && storedFees === null && localStorage.getItem(LEGACY_GCASH_FEE_STORAGE_KEY) !== null) {
      localStorage.setItem(GCASH_FEE_STORAGE_KEY, JSON.stringify(feesByTenant));
    }
    return feesByTenant;
  } catch {
    return {};
  }
}

function isValidFee(fee: unknown): fee is number {
  return typeof fee === 'number' && Number.isFinite(fee) && fee >= 0 && fee <= 100000;
}

export function calculateGCashFee(amount: number, fees: number[]): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (amount > 5000) {
    const baseFeeCentavos = Math.round((fees[5] ?? DEFAULT_GCASH_FEE_TIERS[5]) * 100);
    const incrementCentavos = Math.round((fees[6] ?? DEFAULT_GCASH_FEE_TIERS[6]) * 100);
    const increments = Math.ceil((amount - 5000) / 1000);
    return (baseFeeCentavos + increments * incrementCentavos) / 100;
  }
  const tierIndex = GCASH_FEE_BRACKETS.findIndex(
    (bracket) => bracket.maxAmount === null || amount <= bracket.maxAmount
  );
  const feeCentavos = Math.round((fees[tierIndex] ?? DEFAULT_GCASH_FEE_TIERS[tierIndex]) * 100);
  return feeCentavos / 100;
}

export const useGCashFeeStore = create<GCashFeeState>((set) => ({
  feesByTenant: readSavedFees(),
  setFeeForTenant: (tenantId, tierIndex, fee) => {
    if (!Number.isInteger(tierIndex) || tierIndex < 0 || tierIndex >= GCASH_FEE_BRACKETS.length || !isValidFee(fee)) return;
    set((state) => {
      const fees = [...(state.feesByTenant[tenantId] || DEFAULT_GCASH_FEE_TIERS)];
      fees[tierIndex] = fee;
      const feesByTenant = { ...state.feesByTenant, [tenantId]: fees };
      localStorage.setItem(GCASH_FEE_STORAGE_KEY, JSON.stringify(feesByTenant));
      return { feesByTenant };
    });
  }
}));
