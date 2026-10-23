import { expect, type Page } from '@playwright/test';

/**
 * Initializes a demo store session with consent accepted and demo data loaded.
 */
export async function setupDemoStore(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('fluent_tindahan_consent_v1', 'true');
    localStorage.setItem('fluent_tindahan_terms_version_v1', '2026-03-31');
    localStorage.setItem('fluent_tindahan_language', 'en');
  });

  await page.goto('/?tab=login');

  const demoBtn = page.getByRole('button', { name: /explore with sample demo data/i });
  await expect(demoBtn).toBeVisible();
  await demoBtn.click();

  // Web-first assertion that POS page is loaded
  await expect(page.getByPlaceholder(/scan barcode or search product name/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'All', exact: true })).toBeVisible();
}

/**
 * Navigates to a top-level tab using user-facing navigation button roles.
 */
export async function navigateToTab(
  page: Page,
  tab: 'dashboard' | 'pos' | 'inventory' | 'utang' | 'gcash' | 'import' | 'settings' | string
) {
  const tabMatchers: Record<string, RegExp> = {
    dashboard: /dashboard/i,
    pos: /store \(pos\)/i,
    inventory: /inventory/i,
    utang: /credit ledger/i,
    gcash: /gcash hub/i,
    import: /import csv/i,
    settings: /settings/i
  };

  const matcher = tabMatchers[tab] ?? new RegExp(tab, 'i');
  let navBtn = page.getByRole('button', { name: matcher });

  // If in mobile collapsed mode, expand navigation first
  const collapsedBar = page.getByTestId('nav-collapsed-bar');
  if (await collapsedBar.isVisible()) {
    await collapsedBar.click();
    navBtn = page.getByRole('button', { name: matcher });
  }

  await expect(navBtn).toBeVisible();
  await navBtn.click();
}

