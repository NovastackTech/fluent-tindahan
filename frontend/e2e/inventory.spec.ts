import { test, expect } from '@playwright/test';
import { setupDemoStore } from './helpers';

test.describe('Inventory Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoStore(page);
    // Navigate to Inventory tab via bottom navigation
    const inventoryNavBtn = page.getByRole('button', { name: 'Inventory' });
    await expect(inventoryNavBtn).toBeVisible();
    await inventoryNavBtn.click();
  });

  test('views inventory summary metrics and searches products by name or barcode', async ({ page }) => {
    // Assert summary KPI card
    await expect(page.getByText(/total products/i).first()).toBeVisible();

    // Search for a specific item using placeholder
    const searchInput = page.getByPlaceholder(/search by product name or barcode/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Silver Swan');

    // Confirm filtered result is visible
    await expect(page.getByText(/Silver Swan Soy Sauce/i).first()).toBeVisible();

    // Clear search
    await searchInput.fill('');
  });

  test('enforces plan capacity warning on add, allows editing existing product price and quick restock', async ({ page }) => {
    // Click Add Product when exceeding 30-item cap on Libre plan
    const addProductBtn = page.getByRole('button', { name: /add product/i });
    await expect(addProductBtn).toBeVisible();
    await addProductBtn.click();

    // Plan limit banner is shown
    await expect(page.getByText(/limit reached for libre plan/i)).toBeVisible();

    // The subscription upgrade modal opens to prompt upgrading
    const upgradeDialog = page.getByRole('dialog', { name: /tindahan subscription plans/i });
    await expect(upgradeDialog).toBeVisible();

    // Dismiss upgrade modal and ensure backdrop is gone
    const upgradeCloseBtn = upgradeDialog.getByRole('button', { name: /close/i }).first();
    await upgradeCloseBtn.click();
    await expect(upgradeDialog).not.toBeVisible();

    // Edit an existing product
    const editBtn = page.getByRole('button', { name: 'Edit Product' }).first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Edit Product Dialog opens
    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible();
    await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible();

    // Update retail price
    const priceInput = page.getByLabel(/retail price/i);
    await expect(priceInput).toBeVisible();
    await priceInput.fill('18.00');

    // Save product
    const saveBtn = page.getByRole('button', { name: /save/i });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Dialog closes
    await expect(editDialog).not.toBeVisible();

    // Updated price is shown in table
    await expect(page.getByText('₱18.00').first()).toBeVisible();

    // Test Quick Restock (+6)
    const restock6Btn = page.getByRole('button', { name: '+6' }).first();
    await expect(restock6Btn).toBeVisible();
    await restock6Btn.click();

    // Stock updates to 42
    await expect(page.getByText(/42 in stock/i).first()).toBeVisible();
  });
});
