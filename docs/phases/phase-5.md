# Phase 5 — Tables (only if the pilot cafeteria does dine-in)

Confirm with Phase 0's finding before starting this phase. If the
pilot cafeteria is takeaway/parcel only, skip straight to Phase 6.

**Note (2026-10-03):** built ahead of a real Phase 0 finding, since
there is no pilot cafeteria yet and dine-in is a safe default for a
general-purpose cafeteria app. Re-confirm with the actual pilot before
a real launch — if they're takeaway/parcel only, this feature is
simply unused, not harmful.

## Tasks

- [x] `cafeTables` subcollection + Security Rules: label, active
      (read: any tenant member; write: false, ADMIN-only Server
      Actions)
- [x] Admin can add/edit/deactivate tables (`/admin/tables`)
- [x] Order creation (Phase 3) requires a table when order_type is
      DINE_IN — `createOrder` rejects a missing, nonexistent, or
      deactivated `tableId`, always re-checked against the caller's
      own tenant server-side
- [x] Simple table-status view at `/tables`: which tables have an
      open order, live via `onSnapshot` (same no-`orderBy`,
      client-sort approach as the Phase 3 kitchen board)

## Tests

- [x] Cross-tenant: Tenant A cannot see or assign Tenant B's tables
      (`tests/rules/cafe-tables.test.ts`)
- [x] A nonexistent or deactivated `tableId` is rejected when creating
      a DINE_IN order, even if submitted directly
      (`src/app/orders/actions.test.ts`)
- [x] A DINE_IN order with no `tableId` at all is rejected
      (`src/app/orders/actions.test.ts`)

## Bug found and fixed during this phase

Adding `tableId` to `createOrder`'s audit-log metadata broke order
creation for **every** non-DINE_IN order: `tableId` was `undefined`
for TAKEAWAY/PARCEL, and the Admin SDK rejects `undefined` anywhere in
a document write outright. Fixed at the root in `logAudit()`
(`src/lib/auth/audit.ts`) rather than patching each call site — it now
strips `undefined` values from metadata before writing, so no current
or future caller can hit this again. Covered by a new
`src/lib/auth/audit.test.ts`. Caught by `e2e/billing.spec.ts` and
`e2e/orders.spec.ts` failing during this phase's own verification
pass, not by a user report.

## Manual test steps (actually run, 2026-10-03)

Via the same Docker-based emulator workaround as prior phases (see
README):

1. `npm run test:rules` → 31/31 Security Rules tests pass (27 from
   prior phases + 4 new `cafeTables` tests).
2. `npm run test:e2e:ci` → 16/16 Playwright tests pass, including the
   2 new to this phase: a dine-in order occupying its table on the
   status board until billed, and a deactivated table being excluded
   from the dine-in table picker.
3. `npm run lint`, `npm run typecheck`, `npm test` (70 unit tests),
   `npm run build` all pass on the host.

## Acceptance criteria

- Dine-in orders are correctly tied to a table, and staff can see at
  a glance which tables are occupied
