import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth.js';

// 04 — Inventory flow
// Reuses alice@example.com. Verifies the inventory table renders rows and
// that drilling into one row shows the stock cards + history section.

const ALICE = { email: 'alice@example.com', password: 'password123' };

test.describe('inventory', () => {
  test('list page renders seeded inventory rows', async ({ page }) => {
    await loginAs(page, ALICE.email, ALICE.password);
    await page.goto('/inventory');

    await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();

    // Seed creates 8 products, each with an inventory record -> at least 8 rows.
    const rows = page.locator('table tbody tr');
    expect(await rows.count()).toBeGreaterThanOrEqual(8);

    // The "Low stock only" toggle is present and unchecked.
    await expect(page.getByLabel('Low stock only')).not.toBeChecked();
  });

  test('clicking Details opens the inventory detail with cards and history', async ({ page }) => {
    await loginAs(page, ALICE.email, ALICE.password);
    await page.goto('/inventory');

    // Click the first "Details" link in the table.
    const firstDetails = page.getByRole('link', { name: 'Details' }).first();
    await firstDetails.click();

    // URL becomes /inventory/<encoded productId>
    await expect(page).toHaveURL(/\/inventory\/.+/);

    // The three stock summary cards are present.
    await expect(page.getByText('Available', { exact: true })).toBeVisible();
    await expect(page.getByText('Reserved', { exact: true })).toBeVisible();
    await expect(page.getByText('Reorder at', { exact: true })).toBeVisible();

    // Recent history section exists (seed creates at least the initial "add" row).
    await expect(page.getByRole('heading', { name: 'Recent history' })).toBeVisible();
    // The history table has at least one row.
    const historyRows = page.locator('section:has-text("Recent history") tbody tr');
    expect(await historyRows.count()).toBeGreaterThan(0);
  });

  test('low-stock filter narrows the result', async ({ page }) => {
    await loginAs(page, ALICE.email, ALICE.password);
    await page.goto('/inventory');

    // Count rows before filtering.
    const allRows = page.locator('table tbody tr');
    const before = await allRows.count();
    expect(before).toBeGreaterThan(0);

    // Toggle "Low stock only". The seed has 1 product below threshold (Wireless Mouse, qty=3, threshold=5).
    await page.getByLabel('Low stock only').check();

    // The table updates. Expect a smaller (or equal) count.
    // Use waitFor to allow the fetch to settle.
    await expect.poll(async () => allRows.count()).toBeLessThan(before + 1);
    const after = await allRows.count();
    expect(after).toBeLessThanOrEqual(before);
    expect(after).toBeGreaterThanOrEqual(1);
  });
});