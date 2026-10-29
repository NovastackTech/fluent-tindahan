import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateThermalReceiptHtml,
  printThermalReceipt,
  generateEscPosReceipt,
  isBluetoothPrintSupported,
  printBluetoothReceipt
} from './receiptPrinter';
import type { ReceiptData } from '../components/ReceiptModal';

describe('receiptPrinter', () => {
  const sampleData: ReceiptData = {
    saleId: 'sale-1234567890',
    date: '2026-10-09T14:30:00Z',
    items: [
      { name: 'Kape 3-in-1', qty: 2, price: 12, subtotal: 24 },
      { name: 'Pandesal', qty: 5, price: 3, subtotal: 15 }
    ],
    totalAmount: 39,
    paymentMethod: 'Cash',
    cashReceived: 50,
    changeGiven: 11,
    customerName: 'Nanay Nena',
    customerUtangBalance: 120
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateThermalReceiptHtml', () => {
    it('generates valid HTML document for 58mm thermal rolls', () => {
      const html = generateThermalReceiptHtml(sampleData, "Aling Nena's Tindahan", '58mm');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain("Aling Nena's Tindahan");
      expect(html).toContain('58mm');
      expect(html).toContain('2x Kape 3-in-1');
      expect(html).toContain('5x Pandesal');
      expect(html).toContain('&#8369;39.00');
      expect(html).toContain('Nanay Nena');
      expect(html).toContain('&#8369;120.00');
      expect(html).toContain('*** HINDI OPISYAL NA RESIBO ***');
    });

    it('generates valid HTML document for 80mm thermal rolls', () => {
      const html = generateThermalReceiptHtml(sampleData, "Aling Nena's Tindahan", '80mm');
      expect(html).toContain('80mm');
      expect(html).toContain('&#8369;39.00');
    });

    it('renders GCash reference in thermal receipt HTML when present', () => {
      const gcashData: ReceiptData = {
        ...sampleData,
        paymentMethod: 'GCash',
        gcashRef: '901238471201'
      };
      const html = generateThermalReceiptHtml(gcashData, "Aling Nena's Tindahan", '58mm');
      expect(html).toContain('GCash Ref:');
      expect(html).toContain('901238471201');
    });
  });

  describe('generateEscPosReceipt', () => {
    it('generates valid ESC/POS byte sequence with initialization, text, feed, and cut commands', () => {
      const bytes = generateEscPosReceipt(sampleData, "Aling Nena's Store", '58mm');
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBeGreaterThan(50);

      // Check ESC @ (0x1B, 0x40) init command
      expect(bytes[0]).toBe(0x1B);
      expect(bytes[1]).toBe(0x40);

      // Check that business name and items are encoded in ASCII/UTF-8
      const text = new TextDecoder().decode(bytes);
      expect(text).toContain("Aling Nena's Store");
      expect(text).toContain('2x Kape 3-in-1');
      expect(text).toContain('TOTAL:');
      expect(text).toContain('P39.00');
      expect(text).toContain('Nanay Nena');
      expect(text).toContain('Maraming Salamat po!\n\n\n\n\n');
    });

    it('wraps long items nicely for 80mm rolls', () => {
      const longItemData: ReceiptData = {
        ...sampleData,
        items: [
          { name: 'Very Long Product Name That Definitely Exceeds Width Limit 1234567890', qty: 1, price: 100, subtotal: 100 }
        ]
      };
      const bytes = generateEscPosReceipt(longItemData, "Store", '80mm');
      expect(bytes.length).toBeGreaterThan(0);
    });

    it('encodes GCash reference in ESC/POS byte sequence when present', () => {
      const gcashData: ReceiptData = {
        ...sampleData,
        paymentMethod: 'GCash',
        gcashRef: '901238471201'
      };
      const bytes = generateEscPosReceipt(gcashData, "Store", '58mm');
      const text = new TextDecoder().decode(bytes);
      expect(text).toContain('GCash Ref: 901238471201');
    });
  });

  describe('printThermalReceipt', () => {
    it('creates an iframe, writes receipt HTML, and triggers print', () => {
      vi.useFakeTimers();
      const printSpy = vi.fn();
      const focusSpy = vi.fn();

      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'iframe') {
          const fakeIframe = origCreateElement('iframe');
          Object.defineProperty(fakeIframe, 'contentWindow', {
            value: {
              focus: focusSpy,
              print: printSpy,
              document: {
                open: vi.fn(),
                write: vi.fn(),
                close: vi.fn()
              }
            },
            writable: true
          });
          return fakeIframe;
        }
        return origCreateElement(tagName);
      });

      const result = printThermalReceipt(sampleData, "Aling Nena's Tindahan", { paperWidth: '58mm' });
      expect(result).toBe(true);

      // Advance timer for print trigger
      vi.advanceTimersByTime(200);
      expect(focusSpy).toHaveBeenCalled();
      expect(printSpy).toHaveBeenCalled();

      // Advance timer for cleanup
      vi.advanceTimersByTime(1100);

      vi.useRealTimers();
    });

    it('falls back to window.print if iframe creation fails or errors', () => {
      const winPrintSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => {
        throw new Error('DOM append error');
      });

      const result = printThermalReceipt(sampleData, "Aling Nena's Tindahan");
      expect(result).toBe(true);
      expect(winPrintSpy).toHaveBeenCalled();
    });
  });

  describe('isBluetoothPrintSupported', () => {
    it('returns false when navigator.bluetooth is undefined', () => {
      const origBluetooth = (navigator as any).bluetooth;
      delete (navigator as any).bluetooth;

      expect(isBluetoothPrintSupported()).toBe(false);

      if (origBluetooth) (navigator as any).bluetooth = origBluetooth;
    });

    it('returns true when navigator.bluetooth is defined', () => {
      (navigator as any).bluetooth = {};
      expect(isBluetoothPrintSupported()).toBe(true);
      delete (navigator as any).bluetooth;
    });
  });

  describe('printBluetoothReceipt', () => {
    it('returns error when Web Bluetooth is not supported', async () => {
      delete (navigator as any).bluetooth;
      const res = await printBluetoothReceipt(sampleData, 'Store');
      expect(res.success).toBe(false);
      expect(res.error).toContain('not supported');
    });

    it('connects to GATT and writes 20-byte BLE MTU-safe chunks when device is paired', async () => {
      const writtenChunks: Uint8Array[] = [];
      const writeValueMock = vi.fn().mockImplementation(async (chunk: Uint8Array) => {
        writtenChunks.push(chunk);
      });
      const writeValueWithoutResponseMock = vi.fn();
      const disconnectMock = vi.fn();

      const fakeDevice = {
        gatt: {
          connected: true,
          connect: vi.fn().mockResolvedValue({
            getPrimaryServices: vi.fn().mockResolvedValue([
              {
                getCharacteristics: vi.fn().mockResolvedValue([
                  {
                    properties: { write: true, writeWithoutResponse: false },
                    writeValue: writeValueMock,
                    writeValueWithoutResponse: writeValueWithoutResponseMock
                  }
                ])
              }
            ])
          }),
          disconnect: disconnectMock
        }
      };

      (navigator as any).bluetooth = {
        requestDevice: vi.fn().mockResolvedValue(fakeDevice)
      };

      const res = await printBluetoothReceipt(sampleData, 'Store', { paperWidth: '58mm' });
      expect(res.success).toBe(true);
      expect(writeValueMock).toHaveBeenCalled();
      expect(writeValueWithoutResponseMock).not.toHaveBeenCalled();
      expect(writtenChunks.length).toBeGreaterThan(10);
      expect(writtenChunks.every((c) => c.byteLength <= 20)).toBe(true);
      expect(disconnectMock).toHaveBeenCalled();

      delete (navigator as any).bluetooth;
    });

    it('handles cancellation by user gracefully', async () => {
      const cancelError = new Error('User cancelled');
      cancelError.name = 'NotFoundError';

      (navigator as any).bluetooth = {
        requestDevice: vi.fn().mockRejectedValue(cancelError)
      };

      const res = await printBluetoothReceipt(sampleData, 'Store');
      expect(res.success).toBe(false);
      expect(res.error).toContain('cancelled');

      delete (navigator as any).bluetooth;
    });

    it('handles printer with no writable characteristic', async () => {
      const fakeDevice = {
        gatt: {
          connected: true,
          connect: vi.fn().mockResolvedValue({
            getPrimaryServices: vi.fn().mockResolvedValue([
              {
                getCharacteristics: vi.fn().mockResolvedValue([
                  {
                    properties: { read: true, write: false }
                  }
                ])
              }
            ])
          }),
          disconnect: vi.fn()
        }
      };

      (navigator as any).bluetooth = {
        requestDevice: vi.fn().mockResolvedValue(fakeDevice)
      };

      const res = await printBluetoothReceipt(sampleData, 'Store');
      expect(res.success).toBe(false);
      expect(res.error).toContain('No writable ESC/POS characteristic');

      delete (navigator as any).bluetooth;
    });
  });
});
