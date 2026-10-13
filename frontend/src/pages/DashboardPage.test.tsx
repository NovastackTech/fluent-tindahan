import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { DashboardPage } from './DashboardPage';
import { sariSariLightTheme } from '../theme/theme';
import { db } from '../db/db';
import { useAuthStore } from '../state/authStore';

describe('DashboardPage', () => {
  beforeEach(async () => {
    useAuthStore.setState({ tenantId: 't-1' });
    await db.sales.clear();
    await db.customers.clear();
    await db.gcashTxns.clear();
    await db.gcashTxnResolutions.clear();
    await db.products.clear();
  });

  const renderDashboard = (onNavigate = vi.fn()) => {
    return {
      onNavigate,
      ...render(
        <FluentProvider theme={sariSariLightTheme}>
          <DashboardPage onNavigate={onNavigate} />
        </FluentProvider>
      )
    };
  };

  it('renders quick action buttons and dashboard tiles', () => {
    renderDashboard();

    expect(screen.getByText(/Bagong Benta|New Sale/i)).toBeInTheDocument();
    expect(screen.getByText(/Listahan ng Utang|Utang Ledger/i)).toBeInTheDocument();
    expect(screen.getByText(/GCash Transaction/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Benta Ngayong Araw|Today's Sales/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Kabuuang Utang|Total.*Utang/i)).toBeInTheDocument();
  });

  it('navigates to POS tab when clicking New Sale', () => {
    const { onNavigate } = renderDashboard();

    const newSaleBtn = screen.getByText(/Bagong Benta|New Sale/i).closest('.fui-Card, [role="button"]') ||
      screen.getByText(/Bagong Benta|New Sale/i);
    fireEvent.click(newSaleBtn);

    expect(onNavigate).toHaveBeenCalledWith('pos');
  });

  it('navigates to Utang tab when clicking Utang action', () => {
    const { onNavigate } = renderDashboard();

    const utangBtn = screen.getByText(/Listahan ng Utang|Utang Ledger/i);
    fireEvent.click(utangBtn);

    expect(onNavigate).toHaveBeenCalledWith('utang');
  });

  it('navigates to GCash, Inventory, and Import when respective cards are clicked', () => {
    const { onNavigate } = renderDashboard();

    const gcashBtn = screen.getByText(/GCash Transaction/i);
    fireEvent.click(gcashBtn);
    expect(onNavigate).toHaveBeenCalledWith('gcash');

    const importBtn = screen.getByText(/Import Inventory|Import/i);
    fireEvent.click(importBtn);
    expect(onNavigate).toHaveBeenCalledWith('import');
  });

  it('renders recent sales list when sales exist in database', async () => {
    await db.sales.add({
      id: 's-dash-1',
      tenantId: 't-1',
      totalAmount: 150,
      paymentMethod: 'Cash',
      date: new Date().toISOString(),
      userId: 'u-1'
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByText(/150\.00/).length).toBeGreaterThan(0);
      expect(screen.getByText(/Ref #s-dash/i)).toBeInTheDocument();
    });
  });

  it('shows an explicit zero low-stock count instead of total product count', async () => {
    await db.products.bulkAdd([
      { id: 'p-out', tenantId: 't-1', name: 'Out', price: 10, cost: 5, stockQty: 0, updatedAt: new Date().toISOString() },
      { id: 'p-stocked', tenantId: 't-1', name: 'Stocked', price: 10, cost: 5, stockQty: 6, updatedAt: new Date().toISOString() }
    ]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/0 Low Stock Alerts \(≤ 5\)|0 Paubos na Paninda \(≤ 5\)/i)).toBeInTheDocument();
      expect(screen.queryByText(/2 items/i)).not.toBeInTheDocument();
    });
  });

  it('counts low-stock products using the same range as Inventory (1 through 5)', async () => {
    await db.products.bulkAdd([
      { id: 'p-out', tenantId: 't-1', name: 'Out', price: 10, cost: 5, stockQty: 0, updatedAt: new Date().toISOString() },
      { id: 'p-low-one', tenantId: 't-1', name: 'Low One', price: 10, cost: 5, stockQty: 1, updatedAt: new Date().toISOString() },
      { id: 'p-low-five', tenantId: 't-1', name: 'Low Five', price: 10, cost: 5, stockQty: 5, updatedAt: new Date().toISOString() },
      { id: 'p-stocked', tenantId: 't-1', name: 'Stocked', price: 10, cost: 5, stockQty: 6, updatedAt: new Date().toISOString() }
    ]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/2 Low Stock Alerts \(≤ 5\)|2 Paubos na Paninda \(≤ 5\)/i)).toBeInTheDocument();
    });
  });

  it('excludes unresolved GCash conflicts from dashboard volume and fee totals', async () => {
    const today = new Date().toISOString();
    await db.gcashTxns.bulkAdd([
      {
        id: 'g-dash-counted',
        tenantId: 't-1',
        type: 'CashIn',
        amount: 100,
        fee: 5,
        refNo: 'REF-DASH-COUNTED',
        date: today
      },
      {
        id: 'g-dash-unresolved',
        tenantId: 't-1',
        type: 'CashOut',
        amount: 800,
        fee: 15,
        refNo: 'REF-DASH-UNRESOLVED',
        date: today,
        syncStatus: 'Conflict'
      }
    ]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('today-gcash-volume')).toHaveTextContent('₱100.00');
      expect(screen.getByTestId('today-gcash-fees')).toHaveTextContent('₱5.00');
    });
  });

  it('uses local calendar days for dashboard transaction totals across midnight', async () => {
    const localMidnight = new Date();
    localMidnight.setHours(0, 0, 0, 0);
    const justBeforeMidnight = new Date(localMidnight.getTime() - 1).toISOString();
    const justAfterMidnight = localMidnight.toISOString();

    await db.gcashTxns.bulkAdd([
      {
        id: 'g-dash-before-local-midnight',
        tenantId: 't-1',
        type: 'CashIn',
        amount: 900,
        fee: 20,
        refNo: 'REF-BEFORE-MIDNIGHT',
        date: justBeforeMidnight
      },
      {
        id: 'g-dash-after-local-midnight',
        tenantId: 't-1',
        type: 'CashIn',
        amount: 100,
        fee: 5,
        refNo: 'REF-AFTER-MIDNIGHT',
        date: justAfterMidnight
      }
    ]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('today-gcash-volume')).toHaveTextContent('₱100.00');
      expect(screen.getByTestId('today-gcash-fees')).toHaveTextContent('₱5.00');
    });
  });

  it('excludes locally resolved originals from dashboard GCash totals', async () => {
    const today = new Date().toISOString();
    await db.gcashTxns.bulkAdd([
      {
        id: 'g-dash-resolved-original', tenantId: 't-1', type: 'CashIn', amount: 900, fee: 20,
        refNo: 'REF-DASH-OLD', date: today, needsAttention: true, syncStatus: 'DuplicateRef'
      },
      {
        id: 'g-dash-replacement', tenantId: 't-1', type: 'CashIn', amount: 900, fee: 20,
        refNo: 'REF-DASH-NEW', date: today
      }
    ]);
    await db.gcashTxnResolutions.add({
      gcashTxnId: 'g-dash-resolved-original',
      tenantId: 't-1',
      resolution: 'Corrected',
      resolvedAt: today,
      replacementTxnId: 'g-dash-replacement',
      correctedRefNo: 'REF-DASH-NEW'
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('today-gcash-volume')).toHaveTextContent('₱900.00');
      expect(screen.getByTestId('today-gcash-fees')).toHaveTextContent('₱20.00');
    });
  });
});

