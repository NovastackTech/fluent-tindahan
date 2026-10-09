import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { QuickRegisterProductDialog } from './QuickRegisterProductDialog';
import { sariSariLightTheme } from '../theme/theme';
import { db } from '../db/db';

describe('QuickRegisterProductDialog', () => {
  beforeEach(async () => {
    await db.products.clear();
    await db.syncQueue.clear();
  });

  const renderDialog = (props: {
    isOpen?: boolean;
    unrecognizedBarcode?: string | null;
    onClose?: () => void;
    onProductRegistered?: (p: any) => void;
  } = {}) => {
    const onClose = props.onClose || vi.fn();
    const onProductRegistered = props.onProductRegistered || vi.fn();
    return {
      onClose,
      onProductRegistered,
      ...render(
        <FluentProvider theme={sariSariLightTheme}>
          <QuickRegisterProductDialog
            isOpen={props.isOpen ?? true}
            unrecognizedBarcode={props.unrecognizedBarcode ?? '4800012345678'}
            onClose={onClose}
            onProductRegistered={onProductRegistered}
          />
        </FluentProvider>
      )
    };
  };

  it('renders prompt stage when barcode is not found', () => {
    renderDialog();

    expect(screen.getByText(/4800012345678/)).toBeInTheDocument();
    expect(screen.getByText(/Hindi nahanap ang Barcode|Barcode not found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Oo, Irehistro ang Produkto|Yes, Register Product|Irehistro/i })).toBeInTheDocument();
  });

  it('transitions to registration form and pre-fills barcode', () => {
    renderDialog();

    const registerBtn = screen.getByRole('button', { name: /Oo, Irehistro ang Produkto|Yes, Register Product|Irehistro/i });
    fireEvent.click(registerBtn);

    expect(screen.getByText(/Mabilisang Pagrehistro ng Produkto|Quick Product Registration/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('4800012345678')).toBeInTheDocument();
  });

  it('calculates profit and margin preview live', () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /Oo, Irehistro ang Produkto|Yes, Register Product|Irehistro/i }));

    const inputs = screen.getAllByRole('spinbutton');
    // inputs: stock, cost, price
    const costInput = inputs[1];
    const priceInput = inputs[2];

    fireEvent.change(costInput, { target: { value: '10' } });
    fireEvent.change(priceInput, { target: { value: '15' } });

    expect(screen.getByText(/₱5.00/)).toBeInTheDocument();
    expect(screen.getByText(/33.3%/)).toBeInTheDocument();
  });

  it('registers product and saves to Dexie and triggers callback', async () => {
    const { onProductRegistered, onClose } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /Oo, Irehistro ang Produkto|Yes, Register Product|Irehistro/i }));

    const textInputs = screen.getAllByRole('textbox');
    // barcode input is readonly, product name is textInputs[1]
    const nameInput = textInputs[1];
    fireEvent.change(nameInput, { target: { value: 'Chippy Barbecue 110g' } });

    const numInputs = screen.getAllByRole('spinbutton');
    const priceInput = numInputs[2];
    fireEvent.change(priceInput, { target: { value: '25' } });

    const saveBtn = screen.getByRole('button', { name: /I-save ang Produkto|Save Product/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onProductRegistered).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    const saved = await db.products.where('barcode').equals('4800012345678').first();
    expect(saved).toBeDefined();
    expect(saved?.name).toBe('Chippy Barbecue 110g');
    expect(saved?.price).toBe(25);
  });
});
