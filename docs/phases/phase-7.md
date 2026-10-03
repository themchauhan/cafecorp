# Phase 7 — Super admin dashboard and manual subscriptions

## Tasks

- [x] Super Admin dashboard: tenant counts/statuses, tenant list
      (`src/app/super-admin/page.tsx`)
- [x] Create/activate/suspend a tenant, change plan, change expiry,
      manually extend subscription (`src/app/super-admin/actions.ts`,
      `src/app/super-admin/[tenantId]/tenant-admin-panel.tsx`)
- [x] `subscriptionPayments` collection — record offline UPI/bank
      payments manually (no gateway integration); recording a payment
      also flips the tenant to `plan: "PAID"` and extends
      `subscriptionEndsAt` to the paid period's end
- [x] Confirm `requireActiveTenant()` is enforced on every protected
      route/action, not just the dashboard — audited every
      `actions.ts` file via grep against every `requireRole(` call;
      found `src/app/admin/mfa/actions.ts`'s three write actions
      (`beginMfaEnrollment`, `confirmMfaEnrollment`, `turnOffMfa`) were
      the only ones missing it, fixed as part of this phase. Also
      removed `getMfaStatus()` as dead code (no callers).
- [x] Expired/suspended tenants get a restricted/read-only state —
      data preserved, never deleted. `isTenantCurrentlyActive()`
      (`src/lib/tenant.ts`) now also treats an expired trial/
      subscription as inactive, not just an explicit `SUSPENDED`
      status, so `requireActiveTenant()` blocks writes once a trial
      lapses even if nobody manually suspends the tenant.
- [x] Audit log entries for every subscription state change — a new
      `logPlatformAudit()` (`src/lib/auth/audit.ts`) writes into the
      _affected_ tenant's own `auditLogs` (not the super admin's, who
      has none) for every action in `super-admin/actions.ts`.
- [x] Fills a gap in Phase 1c's own acceptance criteria: Phase 1c only
      covered an existing ADMIN inviting STAFF, never a brand-new
      tenant's first ADMIN. Added `inviteTenantAdmin()`, same
      password-reset-link pattern as `inviteStaff()` (no email
      provider configured for this MVP).

## Tests

- [x] Only SUPER_ADMIN can change subscription state — every Server
      Action in `super-admin/actions.test.ts` asserts a non-
      SUPER_ADMIN caller is rejected before any write; enforced by
      `requireRole(profile, ["SUPER_ADMIN"])` on every action.
- [x] Expiry enforced server-side even if the client is bypassed —
      `src/lib/tenant.test.ts` covers `isTenantCurrentlyActive()`
      directly (SUSPENDED regardless of dates, TRIAL checks
      `trialEndsAt` not `subscriptionEndsAt` and vice versa, exclusive
      expiry boundary); `session.test.ts` covers
      `requireActiveTenant()` throwing once a trial has expired even
      though `status` is still `"ACTIVE"`.
- [x] Expired/suspended tenant data is intact once reactivated — no
      Server Action in this phase ever deletes a tenant document or
      its subcollections; suspend/reactivate only flips `status`.

## Acceptance criteria

- Only SUPER_ADMIN can change subscription state; expiry is enforced
  server-side; no tenant data is deleted due to expiry

## Manual test steps (actually run, 2026-10-03)

Against the Firebase emulator with `scripts/seed.ts` applied:

1. Signed in as `super@cafecorp.app` / `password123`, saw "Tenants
   (platform)" on `/admin` and the tenant list at `/super-admin`.
2. Created a new tenant ("New Cafe", Trial) — redirected to its detail
   page, invited a first admin by email — got back a one-time
   password-setup link (`data-testid="admin-reset-link"`).
3. On `lockout-test-cafe`'s detail page, clicked "Suspend tenant".
   Logged in as its seeded staff (`staff@lockout-test.cafe`) in a
   separate browser context, went to `/orders`, clicked "Start order"
   — the order was correctly blocked server-side (`requireActiveTenant`
   threw, confirmed in server logs) in both `next dev` and a production
   `next build && next start`. Clicked "Reactivate tenant" as the super
   admin, retried as staff — order started successfully.
4. On `demo-cafe`'s detail page, recorded a subscription payment (₹999
   via UPI) with a period — it appeared in the payment history list
   and the tenant's plan flipped to `PAID`. Reverted the plan back to
   `TRIAL` afterward so other manual runs / e2e specs still see
   `demo-cafe` as a trial tenant.
5. Confirmed a STAFF/ADMIN account cannot reach `/super-admin` (gets
   the `Forbidden` component, not a redirect loop or crash).

## Finding carried forward to Phase 8: thrown Server Action errors are redacted in production

While writing `e2e/super-admin.spec.ts`'s suspend/reactivate test, the
first version asserted the visible text "This tenant is not active"
after a blocked write — it passed under `next dev` but failed under
the Playwright e2e suite, which runs a real production build
(`next build && next start`, matching `playwright.config.ts`).

Root cause (confirmed by comparing the `digest` on both sides): in a
**production** Next.js build, any error that is `throw`n from a Server
Action and crosses back into the Server Components render boundary
without being caught has its `message` stripped by React itself —
the client only receives a generic "An error occurred in the Server
Components render..." error (React error #441) plus a `digest` for
correlating with server logs. This is intentional upstream behavior
(avoids leaking internals), not a bug in this app, and it is **not**
specific to this one call site — it applies to every
`throw new Error(...)` / `throw new AuthError(...)` in every
`actions.ts` file across the whole app. `src/app/orders/actions.test.ts`
and similar Vitest suites call the Server Action function directly in
Node, bypassing Next's RSC/Action wire protocol entirely, so they never
catch this; no e2e test before this phase asserted literal error text
from a thrown Server Action error (checked via grep), which is why
this went unnoticed through Phases 1b–6.

**Practical effect**: every "expected" validation/authorization
failure in the app (wrong role, inactive table, tenant suspended, "no
such table", etc.) shows a real cafeteria's staff a useless generic
error in production instead of the intended message, even though the
underlying authorization/validation logic itself is correct and the
write is correctly blocked either way.

**Fix, implemented in Phase 8** (per Next.js's own documented
guidance): every Server Action now catches its own expected failures
internally and `return`s a plain serializable `ActionResult<T>`
(`src/lib/action-result.ts`'s `runAction()` wrapper) instead of
throwing — a thrown error is now reserved for truly unexpected bugs,
which stay hidden from users in production as intended. This touched
every `actions.ts` file (orders, billing, menu, tables, staff, mfa,
super-admin — 25 exported functions) and every client call site that
did `catch (err) { setError(err.message) }` (12 components), each now
checking `result.ok` instead. See `CLAUDE.md` hard rule #12 for the
pattern going forward.

`e2e/super-admin.spec.ts`'s suspend/reactivate test now asserts the
real error text again ("This tenant is not active"), since it's no
longer redacted.
