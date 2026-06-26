import { test, expect } from '@playwright/test';
import { loginAs, uniqueEmail } from './helpers/auth.js';

// 02 — Authentication flow
// Covers register → logout → login → logout with a freshly-created user.

test.describe('authentication', () => {
  test('register, logout, login, logout', async ({ page }) => {
    const email = uniqueEmail('regtest');
    const password = 'password123';
    const firstName = 'Reg';
    const lastName = 'Tester';

    // --- Register -------------------------------------------------------
    await page.goto('/register');
    await page.getByLabel('First name').fill(firstName);
    await page.getByLabel('Last name').fill(lastName);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();

    // After register, the page auto-logs in and lands on "/".
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expect(page.getByText(`Hi, ${firstName}`)).toBeVisible();

    // --- Logout ---------------------------------------------------------
    await page.getByRole('button', { name: 'Sign out' }).click();
    // LoginPage redirects to /login.
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();

    // --- Login ----------------------------------------------------------
    await loginAs(page, email, password);

    // --- Logout again ---------------------------------------------------
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('login form shows an error for wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nobody@example.com');
    await page.getByLabel('Password').fill('definitely-wrong');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    // ErrorBanner renders the API error message in red.
    await expect(page.getByText(/incorrect email or password/i)).toBeVisible();
  });

  test('protected route redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login/);
    // LoginPage preserves where we were trying to go.
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  });
});