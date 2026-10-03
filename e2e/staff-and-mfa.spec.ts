import { expect, test, type Page } from '@playwright/test';
import { generate } from 'otplib';

// Requires the Firebase emulator running with scripts/seed.ts applied
// (`npm run test:e2e:ci`, or `npm run emulators` + `npm run seed`).

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function loginWithTotp(
  page: Page,
  email: string,
  password: string,
  secret: string,
) {
  await login(page, email, password);
  await expect(
    page.getByRole('heading', { name: 'Authenticator code' }),
  ).toBeVisible({ timeout: 10_000 });
  const code = await generate({ secret });
  await page.getByPlaceholder('6-digit code').fill(code);
  await page.getByRole('button', { name: 'Verify' }).click();
}

test('admin can invite a new staff member and gets a one-time setup link', async ({
  page,
}) => {
  await login(page, 'admin@demo.cafe', 'password123');
  await expect(page).toHaveURL('/', { timeout: 10_000 });
  await page.goto('/admin/staff');

  const email = `invitee-${Date.now()}@demo.cafe`;
  await page.getByPlaceholder('Name').fill('Invited Person');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByRole('button', { name: 'Invite' }).click();

  await expect(page.getByText(/one-time password-setup link/i)).toBeVisible({
    timeout: 10_000,
  });
  // The invited email now appears twice (the confirmation box and,
  // thanks to revalidatePath, a new row in the staff table below) —
  // scope to the confirmation box specifically via its test id.
  await expect(page.getByTestId('invited-email')).toHaveText(email, {
    timeout: 10_000,
  });
});

test("admin can deactivate and reactivate a staff member; deactivated accounts can't log in or keep using an existing session", async ({
  page,
}) => {
  // Log the target staff member in FIRST, before deactivation, so
  // there's a live session cookie to prove gets revoked — not just
  // that a fresh login attempt is rejected (Phase 8: deactivation must
  // kick out an already-logged-in session, not merely block new
  // logins; see docs/session-settings-review.md).
  const staffContext = await page.context().browser()!.newContext();
  const staffPage = await staffContext.newPage();
  await login(staffPage, 'target-staff@demo.cafe', 'password123');
  await expect(staffPage).toHaveURL('/', { timeout: 10_000 });

  // Firebase's revocation check compares the session cookie's `iat`
  // against the account's `tokensValidAfterTime`, both integer-second
  // JWT timestamps — if login and revocation land in the same
  // wall-clock second (easily possible for Playwright's near-instant
  // actions, never for a real human), the comparison can't tell them
  // apart and revocation silently isn't detected. A real admin could
  // never click "Deactivate" within the same second as the target's
  // login, so this wait reflects realistic timing, not a workaround
  // for a bug — confirmed empirically against the real emulator
  // (delays under ~1.1s intermittently failed to register revocation;
  // everything at or above that threshold worked every time).
  await staffPage.waitForTimeout(1500);

  await login(page, 'admin@demo.cafe', 'password123');
  await expect(page).toHaveURL('/', { timeout: 10_000 });
  await page.goto('/admin/staff');

  const row = page.locator('tr', { hasText: 'target-staff@demo.cafe' });
  await row.getByRole('button', { name: 'Deactivate' }).click();
  await expect(row.getByRole('button', { name: 'Activate' })).toBeVisible({
    timeout: 10_000,
  });

  // The already-logged-in session is kicked out on its next request
  // (adminAuth.revokeRefreshTokens in setStaffStatus), not just
  // eventually once its cookie expires. staffPage is already sitting
  // on '/' from the login above — confirmed empirically that
  // re-navigating goto()'ing the exact URL a page is already on isn't
  // guaranteed to produce a fresh request (the page can end up just
  // showing its already-rendered content instead of hitting the
  // server again), so hop through a different page first to force a
  // genuine round-trip.
  await staffPage.goto('/orders');
  await staffPage.goto('/');
  await expect(staffPage).toHaveURL(/\/login$/, { timeout: 10_000 });

  // A deactivated account is also rejected server-side on a fresh
  // login attempt, even with the right password (CLAUDE.md / phase-1c:
  // "a deactivated account cannot log in").
  await login(staffPage, 'target-staff@demo.cafe', 'password123');
  await expect(staffPage.getByText(/deactivated/i)).toBeVisible({
    timeout: 10_000,
  });
  await staffContext.close();

  await row.getByRole('button', { name: 'Activate' }).click();
  await expect(row.getByRole('button', { name: 'Deactivate' })).toBeVisible({
    timeout: 10_000,
  });
});

test('admin can enroll TOTP MFA and must then use it to log in', async ({
  page,
}) => {
  await login(page, 'mfa-admin@demo.cafe', 'password123');
  await expect(page).toHaveURL('/', { timeout: 10_000 });
  await page.goto('/admin/mfa');

  await page
    .getByRole('button', { name: 'Set up two-factor authentication' })
    .click();
  const secretText = await page
    .locator('code')
    .textContent({ timeout: 10_000 });
  const secret = secretText?.trim();
  expect(secret).toBeTruthy();

  const code = await generate({ secret: secret! });
  await page.getByPlaceholder('6-digit code').fill(code);
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText(/is on/i)).toBeVisible({ timeout: 10_000 });

  // Log out and back in — this time MFA should be required.
  await page.goto('/');
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });

  await loginWithTotp(page, 'mfa-admin@demo.cafe', 'password123', secret!);
  await expect(page).toHaveURL('/', { timeout: 10_000 });

  // Clean up so this account doesn't require MFA in a later run.
  await page.goto('/admin/mfa');
  await page.getByRole('button', { name: 'Turn off' }).click();
  await expect(
    page.getByRole('button', { name: 'Set up two-factor authentication' }),
  ).toBeVisible({ timeout: 10_000 });
});
