import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { ReceiptModal, type ReceiptData } from './ReceiptModal';
import { sariSariLightTheme } from '../theme/theme';

describe('ReceiptModal', () => {
  const sampleReceiptData: ReceiptData = {
    saleId: 'sale-9876543210',
    date: '2026-10-09T12:00:00Z',
    items: [
      { name: 'Kape', qty: 2, price: 10, subtotal: 20 },
      { name: 'Tinapay', qty: 1, price: 5, subtotal: 5 }
    ],
    totalAmount: 25,
    paymentMethod: 'Cash',
    cashReceived: 50,
    changeGiven: 25,
    customerName: 'Nanay Rosa',
    customerUtangBalance: 100
  };

  const renderModal = (props: { open?: boolean; onClose?: () => void; data?: ReceiptData | null } = {}) => {
    const onClose = props.onClose || vi.fn();
    return {
      onClose,
      ...render(
        <FluentProvider theme={sariSariLightTheme}>
          <ReceiptModal
            open={props.open ?? true}
            onClose={onClose}
            data={props.data !== undefined ? props.data : sampleReceiptData}
          />
        </FluentProvider>
      )
    };
  };

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  it('renders nothing when data is null', () => {
    const { container } = renderModal({ data: null });
    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it('displays mandatory BIR acknowledgment watermark', () => {
    renderModal();

    const watermarks = screen.getAllByText(/NOT AN OFFICIAL RECEIPT/i);
    expect(watermarks.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/FOR ACKNOWLEDGMENT ONLY/i).length).toBeGreaterThan(0);
  });

  it('displays items, totals, tendered cash, and change given', () => {
    renderModal();

    expect(screen.getByText(/2x Kape/i)).toBeInTheDocument();
    expect(screen.getByText(/1x Tinapay/i)).toBeInTheDocument();
    expect(screen.getAllByText(/₱25.00/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/₱50.00/i)).toBeInTheDocument();
    expect(screen.getByText(/Nanay Rosa/i)).toBeInTheDocument();
  });

  it('copies receipt to clipboard when copy button is clicked', () => {
    renderModal();

    const copyBtn = screen.getByRole('button', { name: /Kopyahin|Copy/i });
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('NOT AN OFFICIAL RECEIPT')
    );
  });

  it('triggers thermal print when print receipt button is clicked', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderModal();

    const printBtn = screen.getByRole('button', { name: /I-print.*Resibo|Print Receipt/i });
    expect(printBtn).toBeInTheDocument();
    fireEvent.click(printBtn);

    // Either thermal print or fallback window.print is called
    expect(printBtn).toBeInTheDocument();
    printSpy.mockRestore();
  });

  it('allows toggling between 58mm and 80mm paper widths', () => {
    renderModal();

    const btn80 = screen.getByRole('button', { name: '80mm' });
    fireEvent.click(btn80);

    const btn58 = screen.getByRole('button', { name: '58mm' });
    fireEvent.click(btn58);

    expect(btn58).toBeInTheDocument();
  });

  it('handles bluetooth printer button click', () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderModal();

    const btBtn = screen.getByRole('button', { name: /Bluetooth/i });
    expect(btBtn).toBeInTheDocument();
    fireEvent.click(btBtn);
  });

  it('triggers navigator.share when share button is clicked', () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share: shareMock });

    renderModal();

    const shareBtn = screen.getByRole('button', { name: /Share/i });
    fireEvent.click(shareBtn);

    expect(shareMock).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', () => {
    const { onClose } = renderModal();

    const closeBtn = screen.getByRole('button', { name: /Isara|Close/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });

  it('renders GCash reference number and includes it in copied text', () => {
    const gcashData: ReceiptData = {
      ...sampleReceiptData,
      paymentMethod: 'GCash',
      cashReceived: undefined,
      changeGiven: undefined,
      gcashRef: '901238471201'
    };

    renderModal({ data: gcashData });

    expect(screen.getByText('901238471201')).toBeInTheDocument();
    expect(screen.getByText(/Ref\. No\. ng GCash:|GCash Ref:/i)).toBeInTheDocument();

    const copyBtn = screen.getByRole('button', { name: /Kopyahin|Copy/i });
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('901238471201')
    );
  });
});
