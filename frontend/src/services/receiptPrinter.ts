import type { ReceiptData } from '../components/ReceiptModal';
import type { PaperWidth } from '../state/printerStore';

export interface PrintOptions {
  paperWidth?: PaperWidth;
  businessName?: string;
  tier?: 'Libre' | 'TindahanPro' | 'NegosyoPlus';
}

export interface BluetoothPrintResult {
  success: boolean;
  error?: string;
}

/**
 * Generates thermal receipt printer HTML specifically styled for 58mm or 80mm thermal rolls.
 * High-contrast, black-and-white, monospace layout without browser margins or screen fluff.
 */
export function generateThermalReceiptHtml(
  data: ReceiptData,
  businessName: string,
  paperWidth: PaperWidth = '58mm',
  tier: 'Libre' | 'TindahanPro' | 'NegosyoPlus' = 'Libre'
): string {
  const is58 = paperWidth === '58mm';
  const widthMm = is58 ? '58mm' : '80mm';
  const maxContentMm = is58 ? '48mm' : '72mm';
  const formattedDate = new Date(data.date).toLocaleString('en-PH', {
    dateStyle: 'short',
    timeStyle: 'short'
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt - ${data.saleId.slice(0, 8)}</title>
  <style>
    @page {
      margin: 0;
      size: auto;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: ${widthMm};
      background: #ffffff;
      color: #000000;
      font-family: 'Courier New', Courier, monospace;
      font-size: ${is58 ? '11px' : '13px'};
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt-container {
      width: ${maxContentMm};
      margin: 0 auto;
      padding: 4mm 1mm;
      box-sizing: border-box;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .title {
      font-size: ${is58 ? '14px' : '16px'};
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 2px;
      word-break: break-word;
    }
    .divider {
      border-top: 1px dashed #000000;
      margin: 4px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
      word-break: break-word;
    }
    .row-item {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
    }
    .item-name {
      max-width: 70%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .total-row {
      font-size: ${is58 ? '13px' : '15px'};
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
      border-top: 1px solid #000000;
      border-bottom: 1px solid #000000;
      padding: 3px 0;
    }
    .disclaimer {
      font-size: 9px;
      text-align: center;
      margin-top: 8px;
      padding-top: 4px;
      border-top: 1px dashed #444444;
      line-height: 1.3;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="text-center">
      <div class="title">${businessName}</div>
      <div>Petsa: ${formattedDate}</div>
      <div>Ref: #${data.saleId.slice(0, 8)}</div>
    </div>

    <div class="divider"></div>

    <div class="items-list">
      ${data.items.map((item) => `
        <div class="row-item">
          <span class="item-name">${item.qty}x ${item.name}</span>
          <span class="text-right">&#8369;${item.subtotal.toFixed(2)}</span>
        </div>
      `).join('')}
    </div>

    <div class="total-row">
      <span>KABUUAN (TOTAL):</span>
      <span>&#8369;${data.totalAmount.toFixed(2)}</span>
    </div>

    <div class="row">
      <span>Paraan ng Bayad:</span>
      <span class="bold">${data.paymentMethod}</span>
    </div>

    ${data.cashReceived !== undefined && data.cashReceived > 0 ? `
      <div class="row">
        <span>Bayad (Cash):</span>
        <span>&#8369;${data.cashReceived.toFixed(2)}</span>
      </div>
      <div class="row bold">
        <span>Sukli:</span>
        <span>&#8369;${(data.changeGiven || 0).toFixed(2)}</span>
      </div>
    ` : ''}

    ${data.customerName ? `
      <div class="divider"></div>
      <div class="row">
        <span>Suki:</span>
        <span class="bold">${data.customerName}</span>
      </div>
      ${data.customerUtangBalance !== undefined ? `
        <div class="row">
          <span>Natitirang Utang:</span>
          <span class="bold">&#8369;${data.customerUtangBalance.toFixed(2)}</span>
        </div>
      ` : ''}
    ` : ''}

    <div class="disclaimer">
      *** HINDI OPISYAL NA RESIBO ***<br />
      *** FOR ACKNOWLEDGMENT ONLY ***<br />
      Maraming Salamat po sa Pagbili!
      ${tier === 'Libre' ? '<br />Powered by Fluent Tindahan 🛒🇵🇭' : ''}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Triggers thermal receipt printer output via browser printing engine.
 * Embeds a dedicated thermal receipt document into a hidden iframe with strict 58mm/80mm styling.
 */
export function printThermalReceipt(
  data: ReceiptData,
  businessName: string,
  options: PrintOptions = {}
): boolean {
  if (typeof window === 'undefined') return false;

  const paperWidth = options.paperWidth || '58mm';
  const tier = options.tier || 'Libre';
  const html = generateThermalReceiptHtml(data, businessName, paperWidth, tier);

  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('title', 'Receipt Thermal Print Frame');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      if (iframe.parentNode) document.body.removeChild(iframe);
      window.print();
      return true;
    }

    doc.open();
    doc.write(html);
    doc.close();

    // Allow CSS & DOM to render before calling print
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Iframe print threw error, falling back to window.print():', err);
        window.print();
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }
    }, 150);

    return true;
  } catch (err) {
    console.error('printThermalReceipt error:', err);
    window.print();
    return true;
  }
}

/**
 * Encodes receipt data into standard ESC/POS binary format for thermal receipt printers.
 * Supported by 58mm/80mm thermal printers (Goojprt, Xprinter, Epson, Sunmi, PT-210, etc.)
 */
export function generateEscPosReceipt(
  data: ReceiptData,
  businessName: string,
  paperWidth: PaperWidth = '58mm'
): Uint8Array {
  const maxChars = paperWidth === '58mm' ? 32 : 48;
  const encoder = new TextEncoder();
  const bytes: number[] = [];

  // ESC @: Initialize printer
  bytes.push(0x1B, 0x40);

  // ESC t 0: Code table PC437
  bytes.push(0x1B, 0x74, 0x00);

  // Center alignment: ESC a 1
  bytes.push(0x1B, 0x61, 0x01);

  // Bold ON: ESC E 1
  bytes.push(0x1B, 0x45, 0x01);
  // Double height for title: GS ! 0x01
  bytes.push(0x1D, 0x21, 0x01);
  bytes.push(...encoder.encode(businessName + '\n'));
  // Reset character size: GS ! 0x00
  bytes.push(0x1D, 0x21, 0x00);
  // Bold OFF: ESC E 0
  bytes.push(0x1B, 0x45, 0x00);

  const formattedDate = new Date(data.date).toLocaleString('en-PH', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
  bytes.push(...encoder.encode(`Petsa: ${formattedDate}\n`));
  bytes.push(...encoder.encode(`Ref: #${data.saleId.slice(0, 8)}\n`));

  // Left alignment: ESC a 0
  bytes.push(0x1B, 0x61, 0x00);
  bytes.push(...encoder.encode('-'.repeat(maxChars) + '\n'));

  // Items
  for (const item of data.items) {
    const left = `${item.qty}x ${item.name}`;
    const right = `P${item.subtotal.toFixed(2)}`;
    if (left.length + right.length + 1 <= maxChars) {
      const spaces = ' '.repeat(maxChars - left.length - right.length);
      bytes.push(...encoder.encode(left + spaces + right + '\n'));
    } else {
      bytes.push(...encoder.encode(left + '\n'));
      const spaces = ' '.repeat(Math.max(0, maxChars - right.length));
      bytes.push(...encoder.encode(spaces + right + '\n'));
    }
  }

  bytes.push(...encoder.encode('-'.repeat(maxChars) + '\n'));

  // TOTAL in bold
  bytes.push(0x1B, 0x45, 0x01);
  const totalLeft = 'TOTAL:';
  const totalRight = `P${data.totalAmount.toFixed(2)}`;
  const totalSpaces = ' '.repeat(Math.max(0, maxChars - totalLeft.length - totalRight.length));
  bytes.push(...encoder.encode(totalLeft + totalSpaces + totalRight + '\n'));
  bytes.push(0x1B, 0x45, 0x00);

  // Payment details
  bytes.push(...encoder.encode(`Bayad: ${data.paymentMethod}\n`));

  if (data.cashReceived !== undefined && data.cashReceived > 0) {
    bytes.push(...encoder.encode(`Inabot: P${data.cashReceived.toFixed(2)}\n`));
    bytes.push(...encoder.encode(`Sukli: P${(data.changeGiven || 0).toFixed(2)}\n`));
  }

  if (data.customerName) {
    bytes.push(...encoder.encode(`Suki: ${data.customerName}\n`));
    if (data.customerUtangBalance !== undefined) {
      bytes.push(...encoder.encode(`Natitirang Utang: P${data.customerUtangBalance.toFixed(2)}\n`));
    }
  }

  // Center alignment for disclaimer: ESC a 1
  bytes.push(0x1B, 0x61, 0x01);
  bytes.push(...encoder.encode('\n*** HINDI OPISYAL NA RESIBO ***\n'));
  bytes.push(...encoder.encode('*** FOR ACKNOWLEDGMENT ONLY ***\n'));
  bytes.push(...encoder.encode('Maraming Salamat po!\n'));

  // Feed 4 lines: ESC d 4
  bytes.push(0x1B, 0x64, 0x04);

  // Partial Cut paper: GS V 66 0
  bytes.push(0x1D, 0x56, 0x42, 0x00);

  return new Uint8Array(bytes);
}

/**
 * Checks whether Web Bluetooth is supported on the current browser/device.
 */
export function isBluetoothPrintSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Connects directly to a Bluetooth ESC/POS receipt printer device and prints.
 */
export async function printBluetoothReceipt(
  data: ReceiptData,
  businessName: string,
  options: PrintOptions = {}
): Promise<BluetoothPrintResult> {
  if (!isBluetoothPrintSupported()) {
    return {
      success: false,
      error: 'Web Bluetooth is not supported on this browser or device.'
    };
  }

  try {
    const rawBytes = generateEscPosReceipt(data, businessName, options.paperWidth || '58mm');

    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [
        { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
        { services: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2'] },
        { services: ['0000ff00-0000-1000-8000-00805f9b34fb'] },
        { namePrefix: 'POS' },
        { namePrefix: 'MPT' },
        { namePrefix: 'Printer' },
        { namePrefix: 'PT-' },
        { namePrefix: 'RP' }
      ],
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        '000018f1-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455'
      ]
    });

    if (!device.gatt) {
      return { success: false, error: 'Cannot connect to Bluetooth device GATT server.' };
    }

    const server = await device.gatt.connect();
    const services = await server.getPrimaryServices();
    let writeChar: any = null;

    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties?.write || char.properties?.writeWithoutResponse) {
          writeChar = char;
          break;
        }
      }
      if (writeChar) break;
    }

    if (!writeChar) {
      if (device.gatt.connected) device.gatt.disconnect();
      return { success: false, error: 'No writable ESC/POS characteristic found on printer.' };
    }

    // Chunk size safe for Bluetooth LE MTU
    const chunkSize = 512;
    for (let i = 0; i < rawBytes.length; i += chunkSize) {
      const chunk = rawBytes.slice(i, i + chunkSize);
      if (writeChar.writeValueWithoutResponse) {
        await writeChar.writeValueWithoutResponse(chunk);
      } else {
        await writeChar.writeValue(chunk);
      }
    }

    await new Promise((res) => setTimeout(res, 500));
    if (device.gatt.connected) {
      device.gatt.disconnect();
    }

    return { success: true };
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err.message?.includes('cancelled')) {
      return { success: false, error: 'Bluetooth printer selection was cancelled.' };
    }
    return { success: false, error: err.message || 'Unknown Bluetooth printing error.' };
  }
}
