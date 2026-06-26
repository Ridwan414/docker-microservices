import { expect } from '@playwright/test';

// Shared auth helpers for the e2e suite.
//
// `loginAs` walks the real login form (no API shortcuts), so we exercise the
// same path the user does. It waits for the navbar's "Sign out" button to
// appear, which means AuthContext has loaded the user and React re-rendered.

export async function loginAs(page, email, password) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

// Generate a unique email so register/login tests can run repeatedly without
// colliding on "email already registered". The random suffix guards against
// the same millisecond across parallel workers.
export function uniqueEmail(prefix = 'tester') {
  const stamp = Date.now();
  const rand = Math.floor(Math.random() * 1e6);
  return `${prefix}-${stamp}-${rand}@example.com`;
}