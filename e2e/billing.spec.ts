import { expect, test } from '@playwright/test';

// Requires the Firebase emulator running with scripts/seed.ts applied
// (`npm run test:e2e:ci`, or `npm run emulators` + `npm run seed`).
// Relies on the seeded "Samosa" item (15.00) under "Snacks".

test('staff can split-pay a bill across two modes and see a receipt with no outstanding balance', async ({
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

  // One Samosa (15.00) is the bill total for this order.
  await page.getByRole('button', { name: /Samosa/ }).click();
  await expect(page.locator('li', { hasText: 'Samosa' })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole('button', { name: 'Send to kitchen' }).click();
  await expect(page).toHaveURL(/\/orders\/[^/]+\/kot$/, { timeout: 10_000 });

  const orderUrl = page.url().replace(/\/kot$/, '');
  await page.goto(orderUrl);

  // Split payment: 10 cash, then 5 UPI should fully settle it.
  await page.getByPlaceholder('Amount').fill('10');
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByText('Balance due: 5.00')).toBeVisible({
    timeout: 10_000,
  });

  await page.getByPlaceholder('Amount').fill('5');
  await page.locator('select').selectOption('UPI');
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByRole('link', { name: 'View receipt' })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole('link', { name: 'View receipt' }).click();
  await expect(page).toHaveURL(/\/receipt$/, { timeout: 10_000 });
  await expect(page.getByText('Paid via CASH')).toBeVisible();
  await expect(page.getByText('Paid via UPI')).toBeVisible();
  await expect(page.getByText('Amount paid')).toBeVisible();
});

test('staff can cancel an order with a reason, and it cannot be cancelled again', async ({
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
  await page.getByRole('button', { name: /Samosa/ }).click();
  await expect(page.locator('li', { hasText: 'Samosa' })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole('button', { name: 'Send to kitchen' }).click();
  await expect(page).toHaveURL(/\/orders\/[^/]+\/kot$/, { timeout: 10_000 });

  const orderUrl = page.url().replace(/\/kot$/, '');
  await page.goto(orderUrl);

  await page.getByRole('button', { name: 'Cancel order' }).click();
  await page
    .getByPlaceholder('Reason for cancelling')
    .fill('Customer changed their mind');
  await page.getByRole('button', { name: 'Confirm cancel' }).click();
  await expect(
    page.getByText('Cancelled: Customer changed their mind'),
  ).toBeVisible({
    timeout: 10_000,
  });
});
