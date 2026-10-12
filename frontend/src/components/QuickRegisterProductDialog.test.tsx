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

    const costInput = screen.getByRole('spinbutton', { name: /Puhunan|Cost Price/i });
    const priceInput = screen.getByRole('spinbutton', { name: /Presyo ng Tinda|Retail Price/i });

    fireEvent.change(costInput, { target: { value: '10' } });
    fireEvent.change(priceInput, { target: { value: '15' } });

    expect(screen.getByText(/₱5.00/)).toBeInTheDocument();
    expect(screen.getByText(/33.3%/)).toBeInTheDocument();
  });

  it('registers product and saves to Dexie and triggers callback', async () => {
    const { onProductRegistered, onClose } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /Oo, Irehistro ang Produkto|Yes, Register Product|Irehistro/i }));

    const nameInput = screen.getByRole('textbox', { name: /Pangalan ng Produkto|Product Name/i });
    fireEvent.change(nameInput, { target: { value: 'Chippy Barbecue 110g' } });

    const priceInput = screen.getByRole('spinbutton', { name: /Presyo ng Tinda|Retail Price/i });
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
