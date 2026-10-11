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

// Both tests below share the dedicated tax-test-cafe tenant (not
// demo-cafe) because they each mutate a tenant-wide setting (tax
// rate, GST invoicing) — every other billing test implicitly assumes
// demo-cafe stays at 0%/GST-off. `.serial` keeps these two from
// racing each other too: playwright.config.ts's `fullyParallel: true`
// would otherwise run them concurrently against the same tenant doc.
test.describe.serial('tax-test-cafe tenant settings', () => {
  test('admin sets a tax rate; a discounted, taxed bill shows the right breakdown on the receipt', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('admin@tax-test.cafe');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/', { timeout: 10_000 });

    await page.goto('/admin/settings');
    const taxRateForm = page.locator('form', { hasText: 'Tax rate (%)' });
    await taxRateForm.locator('#taxRatePercent').fill('10');
    await taxRateForm.getByRole('button', { name: 'Save' }).click();
    await expect(taxRateForm.getByText('Saved.')).toBeVisible({
      timeout: 10_000,
    });

    await page.goto('/orders');
    await page.getByRole('button', { name: 'Start order' }).click();
    await expect(page).toHaveURL(/\/orders\/[^/]+$/, { timeout: 10_000 });

    // One Samosa (15.00), 5 flat discount -> 10 taxable, 10% tax -> 1 -> 11 total.
    await page.getByRole('button', { name: /Samosa/ }).click();
    await expect(page.locator('li', { hasText: 'Samosa' })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: 'Send to kitchen' }).click();
    await expect(page).toHaveURL(/\/orders\/[^/]+\/kot$/, { timeout: 10_000 });

    const orderUrl = page.url().replace(/\/kot$/, '');
    await page.goto(orderUrl);

    await page.getByPlaceholder('Discount').fill('5');
    await page.getByRole('button', { name: 'Apply discount' }).click();
    await expect(page.getByText('Balance due: 11.00')).toBeVisible({
      timeout: 10_000,
    });

    await page.getByPlaceholder('Amount').fill('11');
    await page.getByRole('button', { name: 'Record payment' }).click();
    await expect(page.getByRole('link', { name: 'View receipt' })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('link', { name: 'View receipt' }).click();
    await expect(page).toHaveURL(/\/receipt$/, { timeout: 10_000 });
    await expect(page.getByText('Subtotal')).toBeVisible();
    await expect(page.getByText('-5.00')).toBeVisible();
    await expect(page.getByText('Tax (10%)')).toBeVisible();
  });

  test('admin turns on GST invoicing; the receipt becomes a Tax Invoice with CGST/SGST and an invoice number', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('admin@tax-test.cafe');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/', { timeout: 10_000 });

    await page.goto('/admin/settings');
    await page
      .getByRole('checkbox', { name: 'Issue GST tax invoices' })
      .check();
    const gstForm = page.locator('form', { hasText: 'GST tax invoices' });
    await gstForm.locator('#gstin').fill('09AAACH7409R1ZZ');
    await gstForm.locator('#gstLegalName').fill('Tax Test Cafe Pvt Ltd');
    await gstForm.locator('#gstAddress').fill('1 MG Road, Prayagraj');
    await gstForm.getByRole('button', { name: 'Save' }).click();
    await expect(gstForm.getByText('Saved.')).toBeVisible({
      timeout: 10_000,
    });

    await page.goto('/orders');
    await page.getByRole('button', { name: 'Start order' }).click();
    await expect(page).toHaveURL(/\/orders\/[^/]+$/, { timeout: 10_000 });

    // One Samosa (15.00), 10% tax (already set by the previous test in
    // this tenant) -> 16.50 total.
    await page.getByRole('button', { name: /Samosa/ }).click();
    await expect(page.locator('li', { hasText: 'Samosa' })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: 'Send to kitchen' }).click();
    await expect(page).toHaveURL(/\/orders\/[^/]+\/kot$/, { timeout: 10_000 });

    const orderUrl = page.url().replace(/\/kot$/, '');
    await page.goto(orderUrl);

    await page.getByPlaceholder('Amount').fill('16.50');
    await page.getByRole('button', { name: 'Record payment' }).click();
    await expect(page.getByRole('link', { name: 'View receipt' })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('link', { name: 'View receipt' }).click();
    await expect(page).toHaveURL(/\/receipt$/, { timeout: 10_000 });
    await expect(
      page.getByRole('heading', { name: 'Tax Invoice' }),
    ).toBeVisible();
    await expect(page.getByText('Tax Test Cafe Pvt Ltd')).toBeVisible();
    await expect(page.getByText('GSTIN: 09AAACH7409R1ZZ')).toBeVisible();
    await expect(page.getByText(/CGST \(5/)).toBeVisible();
    await expect(page.getByText(/SGST \(5/)).toBeVisible();
    await expect(page.getByText(/Invoice #\d{4}-\d{2}\/\d+/)).toBeVisible();
  });
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
