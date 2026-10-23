import { test, expect } from '@playwright/test';
import { setupDemoStore, navigateToTab } from './helpers';

test.describe('Bulk Import & Migration Flow (TC-IMP-01 & TC-IMP-02)', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoStore(page);
  });

  test('TC-IMP-01: parses sample CSV and flags invalid rows with error badges', async ({ page }) => {
    await navigateToTab(page, 'import');

    // Assert Import page title
    await expect(page.getByRole('heading', { level: 2, name: /csv inventory file/i }).or(page.getByText(/import/i).first())).toBeVisible();

    // Click "Try with Sample Sari-Sari CSV"
    const sampleBtn = page.getByRole('button', { name: /try with sample sari-sari csv/i });
    await expect(sampleBtn).toBeVisible();
    await sampleBtn.click();

    // Verify preview card shows parsed rows with valid and error indicators (9 total rows)
    await expect(page.getByText(/preview and validation/i)).toBeVisible();
    await expect(page.getByText(/8 valid/i)).toBeVisible();
    await expect(page.getByText(/1 errors/i)).toBeVisible();

    // Verify invalid product name appears in error rows
    await expect(page.getByText('Pancit Canton Invalid Test')).toBeVisible();

    // Verify valid product names appear in preview
    await expect(page.getByText('Chippy Barbecue 110g')).toBeVisible();
    await expect(page.getByText('Piattos Cheese 85g')).toBeVisible();
  });

  test('TC-IMP-02: commits valid CSV products into local Dexie IndexedDB under TindahanPro', async ({ page }) => {
    // Elevate store to TindahanPro via native IndexedDB & localStorage, then reload
    await page.evaluate(async () => {
      localStorage.setItem('fluent_tindahan_tier_v1', 'TindahanPro');
      const req = indexedDB.open('FluentTindahanDB');
      const idb = await new Promise<IDBDatabase>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (idb.objectStoreNames.contains('tenants')) {
        const tx = idb.transaction('tenants', 'readwrite');
        const store = tx.objectStore('tenants');
        const getReq = store.get('11111111-1111-1111-1111-111111111111');
        const tenant = await new Promise<any>((resolve) => {
          getReq.onsuccess = () => resolve(getReq.result);
        });
        if (tenant) {
          tenant.tier = 'TindahanPro';
          store.put(tenant);
        }
        await new Promise((resolve) => {
          tx.oncomplete = resolve;
        });
      }
    });

    await page.reload();
    await navigateToTab(page, 'import');

    // Load sample CSV
    await page.getByRole('button', { name: /try with sample sari-sari csv/i }).click();

    // Commit import of 8 valid products
    const importBtn = page.getByRole('button', { name: /import products \(8\)/i });
    await expect(importBtn).toBeVisible();
    await importBtn.click();

    // Verify success status banner
    await expect(page.getByText(/successfully imported 8 products/i)).toBeVisible();

    // Navigate to Inventory tab and verify newly imported items exist
    await navigateToTab(page, 'inventory');
    const searchInput = page.getByPlaceholder(/search by product name or barcode/i);
    await searchInput.fill('Chippy Barbecue');
    await expect(page.getByText(/Chippy Barbecue 110g/i).first()).toBeVisible();
  });
});
