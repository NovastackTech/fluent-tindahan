import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { UtangPage } from './UtangPage';
import { sariSariLightTheme } from '../theme/theme';
import { db } from '../db/db';

describe('UtangPage', () => {
  beforeEach(async () => {
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

  it('opens Add Customer dialog and creates a new customer in Dexie', async () => {
    renderUtang();

    const addBtn = screen.getByRole('button', { name: /Magdagdag ng Bagong Suki|Add New Customer/i });
    fireEvent.click(addBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const inputs = screen.getAllByRole('textbox');
    // inputs[0] is search in main page, inputs[1] is Name, inputs[2] is Phone
    const nameInput = inputs[1];
    const phoneInput = inputs[2];
    fireEvent.change(nameInput, { target: { value: 'Mang Kanor' } });
    fireEvent.change(phoneInput, { target: { value: '09189998888' } });

    const spinInput = screen.getByRole('spinbutton');
    fireEvent.change(spinInput, { target: { value: '150' } });

    const saveBtn = screen.getByRole('button', { name: /I-save ang Suki|Save Customer/i });
    fireEvent.click(saveBtn);

    await waitFor(async () => {
      const saved = await db.customers.where('name').equals('Mang Kanor').first();
      expect(saved).toBeDefined();
      expect(saved?.totalUtangBalance).toBe(150);
    });
  });

  it('rejects a negative opening utang balance without writing customer, ledger, or sync data', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderUtang();

    fireEvent.click(screen.getByRole('button', { name: /Magdagdag ng Bagong Suki|Add New Customer/i }));

    const textInputs = screen.getAllByRole('textbox');
    fireEvent.change(textInputs[1], { target: { value: 'QA-TEST Neg' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '-50' } });
    fireEvent.click(screen.getByRole('button', { name: /I-save ang Suki|Save Customer/i }));

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringMatching(/Hindi maaaring negatibo|cannot be negative/i));
    });
    expect(await db.customers.toArray()).toHaveLength(0);
    expect(await db.utangLedger.toArray()).toHaveLength(0);
    expect(await db.syncQueue.toArray()).toHaveLength(0);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    alertMock.mockRestore();
  });

  it('rejects a malformed customer phone without writing customer or sync data', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderUtang();

    fireEvent.click(screen.getByRole('button', { name: /Magdagdag ng Bagong Suki|Add New Customer/i }));
    const textInputs = screen.getAllByRole('textbox');
    fireEvent.change(textInputs[1], { target: { value: 'QA-TEST Phone' } });
    fireEvent.change(textInputs[2], { target: { value: 'abc123' } });
    fireEvent.click(screen.getByRole('button', { name: /I-save ang Suki|Save Customer/i }));

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringMatching(/wastong Philippine mobile|valid Philippine mobile/i));
    });
    expect(await db.customers.toArray()).toHaveLength(0);
    expect(await db.syncQueue.toArray()).toHaveLength(0);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    alertMock.mockRestore();
  });

  it('normalizes international Philippine mobile input when creating a customer', async () => {
    renderUtang();
    fireEvent.click(screen.getByRole('button', { name: /Magdagdag ng Bagong Suki|Add New Customer/i }));
    const textInputs = screen.getAllByRole('textbox');
    fireEvent.change(textInputs[1], { target: { value: 'QA-TEST Phone Valid' } });
    fireEvent.change(textInputs[2], { target: { value: '+63 917-123-4567' } });
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
      expect(alertMock).toHaveBeenCalledWith(expect.stringMatching(/Hindi puwedeng lumampas ang bayad|cannot exceed/i));
    });

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
      expect(alertMock).toHaveBeenCalledWith(expect.stringMatching(/Hindi puwedeng lumampas ang bayad|cannot exceed/i));
    });

    const cust = await db.customers.get('cust-zero');
    expect(cust?.totalUtangBalance).toBe(0);

    const ledger = await db.utangLedger.where('customerId').equals('cust-zero').toArray();
    expect(ledger).toHaveLength(0);

    alertMock.mockRestore();
  });
});
