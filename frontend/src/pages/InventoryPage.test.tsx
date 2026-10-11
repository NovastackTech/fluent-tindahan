import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { InventoryPage } from './InventoryPage';
import { sariSariLightTheme } from '../theme/theme';
import { db } from '../db/db';

import { useLanguageStore } from '../state/languageStore';
import { useSubscriptionStore } from '../state/subscriptionStore';

describe('InventoryPage', () => {
  beforeEach(async () => {
    useLanguageStore.setState({ language: 'tl' });
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

    // The inputs for cost, price, stock
    const numberInputs = screen.getAllByRole('spinbutton');
    // First spinbutton is Cost, second is Price, third is Stock Qty
    fireEvent.change(numberInputs[0], { target: { value: '12' } });
    fireEvent.change(numberInputs[1], { target: { value: '15' } });
    fireEvent.change(numberInputs[2], { target: { value: '50' } });

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
});

