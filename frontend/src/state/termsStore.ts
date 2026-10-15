import { create } from 'zustand';

interface TermsState {
  isTermsOpen: boolean;
  openTerms: () => void;
  closeTerms: () => void;
}

export const useTermsStore = create<TermsState>((set) => ({
  isTermsOpen: false,
  openTerms: () => set({ isTermsOpen: true }),
  closeTerms: () => set({ isTermsOpen: false })
}));
