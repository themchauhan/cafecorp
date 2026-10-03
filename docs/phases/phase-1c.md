# Phase 1c — Super admin provisioning, staff invites, MFA

## Tasks

- [x] Secure one-time way to provision the first SUPER_ADMIN
      (`scripts/provision-super-admin.ts`, Admin SDK, run manually —
      never a public signup route; writes the `platformAdmins` doc and
      sets the `role: SUPER_ADMIN` custom claim; creates the Firebase
      Auth user with a random temporary password if it doesn't exist,
      printed once for an immediate password reset)
- [x] ADMIN can invite STAFF **or ADMIN** via `inviteStaff`
      (`src/app/admin/staff/actions.ts`), which sets the invited
      user's `tenantId` custom claim from the inviting admin's own
      session, server-side only (no Cloud Function)
- [x] Staff account activate/deactivate (soft, not delete) —
      `setStaffStatus`, with a guard against an admin deactivating
      their own account
- [x] TOTP-based MFA for SUPER_ADMIN and ADMIN — a custom `otplib`
      implementation (`src/lib/auth/mfa.ts`), secret stored at
      `.../profiles/{uid}/private/mfa` (or `platformAdmins/{uid}/private/mfa`
      for SUPER_ADMIN), a path Security Rules always deny client
      access to. `/admin/mfa` to enroll/turn off; `POST /api/session`
      requires a valid code on every login once enrolled.

**Scope notes / deviations from the original checklist:**

- "Invite via **email**" has no email provider configured anywhere in
  this project (none is in `BRIEF.md`'s stack either). `inviteStaff`
  creates the account and returns a Firebase password-reset link that
  the admin copies and shares directly (chat/SMS/in person) — adding
  real email delivery is a separate, explicit decision for later, not
  silently assumed.
- MFA is available and enforced **once an ADMIN/SUPER_ADMIN enrolls**;
  nothing yet forces every admin to enroll before using the app. The
  phase-8 checklist ("MFA confirmed working for all admin accounts
  before pilot") is the actual rollout gate for that.

## Tests

- [x] An invited staff account gets the inviting admin's `tenantId`,
      never a client-supplied one (`actions.test.ts`, asserts the
      claim call's payload directly)
- [x] A deactivated account cannot log in (`e2e/staff-and-mfa.spec.ts`)
- [x] MFA enforced on next login once enrolled, for ADMIN
      (`e2e/staff-and-mfa.spec.ts`; same code path covers SUPER_ADMIN)
- [x] Security Rules: a SUPER_ADMIN's MFA private doc is never
      client-readable, same as the tenant-scoped one
      (`tests/rules/tenancy.test.ts`)

## Manual test steps (actually run, 2026-10-03)

Via the same Docker-based emulator workaround as Phase 1b (see
README):

1. `npm run test:rules` → 14/14 Security Rules tests pass.
2. `npm run test:e2e:ci` → 8/8 Playwright tests pass, including the 3
   new to this phase: invite returns a working setup link, deactivate
   blocks login and reactivate restores it, and MFA enroll → logout →
   TOTP-required login → turn off all work end to end.
3. `npm run lint`, `npm run typecheck`, `npm test` (30 unit tests),
   `npm run build` all pass on the host.

## Acceptance criteria

- An ADMIN can invite an ADMIN or STAFF member, who can then log in
  (after setting a password via the returned link); a deactivated
  account cannot log in; an ADMIN/SUPER_ADMIN can turn on TOTP MFA and
  it's then required on every login. Provisioning the very first
  SUPER_ADMIN, and a SUPER_ADMIN creating a new tenant from the UI,
  are exercised by `scripts/provision-super-admin.ts` and
  `scripts/seed.ts` respectively for now — the SUPER_ADMIN **dashboard**
  for creating tenants through the UI is Phase 7's job, not this one.
