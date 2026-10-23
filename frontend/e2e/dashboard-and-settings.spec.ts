import { test, expect } from '@playwright/test';
import { setupDemoStore, navigateToTab } from './helpers';

test.describe('Dashboard and Settings Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupDemoStore(page);
  });

  test('views store KPI metrics on Dashboard and navigates via quick actions', async ({ page }) => {
    await navigateToTab(page, 'dashboard');

    // Assert Dashboard greeting and sections
    await expect(page.getByText(/good day/i).first()).toBeVisible();
    await expect(page.getByText(/quick actions/i)).toBeVisible();
    await expect(page.getByText(/today's summary/i)).toBeVisible();

    // Verify KPI metrics exist
    await expect(page.getByText(/today's sales/i).first()).toBeVisible();
    await expect(page.getByText(/total outstanding credit/i).first()).toBeVisible();
    await expect(page.getByText(/gcash volume/i).first()).toBeVisible();

    // Navigate to Store (POS) using Dashboard action
    const posAction = page.getByRole('button', { name: /go to pos/i }).or(page.getByText(/new sale \(pos\)/i));
    await posAction.first().click();

    // Verify we landed on POS counter
    await expect(page.getByPlaceholder(/scan barcode or search product name/i)).toBeVisible();
  });

  test('toggles language preference in Settings and verifies live UI update', async ({ page }) => {
    await navigateToTab(page, 'settings');

    // Assert Settings page heading
    await expect(page.getByRole('heading', { level: 1, name: /settings/i })).toBeVisible();

    // Switch language to Taglish using the button in Settings
    const taglishBtn = page.getByRole('button', { name: '🇵🇭 Taglish (Filipino)' });
    await expect(taglishBtn).toBeVisible();
    await taglishBtn.click();

    // Verify Tagalog text is rendered in navigation
    await expect(page.getByRole('button', { name: /benta \(pos\)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /imbentaryo/i })).toBeVisible();

    // Switch back to English
    const englishBtn = page.getByRole('button', { name: '🇺🇸 English' });
    await expect(englishBtn).toBeVisible();
    await englishBtn.click();

    // Verify English text returns
    await expect(page.getByRole('button', { name: /store \(pos\)/i })).toBeVisible();
  });

  test('inspects SaaS plan limits and switches theme mode in Settings', async ({ page }) => {
    await navigateToTab(page, 'settings');

    // Verify SaaS Plan section heading and limits
    await expect(page.getByRole('heading', { level: 2, name: /subscription & plans/i })).toBeVisible();
    await expect(page.getByText('30 max').first()).toBeVisible();

    // Verify Theme buttons exist and are interactive
    const darkThemeBtn = page.getByRole('button', { name: /dark/i });
    await expect(darkThemeBtn).toBeVisible();
    await darkThemeBtn.click();

    const lightThemeBtn = page.getByRole('button', { name: /light/i });
    await expect(lightThemeBtn).toBeVisible();
    await lightThemeBtn.click();

    // Verify Stock validation policy buttons exist
    const warnBtn = page.getByRole('button', { name: /warn only/i });
    await expect(warnBtn).toBeVisible();

    const blockBtn = page.getByRole('button', { name: /strict block/i });
    await expect(blockBtn).toBeVisible();
  });

  test('TC-SET-02: ESC/POS thermal printer simulation and paper width selection', async ({ page }) => {
    await navigateToTab(page, 'settings');

    // Verify Printer Configuration section exists
    await expect(page.getByRole('heading', { level: 2, name: /receipt & printer/i })).toBeVisible();

    // Verify paper width selection buttons (58mm vs 80mm)
    const miniPosBtn = page.getByRole('button', { name: /58mm \(mini pos\)/i });
    const standardPosBtn = page.getByRole('button', { name: /80mm \(standard pos\)/i });
    await expect(miniPosBtn).toBeVisible();
    await expect(standardPosBtn).toBeVisible();

    // Select 80mm width
    await standardPosBtn.click();

    // Trigger test print
    const testPrintBtn = page.getByRole('button', { name: /print test receipt/i });
    await expect(testPrintBtn).toBeVisible();
    await testPrintBtn.click();

    // Verify confirmation status message appears
    await expect(page.getByText(/test receipt sent to printer/i)).toBeVisible();

    // Switch back to 58mm width and trigger print again
    await miniPosBtn.click();
    await testPrintBtn.click();
    await expect(page.getByText(/test receipt sent to printer/i)).toBeVisible();
  });
});
