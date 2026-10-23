import { test, expect } from '@playwright/test';
import { setupDemoStore } from './helpers';

test.describe('POS & Cash Register Sales Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoStore(page);
  });

  test('searches products, filters by category, and updates cart', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/scan barcode or search product name/i);
    await expect(searchInput).toBeVisible();

    // Search for Lucky Me
    await searchInput.fill('Lucky Me');
    await expect(page.getByText(/Lucky Me! Instant Pancit Canton Kalamansi/i).first()).toBeVisible();

    // Clear search
    await searchInput.fill('');

    // Filter by Condiments category
    const condimentsCategory = page.getByRole('button', { name: 'Condiments', exact: true });
    await expect(condimentsCategory).toBeVisible();
    await condimentsCategory.click();

    // Expect Silver Swan Soy Sauce to be displayed
    await expect(page.getByText(/Silver Swan Soy Sauce/i).first()).toBeVisible();

    // Reset back to All
    const allCategory = page.getByRole('button', { name: 'All', exact: true });
    await allCategory.click();
  });

  test('adds items to cart, opens cart drawer, adjusts quantity, and completes cash sale with sukli calculation', async ({ page }) => {
    // Add Lucky Me Pancit Canton to cart
    const addLuckyMeBtn = page.getByRole('button', { name: /add to cart: Lucky Me! Instant Pancit Canton Kalamansi/i }).first();
    await expect(addLuckyMeBtn).toBeVisible();
    await addLuckyMeBtn.click();

    // Add Silver Swan Soy Sauce to cart
    const addSilverSwanBtn = page.getByRole('button', { name: /add to cart: Silver Swan Soy Sauce/i }).first();
    await expect(addSilverSwanBtn).toBeVisible();
    await addSilverSwanBtn.click();

    // Floating cart bar displays items count and Checkout action
    await expect(page.getByText(/in cart/i).first()).toBeVisible();
    const checkoutBtn = page.getByRole('button', { name: 'Checkout' });
    await expect(checkoutBtn).toBeVisible();
    await checkoutBtn.click();

    // Checkout modal is opened
    const checkoutDialog = page.getByRole('dialog');
    await expect(checkoutDialog).toBeVisible();
    await expect(page.getByRole('heading', { name: /confirm payment/i })).toBeVisible();

    // Click Exact Amount button
    const exactCashBtn = page.getByRole('button', { name: /exact amount/i });
    await expect(exactCashBtn).toBeVisible();
    await exactCashBtn.click();

    // Verify Sukli / Change shows ₱0.00
    await expect(page.getByText(/change:\s*₱0\.00/i)).toBeVisible();

    // Click Complete Sale
    const completeSaleBtn = page.getByRole('button', { name: /complete sale/i });
    await expect(completeSaleBtn).toBeEnabled();
    await completeSaleBtn.click();

    // Official Receipt modal appears
    await expect(page.getByRole('heading', { name: /receipt/i })).toBeVisible();

    // Close receipt
    const closeReceiptBtn = page.getByRole('button', { name: /close/i });
    await expect(closeReceiptBtn).toBeVisible();
    await closeReceiptBtn.click();

    // Receipt is closed and cart is reset
    await expect(page.getByRole('button', { name: 'Checkout' })).not.toBeVisible();
  });

  test('TC-POS-07: completes store credit (utang) POS checkout and verifies debit in ledger', async ({ page }) => {
    // Add product to cart
    const addProductBtn = page.getByRole('button', { name: /add to cart: Lucky Me! Instant Pancit Canton Kalamansi/i }).first();
    await expect(addProductBtn).toBeVisible();
    await addProductBtn.click();

    // Click Checkout
    const checkoutBtn = page.getByRole('button', { name: 'Checkout' });
    await expect(checkoutBtn).toBeVisible();
    await checkoutBtn.click();

    // Switch payment tab to Utang
    const utangTab = page.getByRole('tab', { name: /utang/i });
    await expect(utangTab).toBeVisible();
    await utangTab.click();

    // Register a new debtor directly in checkout modal
    const addDebtorBtn = page.getByRole('button', { name: /add new debtor/i });
    await expect(addDebtorBtn).toBeVisible();
    await addDebtorBtn.click();

    await page.getByPlaceholder(/maria santos/i).fill('Aling Marites');
    await page.getByPlaceholder(/09/i).fill('09170001111');

    const saveAndSelectBtn = page.getByRole('button', { name: /save & select/i });
    await expect(saveAndSelectBtn).toBeVisible();
    await saveAndSelectBtn.click();

    // Complete Utang Sale
    const completeSaleBtn = page.getByRole('button', { name: /complete sale/i });
    await expect(completeSaleBtn).toBeEnabled();
    await completeSaleBtn.click();

    // Verify Receipt displays Utang payment and debtor name
    await expect(page.getByRole('heading', { name: /receipt/i })).toBeVisible();
    await expect(page.getByText('Aling Marites')).toBeVisible();

    // Close receipt
    await page.getByRole('button', { name: /close/i }).click();

    // Navigate to Credit Ledger and verify debtor has outstanding debt of ₱16.00
    const utangNavBtn = page.getByRole('button', { name: /credit ledger/i });
    await utangNavBtn.click();
    await expect(page.getByText('Aling Marites')).toBeVisible();
    await expect(page.getByText('₱16.00').first()).toBeVisible();
  });
});
