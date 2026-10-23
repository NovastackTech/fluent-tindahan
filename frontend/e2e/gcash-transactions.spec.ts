import { test, expect } from '@playwright/test';
import { setupDemoStore, navigateToTab } from './helpers';

test.describe('GCash Remittance & Pera Hub Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoStore(page);
    await navigateToTab(page, 'gcash');
  });

  test('records a Cash-In transaction with auto-calculated service fee', async ({ page }) => {
    // Assert page header
    await expect(page.getByText(/gcash remittance & pera hub/i).first()).toBeVisible();

    // Ensure Cash-In tab is selected
    const cashInTab = page.getByRole('tab', { name: /cash in/i });
    await expect(cashInTab).toBeVisible();

    // Fill Cash-In form
    const amountInput = page.getByLabel(/amount \(₱\)/i);
    await expect(amountInput).toBeVisible();
    await amountInput.fill('1000.00');

    // Verify service fee auto-calculates (e.g. ₱20 for ₱1000 tier)
    const feeInput = page.getByLabel(/service fee \(₱\)/i);
    await expect(feeInput).toBeVisible();
    await expect(feeInput).not.toHaveValue('0');

    // Fill customer details
    const refNoInput = page.getByLabel(/reference number/i);
    await refNoInput.fill('901234567890');

    const phoneInput = page.getByLabel(/customer mobile number/i);
    await phoneInput.fill('09178889999');

    const notesInput = page.getByLabel(/notes/i);
    await notesInput.fill('Cash-In for school supplies');

    // Submit transaction
    const submitBtn = page.getByRole('button', { name: /save transaction/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify status/success feedback
    await expect(page.getByRole('status')).toBeVisible();

    // Verify entry in transaction history
    await expect(page.getByText('901234567890')).toBeVisible();
    await expect(page.getByText('09178889999')).toBeVisible();
  });

  test('switches to Cash-Out tab and records a disbursement transaction', async ({ page }) => {
    // Switch to Cash-Out tab
    const cashOutTab = page.getByRole('tab', { name: /cash out/i });
    await expect(cashOutTab).toBeVisible();
    await cashOutTab.click();

    // Fill Cash-Out form
    const amountInput = page.getByLabel(/amount/i);
    await amountInput.fill('500.00');

    const refNoInput = page.getByLabel(/reference number/i);
    await refNoInput.fill('801234567891');

    const phoneInput = page.getByLabel(/customer mobile number/i);
    await phoneInput.fill('09201234567');

    // Submit transaction
    const submitBtn = page.getByRole('button', { name: /save transaction/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify success feedback
    await expect(page.getByRole('status')).toBeVisible();

    // Verify entry in transaction history
    await expect(page.getByText('801234567891')).toBeVisible();
    await expect(page.getByText('09201234567')).toBeVisible();
  });
});
