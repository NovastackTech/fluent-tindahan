import { describe, it, expect, beforeEach } from 'vitest';
import { usePrinterStore } from './printerStore';

describe('printerStore', () => {
  beforeEach(() => {
    localStorage.clear();
    usePrinterStore.setState({ paperWidth: '58mm' });
  });

  it('initializes with default 58mm paper width', () => {
    expect(usePrinterStore.getState().paperWidth).toBe('58mm');
  });

  it('updates paper width and persists to localStorage', () => {
    usePrinterStore.getState().setPaperWidth('80mm');
    expect(usePrinterStore.getState().paperWidth).toBe('80mm');
    expect(localStorage.getItem('fluent_tindahan_paper_width')).toBe('80mm');

    usePrinterStore.getState().setPaperWidth('58mm');
    expect(usePrinterStore.getState().paperWidth).toBe('58mm');
    expect(localStorage.getItem('fluent_tindahan_paper_width')).toBe('58mm');
  });
});
