import { expect, test } from '@playwright/test';

// Requires the Firebase emulator running with scripts/seed.ts applied
// (`npm run test:e2e:ci`, or `npm run emulators` + `npm run seed`).

test("billing a Samosa order shows up in today's report; staff can't see reports at all", async ({
  page,
}) => {
  // Create and fully pay an order as staff, which should update
  // today's dailySummaries.
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('staff@demo.cafe');
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/', { timeout: 10_000 });

  await page.goto('/orders');
  await page.getByRole('button', { name: 'Start order' }).click();
  await expect(page).toHaveURL(/\/orders\/[^/]+$/, { timeout: 10_000 });
  await page.getByRole('button', { name: /Samosa/ }).click();
  await expect(page.locator('li', { hasText: 'Samosa' })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole('button', { name: 'Send to kitchen' }).click();
  await expect(page).toHaveURL(/\/orders\/[^/]+\/kot$/, { timeout: 10_000 });

  const orderUrl = page.url().replace(/\/kot$/, '');
  await page.goto(orderUrl);
  await page.getByPlaceholder('Amount').fill('15');
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByRole('link', { name: 'View receipt' })).toBeVisible({
    timeout: 10_000,
  });

  // Staff has no access to reports at all (dailySummaries is
  // ADMIN-only, unlike orders/menu).
  await page.goto('/reports');
  await expect(
    page.getByRole('heading', { name: '403 — Forbidden' }),
  ).toBeVisible({ timeout: 10_000 });

  // Admin sees it reflected in today's report.
  const adminContext = await page.context().browser()!.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto('/login');
  await adminPage.getByPlaceholder('Email').fill('admin@demo.cafe');
  await adminPage.getByPlaceholder('Password').fill('password123');
  await adminPage.getByRole('button', { name: 'Sign in' }).click();
  await expect(adminPage).toHaveURL('/', { timeout: 10_000 });

  await adminPage.goto('/reports');
  await expect(adminPage.getByRole('heading', { name: 'Reports' })).toBeVisible(
    { timeout: 10_000 },
  );
  // The billing transaction (order + dailySummaries) already fully
  // committed before "View receipt" appeared above — one fresh load
  // is enough.
  await expect(adminPage.getByText('Samosa')).toBeVisible({ timeout: 10_000 });
  await adminContext.close();
});
