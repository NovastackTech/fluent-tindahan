import { test, expect } from '@playwright/test';

test.describe('Authentication & Onboarding Flow', () => {
  test('fresh visitor sees privacy consent dialog, accepts terms, and tests registration tab switching', async ({ page }) => {
    // Navigate to root as a fresh visitor without pre-set consent
    await page.goto('/');

    // Web-first assertion: Privacy Consent Dialog appears
    const privacyDialog = page.getByRole('dialog');
    await expect(privacyDialog).toBeVisible();

    const termsCheckbox = page.getByRole('checkbox');
    await expect(termsCheckbox).toBeVisible();
    await termsCheckbox.check();

    const agreeBtn = page.getByRole('button', { name: /i agree|sumasang-ayon/i });
    await expect(agreeBtn).toBeEnabled();
    await agreeBtn.click();

    // Dialog closes
    await expect(privacyDialog).not.toBeVisible();

    // Switch to Register / New Store tab
    const registerTab = page.getByRole('tab', { name: /new store|bagong tindahan/i });
    await expect(registerTab).toBeVisible();
    await registerTab.click();

    // Verify registration input fields are shown
    const storeNameInput = page.getByLabel(/store name|pangalan ng tindahan/i);
    await expect(storeNameInput).toBeVisible();

    // Switch back to Login tab
    const loginTab = page.getByRole('tab', { name: /log in|mag-login/i });
    await loginTab.click();
    await expect(page.getByRole('button', { name: /explore with sample demo data/i })).toBeVisible();
  });

  test('one-click Explore Demo button seeds store and navigates to POS counter', async ({ page }) => {
    // Ensure English language and consent are set to test the 1-click test drive
    await page.addInitScript(() => {
      localStorage.setItem('fluent_tindahan_consent_v1', 'true');
      localStorage.setItem('fluent_tindahan_terms_version_v1', '2026-03-31');
      localStorage.setItem('fluent_tindahan_language', 'en');
    });

    await page.goto('/?tab=login');

    const demoBtn = page.getByRole('button', { name: /explore with sample demo data/i });
    await expect(demoBtn).toBeVisible();
    await demoBtn.click();

    // Web-first assertion: POS page is loaded with product search and categories
    await expect(page.getByPlaceholder(/scan barcode or search product name/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'All', exact: true })).toBeVisible();

    // Store Name is set to Aling Nena's Demo Tindahan in header
    await expect(page.getByRole('button', { name: "Aling Nena's Demo Tindahan" })).toBeVisible();
  });
});
