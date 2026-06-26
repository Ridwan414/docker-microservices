import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth.js';

// 03 — Checkout flow
// Reuses the seeded alice@example.com (has a default shipping address and
// eight products to choose from). Places one order end-to-end and verifies
// it shows up in the user's order history.

const ALICE = { email: 'alice@example.com', password: 'password123' };

// Same ObjectId-aware selector as in 01-browse.spec.js — picks the first
// product card from the catalog.
async function firstProductHref(page) {
  return page.$$eval('a[href]', (els) => {
    const hrefs = els
      .map((el) => el.getAttribute('href'))
      .filter((h) => h && /^\/products\/[a-f0-9]{24}$/.test(h));
    return hrefs[0] || null;
  });
}

test.describe('checkout', () => {
  test('buy now → place order → appears in My orders', async ({ page }) => {
    await loginAs(page, ALICE.email, ALICE.password);

    // Open the catalog and pick the first product.
    await page.goto('/products');
    const productHref = await firstProductHref(page);
    expect(productHref).toMatch(/^\/products\/[a-f0-9]{24}$/);
    await page.locator(`a[href="${productHref}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${productHref}$`));

    // Hit Buy now — ProductDetailPage seeds checkout with one item.
    await page.getByRole('button', { name: 'Buy now' }).click();
    await expect(page).toHaveURL(/\/checkout$/);

    // The cart line item should render (CheckoutPage hydrates product details).
    // The seeded alice has a default address, so the shipping form is pre-filled.
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    // At least one row in the items list — the line item has a remove button.
    await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();

    // Place the order.
    await page.getByRole('button', { name: 'Place order' }).click();

    // Success → redirect to /orders/<id>
    await expect(page).toHaveURL(/\/orders\/[a-f0-9]+$/);

    // Order detail page: shows the truncated id, the new order status, and a non-empty total.
    await expect(page.getByRole('heading', { name: /Order [a-f0-9]{8}$/i })).toBeVisible();
    await expect(page.getByText(/\$/).first()).toBeVisible();

    // Back to the orders list — the new order is at the top (sorted desc by date).
    await page.goto('/orders');
    await expect(page.getByRole('heading', { name: 'My orders', exact: true })).toBeVisible();
    // Wait for the SPA to finish hydrating and rendering the table before
    // counting rows. The heading alone can be in the static layout while
    // the table is still being populated from the API.
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
    // Alice has 2 seeded orders in data/orders.json; this test added 1 more,
    // so we expect at least 3 rows. (Earlier test runs add more — that's fine.)
    expect(await rows.count()).toBeGreaterThanOrEqual(3);
  });
});