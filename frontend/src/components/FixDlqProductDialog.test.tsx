import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { FixDlqProductDialog } from './FixDlqProductDialog';
import { db, type DeadLetterRecord } from '../db/db';
import { useLanguageStore } from '../state/languageStore';

describe('FixDlqProductDialog', () => {
  beforeEach(async () => {
    await db.products.clear();
    await db.deadLetterQueue.clear();
    await db.syncQueue.clear();
    useLanguageStore.setState({ language: 'en' });
  });

  const renderDialog = (item: DeadLetterRecord | null, isOpen = true, onClose = () => {}) => {
    return render(
      <FluentProvider theme={webLightTheme}>
        <FixDlqProductDialog isOpen={isOpen} item={item} onClose={onClose} />
      </FluentProvider>
    );
  };

  it('renders nothing when isOpen is false or item is null', () => {
    renderDialog(null, false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders product details and sync error in dialog', async () => {
    const item: DeadLetterRecord = {
      id: 'dlq-test-1',
      entity: 'Product',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: {
        id: 'prod-test-1',
        name: 'Super Soda Can',
        price: 99999999999,
        cost: 20,
        stockQty: 50,
        category: 'Beverages'
      },
      retryCount: 3,
      errorMessage: 'Price exceeds maximum allowed bounds',
      failedAt: new Date().toISOString()
    };

    renderDialog(item);

    await waitFor(() => {
      expect(screen.getByText('Fix Product (Dead Letter Queue)')).toBeInTheDocument();
      expect(screen.getByText('Price exceeds maximum allowed bounds')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Super Soda Can')).toBeInTheDocument();
      expect(screen.getByDisplayValue('99999999999')).toBeInTheDocument();
    });
  });

  it('validates bounds and submits corrected price without auto-clamping', async () => {
    await db.products.put({
      id: 'prod-test-2',
      tenantId: 'tenant-1',
      name: 'Wrong Price Snack',
      price: 0,
      cost: 15,
      stockQty: 10,
      updatedAt: new Date().toISOString()
    });

    const item: DeadLetterRecord = {
      id: 'dlq-test-2',
      entity: 'Product',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: {
        id: 'prod-test-2',
        name: 'Wrong Price Snack',
        price: 0,
        cost: 15,
        stockQty: 10
      },
      retryCount: 3,
      errorMessage: 'Price must be positive',
      failedAt: new Date().toISOString()
    };
    await db.deadLetterQueue.put(item);

    let closed = false;
    render(
      <FluentProvider theme={webLightTheme}>
        <FixDlqProductDialog isOpen={true} item={item} onClose={() => { closed = true; }} />
      </FluentProvider>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Wrong Price Snack')).toBeInTheDocument();
    });

    const priceInput = screen.getByTestId('dlq-product-price-input');
    fireEvent.change(priceInput, { target: { value: '25.50' } });

    const saveBtn = screen.getByRole('button', { name: /Save & Retry/i });
    fireEvent.click(saveBtn);

    await waitFor(async () => {
      const updated = await db.products.get('prod-test-2');
      expect(updated?.price).toBe(25.50);
      expect(closed).toBe(true);
    });

    // DLQ item was removed and queued to syncQueue
    const dlq = await db.deadLetterQueue.toArray();
    expect(dlq).toHaveLength(0);

    const queued = await db.syncQueue.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0].payload.price).toBe(25.50);
  });

  it('enforces 200 character max length on product name in DLQ editor', async () => {
    const item: DeadLetterRecord = {
      id: 'dlq-test-3',
      entity: 'Product',
      action: 'Insert',
      timestamp: new Date().toISOString(),
      payload: {
        id: 'prod-test-3',
        name: 'A'.repeat(205),
        price: 25,
        cost: 15,
        stockQty: 10
      },
      retryCount: 3,
      errorMessage: 'value too long for type character varying(200)',
      failedAt: new Date().toISOString()
    };
    await db.deadLetterQueue.put(item);

    renderDialog(item);

    await waitFor(() => {
      expect(screen.getByDisplayValue('A'.repeat(205))).toBeInTheDocument();
    });

    const nameInput = screen.getByTestId('dlq-product-name-input');
    expect(nameInput).toHaveAttribute('maxLength', '200');

    const saveBtn = screen.getByRole('button', { name: /Save & Retry/i });
    fireEvent.click(saveBtn);

    expect(await screen.findByText(/Product name cannot exceed 200 characters/i)).toBeInTheDocument();
  });
});
