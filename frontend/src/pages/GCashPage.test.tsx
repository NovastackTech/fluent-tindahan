import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { GCashPage, toLocalDateKey } from './GCashPage';
import { sariSariLightTheme } from '../theme/theme';
import { db } from '../db/db';
import { useLanguageStore } from '../state/languageStore';
import { DEFAULT_GCASH_FEE_TIERS, useGCashFeeStore } from '../state/gcashFeeStore';
import { useAuthStore } from '../state/authStore';

describe('GCashPage', () => {
  beforeEach(async () => {
    useLanguageStore.getState().setLanguage('tl');
    const tenantId = useAuthStore.getState().tenantId;
    DEFAULT_GCASH_FEE_TIERS.forEach((fee, index) => useGCashFeeStore.getState().setFeeForTenant(tenantId, index, fee));
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

  it('builds date keys from local calendar components', () => {
    const localDate = new Date(2026, 9, 12, 0, 30);

    expect(toLocalDateKey(localDate)).toBe('2026-10-12');
    expect(toLocalDateKey(localDate.toISOString())).toBe('2026-10-12');
  });

  it('renders GCash Hub header and Cash In / Cash Out tabs', () => {
    renderGCash();

    expect(screen.getByText(/GCash.*Hub/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Cash In/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cash Out/i).length).toBeGreaterThan(0);
  });

  it('localizes the monthly Libre counter label in English', () => {
    useLanguageStore.getState().setLanguage('en');
    renderGCash();

    expect(screen.getByText(/This Month:/i)).toBeInTheDocument();
    expect(screen.getByText(/Libre plan/i)).toBeInTheDocument();
    expect(screen.queryByText(/^\(Libre\)$/i)).not.toBeInTheDocument();
  });

  it('calculates the default percentage fee for small cash-in amounts', () => {
    renderGCash();

    const inputs = screen.getAllByRole('spinbutton');
    const amountInput = inputs[0]; // Halaga / Amount

    fireEvent.change(amountInput, { target: { value: '20' } });

    expect(screen.getByDisplayValue('5')).toBeInTheDocument();
  });

  it('calculates the default fixed fee for cash-out', () => {
    renderGCash();
    fireEvent.click(screen.getByRole('tab', { name: /Cash.*Out/i }));
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '500' } });

    expect(screen.getByDisplayValue('5')).toBeInTheDocument();
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
      expect(records[0].fee).toBe(10);
      expect(records[0].refNo).toBe('REF-12345678');
    });
  });

  it('uses the configured tenant-specific fixed fee', () => {
    const tenantId = useAuthStore.getState().tenantId;
    useGCashFeeStore.getState().setFeeForTenant(tenantId, 0, 7);

    renderGCash();
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '20' } });

    expect(screen.getByDisplayValue('7')).toBeInTheDocument();
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
    expect(await screen.findByText('Padala ni Nanay')).toBeInTheDocument();
  });

  it('renders existing today transactions in history log', async () => {
    await db.gcashTxns.add({
      id: 'g-hist-1',
      tenantId: '11111111-1111-1111-1111-111111111111',
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

  it('shows current-tenant entries from this month and excludes other tenants from quota', async () => {
    const earlierThisMonth = new Date();
    earlierThisMonth.setDate(1);
    earlierThisMonth.setHours(12, 0, 0, 0);

    await db.gcashTxns.bulkAdd([
      {
        id: 'g-month-current-tenant',
        tenantId: '11111111-1111-1111-1111-111111111111',
        type: 'CashOut',
        amount: 500,
        fee: 10,
        refNo: 'REF-MONTH-CURRENT-TENANT',
        date: earlierThisMonth.toISOString()
      },
      {
        id: 'g-month-other-tenant',
        tenantId: '99999999-9999-9999-9999-999999999999',
        type: 'CashOut',
        amount: 700,
        fee: 15,
        refNo: 'REF-MONTH-OTHER-TENANT',
        date: new Date().toISOString()
      }
    ]);

    renderGCash();

    await waitFor(() => {
      expect(screen.getByTestId('monthly-gcash-count')).toHaveTextContent('1/30');
      expect(screen.getByText(/REF-MONTH-CURRENT-TENANT/i)).toBeInTheDocument();
      expect(screen.queryByText(/REF-MONTH-OTHER-TENANT/i)).not.toBeInTheDocument();
    });

    const spinInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(spinInputs[0], { target: { value: '50' } });
    const textInputs = screen.getAllByRole('textbox');
    fireEvent.change(textInputs[0], { target: { value: 'REF-MONTH-SECOND' } });
    fireEvent.click(screen.getByRole('button', { name: /Itala ang GCash|Record GCash|Cash-In/i }));

    await waitFor(() => {
      expect(screen.getByTestId('monthly-gcash-count')).toHaveTextContent('2/30');
      expect(screen.getByText(/REF-MONTH-SECOND/i)).toBeInTheDocument();
      expect(screen.queryByText(/REF-MONTH-OTHER-TENANT/i)).not.toBeInTheDocument();
    });
  });

  it('hides resolved originals and replacements after the day they were resolved', async () => {
    const now = Date.now();
    const today = new Date(now).toISOString();
    const oldDate = new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString();
    const resolvedYesterday = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();

    await db.gcashTxns.bulkAdd([
      {
        id: 'g-old-resolved',
        tenantId: '11111111-1111-1111-1111-111111111111',
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
        tenantId: '11111111-1111-1111-1111-111111111111',
        type: 'CashIn',
        amount: 100,
        fee: 5,
        refNo: 'REF-CURRENT-VISIBLE',
        date: today
      },
      {
        id: 'g-old-replacement',
        tenantId: '11111111-1111-1111-1111-111111111111',
        type: 'CashIn',
        amount: 400,
        fee: 10,
        refNo: 'REF-OLD-REPLACEMENT',
        date: oldDate
      }
    ]);
    await db.gcashTxnResolutions.add({
      gcashTxnId: 'g-old-resolved',
      tenantId: '11111111-1111-1111-1111-111111111111',
      resolution: 'Corrected',
      resolvedAt: resolvedYesterday,
      replacementTxnId: 'g-old-replacement',
      correctedRefNo: 'REF-OLD-REPLACEMENT'
    });

    renderGCash();

    await waitFor(() => {
      expect(screen.getByText(/REF-CURRENT-VISIBLE/i)).toBeInTheDocument();
      expect(screen.queryByText(/REF-OLD-RESOLVED/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/REF-OLD-REPLACEMENT/i)).not.toBeInTheDocument();
    });
  });

  it('warns inline and disables save for a duplicate reference number', async () => {
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
    expect(await screen.findByRole('alert')).toHaveTextContent(/Ginamit na|already been used|Hindi maaaring magtala ng doble/i);
    expect(submitBtn).toBeDisabled();
    expect(textInputs[0]).toHaveAttribute('aria-invalid', 'true');

    const records = await db.gcashTxns.toArray();
    expect(records).toHaveLength(1);
    expect(records[0].refNo).toBe('REF-DUP-12345');
  });

  it('warns inline for a duplicate legacy reference when refNoNorm is missing', async () => {
    await db.gcashTxns.add({
      id: 'g-legacy-duplicate',
      tenantId: '11111111-1111-1111-1111-111111111111',
      type: 'CashIn',
      amount: 1000,
      fee: 15,
      refNo: '901238471201',
      date: new Date().toISOString()
    });

    renderGCash();

    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '100' } });
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '901238471201' } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/Ginamit na|already been used/i);
    expect(screen.getByRole('button', { name: /Itala ang GCash|Record GCash|Cash-In/i })).toBeDisabled();
    expect(await db.gcashTxns.count()).toBe(1);
    expect(await db.syncQueue.count()).toBe(0);
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
        tenantId: '11111111-1111-1111-1111-111111111111',
        type: 'CashIn',
        amount: 100,
        fee: 5,
        refNo: 'REF-COUNTED-1',
        date: today
      },
      {
        id: 'g-unresolved-1',
        tenantId: '11111111-1111-1111-1111-111111111111',
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
    expect(await screen.findByTestId('gcash-correction-replacement-row')).toBeInTheDocument();
    expect(screen.getByTestId('gcash-correction-replacement-badge')).toHaveTextContent(
      /Corrected replacement created today|Bagong ref na naayos ngayon/i
    );
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

