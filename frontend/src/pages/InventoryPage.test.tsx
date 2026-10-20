import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { InventoryPage } from './InventoryPage';
import { sariSariLightTheme } from '../theme/theme';
import { db } from '../db/db';

import { useLanguageStore } from '../state/languageStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { useAuthStore } from '../state/authStore';

describe('InventoryPage', () => {
  beforeEach(async () => {
    useLanguageStore.setState({ language: 'tl' });
    useAuthStore.setState({ tenantId: 't-1' });
    useSubscriptionStore.setState({ tier: 'Libre', isUpgradeModalOpen: false });
    await db.products.clear();
    await db.syncQueue.clear();

    await db.products.bulkAdd([
      {
        id: 'inv-1',
        tenantId: 't-1',
        name: 'Lucky Me Pancit Canton Kalamansi',
        price: 16,
        cost: 13,
        barcode: '4800016644026',
        category: 'Instant Noodles',
        stockQty: 3, // Low stock <= 5
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-2',
        tenantId: 't-1',
        name: 'Datu Puti Vinegar 350ml',
        price: 22,
        cost: 18,
        barcode: '4800011223344',
        category: 'Condiments',
        stockQty: 25, // In stock
        updatedAt: new Date().toISOString()
      }
    ]);
  });

  const renderInventory = () => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <InventoryPage />
      </FluentProvider>
    );
  };

  it('renders summary cards and filter pills', async () => {
    renderInventory();

    expect(screen.getByText(/Talaan ng Imbentaryo at Stocks|Inventory & Stock/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText(/Lucky Me Pancit Canton Kalamansi/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Datu Puti Vinegar 350ml/i).length).toBeGreaterThan(0);
    });
  });

  it('translates capacity badges and low-stock hints in the selected language', async () => {
    const makeProducts = (count: number, offset: number) => Array.from({ length: count }, (_, index) => ({
      id: `capacity-${offset + index}`,
      tenantId: 't-1',
      name: `Capacity Product ${offset + index}`,
      price: 10,
      cost: 8,
      stockQty: 6,
      updatedAt: new Date().toISOString()
    }));
    await db.products.bulkAdd(makeProducts(23, 0));
    renderInventory();

    expect(await screen.findByText('Halos puno')).toBeInTheDocument();
    expect(screen.getByText('≤ 5 piraso ang natitira')).toBeInTheDocument();

    await db.products.bulkAdd(makeProducts(5, 23));
    await waitFor(() => expect(screen.getByText('Puno na')).toBeInTheDocument());

    act(() => {
      useLanguageStore.getState().setLanguage('en');
    });

    expect(await screen.findByText('Full')).toBeInTheDocument();
    expect(screen.getByText('≤ 5 units remaining')).toBeInTheDocument();
  });

  it('only lists products belonging to the active tenant', async () => {
    await db.products.add({
      id: 'other-tenant-product',
      tenantId: 't-2',
      name: 'Other Store Product',
      price: 10,
      cost: 8,
      stockQty: 4,
      updatedAt: new Date().toISOString()
    });

    renderInventory();

    await waitFor(() => {
      expect(screen.getAllByText(/Lucky Me Pancit Canton Kalamansi/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Other Store Product')).not.toBeInTheDocument();
  });

  it('filters by low stock items', async () => {
    renderInventory();

    await waitFor(() => {
      expect(screen.getAllByText(/Lucky Me Pancit Canton Kalamansi/i).length).toBeGreaterThan(0);
    });

    const lowStockPill = screen.getByText(/⚠️.*(Paubos na|Low Stock)/i);
    fireEvent.click(lowStockPill);

    await waitFor(() => {
      expect(screen.getAllByText(/Lucky Me Pancit Canton Kalamansi/i).length).toBeGreaterThan(0);
      expect(screen.queryByText(/Datu Puti Vinegar 350ml/i)).not.toBeInTheDocument();
    });
  });

  it('opens add product modal when clicking Add Product button', () => {
    renderInventory();

    const addBtn = screen.getByRole('button', { name: /Magdagdag ng Produkto|Add Product/i });
    fireEvent.click(addBtn);

    expect(screen.getByText(/Magdagdag ng Bagong Produkto|Add New Product/i)).toBeInTheDocument();
  });

  it('shows inline validation when saving a product with a blank name', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderInventory();
    fireEvent.click(screen.getByRole('button', { name: /Magdagdag ng Produkto|Add Product/i }));
    fireEvent.click(screen.getByRole('button', { name: /I-save|Save/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Ilagay ang pangalan ng produkto.');
    expect(screen.getByRole('textbox', { name: /Pangalan ng Produkto|Product Name/i }))
      .toHaveAttribute('aria-invalid', 'true');
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('shows inline validation when retail price is not positive', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderInventory();
    fireEvent.click(screen.getByRole('button', { name: /Magdagdag ng Produkto|Add Product/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /Pangalan ng Produkto|Product Name/i }), {
      target: { value: 'No Price Product' }
    });
    fireEvent.click(screen.getByRole('button', { name: /I-save|Save/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Dapat mas mataas sa ₱0|Retail price must be greater than ₱0/i);
    expect(screen.getByRole('spinbutton', { name: /Presyo ng Tinda|Retail Price/i }))
      .toHaveAttribute('aria-invalid', 'true');
    expect(alertSpy).not.toHaveBeenCalled();
    expect(await db.products.where('name').equals('No Price Product').count()).toBe(0);

    // Blank the name and re-submit: name error should show and price error should be cleared
    fireEvent.change(screen.getByRole('textbox', { name: /Pangalan ng Produkto|Product Name/i }), {
      target: { value: '' }
    });
    fireEvent.click(screen.getByRole('button', { name: /I-save|Save/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Ilagay ang pangalan ng produkto|Product name is required/i);
    expect(screen.getByRole('textbox', { name: /Pangalan ng Produkto|Product Name/i }))
      .toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('spinbutton', { name: /Presyo ng Tinda|Retail Price/i }))
      .toHaveAttribute('aria-invalid', 'false');

    alertSpy.mockRestore();
  });

  it('shows inline validation when cost is negative', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderInventory();
    fireEvent.click(screen.getByRole('button', { name: /Magdagdag ng Produkto|Add Product/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /Pangalan ng Produkto|Product Name/i }), {
      target: { value: 'Negative Cost Product' }
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: /Puhunan|Cost Price/i }), {
      target: { value: '-1' }
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: /Presyo ng Tinda|Retail Price/i }), {
      target: { value: '10' }
    });
    fireEvent.click(screen.getByRole('button', { name: /I-save|Save/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Hindi maaaring negatibo ang puhunan|Cost price cannot be negative/i);
    expect(screen.getByRole('spinbutton', { name: /Puhunan|Cost Price/i })).toHaveAttribute('aria-invalid', 'true');
    expect(alertSpy).not.toHaveBeenCalled();
    expect(await db.products.where('name').equals('Negative Cost Product').count()).toBe(0);

    // Blank the name and re-submit: name error should show and cost error should be cleared
    fireEvent.change(screen.getByRole('textbox', { name: /Pangalan ng Produkto|Product Name/i }), {
      target: { value: '' }
    });
    fireEvent.click(screen.getByRole('button', { name: /I-save|Save/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Ilagay ang pangalan ng produkto|Product name is required/i);
    expect(screen.getByRole('textbox', { name: /Pangalan ng Produkto|Product Name/i }))
      .toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('spinbutton', { name: /Puhunan|Cost Price/i }))
      .toHaveAttribute('aria-invalid', 'false');

    alertSpy.mockRestore();
  });

  it('creates and saves a new product to Dexie via modal', async () => {
    renderInventory();

    const addBtn = screen.getByRole('button', { name: /Magdagdag ng Produkto|Add Product/i });
    fireEvent.click(addBtn);

    const nameInput = screen.getByPlaceholderText(/Lucky Me Pancit Canton Kalamansi/i);
    const categoryInput = screen.getByPlaceholderText(/Noodles & Instant Food/i);
    const barcodeInput = screen.getByPlaceholderText(/4800016644810/i);

    fireEvent.change(nameInput, { target: { value: 'Bear Brand Powdered Milk 33g' } });
    fireEvent.change(categoryInput, { target: { value: 'Dairy' } });
    fireEvent.change(barcodeInput, { target: { value: '4800019998887' } });

    fireEvent.change(screen.getByRole('spinbutton', { name: /Puhunan|Cost Price/i }), { target: { value: '12' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /Presyo ng Tinda|Retail Price/i }), { target: { value: '15' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /Kasalukuyang Stock|Current Stock Qty/i }), { target: { value: '50' } });

    const saveBtn = screen.getByRole('button', { name: /I-save|Save/i });
    fireEvent.click(saveBtn);

    await waitFor(async () => {
      const added = await db.products.where('name').equals('Bear Brand Powdered Milk 33g').first();
      expect(added).toBeDefined();
      expect(added?.price).toBe(15);
      expect(added?.cost).toBe(12);
      expect(added?.stockQty).toBe(50);
      expect(added?.category).toBe('Dairy');
    });
  });

  it('blocks saving a product with SRP exceeding reasonable maximum limit 999,999.99', async () => {
    renderInventory();

    const addBtn = screen.getByRole('button', { name: /Magdagdag ng Produkto|Add Product/i });
    fireEvent.click(addBtn);

    const nameInput = screen.getByPlaceholderText(/Lucky Me Pancit Canton Kalamansi/i);
    fireEvent.change(nameInput, { target: { value: 'QA-TEST Luxury Soda' } });

    const priceInput = screen.getByRole('spinbutton', { name: /Presyo ng Tinda|Retail Price/i });
    fireEvent.change(priceInput, { target: { value: '99999999999' } });

    const saveBtn = screen.getByRole('button', { name: /I-save|Save/i });
    fireEvent.click(saveBtn);

    expect(await screen.findByText(/Hindi maaaring lumampas sa ₱999,999.99 ang presyo|cannot exceed ₱999,999.99/i)).toBeInTheDocument();
    expect(priceInput).toHaveAttribute('aria-invalid', 'true');

    // Ensure not saved to Dexie
    const added = await db.products.where('name').equals('QA-TEST Luxury Soda').first();
    expect(added).toBeUndefined();
    // Ensure not queued in syncQueue
    const syncOps = await db.syncQueue.toArray();
    expect(syncOps.some(op => op.payload?.name === 'QA-TEST Luxury Soda')).toBe(false);
  });

  it('performs quick restock on a product', async () => {
    renderInventory();

    await waitFor(() => {
      expect(screen.getAllByText(/Lucky Me Pancit Canton Kalamansi/i).length).toBeGreaterThan(0);
    });

    const restockButtons = screen.getAllByRole('button', { name: '+6' });
    expect(restockButtons.length).toBeGreaterThan(0);

    fireEvent.click(restockButtons[0]);

    await waitFor(async () => {
      const prod = await db.products.get('inv-1');
      expect(prod?.stockQty).toBe(9); // 3 + 6 = 9
    });
  });

  it('deletes a product via confirmation dialog', async () => {
    renderInventory();

    await waitFor(() => {
      expect(screen.getAllByText(/Lucky Me Pancit Canton Kalamansi/i).length).toBeGreaterThan(0);
    });

    // Find delete buttons
    const deleteButtons = screen.getAllByRole('button', { name: /Burahin ang Produkto|Delete Product/i });
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0]);
    } else {
      // Find by title or icon button
      const allButtons = screen.getAllByRole('button');
      const delBtn = allButtons.find(b => b.querySelector('svg') && b.innerHTML.includes('DeleteRegular') || b.title?.includes('Burahin'));
      if (delBtn) fireEvent.click(delBtn);
    }

    // Confirmation dialog should appear
    const confirmDeleteBtn = await screen.findByRole('button', { name: /Burahin$|Delete$/i });
    expect(screen.getByText(/Sigurado ka bang nais mong burahin|delete this product/i)).toBeInTheDocument();
    fireEvent.click(confirmDeleteBtn);

    await waitFor(async () => {
      const prods = await db.products.toArray();
      expect(prods.find(p => p.id === 'inv-1')).toBeUndefined();
    });
  });

  it('exposes accessible names for header and scanner buttons', async () => {
    const onNavigateMock = vi.fn();
    render(
      <FluentProvider theme={sariSariLightTheme}>
        <InventoryPage onNavigate={onNavigateMock} />
      </FluentProvider>
    );

    expect(screen.getByRole('button', { name: /Magdagdag ng Produkto|Add Product/i })).toHaveAttribute('aria-label');
    expect(screen.getByRole('button', { name: /Mag-import ng CSV|Import CSV/i })).toHaveAttribute('aria-label');
    expect(screen.getByRole('button', { name: /Buksan ang Scanner|Open Scanner/i })).toHaveAttribute('aria-label');
  });

  it('does not display invalid margin percentage when cost is negative', async () => {
    renderInventory();
    fireEvent.click(screen.getByRole('button', { name: /Magdagdag ng Produkto|Add Product/i }));

    const costInput = screen.getByRole('spinbutton', { name: /Puhunan|Unit Cost/i });
    const priceInput = screen.getByRole('spinbutton', { name: /Presyo ng Tinda|Retail Price/i });

    fireEvent.change(costInput, { target: { value: '-5' } });
    fireEvent.change(priceInput, { target: { value: '10' } });

    expect(screen.queryByText('150.0%')).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBe(2);
  });
});

