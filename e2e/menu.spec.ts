import { expect, test } from '@playwright/test';

// Requires the Firebase emulator running with scripts/seed.ts applied
// (`npm run test:e2e:ci`, or `npm run emulators` + `npm run seed`).

test('admin can add a category and an item, then toggle its availability', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('admin@demo.cafe');
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/', { timeout: 10_000 });

  await page.goto('/admin/menu');
  await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();

  const categoryName = `Desserts ${Date.now()}`;
  await page.getByPlaceholder('Category name').fill(categoryName);
  await page.getByPlaceholder('Sort order').fill('5');
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect(page.locator('tr', { hasText: categoryName })).toBeVisible({
    timeout: 10_000,
  });

  const itemName = `Gulab Jamun ${Date.now()}`;
  const itemForm = page.locator('form', {
    has: page.getByPlaceholder('Item name'),
  });
  await itemForm.locator('select').selectOption({ label: categoryName });
  await page.getByPlaceholder('Item name').fill(itemName);
  await page.getByPlaceholder('Price').fill('40');
  await page.getByRole('button', { name: 'Add item' }).click();

  const row = page.locator('tr', { hasText: itemName });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row.getByRole('button', { name: 'Available' })).toBeVisible();

  await row.getByRole('button', { name: 'Available' }).click();
  await expect(row.getByRole('button', { name: 'Unavailable' })).toBeVisible({
    timeout: 10_000,
  });
});

test('staff can see the seeded menu but gets no admin menu link', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('staff@demo.cafe');
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/', { timeout: 10_000 });

  await page.goto('/admin/menu');
  await expect(
    page.getByRole('heading', { name: '403 — Forbidden' }),
  ).toBeVisible({ timeout: 10_000 });
});
