import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { GCashPage } from './GCashPage';
import { sariSariLightTheme } from '../theme/theme';
import { db } from '../db/db';

describe('GCashPage', () => {
  beforeEach(async () => {
    await db.gcashTxns.clear();
  });

  const renderGCash = () => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <GCashPage />
      </FluentProvider>
    );
  };

  it('renders GCash Hub header and Cash In / Cash Out tabs', () => {
    renderGCash();

    expect(screen.getByText(/GCash.*Hub/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Cash In/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cash Out/i).length).toBeGreaterThan(0);
  });

  it('calculates default fee tiered based on amount', () => {
    renderGCash();

    const inputs = screen.getAllByRole('spinbutton');
    const amountInput = inputs[0]; // Halaga / Amount

    fireEvent.change(amountInput, { target: { value: '500' } });

    // Under 500, fee is 10
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
  });

  it('records cash-in transaction to Dexie', async () => {
    renderGCash();

    const spinInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(spinInputs[0], { target: { value: '1000' } });

    const textInputs = screen.getAllByRole('textbox');
    // textInputs: Ref No, Customer Phone, Notes
    fireEvent.change(textInputs[0], { target: { value: 'REF-12345678' } });
    fireEvent.change(textInputs[1], { target: { value: '09171234567' } });

    const submitBtn = screen.getByRole('button', { name: /Itala ang GCash|Record GCash|Cash-In/i });
    fireEvent.click(submitBtn);

    await waitFor(async () => {
      const records = await db.gcashTxns.toArray();
      expect(records).toHaveLength(1);
      expect(records[0].amount).toBe(1000);
      expect(records[0].refNo).toBe('REF-12345678');
    });
  });

  it('records cash-out transaction with custom fee to Dexie', async () => {
    renderGCash();

    // Switch to CashOut tab
    const cashOutTab = screen.getByRole('tab', { name: /Cash.*Out/i });
    fireEvent.click(cashOutTab);

    const spinInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(spinInputs[0], { target: { value: '2500' } }); // Amount
    fireEvent.change(spinInputs[1], { target: { value: '35' } }); // Custom Fee

    const textInputs = screen.getAllByRole('textbox');
    fireEvent.change(textInputs[0], { target: { value: 'OUT-99887766' } });
    fireEvent.change(textInputs[1], { target: { value: '09189876543' } });
    fireEvent.change(textInputs[2], { target: { value: 'Padala ni Nanay' } });

    const submitBtn = screen.getByRole('button', { name: /Itala ang GCash|Record GCash|Cash-Out/i });
    fireEvent.click(submitBtn);

    await waitFor(async () => {
      const records = await db.gcashTxns.where('type').equals('CashOut').toArray();
      expect(records).toHaveLength(1);
      expect(records[0].amount).toBe(2500);
      expect(records[0].fee).toBe(35);
      expect(records[0].refNo).toBe('OUT-99887766');
      expect(records[0].notes).toBe('Padala ni Nanay');
    });
  });

  it('renders existing today transactions in history log', async () => {
    await db.gcashTxns.add({
      id: 'g-hist-1',
      tenantId: 't-1',
      type: 'CashIn',
      amount: 500,
      fee: 10,
      refNo: 'REF-HIST-1',
      date: new Date().toISOString()
    });

    renderGCash();

    await waitFor(() => {
      expect(screen.getByText(/REF-HIST-1/i)).toBeInTheDocument();
      expect(screen.getAllByText(/500\.00/).length).toBeGreaterThan(0);
    });
  });
});

