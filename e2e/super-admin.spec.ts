import { expect, test, type Page } from '@playwright/test';

// Requires the Firebase emulator running with scripts/seed.ts applied
// (`npm run test:e2e:ci`, or `npm run emulators` + `npm run seed`).
// Uses the dedicated `lockout-test-cafe` tenant / `seed-lockout-staff`
// account for the suspend/reactivate test so it never touches
// `demo-cafe`'s shared accounts.

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('super admin creates a tenant and invites its first admin', async ({
  page,
}) => {
  await login(page, 'super@cafecorp.app', 'password123');
  await expect(page).toHaveURL('/', { timeout: 10_000 });

  await page.goto('/super-admin');
  const suffix = Date.now();
  await page.getByPlaceholder('Cafe name').fill(`New Cafe ${suffix}`);
  await page.getByPlaceholder('Phone').fill('+91 90000 11111');
  await page.getByPlaceholder('Owner email').fill(`owner-${suffix}@new.cafe`);
  await page.getByRole('button', { name: 'Create tenant' }).click();

  await expect(page).toHaveURL(/\/super-admin\/[^/]+$/, { timeout: 10_000 });
  await expect(
    page.getByRole('heading', { name: `New Cafe ${suffix}` }),
  ).toBeVisible();

  await page.getByPlaceholder('Name').fill('First Admin');
  await page.getByPlaceholder('Email').fill(`admin-${suffix}@new.cafe`);
  await page.getByRole('button', { name: 'Invite' }).click();

  await expect(page.getByTestId('admin-reset-link')).toBeVisible({
    timeout: 10_000,
  });
});

test('super admin suspends a tenant, blocking its staff from writes, then reactivates it', async ({
  page,
}) => {
  await login(page, 'super@cafecorp.app', 'password123');
  await expect(page).toHaveURL('/', { timeout: 10_000 });

  await page.goto('/super-admin');
  await page
    .locator('tr', { hasText: 'Lockout Test Cafe' })
    .getByRole('link', { name: 'Manage' })
    .click();
  await expect(page).toHaveURL(/\/super-admin\/[^/]+$/, { timeout: 10_000 });

  await page.getByRole('button', { name: 'Suspend tenant' }).click();
  await expect(
    page.getByRole('button', { name: 'Reactivate tenant' }),
  ).toBeVisible({ timeout: 10_000 });

  const staffContext = await page.context().browser()!.newContext();
  const staffPage = await staffContext.newPage();
  await login(staffPage, 'staff@lockout-test.cafe', 'password123');
  await expect(staffPage).toHaveURL('/', { timeout: 10_000 });

  await staffPage.goto('/orders');
  await staffPage.getByRole('button', { name: 'Start order' }).click();
  await expect(staffPage.getByText(/tenant is not active/i)).toBeVisible({
    timeout: 10_000,
  });
  await expect(staffPage).toHaveURL(/\/orders$/);

  await page.getByRole('button', { name: 'Reactivate tenant' }).click();
  await expect(
    page.getByRole('button', { name: 'Suspend tenant' }),
  ).toBeVisible({ timeout: 10_000 });

  await staffPage.getByRole('button', { name: 'Start order' }).click();
  await expect(staffPage).toHaveURL(/\/orders\/[^/]+$/, { timeout: 10_000 });

  await staffContext.close();
});

test('super admin records a subscription payment, which marks the tenant Paid', async ({
  page,
}) => {
  await login(page, 'super@cafecorp.app', 'password123');
  await expect(page).toHaveURL('/', { timeout: 10_000 });

  await page.goto('/super-admin');
  await page
    .locator('tr', { hasText: 'Demo Cafe' })
    .getByRole('link', { name: 'Manage' })
    .click();
  await expect(page).toHaveURL(/\/super-admin\/[^/]+$/, { timeout: 10_000 });

  await page.getByPlaceholder('Amount').fill('999');
  await page.getByPlaceholder('Reference number').fill(`ref-${Date.now()}`);
  await page.getByLabel('Period start').fill('2026-10-01');
  await page.getByLabel('Period end').fill('2026-11-01');
  await page.getByRole('button', { name: 'Record payment' }).click();

  await expect(page.getByText(/999\.00 via UPI/)).toBeVisible({
    timeout: 10_000,
  });

  // Revert this tenant back to TRIAL so other runs of this file (and
  // other specs that assume demo-cafe is on a trial) stay consistent.
  await page.getByRole('heading', { name: 'Plan' }).scrollIntoViewIfNeeded();
  await page
    .locator('section', { has: page.getByRole('heading', { name: 'Plan' }) })
    .getByRole('combobox')
    .selectOption('TRIAL');
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect(page.getByRole('button', { name: 'Save plan' })).toBeEnabled({
    timeout: 10_000,
  });
});
