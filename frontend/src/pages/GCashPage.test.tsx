import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { GCashPage } from './GCashPage';
import { sariSariLightTheme } from '../theme/theme';
import { db } from '../db/db';

describe('GCashPage', () => {
  beforeEach(async () => {
    await db.gcashTxns.clear();
    await db.gcashTxnResolutions.clear();
    await db.syncQueue.clear();
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

  it('hides resolved originals after the day they were resolved', async () => {
    const now = Date.now();
    const today = new Date(now).toISOString();
    const oldDate = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();
    const resolvedYesterday = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();

    await db.gcashTxns.bulkAdd([
      {
        id: 'g-old-resolved',
        tenantId: 't-1',
        type: 'CashIn',
        amount: 400,
        fee: 10,
        refNo: 'REF-OLD-RESOLVED',
        date: oldDate,
        needsAttention: true,
        syncStatus: 'DuplicateRef'
      },
      {
        id: 'g-current-visible',
        tenantId: 't-1',
        type: 'CashIn',
        amount: 100,
        fee: 5,
        refNo: 'REF-CURRENT-VISIBLE',
        date: today
      }
    ]);
    await db.gcashTxnResolutions.add({
      gcashTxnId: 'g-old-resolved',
      tenantId: 't-1',
      resolution: 'Voided',
      resolvedAt: resolvedYesterday
    });

    renderGCash();

    await waitFor(() => {
      expect(screen.getByText(/REF-CURRENT-VISIBLE/i)).toBeInTheDocument();
      expect(screen.queryByText(/REF-OLD-RESOLVED/i)).not.toBeInTheDocument();
    });
  });

  it('rejects recording transaction with duplicate reference number', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    await db.gcashTxns.add({
      id: 'g-dup-1',
      tenantId: '11111111-1111-1111-1111-111111111111',
      type: 'CashIn',
      amount: 500,
      fee: 10,
      refNo: 'REF-DUP-12345',
      refNoNorm: 'ref-dup-12345',
      date: new Date().toISOString()
    });

    renderGCash();

    const spinInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(spinInputs[0], { target: { value: '750' } });

    const textInputs = screen.getAllByRole('textbox');
    // textInputs: Ref No, Customer Phone, Notes
    // Pass duplicate with differing casing and surrounding whitespace
    fireEvent.change(textInputs[0], { target: { value: '  ref-dup-12345  ' } });

    const submitBtn = screen.getByRole('button', { name: /Itala ang GCash|Record GCash|Cash-In/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringMatching(/Ginamit na|already been used|Hindi maaaring magtala ng doble/i));
    });

    const records = await db.gcashTxns.toArray();
    expect(records).toHaveLength(1);
    expect(records[0].refNo).toBe('REF-DUP-12345');

    alertMock.mockRestore();
  });

  it('allows same reference number for a different tenant due to compound indexing', async () => {
    // Record exists under different tenant
    await db.gcashTxns.add({
      id: 'g-tenant-other',
      tenantId: '99999999-9999-9999-9999-999999999999',
      type: 'CashIn',
      amount: 500,
      fee: 10,
      refNo: 'REF-SHARED-123',
      refNoNorm: 'ref-shared-123',
      date: new Date().toISOString()
    });

    renderGCash();

    const spinInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(spinInputs[0], { target: { value: '500' } });

    const textInputs = screen.getAllByRole('textbox');
    fireEvent.change(textInputs[0], { target: { value: 'REF-SHARED-123' } });

    const submitBtn = screen.getByRole('button', { name: /Itala ang GCash|Record GCash|Cash-In/i });
    fireEvent.click(submitBtn);

    await waitFor(async () => {
      const currentTenantTxns = await db.gcashTxns
        .where('tenantId')
        .equals('11111111-1111-1111-1111-111111111111')
        .toArray();
      expect(currentTenantTxns).toHaveLength(1);
      expect(currentTenantTxns[0].refNo).toBe('REF-SHARED-123');
    });
  });

  it('renders duplicate ref attention badge when transaction is flagged with needsAttention', async () => {
    await db.gcashTxns.add({
      id: 'g-flagged-1',
      tenantId: '11111111-1111-1111-1111-111111111111',
      type: 'CashIn',
      amount: 800,
      fee: 15,
      refNo: 'REF-FLAGGED-777',
      refNoNorm: 'ref-flagged-777',
      date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      needsAttention: true,
      syncStatus: 'DuplicateRef',
      conflictReason: "Duplicate GCash reference number 'REF-FLAGGED-777' for this tenant."
    });

    renderGCash();

    await waitFor(() => {
      expect(screen.getAllByText(/REF-FLAGGED-777/i).length).toBeGreaterThan(0);
      expect(screen.getByTestId('duplicate-ref-badge')).toBeInTheDocument();
      expect(screen.getByText(/Duplicate GCash reference number 'REF-FLAGGED-777'/i)).toBeInTheDocument();
      expect(screen.getByText(/Not synced; excluded from totals|Hindi naka-sync; hindi kasama sa totals/i)).toBeInTheDocument();
    });
  });

  it('excludes flagged conflicts from daily GCash totals while retaining them in the log', async () => {
    const today = new Date().toISOString();
    await db.gcashTxns.bulkAdd([
      {
        id: 'g-counted-1',
        tenantId: 't-1',
        type: 'CashIn',
        amount: 100,
        fee: 5,
        refNo: 'REF-COUNTED-1',
        date: today
      },
      {
        id: 'g-unresolved-1',
        tenantId: 't-1',
        type: 'CashIn',
        amount: 800,
        fee: 15,
        refNo: 'REF-UNRESOLVED-1',
        date: today,
        needsAttention: true,
        syncStatus: 'DuplicateRef'
      }
    ]);

    renderGCash();

    await waitFor(() => {
      expect(screen.getByTestId('today-cash-in-total')).toHaveTextContent('₱100.00');
      expect(screen.getByTestId('today-gcash-fees-total')).toHaveTextContent('₱5.00');
      expect(screen.getByTestId('monthly-gcash-count')).toHaveTextContent('1/30');
      expect(screen.getByText(/REF-UNRESOLVED-1/i)).toBeInTheDocument();
    });
  });

  it('corrects a rejected reference by preserving the original and enqueueing a replacement', async () => {
    await db.gcashTxns.add({
      id: 'g-correct-me',
      tenantId: '11111111-1111-1111-1111-111111111111',
      type: 'CashIn',
      amount: 800,
      fee: 15,
      refNo: 'REF-ORIGINAL',
      refNoNorm: 'ref-original',
      date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      needsAttention: true,
      syncStatus: 'DuplicateRef',
      conflictReason: 'Duplicate reference'
    });

    renderGCash();
    await screen.findByText(/REF-ORIGINAL/i);
    expect(await screen.findByTestId('gcash-correction-date-note')).toHaveTextContent(
      /original transaction date|orihinal na petsa/i
    );

    fireEvent.change(screen.getByRole('textbox', { name: /Corrected reference for REF-ORIGINAL|Bagong reference para sa REF-ORIGINAL/i }), {
      target: { value: 'REF-CORRECTED' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Correct & sync|Ayusin at i-sync/i }));

    await waitFor(async () => {
      const original = await db.gcashTxns.get('g-correct-me');
      const replacement = await db.gcashTxns.where('refNoNorm').equals('ref-corrected').first();
      const resolution = await db.gcashTxnResolutions.get('g-correct-me');
      const queued = await db.syncQueue.toArray();

      expect(original?.refNo).toBe('REF-ORIGINAL');
      expect(original?.syncStatus).toBe('DuplicateRef');
      expect(replacement).toMatchObject({
        tenantId: '11111111-1111-1111-1111-111111111111',
        refNo: 'REF-CORRECTED',
        amount: 800,
        fee: 15
      });
      expect(replacement?.id).not.toBe('g-correct-me');
      expect(resolution).toMatchObject({
        resolution: 'Corrected',
        replacementTxnId: replacement?.id,
        correctedRefNo: 'REF-CORRECTED'
      });
      expect(queued).toHaveLength(1);
      expect(queued[0]).toMatchObject({ entity: 'GCashTxn', action: 'Insert', payload: { id: replacement?.id } });
    });

    expect(screen.getByText(/Corrected; new ref: REF-CORRECTED|Naayos; bagong ref: REF-CORRECTED/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('duplicate-ref-badge')).not.toBeInTheDocument();
      expect(screen.queryByText(/Not synced; excluded from totals|Hindi naka-sync; hindi kasama sa totals/i)).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('today-cash-in-total')).toHaveTextContent('₱0.00');
  });

  it('rejects a corrected reference already used in the same tenant', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    await db.gcashTxns.bulkAdd([
      {
        id: 'g-needs-correction',
        tenantId: '11111111-1111-1111-1111-111111111111',
        type: 'CashIn', amount: 300, fee: 10, refNo: 'REF-BAD', refNoNorm: 'ref-bad',
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), needsAttention: true, syncStatus: 'DuplicateRef'
      },
      {
        id: 'g-existing-ref',
        tenantId: '11111111-1111-1111-1111-111111111111',
        type: 'CashOut', amount: 200, fee: 5, refNo: 'REF-TAKEN', refNoNorm: 'ref-taken',
        date: new Date().toISOString()
      }
    ]);

    renderGCash();
    await screen.findByText(/REF-BAD/i);
    fireEvent.change(screen.getByRole('textbox', { name: /Corrected reference for REF-BAD|Bagong reference para sa REF-BAD/i }), {
      target: { value: 'REF-TAKEN' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Correct & sync|Ayusin at i-sync/i }));

    await waitFor(() => expect(alertMock).toHaveBeenCalledWith(expect.stringMatching(/already used|Nagamit na/i)));
    expect(await db.gcashTxnResolutions.get('g-needs-correction')).toBeUndefined();
    expect(await db.syncQueue.count()).toBe(0);
    expect(await db.gcashTxns.count()).toBe(2);
    alertMock.mockRestore();
  });

  it('voids a rejected row without deleting it or enqueueing it', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await db.gcashTxns.add({
      id: 'g-void-me',
      tenantId: '11111111-1111-1111-1111-111111111111',
      type: 'CashOut',
      amount: 700,
      fee: 15,
      refNo: 'REF-VOID',
      refNoNorm: 'ref-void',
      date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      needsAttention: true,
      syncStatus: 'DuplicateRef'
    });

    renderGCash();
    await screen.findByText(/REF-VOID/i);
    fireEvent.click(screen.getByRole('button', { name: /^Void$|^I-void$/i }));

    await waitFor(async () => {
      expect(await db.gcashTxns.get('g-void-me')).toBeDefined();
      expect(await db.gcashTxnResolutions.get('g-void-me')).toMatchObject({ resolution: 'Voided' });
    });
    expect(await db.syncQueue.count()).toBe(0);
    expect(screen.getByText(/Voided locally|Voided \(lokal\)/i)).toBeInTheDocument();
    expect(screen.queryByTestId('duplicate-ref-badge')).not.toBeInTheDocument();
    expect(screen.queryByText(/Not synced; excluded from totals|Hindi naka-sync; hindi kasama sa totals/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('today-cash-out-total')).toHaveTextContent('₱0.00');
    confirmMock.mockRestore();
  });
});

