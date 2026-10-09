import { create } from 'zustand';

export type PaperWidth = '58mm' | '80mm';

interface PrinterState {
  paperWidth: PaperWidth;
  setPaperWidth: (width: PaperWidth) => void;
}

const savedWidth = (localStorage.getItem('fluent_tindahan_paper_width') as PaperWidth) || '58mm';

export const usePrinterStore = create<PrinterState>((set) => ({
  paperWidth: savedWidth === '80mm' ? '80mm' : '58mm',
  setPaperWidth: (width: PaperWidth) => {
    localStorage.setItem('fluent_tindahan_paper_width', width);
    set({ paperWidth: width });
  }
}));
