# Phase 4 — Billing, payments, and receipt

## Tasks

- [x] `payments[]` embedded on the order document: amount, mode
      (CASH/UPI/CARD/OTHER), receivedBy, receivedAt
- [x] Bill view: item list with prices, total, amount paid so far,
      balance (`/orders/[id]`'s `BillPanel`)
- [x] Split-payment support: multiple payment entries against one
      order, appended atomically to the order document (one Firestore
      transaction per `addPayment` call)
- [x] Order status transitions to `BILLED` only once fully paid
- [x] Simple printable/on-screen customer receipt at
      `/orders/[id]/receipt` (not a GST invoice)
- [x] Cancel-order flow: status `CANCELLED`, excluded from sales
      reports, reason captured. Blocked once an order is already
      `BILLED` or `CANCELLED`.
- [x] The billing Server Action (`addPayment`) updates the tenant's
      `dailySummaries/{date}` doc in the same Firestore transaction as
      the order write, the moment an order becomes fully paid — no
      Cloud Function, no client-side aggregation. `cancelOrder` does
      **not** touch `dailySummaries`: a cancelled order was never
      billed, so it never contributed to a total in the first place —
      there's nothing to subtract.

## Tests

- [x] Split payments across two modes sum correctly and close the
      order only when fully paid (`billing-actions.test.ts`;
      `e2e/billing.spec.ts` covers the same end-to-end through to the
      receipt)
- [x] A cancelled order is excluded from `dailySummaries` by
      construction (cancellation never writes to it)
      (`billing-actions.test.ts`)
- [x] Cross-tenant: `dailySummaries` is ADMIN/SUPER_ADMIN-only and
      scoped per tenant, like `auditLogs`
      (`tests/rules/daily-summaries.test.ts`)
- [x] A payment is rejected once an order is already `BILLED`; a
      cancel is rejected once an order is already `BILLED` or
      `CANCELLED` (`billing-actions.test.ts`)

## Manual test steps (actually run, 2026-10-03)

Via the same Docker-based emulator workaround as prior phases (see
README):

1. `npm run test:rules` → 27/27 Security Rules tests pass (22 from
   prior phases + 5 new `dailySummaries` tests).
2. `npm run test:e2e:ci` → 14/14 Playwright tests pass, including the
   2 new to this phase: a split CASH+UPI payment settling a bill and
   showing both payments on the receipt, and cancelling an order with
   a reason.
3. `npm run lint`, `npm run typecheck`, `npm test` (58 unit tests),
   `npm run build` all pass on the host.

## Acceptance criteria

- Staff can settle a bill with one or more payments, print a receipt,
  and cancel an order cleanly when needed
