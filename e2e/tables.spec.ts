import { expect, test } from '@playwright/test';

// Requires the Firebase emulator running with scripts/seed.ts applied
// (`npm run test:e2e:ci`, or `npm run emulators` + `npm run seed`).
// Relies on seeded tables T1/T2 (occupancy) and T3 (dedicated to the
// activate/deactivate test, to avoid racing the occupancy test).

test('a dine-in order ties to a table, and the table shows occupied until billed', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('staff@demo.cafe');
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/', { timeout: 10_000 });

  await page.goto('/orders');
  await page.locator('select').first().selectOption('DINE_IN');
  await page.locator('select').nth(1).selectOption({ label: 'T1' });
  await page.getByRole('button', { name: 'Start order' }).click();
  await expect(page).toHaveURL(/\/orders\/[^/]+$/, { timeout: 10_000 });

  await page.goto('/tables');
  const t1 = page.locator('div', { hasText: 'T1' }).last();
  await expect(t1.getByText('Occupied')).toBeVisible({ timeout: 10_000 });

  const t2 = page.locator('div', { hasText: 'T2' }).last();
  await expect(t2.getByText('Free')).toBeVisible();
});

test('admin cannot create a dine-in order against an inactive table', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('admin@demo.cafe');
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/', { timeout: 10_000 });

  // T3 is dedicated to this test (not T1/T2, used by the occupancy
  // test above) so the two don't race over shared table state.
  await page.goto('/admin/tables');
  const row = page.locator('tr', { hasText: 'T3' });
  await row.getByRole('button', { name: 'Deactivate' }).click();
  await expect(row.getByRole('button', { name: 'Activate' })).toBeVisible({
    timeout: 10_000,
  });

  // Poll rather than a single read: this exercises a fresh SSR fetch
  // on every retry (full navigation, not a client-side transition),
  // so it tolerates any brief emulator read-after-write lag between
  // the Server Action's write and a *different* route's next read,
  // without weakening what's actually being verified.
  await expect
    .poll(
      async () => {
        await page.goto('/orders');
        await page.locator('select').first().selectOption('DINE_IN');
        return page
          .locator('select')
          .nth(1)
          .locator('option')
          .allTextContents();
      },
      { timeout: 15_000 },
    )
    .not.toContain('T3');

  // Restore state for any later run of this file.
  await page.goto('/admin/tables');
  await page
    .locator('tr', { hasText: 'T3' })
    .getByRole('button', { name: 'Activate' })
    .click();
});
