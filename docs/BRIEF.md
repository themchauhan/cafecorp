# Cafeteria POS SaaS — Product Brief

## Product goal

A small cafeteria/cafe currently takes orders and bills on paper or a
basic register. Replace that with a simple order-taking and billing
flow — pick items, send the order to the kitchen, collect payment,
see daily sales — without building a full restaurant POS with online
ordering, delivery, or inventory costing.

This is a multi-tenant SaaS: one deployment serves many independent
cafeteria businesses, each seeing only their own data.

## Roles

- **SUPER_ADMIN** — you, the SaaS owner. Create/manage tenant
  businesses, plans, trial/expiry, review payments.
- **ADMIN** (owner/manager) — manage menu, categories, prices, tables,
  view all orders and sales reports, invite staff.
- **STAFF** (cashier/counter staff) — take orders, send to kitchen,
  settle bills, record payments.

## Core workflow

1. Staff opens a new order: choose order type (dine-in, takeaway,
   parcel) and a table if dine-in.
2. Staff adds menu items and quantities; price is snapshotted per
   item at order time.
3. Staff sends the order to the kitchen as a **KOT (kitchen order
   ticket)** — a printed or on-screen ticket showing item, quantity,
   table, and time, with no prices.
4. When the customer is ready to pay, staff settles the bill: enters
   payment(s) received manually (amount + mode + received_by — no
   payment gateway). Splitting a bill across two payment modes is
   supported.
5. Order closes; a simple printable/on-screen receipt is available.

## Data model

Firestore. Tenant-owned data lives in subcollections under
`tenants/{tenantId}/...` so the tenant boundary is a path segment, not
just a field — Security Rules check
`request.auth.token.tenantId == tenantId` once per collection rather
than per document field.

| Collection                                      | Key fields                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenants/{tenantId}`                            | name, phone, email, status, plan, trialEndsAt, subscriptionEndsAt                                                                                                                                                                                                                                                     |
| `tenants/{tenantId}/profiles/{uid}`             | name, role (`ADMIN`\|`STAFF`), status (doc id = Firebase Auth uid)                                                                                                                                                                                                                                                    |
| `tenants/{tenantId}/profiles/{uid}/private/mfa` | TOTP secret for that user — Security Rules always deny client read/write; Admin SDK only                                                                                                                                                                                                                              |
| `platformAdmins/{uid}`                          | name — SUPER_ADMIN accounts; a separate top-level collection, not a nullable tenant on `profiles`                                                                                                                                                                                                                     |
| `tenants/{tenantId}/menuCategories/{id}`        | name, sortOrder                                                                                                                                                                                                                                                                                                       |
| `tenants/{tenantId}/menuItems/{id}`             | categoryId, name, price, vegFlag, available, description                                                                                                                                                                                                                                                              |
| `tenants/{tenantId}/cafeTables/{id}`            | label, active (only if dine-in is used)                                                                                                                                                                                                                                                                               |
| `tenants/{tenantId}/orders/{id}`                | orderType (`DINE_IN`\|`TAKEAWAY`\|`PARCEL`), tableId (nullable), status (`OPEN`\|`KOT_SENT`\|`SERVED`\|`BILLED`\|`CANCELLED`), createdBy, createdAt, cancelReason, `items[]` (menuItemId, name, quantity, priceSnapshot, notes), `payments[]` (amount, mode (`CASH`\|`UPI`\|`CARD`\|`OTHER`), receivedBy, receivedAt) |
| `tenants/{tenantId}/auditLogs/{id}`             | userId, action, targetType, targetId, metadata, createdAt                                                                                                                                                                                                                                                             |
| `tenants/{tenantId}/dailySummaries/{date}`      | maintained by the billing/cancel Server Action, in the same Firestore transaction as the order write — totalsByMode, totalsByStaff, itemsSold, categorySales. Powers Phase 6 reports without aggregating raw orders client-side                                                                                       |
| `subscriptionPayments/{id}`                     | tenantId, amount, paymentDate, paymentMethod, referenceNumber, periodStart, periodEnd, notes — top-level, SUPER_ADMIN only                                                                                                                                                                                            |

Order line items and payments are embedded arrays on the order
document, not separate collections — an order is small and bounded,
so one atomic document write replaces what would otherwise be a
multi-table transaction.

Every tenant-scoped read/write is authorized by the `tenantId` and
`role` **custom claims** on the caller's Firebase Auth ID token, set
only via the Admin SDK (never a client-writable field, never trusted
from a request body). Security Rules enforce this on every
collection; server code (Server Actions, Route Handlers, Cloud
Functions) re-verifies the decoded ID token before acting.

## KOT and receipts

- Start with a print-friendly KOT layout (item, qty, table/order type,
  time) sent to a receipt printer via the browser print dialog — no
  full kitchen-display screen in the MVP.
- Same approach for the customer receipt: a simple printable page,
  not a fiscal/GST invoice.
- If the pilot cafeteria has no printer, an on-screen "current KOTs"
  list on a tablet at the kitchen counter is an acceptable
  alternative — confirm which they actually have before building.

## Reports

- Daily collection by payment mode and by staff member
- Top-selling items and sales by category, for a selected date range
- No accounting/GST/ledger reporting in the MVP

## Build phases

See `docs/phases/phase-N.md` for detailed tasks and acceptance
criteria.

- **Phase 0** — Validation with a real cafeteria (not code)
- **Phase 1a** — Scaffold, tooling, CI
- **Phase 1b** — Auth, roles, Security Rules, tenant guard, audit
  foundation
- **Phase 1c** — Super admin provisioning, staff invites, admin MFA
- **Phase 2** — Menu setup
- **Phase 3** — Order creation + KOT
- **Phase 4** — Billing/payments + receipt
- **Phase 5** — Tables (only if the pilot cafeteria does dine-in)
- **Phase 6** — Reports
- **Phase 7** — Super admin dashboard, manual subscriptions
- **Phase 8** — Security hardening and pilot readiness

## Out of scope for MVP

Online ordering/delivery-aggregator integration, raw-material
inventory and recipe costing, loyalty programs and discount engines,
GST invoicing, multi-outlet management.
