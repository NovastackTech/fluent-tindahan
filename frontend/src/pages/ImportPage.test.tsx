import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { ImportPage } from './ImportPage';
import { sariSariLightTheme } from '../theme/theme';
import { db } from '../db/db';
import { useSubscriptionStore } from '../state/subscriptionStore';

describe('ImportPage', () => {
  beforeEach(async () => {
    await db.products.clear();
    await db.syncQueue.clear();
    useSubscriptionStore.setState({ tier: 'TindahanPro' });
  });

  const renderImport = () => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <ImportPage />
      </FluentProvider>
    );
  };

  it('renders CSV file upload dropzone and instruction text', () => {
    renderImport();

    expect(screen.getByText(/Mag-import ng Imbentaryo|Import Inventory/i)).toBeInTheDocument();
    expect(screen.getByText(/Piliin o I-drag|Select or drag/i)).toBeInTheDocument();
  });

  it('handles CSV file upload and shows preview table', async () => {
    renderImport();

    const csvContent = 'name,price,cost,barcode,category,stockQty\nSan Miguel Beer,45,38,123456,Beverages,24';
    const file = new File([csvContent], 'catalog.csv', { type: 'text/csv' });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('San Miguel Beer')).toBeInTheDocument();
      expect(screen.getByText('₱45.00')).toBeInTheDocument();
    });
  });

  it('loads sample CSV when clicking sample button and completes import to Dexie', async () => {
    renderImport();

    const sampleBtn = screen.getByRole('button', { name: /Subukan gamit ang Sample|Try.*Sample/i });
    fireEvent.click(sampleBtn);

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    const importBtn = screen.getByRole('button', { name: /I-import|Import/i });
    expect(importBtn).not.toBeDisabled();
    fireEvent.click(importBtn);

    await waitFor(async () => {
      expect(screen.getByText(/Matagumpay na na-import|Successfully imported/i)).toBeInTheDocument();
      const prods = await db.products.toArray();
      expect(prods.length).toBeGreaterThan(0);
    });
  });

  it('displays Pro feature warning when on Libre tier', () => {
    useSubscriptionStore.setState({ tier: 'Libre' });
    renderImport();

    expect(screen.getByText(/Pro Feature: CSV Bulk Import/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mag-upgrade sa Pro|Upgrade to Pro/i })).toBeInTheDocument();
  });
});


