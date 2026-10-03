import { expect, test } from '@playwright/test';

// Requires the Firebase emulator running with scripts/seed.ts applied
// (`npm run test:e2e:ci`, or `npm run emulators` + `npm run seed`).
// Relies on the seeded "Masala Chai" item under "Beverages".

test('staff can build an order, send it to the kitchen, and see a price-free KOT', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('staff@demo.cafe');
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/', { timeout: 10_000 });

  await page.goto('/orders');
  await page.getByRole('button', { name: 'Start order' }).click();
  await expect(page).toHaveURL(/\/orders\/[^/]+$/, { timeout: 10_000 });

  await page.getByRole('button', { name: /Masala Chai/ }).click();
  const line = page.locator('li', { hasText: 'Masala Chai' });
  await expect(line).toBeVisible({ timeout: 10_000 });

  await line.getByRole('button', { name: /Increase/ }).click();
  await expect(line.getByText('2', { exact: true })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole('button', { name: 'Send to kitchen' }).click();
  await expect(page).toHaveURL(/\/orders\/[^/]+\/kot$/, { timeout: 10_000 });

  const kotBody = page.locator('main');
  await expect(kotBody.getByText('Masala Chai')).toBeVisible();
  await expect(kotBody.getByText(/\d+\.\d{2}/)).toHaveCount(0); // no prices on the KOT
});

test('the kitchen board shows a sent order live, with no prices', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('staff@demo.cafe');
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/', { timeout: 10_000 });

  await page.goto('/orders');
  await page.getByRole('button', { name: 'Start order' }).click();
  await expect(page).toHaveURL(/\/orders\/[^/]+$/, { timeout: 10_000 });
  await page.getByRole('button', { name: /Filter Coffee/ }).click();
  await expect(page.locator('li', { hasText: 'Filter Coffee' })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole('button', { name: 'Send to kitchen' }).click();
  await expect(page).toHaveURL(/\/orders\/[^/]+\/kot$/, { timeout: 10_000 });

  await page.goto('/kitchen');
  await expect(page.getByText('Filter Coffee')).toBeVisible({
    timeout: 10_000,
  });
});
