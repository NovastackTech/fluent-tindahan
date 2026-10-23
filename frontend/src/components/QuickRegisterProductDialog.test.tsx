import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { QuickRegisterProductDialog } from './QuickRegisterProductDialog';
import { sariSariLightTheme } from '../theme/theme';
import { db } from '../db/db';
import { useAuthStore } from '../state/authStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { useLanguageStore } from '../state/languageStore';

describe('QuickRegisterProductDialog', () => {
  beforeEach(async () => {
    useLanguageStore.setState({ language: 'tl' });
    useAuthStore.setState({ tenantId: 'quick-register-tenant' });
    useSubscriptionStore.setState({ tier: 'Libre' });
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

  it('shows inline validation when quick-registering a product with a blank name', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Oo, Irehistro ang Produkto|Yes, Register Product|Irehistro/i }));
    fireEvent.click(screen.getByRole('button', { name: /I-save ang Produkto|Save Product/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Ilagay ang pangalan ng produkto.');
    expect(screen.getByRole('textbox', { name: /Pangalan ng Produkto|Product Name/i }))
      .toHaveAttribute('aria-invalid', 'true');
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('shows inline validation when quick-register retail price is not positive', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Oo, Irehistro ang Produkto|Yes, Register Product|Irehistro/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /Pangalan ng Produkto|Product Name/i }), {
      target: { value: 'No Price Product' }
    });
    fireEvent.click(screen.getByRole('button', { name: /I-save ang Produkto|Save Product/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Dapat mas mataas sa ₱0|Retail price must be greater than ₱0/i);
    expect(screen.getByRole('spinbutton', { name: /Presyo ng Tinda|Retail Price/i }))
      .toHaveAttribute('aria-invalid', 'true');
    expect(alertSpy).not.toHaveBeenCalled();
    await expect(db.products.where('name').equals('No Price Product').count()).resolves.toBe(0);

    // Blank the name and re-submit: name error should show and price error should be cleared
    fireEvent.change(screen.getByRole('textbox', { name: /Pangalan ng Produkto|Product Name/i }), {
      target: { value: '' }
    });
    fireEvent.click(screen.getByRole('button', { name: /I-save ang Produkto|Save Product/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Ilagay ang pangalan ng produkto|Product name is required/i);
    expect(screen.getByRole('textbox', { name: /Pangalan ng Produkto|Product Name/i }))
      .toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('spinbutton', { name: /Presyo ng Tinda|Retail Price/i }))
      .toHaveAttribute('aria-invalid', 'false');

    alertSpy.mockRestore();
  });

  it('shows inline validation when quick-register cost is negative', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Oo, Irehistro ang Produkto|Yes, Register Product|Irehistro/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /Pangalan ng Produkto|Product Name/i }), {
      target: { value: 'Negative Cost Product' }
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: /Puhunan|Cost Price/i }), {
      target: { value: '-1' }
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: /Presyo ng Tinda|Retail Price/i }), {
      target: { value: '10' }
    });
    fireEvent.click(screen.getByRole('button', { name: /I-save ang Produkto|Save Product/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Hindi maaaring negatibo ang puhunan|Cost price cannot be negative/i);
    expect(screen.getByRole('spinbutton', { name: /Puhunan|Cost Price/i })).toHaveAttribute('aria-invalid', 'true');
    expect(alertSpy).not.toHaveBeenCalled();
    await expect(db.products.where('name').equals('Negative Cost Product').count()).resolves.toBe(0);

    // Blank the name and re-submit: name error should show and cost error should be cleared
    fireEvent.change(screen.getByRole('textbox', { name: /Pangalan ng Produkto|Product Name/i }), {
      target: { value: '' }
    });
    fireEvent.click(screen.getByRole('button', { name: /I-save ang Produkto|Save Product/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Ilagay ang pangalan ng produkto|Product name is required/i);
    expect(screen.getByRole('textbox', { name: /Pangalan ng Produkto|Product Name/i }))
      .toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('spinbutton', { name: /Puhunan|Cost Price/i }))
      .toHaveAttribute('aria-invalid', 'false');

    alertSpy.mockRestore();
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

  it('allows the active tenant to add a product when another tenant has 30', async () => {
    await db.products.bulkAdd(Array.from({ length: 30 }, (_, index) => ({
      id: `other-product-${index}`,
      tenantId: 'other-tenant',
      name: `Other Product ${index}`,
      price: 10,
      cost: 8,
      stockQty: 1,
      updatedAt: new Date().toISOString()
    })));

    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Oo, Irehistro ang Produkto|Yes, Register Product|Irehistro/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /Pangalan ng Produkto|Product Name/i }), { target: { value: 'My First Product' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /Presyo ng Tinda|Retail Price/i }), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: /I-save ang Produkto|Save Product/i }));

    await waitFor(async () => {
      const product = await db.products.where('name').equals('My First Product').first();
      expect(product?.tenantId).toBe('quick-register-tenant');
    });
  });

  it('enforces 200 character max length on product name and shows error if exceeded', async () => {
    const { onProductRegistered } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Oo, Irehistro ang Produkto|Yes, Register Product|Irehistro/i }));

    const nameInput = screen.getByRole('textbox', { name: /Pangalan ng Produkto|Product Name/i });
    expect(nameInput).toHaveAttribute('maxLength', '200');

    // Simulate entering > 200 chars
    const longName = 'A'.repeat(205);
    fireEvent.change(nameInput, { target: { value: longName } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /Presyo ng Tinda|Retail Price/i }), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: /I-save ang Produkto|Save Product/i }));

    expect(await screen.findByText(/Hindi dapat lumagpas sa 200 characters|Product name cannot exceed 200 characters/i)).toBeInTheDocument();
    expect(onProductRegistered).not.toHaveBeenCalled();
    const count = await db.products.count();
    expect(count).toBe(0);
  });
});
