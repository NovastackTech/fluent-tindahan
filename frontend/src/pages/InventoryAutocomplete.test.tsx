import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { InventoryPage } from './InventoryPage';
import { sariSariLightTheme } from '../theme/theme';
import { db } from '../db/db';
import { useLanguageStore } from '../state/languageStore';
import { useSubscriptionStore } from '../state/subscriptionStore';
import { useAuthStore } from '../state/authStore';
import { getCatalog } from '../db/catalog';

describe('InventoryPage - Catalog Autocomplete & Auto-fill', () => {
  beforeEach(async () => {
    useLanguageStore.setState({ language: 'en' });
    useAuthStore.setState({ tenantId: 'tenant-autocomplete-test' });
    useSubscriptionStore.setState({ tier: 'Libre', isUpgradeModalOpen: false });
    await db.products.clear();
    await db.syncQueue.clear();
  });

  const renderPage = () => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <InventoryPage />
      </FluentProvider>
    );
  };

  it('renders datalists for Product Name and Barcode populated with all catalog options from CSV', async () => {
    renderPage();

    const addBtn = screen.getByRole('button', { name: /Add Product/i });
    fireEvent.click(addBtn);

    const nameDatalist = document.getElementById('catalog-product-names-list');
    const barcodeDatalist = document.getElementById('catalog-barcodes-list');

    expect(nameDatalist).toBeInTheDocument();
    expect(barcodeDatalist).toBeInTheDocument();

    const catalog = getCatalog();
    const nameOptions = nameDatalist?.querySelectorAll('option');
    expect(nameOptions?.length).toBe(catalog.length);
    expect(nameOptions && nameOptions.length).toBeGreaterThan(100);

    const barcodeOptions = barcodeDatalist?.querySelectorAll('option');
    const expectedBarcodes = catalog.filter((c) => Boolean(c.barcode));
    expect(barcodeOptions?.length).toBe(expectedBarcodes.length);
    expect(barcodeOptions && barcodeOptions.length).toBeGreaterThan(100);
  });

  it('auto-fills barcode, category, cost, and price when a catalog product name is selected', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Add Product/i }));

    const nameInput = screen.getByPlaceholderText(/Lucky Me Pancit Canton Kalamansi/i);
    const barcodeInput = screen.getByPlaceholderText(/4800016644810/i);
    const costInput = screen.getByRole('spinbutton', { name: /Cost Price/i });
    const priceInput = screen.getByRole('spinbutton', { name: /Retail Price/i });
    const categoryInput = screen.getByPlaceholderText(/Noodles & Instant Food/i);

    // Select Lucky Me Pancit Canton Kalamansi by name
    fireEvent.change(nameInput, {
      target: { value: 'Lucky Me! Instant Pancit Canton Kalamansi' }
    });

    expect(barcodeInput).toHaveValue('4800016644026');
    expect(categoryInput).toHaveValue('Instant Noodles');
    expect(costInput).toHaveValue(13.25);
    expect(priceInput).toHaveValue(16);
  });

  it('updates auto-filled fields when switching to another catalog product name', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Add Product/i }));

    const nameInput = screen.getByPlaceholderText(/Lucky Me Pancit Canton Kalamansi/i);
    const barcodeInput = screen.getByPlaceholderText(/4800016644810/i);
    const costInput = screen.getByRole('spinbutton', { name: /Cost Price/i });
    const priceInput = screen.getByRole('spinbutton', { name: /Retail Price/i });
    const categoryInput = screen.getByPlaceholderText(/Noodles & Instant Food/i);

    fireEvent.change(nameInput, {
      target: { value: 'Lucky Me! Instant Pancit Canton Kalamansi' }
    });
    expect(barcodeInput).toHaveValue('4800016644026');

    // Switch to Kopiko Blanca 3-in-1 Coffee
    fireEvent.change(nameInput, {
      target: { value: 'Kopiko Blanca 3-in-1 Coffee' }
    });

    expect(barcodeInput).toHaveValue('8996001414002');
    expect(categoryInput).toHaveValue('Coffee & Beverages');
    expect(costInput).toHaveValue(12.2);
    expect(priceInput).toHaveValue(15);
  });

  it('auto-fills items located deep in the catalog CSV beyond the initial 20 items', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Add Product/i }));

    const nameInput = screen.getByPlaceholderText(/Lucky Me Pancit Canton Kalamansi/i);
    const barcodeInput = screen.getByPlaceholderText(/4800016644810/i);
    const costInput = screen.getByRole('spinbutton', { name: /Cost Price/i });
    const priceInput = screen.getByRole('spinbutton', { name: /Retail Price/i });
    const categoryInput = screen.getByPlaceholderText(/Noodles & Instant Food/i);

    // Select the last item in the catalog (line 139 in CSV)
    fireEvent.change(nameInput, {
      target: { value: 'Winston Red Single Stick (Tingi)' }
    });

    expect(barcodeInput).toHaveValue('2000000000107');
    expect(categoryInput).toHaveValue('Tobacco');
    expect(costInput).toHaveValue(7.5);
    expect(priceInput).toHaveValue(9);
  });

  it('auto-fills name, category, cost, and price when a catalog barcode is entered', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Add Product/i }));

    const nameInput = screen.getByPlaceholderText(/Lucky Me Pancit Canton Kalamansi/i);
    const barcodeInput = screen.getByPlaceholderText(/4800016644810/i);
    const costInput = screen.getByRole('spinbutton', { name: /Cost Price/i });
    const priceInput = screen.getByRole('spinbutton', { name: /Retail Price/i });
    const categoryInput = screen.getByPlaceholderText(/Noodles & Instant Food/i);

    // Enter barcode for Lucky Me! Instant Pancit Canton Chili Mansi
    fireEvent.change(barcodeInput, {
      target: { value: '4800016644040' }
    });

    expect(nameInput).toHaveValue('Lucky Me! Instant Pancit Canton Chili Mansi');
    expect(categoryInput).toHaveValue('Instant Noodles');
    expect(costInput).toHaveValue(13.25);
    expect(priceInput).toHaveValue(16);
  });

  it('preserves user custom barcode when selecting a catalog product name', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Add Product/i }));

    const nameInput = screen.getByPlaceholderText(/Lucky Me Pancit Canton Kalamansi/i);
    const barcodeInput = screen.getByPlaceholderText(/4800016644810/i);

    // User types custom store barcode first
    fireEvent.change(barcodeInput, {
      target: { value: 'STORE-CUSTOM-999' }
    });

    // Then user selects product name from catalog
    fireEvent.change(nameInput, {
      target: { value: 'Lucky Me! Instant Pancit Canton Kalamansi' }
    });

    // Custom barcode should remain preserved
    expect(barcodeInput).toHaveValue('STORE-CUSTOM-999');
    expect(screen.getByRole('spinbutton', { name: /Retail Price/i })).toHaveValue(16);
  });

  it('supports freeform custom product entry and saves correctly to Dexie', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Add Product/i }));

    const nameInput = screen.getByPlaceholderText(/Lucky Me Pancit Canton Kalamansi/i);
    const barcodeInput = screen.getByPlaceholderText(/4800016644810/i);
    const categoryInput = screen.getByPlaceholderText(/Noodles & Instant Food/i);
    const costInput = screen.getByRole('spinbutton', { name: /Cost Price/i });
    const priceInput = screen.getByRole('spinbutton', { name: /Retail Price/i });

    fireEvent.change(nameInput, {
      target: { value: 'Custom Homemade Chicharon 100g' }
    });
    fireEvent.change(barcodeInput, {
      target: { value: '9876543210123' }
    });
    fireEvent.change(categoryInput, {
      target: { value: 'Snacks' }
    });
    fireEvent.change(costInput, { target: { value: '25' } });
    fireEvent.change(priceInput, { target: { value: '35' } });

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(async () => {
      const saved = await db.products.where('barcode').equals('9876543210123').first();
      expect(saved).toBeDefined();
      expect(saved?.name).toBe('Custom Homemade Chicharon 100g');
      expect(saved?.price).toBe(35);
      expect(saved?.cost).toBe(25);
    });
  });
});
