import { expect, test } from '@playwright/test';

test('an unauthenticated visitor is redirected to login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('an unknown route shows the 404 page', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await expect(
    page.getByRole('heading', { name: '404 — Page not found' }),
  ).toBeVisible();
});
