import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { UtangPage } from './UtangPage';
import { sariSariLightTheme } from '../theme/theme';
import { db } from '../db/db';
import { useAuthStore } from '../state/authStore';

describe('UtangPage', () => {
  beforeEach(async () => {
    useAuthStore.setState({ tenantId: 'tenant-1' });
    await db.customers.clear();
    await db.utangLedger.clear();
    await db.syncQueue.clear();
  });

  const renderUtang = () => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <UtangPage />
      </FluentProvider>
    );
  };

  it('renders header, search bar, and add customer button', () => {
    renderUtang();

    expect(screen.getByText(/Talaan ng Utang/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Hanapin ang pangalan ng suki|Search customer/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Magdagdag ng Bagong Suki|Add New Customer/i })).toBeInTheDocument();
  });

  it('displays customers with utang balance', async () => {
    await db.customers.add({
      id: 'cust-1',
      tenantId: 'tenant-1',
      name: 'Nanay Rosa',
      phone: '09171112222',
      totalUtangBalance: 350,
      updatedAt: new Date().toISOString()
    });

    renderUtang();

    await waitFor(() => {
      expect(screen.getByText('Nanay Rosa')).toBeInTheDocument();
      expect(screen.getAllByText(/350\.00/).length).toBeGreaterThan(0);
    });
  });

  it('does not display customers from another tenant', async () => {
    await db.customers.bulkAdd([
      {
        id: 'cust-active',
        tenantId: 'tenant-1',
        name: 'Active Tenant Customer',
        phone: '09171112222',
        totalUtangBalance: 0,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'cust-other',
        tenantId: 'other-tenant',
        name: 'Aling Rosa Santos',
        phone: '09204445566',
        totalUtangBalance: 150,
        updatedAt: new Date().toISOString()
      }
    ]);

    renderUtang();

    await waitFor(() => expect(screen.getByText('Active Tenant Customer')).toBeInTheDocument());
    expect(screen.queryByText('Aling Rosa Santos')).not.toBeInTheDocument();
  });

  it('opens Add Customer dialog and creates a new customer in Dexie', async () => {
    renderUtang();

    const addBtn = screen.getByRole('button', { name: /Magdagdag ng Bagong Suki|Add New Customer/i });
    fireEvent.click(addBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const nameInput = screen.getByRole('textbox', { name: /Pangalan ng Suki|Customer Name/i });
    const phoneInput = screen.getByRole('textbox', { name: /Cellphone Number|Mobile Number/i });
    fireEvent.change(nameInput, { target: { value: 'Mang Kanor' } });
    fireEvent.change(phoneInput, { target: { value: '09189998888' } });

    const spinInput = screen.getByRole('spinbutton');
    fireEvent.change(spinInput, { target: { value: '150' } });

    const saveBtn = screen.getByRole('button', { name: /I-save ang Suki|Save Customer/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    const saved = await db.customers.where('name').equals('Mang Kanor').first();
    expect(saved).toBeDefined();
    expect(saved?.totalUtangBalance).toBe(150);
    expect(await db.utangLedger.toArray()).toHaveLength(1);
    expect(await db.syncQueue.toArray()).toHaveLength(2);
  });

  it('shows inline validation when saving a customer with a blank name', async () => {
    renderUtang();

    fireEvent.click(screen.getByRole('button', { name: /Magdagdag ng Bagong Suki|Add New Customer/i }));
    fireEvent.click(screen.getByRole('button', { name: /I-save ang Suki|Save Customer/i }));

    const nameInput = screen.getByRole('textbox', { name: /Pangalan ng Suki|Customer Name/i });
    expect(await screen.findByRole('alert')).toHaveTextContent(/Pakiusap ilagay ang pangalan ng suki|Please enter customer name/i);
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput).toHaveAttribute('aria-describedby', 'utang-customer-name-error');
    expect(await db.customers.toArray()).toHaveLength(0);
    expect(await db.syncQueue.toArray()).toHaveLength(0);

    fireEvent.change(nameInput, { target: { value: 'QA-TEST Name' } });
    expect(nameInput).toHaveAttribute('aria-invalid', 'false');
    expect(nameInput).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('rejects a negative opening utang balance without writing customer, ledger, or sync data', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderUtang();

    fireEvent.click(screen.getByRole('button', { name: /Magdagdag ng Bagong Suki|Add New Customer/i }));

    fireEvent.change(screen.getByRole('textbox', { name: /Pangalan ng Suki|Customer Name/i }), { target: { value: 'QA-TEST Neg' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '-50' } });
    fireEvent.click(screen.getByRole('button', { name: /I-save ang Suki|Save Customer/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Hindi maaaring negatibo|cannot be negative/i);
    });
    expect(alertMock).not.toHaveBeenCalled();
    expect(await db.customers.toArray()).toHaveLength(0);
    expect(await db.utangLedger.toArray()).toHaveLength(0);
    expect(await db.syncQueue.toArray()).toHaveLength(0);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    alertMock.mockRestore();
  });

  it('shows inline validation for malformed customer phone without writing customer or sync data', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderUtang();

    fireEvent.click(screen.getByRole('button', { name: /Magdagdag ng Bagong Suki|Add New Customer/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /Pangalan ng Suki|Customer Name/i }), { target: { value: 'QA-TEST Phone' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Cellphone Number|Mobile Number/i }), { target: { value: 'abc123' } });
    fireEvent.click(screen.getByRole('button', { name: /I-save ang Suki|Save Customer/i }));

    const phoneError = await screen.findByRole('alert');
    expect(phoneError).toHaveTextContent(/wastong 11-digit Philippine mobile|valid 11-digit Philippine mobile/i);
    expect(screen.getByRole('textbox', { name: /Cellphone Number|Mobile Number/i }))
      .toHaveAttribute('aria-invalid', 'true');
    expect(alertMock).not.toHaveBeenCalled();
    expect(await db.customers.toArray()).toHaveLength(0);
    expect(await db.syncQueue.toArray()).toHaveLength(0);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: /Cellphone Number|Mobile Number/i }), {
      target: { value: '09171234567' }
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    alertMock.mockRestore();
  });

  it('clears phone error when subsequent submit fails early on empty customer name', async () => {
    renderUtang();
    fireEvent.click(screen.getByRole('button', { name: /Magdagdag ng Bagong Suki|Add New Customer/i }));

    const nameInput = screen.getByRole('textbox', { name: /Pangalan ng Suki|Customer Name/i });
    const phoneInput = screen.getByRole('textbox', { name: /Cellphone Number|Mobile Number/i });
    const saveBtn = screen.getByRole('button', { name: /I-save ang Suki|Save Customer/i });

    // Enter valid name and invalid phone
    fireEvent.change(nameInput, { target: { value: 'Customer A' } });
    fireEvent.change(phoneInput, { target: { value: 'invalid-phone' } });
    fireEvent.click(saveBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent(/wastong 11-digit Philippine mobile|valid 11-digit Philippine mobile/i);
    expect(phoneInput).toHaveAttribute('aria-invalid', 'true');

    // Blank the name and re-submit: name error should show and phone error should be cleared
    fireEvent.change(nameInput, { target: { value: '   ' } });
    fireEvent.click(saveBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Pakiusap ilagay ang pangalan ng suki|Please enter customer name/i);
    expect(phoneInput).toHaveAttribute('aria-invalid', 'false');
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('normalizes international Philippine mobile input when creating a customer', async () => {
    renderUtang();
    fireEvent.click(screen.getByRole('button', { name: /Magdagdag ng Bagong Suki|Add New Customer/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /Pangalan ng Suki|Customer Name/i }), { target: { value: 'QA-TEST Phone Valid' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Cellphone Number|Mobile Number/i }), { target: { value: '+63 917-123-4567' } });
    fireEvent.click(screen.getByRole('button', { name: /I-save ang Suki|Save Customer/i }));

    await waitFor(async () => {
      const saved = await db.customers.where('name').equals('QA-TEST Phone Valid').first();
      expect(saved?.phone).toBe('09171234567');
    });
  });

  it('opens customer details and records payment', async () => {
    await db.customers.add({
      id: 'cust-pay',
      tenantId: 'tenant-1',
      name: 'Aling Marites',
      phone: '09170001111',
      totalUtangBalance: 500,
      updatedAt: new Date().toISOString()
    });
    await db.customers.add({
      id: 'cust-pay-next',
      tenantId: 'tenant-1',
      name: 'Mang Jose',
      phone: '09170003333',
      totalUtangBalance: 250,
      updatedAt: new Date().toISOString()
    });

    renderUtang();

    await waitFor(() => {
      expect(screen.getByText('Aling Marites')).toBeInTheDocument();
    });

    // Click customer card to open details
    fireEvent.click(screen.getByText('Aling Marites'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Magbayad|Pay/i })).toBeInTheDocument();
    });

    // Click Pay button
    fireEvent.click(screen.getByRole('button', { name: /Magbayad|Pay/i }));

    // Payment input
    const spinInput = screen.getByRole('spinbutton');
    fireEvent.change(spinInput, { target: { value: '200' } });

    // Confirm Payment
    const confirmBtn = screen.getByRole('button', { name: /Kumpirmahin ang Bayad|Confirm Payment/i });
    fireEvent.click(confirmBtn);

    await waitFor(async () => {
      const updated = await db.customers.get('cust-pay');
      expect(updated?.totalUtangBalance).toBe(300);
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows validation when payment amount is zero', async () => {
    await db.customers.add({
      id: 'cust-zero-payment',
      tenantId: 'tenant-1',
      name: 'Aling Cora',
      phone: '09170002222',
      totalUtangBalance: 500,
      updatedAt: new Date().toISOString()
    });

    renderUtang();
    fireEvent.click(await screen.findByText('Aling Cora'));
    fireEvent.click(await screen.findByRole('button', { name: /Magbayad|Pay/i }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /Kumpirmahin ang Bayad|Confirm Payment/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/higit sa ₱0/i);
    expect(await db.customers.get('cust-zero-payment')).toMatchObject({ totalUtangBalance: 500 });
    expect(await db.utangLedger.where('customerId').equals('cust-zero-payment').toArray()).toHaveLength(0);
  });

  it('adds additional credit to customer', async () => {
    await db.customers.add({
      id: 'cust-credit',
      tenantId: 'tenant-1',
      name: 'Kuya Jobert',
      phone: '09172223333',
      totalUtangBalance: 100,
      updatedAt: new Date().toISOString()
    });

    renderUtang();

    await waitFor(() => {
      expect(screen.getByText('Kuya Jobert')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Kuya Jobert'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Dagdagan ng Utang|Add Debt/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Dagdagan ng Utang|Add Debt/i }));

    const spinInput = screen.getByRole('spinbutton');
    fireEvent.change(spinInput, { target: { value: '150' } });

    const saveCreditBtn = screen.getByRole('button', { name: /Itala ang Utang|Save Credit/i });
    fireEvent.click(saveCreditBtn);

    await waitFor(async () => {
      const updated = await db.customers.get('cust-credit');
      expect(updated?.totalUtangBalance).toBe(250);
    });
  });

  it('renders transaction timeline with non-breaking Utang and Bayad badges and amounts', async () => {
    await db.customers.add({
      id: 'cust-timeline',
      tenantId: 'tenant-1',
      name: 'Aling Rosa Santos',
      phone: '09204445566',
      totalUtangBalance: 0,
      updatedAt: new Date().toISOString()
    });

    await db.utangLedger.add({
      id: 'ledger-1',
      tenantId: 'tenant-1',
      customerId: 'cust-timeline',
      type: 'Payment',
      amount: 15031,
      date: new Date().toISOString(),
      notes: 'Bayad sa utang'
    });

    await db.utangLedger.add({
      id: 'ledger-2',
      tenantId: 'tenant-1',
      customerId: 'cust-timeline',
      type: 'Credit',
      amount: 150,
      date: new Date().toISOString(),
      notes: 'Marlboro pack & Skyflakes'
    });

    renderUtang();

    await waitFor(() => {
      expect(screen.getByText('Aling Rosa Santos')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Aling Rosa Santos'));

    await waitFor(() => {
      expect(screen.getByText(/Marlboro pack & Skyflakes/)).toBeInTheDocument();
      expect(screen.getByText(/\+[\s\u00A0]*UTANG/i)).toBeInTheDocument();
      expect(screen.getByText(/-[\s\u00A0]*BAYAD/i)).toBeInTheDocument();
      expect(screen.getByText('+₱150.00')).toBeInTheDocument();
      expect(screen.getByText('-₱15,031.00')).toBeInTheDocument();
    });
  });

  it('rejects recording payment that exceeds customer balance (overpayment check)', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    await db.customers.add({
      id: 'cust-overpay',
      tenantId: 'tenant-1',
      name: 'Tatay Berting',
      phone: '09174445555',
      totalUtangBalance: 100,
      updatedAt: new Date().toISOString()
    });

    renderUtang();

    await waitFor(() => {
      expect(screen.getByText('Tatay Berting')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Tatay Berting'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Magbayad|Pay/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Magbayad|Pay/i }));

    const spinInput = screen.getByRole('spinbutton');
    fireEvent.change(spinInput, { target: { value: '150' } });

    const confirmBtn = screen.getByRole('button', { name: /Kumpirmahin ang Bayad|Confirm Payment/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Hindi puwedeng lumampas ang bayad|cannot exceed/i);
    });
    expect(alertMock).not.toHaveBeenCalled();

    // Verify balance was untouched and no ledger row was added
    const cust = await db.customers.get('cust-overpay');
    expect(cust?.totalUtangBalance).toBe(100);

    const ledger = await db.utangLedger.where('customerId').equals('cust-overpay').toArray();
    expect(ledger).toHaveLength(0);

    alertMock.mockRestore();
  });

  it('rejects recording payment when customer has ₱0 balance', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    await db.customers.add({
      id: 'cust-zero',
      tenantId: 'tenant-1',
      name: 'Ate Liza',
      phone: '09175556666',
      totalUtangBalance: 0,
      updatedAt: new Date().toISOString()
    });

    renderUtang();

    await waitFor(() => {
      expect(screen.getByText('Ate Liza')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ate Liza'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Magbayad|Pay/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Magbayad|Pay/i }));

    const spinInput = screen.getByRole('spinbutton');
    fireEvent.change(spinInput, { target: { value: '50' } });

    const confirmBtn = screen.getByRole('button', { name: /Kumpirmahin ang Bayad|Confirm Payment/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Hindi puwedeng lumampas ang bayad|cannot exceed/i);
    });
    expect(alertMock).not.toHaveBeenCalled();

    const cust = await db.customers.get('cust-zero');
    expect(cust?.totalUtangBalance).toBe(0);

    const ledger = await db.utangLedger.where('customerId').equals('cust-zero').toArray();
    expect(ledger).toHaveLength(0);

    alertMock.mockRestore();
  });
});
