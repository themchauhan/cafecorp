import { expect, test } from '@playwright/test';

// Requires the Firebase emulator running with scripts/seed.ts applied
// (`npm run test:e2e:ci`, or `npm run emulators` + `npm run seed` in
// two other terminals before `npm run test:e2e` locally).

async function login(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
) {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Login is async (client sign-in, then a fetch to set the session
  // cookie); give the caller's first post-click assertion a longer
  // timeout rather than racing two waiters here.
}

test('admin can log in, see the dashboard, and log out', async ({ page }) => {
  await login(page, 'admin@demo.cafe', 'password123');
  await expect(page).toHaveURL('/', { timeout: 10_000 });
  await expect(page.getByText(/tenant demo-cafe/)).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole('strong')).toHaveText('ADMIN');

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
});

test('admin can reach the admin page; staff cannot', async ({ browser }) => {
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, 'admin@demo.cafe', 'password123');
  await expect(adminPage).toHaveURL('/', { timeout: 10_000 });
  await adminPage.goto('/admin');
  await expect(adminPage.getByRole('heading', { name: 'Admin' })).toBeVisible({
    timeout: 10_000,
  });
  await adminContext.close();

  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  await login(staffPage, 'staff@demo.cafe', 'password123');
  await expect(staffPage).toHaveURL('/', { timeout: 10_000 });
  await staffPage.goto('/admin');
  await expect(
    staffPage.getByRole('heading', { name: '403 — Forbidden' }),
  ).toBeVisible({ timeout: 10_000 });
  await staffContext.close();
});

test('a wrong password shows an error and does not sign in', async ({
  page,
}) => {
  await login(page, 'admin@demo.cafe', 'wrong-password');
  await expect(
    page.getByText(/login failed|invalid|wrong-password/i),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/login$/);
});
