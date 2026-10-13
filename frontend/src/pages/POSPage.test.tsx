import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { POSPage } from './POSPage';
import { sariSariLightTheme } from '../theme/theme';
import { db } from '../db/db';
import { useCartStore } from '../state/cartStore';
import { usePwaStore } from '../state/pwaStore';
import { _resetUpdateSWFunctionForTest } from '../pwa/registerServiceWorker';
import { useAuthStore } from '../state/authStore';
import { useLanguageStore } from '../state/languageStore';

describe('POSPage', () => {
  beforeEach(async () => {
    useLanguageStore.setState({ language: 'tl' });
    useAuthStore.setState({ tenantId: 't-1' });
    _resetUpdateSWFunctionForTest();
    useCartStore.getState().clearCart();
    await db.products.clear();
    await db.sales.clear();
    await db.saleItems.clear();
    await db.utangLedger.clear();
    await db.customers.clear();
    await db.syncQueue.clear();

    await db.products.add({
      id: 'p-1',
      tenantId: 't-1',
      name: 'Lucky Me Pancit Canton Kalamansi',
      price: 16,
      cost: 13,
      barcode: '4800016644026',
      category: 'Instant Noodles',
      stockQty: 20,
      updatedAt: new Date().toISOString()
    });
  });

  const renderPOS = (props?: { onNavigate?: (tab: any) => void }) => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <POSPage {...props} />
      </FluentProvider>
    );
  };

  it('shows an empty inventory state with CTA when the store has no products yet', async () => {
    await db.products.clear();
    const onNavigateMock = vi.fn();
    renderPOS({ onNavigate: onNavigateMock });

    await waitFor(() => {
      expect(screen.getByText('Wala pang paninda sa tindahan.')).toBeInTheDocument();
      expect(screen.getByText('Magdagdag ng produkto sa Imbentaryo upang magsimulang magbenta.')).toBeInTheDocument();
      expect(screen.queryByText('Walang nahanap na paninda. Subukan ang ibang paghahanap o kategorya.')).not.toBeInTheDocument();
    });

    const ctaBtn = screen.getByRole('button', { name: /Pumunta sa Imbentaryo|Go to Inventory/i });
    fireEvent.click(ctaBtn);
    expect(onNavigateMock).toHaveBeenCalledWith('inventory');
  });

  it('renders search input, category filters, and product grid', async () => {
    renderPOS();

    expect(screen.getByPlaceholderText(/barcode|produkto|product/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Lucky Me Pancit Canton Kalamansi')).toBeInTheDocument();
      expect(screen.getByText('₱16.00')).toBeInTheDocument();
    });
  });

  it('adds product to cart when product card is clicked', async () => {
    renderPOS();

    await waitFor(() => {
      expect(screen.getByText('Lucky Me Pancit Canton Kalamansi')).toBeInTheDocument();
    });

    const productCard = screen.getByText('Lucky Me Pancit Canton Kalamansi').closest('.fui-Card, [role="button"]') ||
      screen.getByText('Lucky Me Pancit Canton Kalamansi');

    fireEvent.click(productCard);

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().getTotalAmount()).toBe(16);
  });

  it('filters products when searching by name', async () => {
    await db.products.add({
      id: 'p-2',
      tenantId: 't-1',
      name: 'Coca Cola 1.5L',
      price: 75,
      cost: 65,
      barcode: '4800011122334',
      category: 'Beverages',
      stockQty: 10,
      updatedAt: new Date().toISOString()
    });

    renderPOS();

    const searchInput = screen.getByPlaceholderText(/barcode|produkto|product/i);
    fireEvent.change(searchInput, { target: { value: 'Coca' } });

    await waitFor(() => {
      expect(screen.getByText('Coca Cola 1.5L')).toBeInTheDocument();
      expect(screen.queryByText('Lucky Me Pancit Canton Kalamansi')).not.toBeInTheDocument();
    });
  });

  it('shows a localized empty state when product search has no matches', async () => {
    renderPOS();

    fireEvent.change(screen.getByPlaceholderText(/barcode|produkto|product/i), {
      target: { value: 'Product That Does Not Exist' }
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Walang nahanap na paninda. Subukan ang ibang paghahanap o kategorya.'
    );
  });

  it('prompts quick registration when barcode is not found on Enter key', async () => {
    renderPOS();

    const searchInput = screen.getByPlaceholderText(/barcode|produkto|product/i);
    fireEvent.change(searchInput, { target: { value: '9999999999999' } });
    fireEvent.submit(searchInput.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/Hindi nahanap ang Barcode|Barcode not found/i)).toBeInTheDocument();
    });
  });

  it('blocks completing a cash sale when tender is short or negative', async () => {
    renderPOS();

    await waitFor(() => {
      expect(screen.getByText('Lucky Me Pancit Canton Kalamansi')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Lucky Me Pancit Canton Kalamansi'));
    fireEvent.click(screen.getByRole('button', { name: /Bayad|Pay/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const completeBtn = screen.getByRole('button', { name: /Kumpletuhin ang Benta|Complete Sale/i });
    const tenderInput = screen.getByLabelText(/Cash received|Tinanggap/i);

    // Short tender (total is 16)
    fireEvent.change(tenderInput, { target: { value: '10' } });
    expect(completeBtn).toBeDisabled();
    expect(screen.getByText(/Short by|Kulang ng/i)).toBeInTheDocument();

    // Negative tender
    fireEvent.change(tenderInput, { target: { value: '-10' } });
    expect(completeBtn).toBeDisabled();

    // Sufficient tender
    fireEvent.change(tenderInput, { target: { value: '20' } });
    expect(completeBtn).toBeEnabled();
  });

  it('completes cash checkout and records sale in Dexie', async () => {
    renderPOS();

    await waitFor(() => {
      expect(screen.getByText('Lucky Me Pancit Canton Kalamansi')).toBeInTheDocument();
    });

    // Add item to cart
    fireEvent.click(screen.getByText('Lucky Me Pancit Canton Kalamansi'));

    // Open checkout from floating cart
    const payBtn = screen.getByRole('button', { name: /Bayad|Pay/i });
    fireEvent.click(payBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Tender exact cash and complete sale
    fireEvent.click(screen.getByRole('button', { name: /Eksaktong|Exact/i }));
    const completeBtn = screen.getByRole('button', { name: /Kumpletuhin ang Benta|Complete Sale/i });
    fireEvent.click(completeBtn);

    await waitFor(async () => {
      const sales = await db.sales.toArray();
      expect(sales).toHaveLength(1);
      expect(sales[0].totalAmount).toBe(16);
      expect(sales[0].paymentMethod).toBe('Cash');

      const items = await db.saleItems.toArray();
      expect(items).toHaveLength(1);
      expect(items[0].productName).toBe('Lucky Me Pancit Canton Kalamansi');
    });
  });

  it('completes utang checkout and records credit in utang ledger', async () => {
    await db.customers.add({
      id: 'cust-pos',
      tenantId: 't-1',
      name: 'Ka Freddie',
      phone: '09191234567',
      totalUtangBalance: 50,
      updatedAt: new Date().toISOString()
    });

    renderPOS();

    await waitFor(() => {
      expect(screen.getByText('Lucky Me Pancit Canton Kalamansi')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Lucky Me Pancit Canton Kalamansi'));

    const payBtn = screen.getByRole('button', { name: /Bayad|Pay/i });
    fireEvent.click(payBtn);

    // Switch payment method to Utang
    const utangTab = screen.getByRole('tab', { name: /Utang/i });
    fireEvent.click(utangTab);

    // Select customer
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'cust-pos' } });

    // Complete sale
    const completeBtn = screen.getByRole('button', { name: /Kumpletuhin ang Benta|Complete Sale/i });
    fireEvent.click(completeBtn);

    await waitFor(async () => {
      const sales = await db.sales.toArray();
      expect(sales).toHaveLength(1);
      expect(sales[0].paymentMethod).toBe('Utang');

      const cust = await db.customers.get('cust-pos');
      expect(cust?.totalUtangBalance).toBe(66); // 50 + 16

      const ledger = await db.utangLedger.toArray();
      expect(ledger).toHaveLength(1);
      expect(ledger[0].amount).toBe(16);
    });
  });

  it('does not render empty parentheses for a customer without a phone', async () => {
    await db.customers.add({
      id: 'cust-no-phone',
      tenantId: 't-1',
      name: 'Suki Without Phone',
      phone: '',
      totalUtangBalance: 0,
      updatedAt: new Date().toISOString()
    });

    renderPOS();
    await waitFor(() => expect(screen.getByText('Lucky Me Pancit Canton Kalamansi')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Lucky Me Pancit Canton Kalamansi'));
    fireEvent.click(screen.getByRole('button', { name: /Bayad|Pay/i }));
    fireEvent.click(screen.getByRole('tab', { name: /Utang/i }));

    const customerOption = screen.getByRole('option', { name: /Suki Without Phone/i });
    expect(customerOption).toHaveTextContent('Suki Without Phone');
    expect(customerOption).not.toHaveTextContent('()');
  });

  it('completes GCash checkout and records sale in Dexie', async () => {
    renderPOS();

    await waitFor(() => {
      expect(screen.getByText('Lucky Me Pancit Canton Kalamansi')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Lucky Me Pancit Canton Kalamansi'));

    const payBtn = screen.getByRole('button', { name: /Bayad|Pay/i });
    fireEvent.click(payBtn);

    // Switch payment method to GCash
    const gcashTab = screen.getByRole('tab', { name: /GCash/i });
    fireEvent.click(gcashTab);

    // Complete sale
    const completeBtn = screen.getByRole('button', { name: /Kumpletuhin ang Benta|Complete Sale/i });
    fireEvent.click(completeBtn);

    await waitFor(async () => {
      const sales = await db.sales.toArray();
      expect(sales).toHaveLength(1);
      expect(sales[0].paymentMethod).toBe('GCash');
      expect(sales[0].totalAmount).toBe(16);
    });
  });

  it('completes Split payment checkout (Cash + GCash)', async () => {
    renderPOS();

    await waitFor(() => {
      expect(screen.getByText('Lucky Me Pancit Canton Kalamansi')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Lucky Me Pancit Canton Kalamansi'));

    const payBtn = screen.getByRole('button', { name: /Bayad|Pay/i });
    fireEvent.click(payBtn);

    // Switch payment method to Split
    const splitTab = screen.getByRole('tab', { name: /Split/i });
    fireEvent.click(splitTab);

    // Input cash and gcash amounts
    fireEvent.change(screen.getByRole('spinbutton', { name: /Halaga sa Cash|Cash Amount/i }), { target: { value: '10' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /Halaga sa GCash|GCash Amount/i }), { target: { value: '6' } });

    // Complete sale
    const completeBtn = screen.getByRole('button', { name: /Kumpletuhin ang Benta|Complete Sale/i });
    fireEvent.click(completeBtn);

    await waitFor(async () => {
      const sales = await db.sales.toArray();
      expect(sales).toHaveLength(1);
      expect(sales[0].paymentMethod).toBe('Split');
      expect(sales[0].totalAmount).toBe(16);
    });
  });

  it('opens cart drawer and allows clearing the cart', async () => {
    renderPOS();

    await waitFor(() => {
      expect(screen.getByText('Lucky Me Pancit Canton Kalamansi')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Lucky Me Pancit Canton Kalamansi'));

    // Wait for floating cart bar "sa cart" to appear
    await waitFor(() => {
      expect(screen.getByText(/sa cart/i)).toBeInTheDocument();
    });

    const floatingCartText = screen.getByText(/sa cart/i);
    fireEvent.click(floatingCartText);

    await waitFor(() => {
      expect(screen.getByText(/Listahan ng Bibilhin/i)).toBeInTheDocument();
    });

    const clearBtn = screen.getByRole('button', { name: /^I-clear$|^Clear$/i });
    fireEvent.click(clearBtn);

    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('allows adding a new debtor during utang checkout if they do not exist on the list and completes sale', async () => {
    await db.customers.clear();

    renderPOS();

    await waitFor(() => {
      expect(screen.getByText('Lucky Me Pancit Canton Kalamansi')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Lucky Me Pancit Canton Kalamansi'));

    const payBtn = screen.getByRole('button', { name: /Bayad|Pay/i });
    fireEvent.click(payBtn);

    // Switch payment method to Utang
    const utangTab = screen.getByRole('tab', { name: /Utang/i });
    fireEvent.click(utangTab);

    // Click "+ Magdagdag ng Suki" button
    const addDebtorBtn = screen.getByRole('button', { name: /Magdagdag ng Suki|Add New Debtor/i });
    fireEvent.click(addDebtorBtn);

    // The inline form appears
    expect(screen.getByText(/Magrehistro ng Bagong Suki|Register New Debtor/i)).toBeInTheDocument();

    // Fill in new debtor details
    const nameInput = screen.getByPlaceholderText(/Aling Maria/i);
    fireEvent.change(nameInput, { target: { value: 'Tatay Digong' } });

    const phoneInput = screen.getByPlaceholderText('09123456789');
    fireEvent.change(phoneInput, { target: { value: '09170001122' } });

    // Save and select debtor
    const saveDebtorBtn = screen.getByRole('button', { name: /I-save at Piliin|Save & Select/i });
    fireEvent.click(saveDebtorBtn);

    // Verify debtor was added to db.customers
    await waitFor(async () => {
      const customers = await db.customers.toArray();
      const found = customers.find((c) => c.name === 'Tatay Digong');
      expect(found).toBeDefined();
      expect(found?.phone).toBe('09170001122');
      expect(useCartStore.getState().customerId).toBe(found?.id);
    });

    // Complete sale with the new debtor
    const completeBtn = screen.getByRole('button', { name: /Kumpletuhin ang Benta|Complete Sale/i });
    fireEvent.click(completeBtn);

    await waitFor(async () => {
      const sales = await db.sales.toArray();
      expect(sales).toHaveLength(1);
      expect(sales[0].paymentMethod).toBe('Utang');

      const customers = await db.customers.toArray();
      const tatay = customers.find((c) => c.name === 'Tatay Digong');
      expect(tatay?.totalUtangBalance).toBe(16);

      const ledger = await db.utangLedger.toArray();
      expect(ledger).toHaveLength(1);
      expect(ledger[0].customerId).toBe(tatay?.id);
      expect(ledger[0].amount).toBe(16);
    });
  });

  it('rejects a malformed phone when adding a debtor during checkout', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderPOS();

    await waitFor(() => expect(screen.getByText('Lucky Me Pancit Canton Kalamansi')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Lucky Me Pancit Canton Kalamansi'));
    fireEvent.click(screen.getByRole('button', { name: /Bayad|Pay/i }));
    fireEvent.click(screen.getByRole('tab', { name: /Utang/i }));
    fireEvent.click(screen.getByRole('button', { name: /Magdagdag ng Suki|Add New Debtor/i }));

    fireEvent.change(screen.getByPlaceholderText(/Aling Maria/i), { target: { value: 'QA customer' } });
    fireEvent.change(screen.getByPlaceholderText('09123456789'), { target: { value: 'abc123' } });
    fireEvent.click(screen.getByRole('button', { name: /I-save at Piliin|Save & Select/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/wastong 11-digit Philippine mobile|valid 11-digit Philippine mobile/i);
    expect(screen.getByPlaceholderText('09123456789')).toHaveAttribute('aria-invalid', 'true');
    expect(alertMock).not.toHaveBeenCalled();
    expect(await db.customers.toArray()).toHaveLength(0);
    expect(await db.syncQueue.toArray()).toHaveLength(0);

    // Blank the name and re-submit: debtor name error should show and phone error should be cleared
    fireEvent.change(screen.getByPlaceholderText(/Aling Maria/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /I-save at Piliin|Save & Select/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Pakiusap ilagay ang pangalan ng suki|Please enter customer name/i);
    expect(screen.getByPlaceholderText('09123456789')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByPlaceholderText(/Aling Maria/i)).toHaveAttribute('aria-invalid', 'true');

    alertMock.mockRestore();
  });

  it('validates debtor name and supports canceling debtor form in utang checkout', async () => {
    renderPOS();

    await waitFor(() => {
      expect(screen.getByText('Lucky Me Pancit Canton Kalamansi')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Lucky Me Pancit Canton Kalamansi'));

    const payBtn = screen.getByRole('button', { name: /Bayad|Pay/i });
    fireEvent.click(payBtn);

    const utangTab = screen.getByRole('tab', { name: /Utang/i });
    fireEvent.click(utangTab);

    // Trigger add debtor via dropdown selection __NEW__
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '__NEW__' } });

    expect(screen.getByText(/Magrehistro ng Bagong Suki|Register New Debtor/i)).toBeInTheDocument();

    // Click Save with empty name
    const saveDebtorBtn = screen.getByRole('button', { name: /I-save at Piliin|Save & Select/i });
    fireEvent.click(saveDebtorBtn);

    const nameInput = screen.getByRole('textbox', { name: /Pangalan ng Suki|Customer Name/i });
    expect(screen.getByText(/Pakiusap ilagay ang pangalan ng suki|Please enter customer name/i)).toBeInTheDocument();
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput).toHaveAttribute('aria-describedby', 'pos-debtor-name-error');

    // Enter name to clear error
    fireEvent.change(nameInput, { target: { value: 'Debtor One' } });
    expect(nameInput).toHaveAttribute('aria-invalid', 'false');
    expect(nameInput).not.toHaveAttribute('aria-describedby');

    // Cancel form using cancel button within debtor registration card
    const debtorCard = screen.getByText(/Magrehistro ng Bagong Suki|Register New Debtor/i).closest('div')!;
    const cancelDebtorBtn = within(debtorCard.parentElement as HTMLElement).getAllByRole('button', { name: /^Kanselahin$|^Cancel$/i })[0];
    fireEvent.click(cancelDebtorBtn);

    // Form should close, select should be visible again
    expect(screen.queryByText(/Magrehistro ng Bagong Suki|Register New Debtor/i)).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('persists completed sale in Dexie before triggering reload when update reload is deferred', async () => {
    const originalLocation = window.location;
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      configurable: true,
      writable: true
    });

    renderPOS();

    await waitFor(() => {
      expect(screen.getByText('Lucky Me Pancit Canton Kalamansi')).toBeInTheDocument();
    });

    // 1. Add item to cart
    fireEvent.click(screen.getByText('Lucky Me Pancit Canton Kalamansi'));
    expect(useCartStore.getState().items).toHaveLength(1);

    // 2. An update is available, but it must not reload without user action.
    usePwaStore.getState().setNeedRefresh(true);
    expect(usePwaStore.getState().needRefresh).toBe(true);

    // 3. Open checkout dialog
    const payBtn = screen.getByRole('button', { name: /Bayad|Pay/i });
    fireEvent.click(payBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // 4. Tender exact cash and complete checkout
    fireEvent.click(screen.getByRole('button', { name: /Eksaktong|Exact/i }));
    const completeBtn = screen.getByRole('button', { name: /Kumpletuhin ang Benta|Complete Sale/i });
    fireEvent.click(completeBtn);

    // 5. Verify that sale is persisted in Dexie
    await waitFor(async () => {
      const sales = await db.sales.toArray();
      expect(sales).toHaveLength(1);
      expect(sales[0].totalAmount).toBe(16);
      expect(sales[0].paymentMethod).toBe('Cash');
    });

    // 6. Verify receipt modal is open and hasActiveReceipt is true
    await waitFor(() => {
      const watermarks = screen.getAllByText(/NOT AN OFFICIAL RECEIPT/i);
      expect(watermarks.length).toBeGreaterThan(0);
      expect(usePwaStore.getState().hasActiveReceipt).toBe(true);
    });

    // Reload must NOT have fired while receipt is open!
    expect(reloadMock).not.toHaveBeenCalled();

    // 7. Cashier dismisses receipt modal
    const receiptDialog = await screen.findByRole('dialog', { name: /Resibo|Receipt/i });
    const closeBtn = await within(receiptDialog).findByRole('button', { name: /Isara|Close/i });
    fireEvent.click(closeBtn);

    // 8. Closing the receipt does not trigger an unsolicited reload.
    expect(reloadMock).not.toHaveBeenCalled();

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true
    });
  });
});




