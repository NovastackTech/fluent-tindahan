import { test, expect } from '@playwright/test';
import { setupDemoStore, navigateToTab } from './helpers';

test.describe('Customer Credit & Utang Ledger Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoStore(page);
    await navigateToTab(page, 'utang');
  });

  test('registers a new debtor with initial utang and verifies ledger listing', async ({ page }) => {
    // Check Utang page header
    await expect(page.getByText(/customer credit & utang ledger/i).first()).toBeVisible();

    // Click "Add New Customer"
    const addCustomerBtn = page.getByRole('button', { name: /add new customer/i });
    await expect(addCustomerBtn).toBeVisible();
    await addCustomerBtn.click();

    // Fill customer form
    const nameInput = page.getByLabel(/customer name/i);
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Aling Tessie');

    const phoneInput = page.getByLabel(/mobile number/i);
    await phoneInput.fill('09171234567');

    const initialDebtInput = page.getByLabel(/initial credit balance/i);
    await initialDebtInput.fill('250.00');

    // Submit dialog
    const saveBtn = page.getByRole('button', { name: /save customer/i });
    await saveBtn.click();

    // Verify debtor appears in list
    const debtorCard = page.getByText('Aling Tessie');
    await expect(debtorCard).toBeVisible();
    await expect(page.getByText('₱250.00')).toBeVisible();

    // Search debtor by name
    const searchInput = page.getByPlaceholder(/search customer name/i);
    await searchInput.fill('Tessie');
    await expect(debtorCard).toBeVisible();
  });

  test('manages debtor ledger by adding credit charge and recording debt repayment', async ({ page }) => {
    // Register debtor first
    await page.getByRole('button', { name: /add new customer/i }).click();
    await page.getByLabel(/customer name/i).fill('Mang Kanor');
    await page.getByLabel(/mobile number/i).fill('09189876543');
    await page.getByRole('button', { name: /save customer/i }).click();

    // Open Mang Kanor's ledger dialog
    const debtorCard = page.getByText('Mang Kanor');
    await expect(debtorCard).toBeVisible();
    await debtorCard.click();

    // Add Credit Charge
    const addCreditBtn = page.getByRole('button', { name: /add credit charge/i });
    await expect(addCreditBtn).toBeVisible();
    await addCreditBtn.click();

    const creditAmountInput = page.getByLabel(/credit amount/i);
    await expect(creditAmountInput).toBeVisible();
    await creditAmountInput.fill('120.00');

    const creditNotesInput = page.getByLabel(/items taken/i);
    await creditNotesInput.fill('2 Sardines and 1 Pancit Canton');

    await page.getByRole('button', { name: /record credit/i }).click();

    // Verify credit shows in timeline and updated debt
    await expect(page.getByText('₱120.00').first()).toBeVisible();
    await expect(page.getByText('2 Sardines and 1 Pancit Canton')).toBeVisible();

    // Record Partial Payment (Bayad)
    const recordPaymentBtn = page.getByRole('button', { name: /record payment/i });
    await recordPaymentBtn.click();

    const paymentAmountInput = page.getByLabel(/payment amount/i);
    await expect(paymentAmountInput).toBeVisible();
    await paymentAmountInput.fill('50.00');

    const paymentNotesInput = page.getByLabel(/notes/i);
    await paymentNotesInput.fill('Partial payment in cash');

    await page.getByRole('button', { name: /confirm payment/i }).click();

    // Dialog closes and debtor card in list reflects the updated balance (120 - 50 = 70.00)
    await expect(page.getByText('₱70.00')).toBeVisible();
    await expect(page.getByText('Mang Kanor').first()).toBeVisible();
  });
});
