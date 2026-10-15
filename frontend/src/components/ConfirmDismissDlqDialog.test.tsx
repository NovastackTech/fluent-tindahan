import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { ConfirmDismissDlqDialog } from './ConfirmDismissDlqDialog';
import { sariSariLightTheme } from '../theme/theme';
import { useLanguageStore } from '../state/languageStore';
import type { DeadLetterRecord } from '../db/db';

describe('ConfirmDismissDlqDialog', () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: 'tl' });
  });

  const renderDialog = (props: {
    isOpen: boolean;
    item: DeadLetterRecord | null;
    onClose: () => void;
    onConfirm: () => void;
  }) => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <ConfirmDismissDlqDialog {...props} />
      </FluentProvider>
    );
  };

  it('renders nothing when isOpen is false or item is null', () => {
    renderDialog({
      isOpen: false,
      item: null,
      onClose: vi.fn(),
      onConfirm: vi.fn()
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders confirmation dialog naming Sale entity and details', () => {
    const saleItem: DeadLetterRecord = {
      id: 'dlq-sale-1',
      entity: 'Sale',
      action: 'Insert',
      timestamp: '2026-10-15T10:00:00.000Z',
      payload: {
        id: 'sale-123',
        totalAmount: 350.50,
        paymentMethod: 'Cash',
        date: '2026-10-15T10:00:00.000Z',
        items: [{ productId: 'p1', qty: 2 }]
      },
      retryCount: 3,
      errorMessage: 'Database connection failed',
      failedAt: '2026-10-15T10:05:00.000Z'
    };

    renderDialog({
      isOpen: true,
      item: saleItem,
      onClose: vi.fn(),
      onConfirm: vi.fn()
    });

    // Check entity name and warning
    expect(screen.getByText('Benta (Sale)')).toBeInTheDocument();
    expect(screen.getByText(/Kumpirmahin ang Pag-dismiss ng Datos/i)).toBeInTheDocument();
    expect(screen.getByText(/350.50/)).toBeInTheDocument();
    expect(screen.getByText(/Database connection failed/)).toBeInTheDocument();
  });

  it('renders confirmation dialog naming UtangLedger entity and details', () => {
    const utangItem: DeadLetterRecord = {
      id: 'dlq-utang-1',
      entity: 'UtangLedger',
      action: 'Insert',
      timestamp: '2026-10-15T10:00:00.000Z',
      payload: {
        id: 'utang-123',
        customerId: 'cust-456',
        type: 'Credit',
        amount: 150.00,
        notes: '2 pack ng noodles'
      },
      retryCount: 3,
      errorMessage: 'Customer account locked',
      failedAt: '2026-10-15T10:05:00.000Z'
    };

    renderDialog({
      isOpen: true,
      item: utangItem,
      onClose: vi.fn(),
      onConfirm: vi.fn()
    });

    expect(screen.getByText('Talaan ng Utang / Bayad (UtangLedger)')).toBeInTheDocument();
    expect(screen.getByText(/Utang \(Credit\)/)).toBeInTheDocument();
    expect(screen.getByText(/150.00/)).toBeInTheDocument();
    expect(screen.getByText(/2 pack ng noodles/)).toBeInTheDocument();
    expect(screen.getByText(/Customer account locked/)).toBeInTheDocument();
  });

  it('renders confirmation dialog naming GCashTxn entity and details', () => {
    const gcashItem: DeadLetterRecord = {
      id: 'dlq-gcash-1',
      entity: 'GCashTxn',
      action: 'Insert',
      timestamp: '2026-10-15T10:00:00.000Z',
      payload: {
        id: 'gcash-123',
        type: 'CashIn',
        amount: 1000.00,
        fee: 15.00,
        refNo: '987654321',
        customerPhone: '09171234567'
      },
      retryCount: 3,
      errorMessage: 'Duplicate reference number',
      failedAt: '2026-10-15T10:05:00.000Z'
    };

    renderDialog({
      isOpen: true,
      item: gcashItem,
      onClose: vi.fn(),
      onConfirm: vi.fn()
    });

    expect(screen.getByText('GCash Transaksyon (GCashTxn)')).toBeInTheDocument();
    expect(screen.getByText('Cash-In')).toBeInTheDocument();
    expect(screen.getByText(/1,000.00/)).toBeInTheDocument();
    expect(screen.getByText('987654321')).toBeInTheDocument();
    expect(screen.getByText('09171234567')).toBeInTheDocument();
  });

  it('triggers onConfirm and onClose when clicking Confirm button', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    const productItem: DeadLetterRecord = {
      id: 'dlq-prod-1',
      entity: 'Product',
      action: 'Insert',
      timestamp: '2026-10-15T10:00:00.000Z',
      payload: {
        id: 'prod-123',
        name: 'Lucky Me Pancit Canton',
        price: 18,
        cost: 15,
        stockQty: 24
      },
      retryCount: 3,
      errorMessage: 'Product sync failed',
      failedAt: '2026-10-15T10:05:00.000Z'
    };

    renderDialog({
      isOpen: true,
      item: productItem,
      onClose,
      onConfirm
    });

    expect(screen.getByText('Paninda (Product)')).toBeInTheDocument();
    expect(screen.getByText('Lucky Me Pancit Canton')).toBeInTheDocument();

    const confirmBtn = screen.getByTestId('confirm-dismiss-dlq-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('triggers onClose without calling onConfirm when clicking Cancel button', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    const customerItem: DeadLetterRecord = {
      id: 'dlq-cust-1',
      entity: 'Customer',
      action: 'Insert',
      timestamp: '2026-10-15T10:00:00.000Z',
      payload: {
        id: 'cust-123',
        name: 'Nanay Corazon',
        phone: '09181234567',
        totalUtangBalance: 450
      },
      retryCount: 3,
      errorMessage: 'Network timeout',
      failedAt: '2026-10-15T10:05:00.000Z'
    };

    renderDialog({
      isOpen: true,
      item: customerItem,
      onClose,
      onConfirm
    });

    expect(screen.getByText('Suki (Customer)')).toBeInTheDocument();
    expect(screen.getByText('Nanay Corazon')).toBeInTheDocument();

    const cancelBtn = screen.getByTestId('cancel-dismiss-dlq-btn');
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
