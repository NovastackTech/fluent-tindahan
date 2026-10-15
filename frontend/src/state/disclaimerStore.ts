import { create } from 'zustand';

interface DisclaimerState {
  isDisclaimerOpen: boolean;
  openDisclaimer: () => void;
  closeDisclaimer: () => void;
}

export const useDisclaimerStore = create<DisclaimerState>((set) => ({
  isDisclaimerOpen: false,
  openDisclaimer: () => set({ isDisclaimerOpen: true }),
  closeDisclaimer: () => set({ isDisclaimerOpen: false })
}));
