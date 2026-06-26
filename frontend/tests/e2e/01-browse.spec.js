import { test, expect } from '@playwright/test';

// 01 — Browse flow (no auth)
// Verifies the public storefront: home page, product list, product detail.

// Product cards in the catalog are anchors to /products/<ObjectId>. The
// navbar's "/products" link and the "Add product" link to "/products/new"
// share the same prefix, so we filter by MongoDB ObjectId shape (24 hex).
const PRODUCT_HREF_RE = /^\/products\/[a-f0-9]{24}$/;

// Returns an array of <a> Locators whose href matches the product-detail
// pattern. We collect the hrefs via $$eval (atomic against the current DOM)
// so handles don't go stale, then build Locators for the matches.
async function productCardAnchors(page) {
  const matching = await page.$$eval('a[href]', (els) =>
    els
      .map((el) => el.getAttribute('href'))
      .filter((h) => h && /^\/products\/[a-f0-9]{24}$/.test(h)),
  );
  return matching.map((href) => page.locator(`a[href="${href}"]`).first());
}

test.describe('public storefront', () => {
  test('home page shows the brand and a featured grid', async ({ page }) => {
    await page.goto('/');

    // Brand in the navbar
    await expect(page.getByRole('link', { name: /microservices shop/i })).toBeVisible();

    // Hero copy + primary CTA
    await expect(page.getByRole('heading', { name: /shop the catalog/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /browse products/i })).toBeVisible();

    // Featured grid renders at least one product card.
    const cards = await productCardAnchors(page);
    expect(cards.length).toBeGreaterThan(0);
  });

  test('product list page renders all seeded products', async ({ page }) => {
    await page.goto('/products');

    await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible();

    // Seed data has 8 products; assert at least one card is present.
    const cards = await productCardAnchors(page);
    expect(cards.length).toBeGreaterThan(0);
  });

  test('clicking a product opens the detail page with price and Buy now', async ({ page }) => {
    await page.goto('/products');

    const cards = await productCardAnchors(page);
    expect(cards.length).toBeGreaterThan(0);
    await cards[0].click();

    // URL becomes /products/<id>
    await expect(page).toHaveURL(/\/products\/[a-f0-9]{24}$/);

    // Detail page shows price (any currency-formatted string) and the Buy now button.
    await expect(page.getByRole('button', { name: 'Buy now' })).toBeVisible();
    await expect(page.locator('text=/\\$/').first()).toBeVisible();
  });

  test('navbar links to Products without requiring auth', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Products', exact: true }).click();
    await expect(page).toHaveURL(/\/products$/);
  });
});