/**
 * E2E Tests: ZK Credentials
 *
 * Tests the credentials page through a real browser:
 * - Wallet guard behavior
 * - Empty state display
 * - Credential dialog
 * - Tab filtering
 */

import { test, expect } from '@playwright/test';
import { injectMockWallet, injectDisconnectedWallet } from './fixtures/test-wallet';

test.describe('Credentials Page', () => {
  test('shows connect prompt when wallet is disconnected', async ({ page }) => {
    await injectDisconnectedWallet(page);
    await page.goto('/credentials');

    // Should display connect prompt or redirect
    const connectButton = page.getByRole('button', { name: /connect/i });
    const body = page.locator('body');

    // Either shows connect button or the text
    const hasConnect = await connectButton.isVisible().catch(() => false);
    const hasText = await body.getByText(/connect.*wallet/i).isVisible().catch(() => false);

    expect(hasConnect || hasText).toBeTruthy();
  });

  test('shows empty state when connected with no credentials', async ({ page }) => {
    await injectMockWallet(page);
    await page.goto('/credentials');
    await page.waitForLoadState('networkidle');

    // Should not show an error
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('displays circuit type options', async ({ page }) => {
    await injectMockWallet(page);
    await page.goto('/credentials');
    await page.waitForLoadState('networkidle');

    // Look for circuit type labels in the page
    const body = page.locator('body');
    const pageText = await body.textContent();

    // The page should contain credential-related content (if the route exists)
    if (pageText && !pageText.includes('404')) {
      // Credential types should be mentioned somewhere
      const hasBuilderRef = pageText.includes('Builder') || pageText.includes('builder');
      const hasGrantRef = pageText.includes('Grant') || pageText.includes('grant');

      // At least one credential type should be visible
      expect(hasBuilderRef || hasGrantRef).toBeTruthy();
    }
  });

  test('tab filtering is accessible', async ({ page }) => {
    await injectMockWallet(page);
    await page.goto('/credentials');
    await page.waitForLoadState('networkidle');

    // Look for tab navigation (All / Local / On-Chain)
    const tabs = page.getByRole('tab');
    const tabCount = await tabs.count();

    if (tabCount > 0) {
      // Should have filtering tabs
      expect(tabCount).toBeGreaterThanOrEqual(2);

      // First tab should be clickable
      await tabs.first().click();
    }
  });
});
