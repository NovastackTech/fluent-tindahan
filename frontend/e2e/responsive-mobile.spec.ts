import { test, expect } from '@playwright/test';
import { setupDemoStore, navigateToTab } from './helpers';

test.describe('Mobile Viewport & Responsive Design Flow (375x667)', () => {
  test.use({
    viewport: { width: 375, height: 667 }
  });

  test('TC-RESP-01: 375px mobile viewport usability and collapsible bottom navigation dock', async ({ page }) => {
    await setupDemoStore(page);

    // Verify there is no horizontal page overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth ||
             document.body.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Verify the mobile collapsible navigation dock is rendered
    const collapsedBar = page.getByTestId('nav-collapsed-bar');
    await expect(collapsedBar).toBeVisible();

    // Expand the bottom navigation dock
    await collapsedBar.click();

    // Verify expanded vertical navigation panel is visible
    const navMenu = page.getByRole('navigation', { name: /bottom navigation menu/i });
    await expect(navMenu).toBeVisible();

    // Verify menu items are present
    const inventoryNavBtn = page.getByRole('button', { name: /inventory/i });
    const utangNavBtn = page.getByRole('button', { name: /credit ledger/i });
    const gcashNavBtn = page.getByRole('button', { name: /gcash hub/i });
    const dashboardNavBtn = page.getByRole('button', { name: /dashboard/i });

    await expect(inventoryNavBtn).toBeVisible();
    await expect(utangNavBtn).toBeVisible();
    await expect(gcashNavBtn).toBeVisible();
    await expect(dashboardNavBtn).toBeVisible();

    // Navigate to Inventory via the expanded menu
    await inventoryNavBtn.click();

    // Assert Inventory page header appears and navigation collapses back
    await expect(page.getByText(/inventory & stock management/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /add product/i })).toBeVisible();
    await expect(collapsedBar).toBeVisible();
  });

  test('TC-RESP-02: Mobile Dashboard metric cards stack cleanly without horizontal clipping', async ({ page }) => {
    await setupDemoStore(page);
    await navigateToTab(page, 'dashboard');

    // Confirm dashboard header loaded
    await expect(page.getByText(/good day/i).first()).toBeVisible();
    await expect(page.getByText(/today's summary/i)).toBeVisible();

    // Verify metric cards are rendered and visible
    const salesCard = page.getByText(/today's sales/i).first();
    const utangCard = page.getByText(/total active utang|total outstanding credit/i).first();
    const gcashCard = page.getByText(/gcash volume/i).first();
    const lowStockCard = page.getByText(/low stock alerts/i).first();

    await expect(salesCard).toBeVisible();
    await expect(utangCard).toBeVisible();
    await expect(gcashCard).toBeVisible();
    await expect(lowStockCard).toBeVisible();

    // Assert no horizontal scrollbar / overflow in mobile dashboard view
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth ||
             document.body.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Verify that KPI cards fit within mobile screen bounds
    const salesBox = await salesCard.boundingBox();
    const utangBox = await utangCard.boundingBox();
    expect(salesBox).not.toBeNull();
    expect(utangBox).not.toBeNull();
    if (salesBox && utangBox) {
      expect(salesBox.width).toBeLessThanOrEqual(375);
      expect(utangBox.width).toBeLessThanOrEqual(375);
    }
  });
});
