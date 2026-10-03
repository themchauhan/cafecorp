# Security Rules review (Phase 8)

Written review of `firestore.rules`, collection by collection, done as
part of Phase 8 hardening (CLAUDE.md hard rule #3: all writes go
through Server Actions using the Admin SDK; rules are read-only). Last
reviewed **2026-10-03** against the rules file as committed in this
phase.

## How to read this

For every collection: who can **read** it from the client SDK, who can
**write** it (should always be "nobody — Server Actions only"), the
reasoning, and which rules test file proves it. A collection is
"complete" only if a dedicated or shared test file covers: an
unauthenticated read, a same-tenant read (if readable), a cross-tenant
read denial (if tenant-scoped), and a write denial.

## Collection-by-collection

### `platformAdmins/{uid}`

- **Read:** only that exact SUPER_ADMIN, reading their own doc
  (`request.auth.uid == uid && isSuperAdmin()`).
- **Write:** `false` — unconditional, including for the owner.
- **Why:** the SUPER_ADMIN registry. No one else should even confirm
  a given uid is a platform admin (no "is X a super admin" oracle for
  a regular tenant user).
- **Tested in:** `tests/rules/tenancy.test.ts` (non-SUPER_ADMIN denied,
  the owning SUPER_ADMIN allowed).

### `platformAdmins/{uid}/private/mfa`

- **Read/Write:** `false` unconditionally, including for the owner.
- **Why:** TOTP secret. Only the Admin SDK (`src/lib/auth/mfa.ts`)
  ever touches this path — a client-readable TOTP secret would defeat
  the point of MFA.
- **Tested in:** `tests/rules/tenancy.test.ts` ("never allows reading
  a SUPER_ADMIN's MFA private doc, even for its own owner").

### `subscriptionPayments/{paymentId}`

- **Read/Write:** `false` unconditionally — not even SUPER_ADMIN can
  read it via the client SDK.
- **Why:** a top-level collection (not nested under `tenants/{id}`,
  since a payment is platform-billing data about a tenant, not data
  belonging to the tenant). SUPER_ADMIN tooling
  (`src/app/super-admin/actions.ts`) reads/writes it exclusively via
  the Admin SDK, which bypasses rules by design — there's no reason to
  ever expose it to a client session, including the SUPER_ADMIN's own
  browser tab.
- **Tested in:** `tests/rules/subscription-payments.test.ts` (added
  this phase — previously only covered implicitly by the deny-by-
  default catch-all; now has its own explicit test including a
  SUPER_ADMIN-denied case, since SUPER_ADMIN is the one role that can
  read almost everything else).

### `tenants/{tenantId}`

- **Read:** any member of that tenant (`tokenTenantId() == tenantId`),
  or SUPER_ADMIN (any tenant).
- **Write:** `false` — status/plan/expiry changes are SUPER_ADMIN-only
  Server Actions (`src/app/super-admin/actions.ts`).
- **Why:** staff/admin need to read their own tenant doc (e.g. the
  dashboard's "signed in as ... tenant ..." line); no one needs to
  read another tenant's doc except the platform operator.
- **Tested in:** `tests/rules/tenancy.test.ts` (unauthenticated denied,
  own-tenant read allowed, cross-tenant read denied, SUPER_ADMIN
  allowed any tenant, write denied even for the tenant's own ADMIN).

### `tenants/{tenantId}/profiles/{uid}`

- **Read:** any member of that tenant, or SUPER_ADMIN.
- **Write:** `false` — invites/status changes are ADMIN-only Server
  Actions (`src/app/admin/staff/actions.ts`,
  `src/app/super-admin/actions.ts`).
- **Why:** staff need to see the staff list / "who's this order's
  creator" type lookups within their own tenant; no cross-tenant
  visibility.
- **Tested in:** `tests/rules/tenancy.test.ts` (cross-tenant profile
  read denied).

### `tenants/{tenantId}/profiles/{uid}/private/mfa`

- **Read/Write:** `false` unconditionally, including for the owner —
  same reasoning as the SUPER_ADMIN MFA path above.
- **Tested in:** `tests/rules/tenancy.test.ts`.

### `tenants/{tenantId}/auditLogs/{logId}`

- **Read:** ADMIN (that tenant) or SUPER_ADMIN — not STAFF.
- **Write:** `false` — append-only via `src/lib/auth/audit.ts`'s
  `logAudit()`/`logPlatformAudit()`, both Admin SDK.
- **Why:** audit trail is an ADMIN/oversight tool; STAFF don't need
  (and shouldn't have) visibility into the full action log, including
  other staff's activity.
- **Tested in:** `tests/rules/tenancy.test.ts` (STAFF denied, ADMIN
  allowed).

### `tenants/{tenantId}/menuCategories/{id}` and `menuItems/{id}`

- **Read:** any tenant member (STAFF need these for order-taking).
- **Write:** `false` — ADMIN-only Server Actions
  (`src/app/admin/menu/actions.ts`).
- **Tested in:** `tests/rules/menu.test.ts`.

### `tenants/{tenantId}/orders/{orderId}`

- **Read:** any tenant member (STAFF need these for order-taking and
  the live kitchen board via `onSnapshot`).
- **Write:** `false` — ADMIN/STAFF Server Actions
  (`src/app/orders/actions.ts`, `billing-actions.ts`).
- **Why:** an order is operational data every staff member on shift
  needs to see; no reason to restrict to ADMIN. Still fully
  tenant-scoped — no cross-tenant read.
- **Tested in:** `tests/rules/orders.test.ts`.

### `tenants/{tenantId}/dailySummaries/{dateKey}`

- **Read:** ADMIN (that tenant) or SUPER_ADMIN — not STAFF.
- **Write:** `false` — written only by `addPayment()`
  (`src/app/orders/billing-actions.ts`), in the same transaction as
  the order write that produced the numbers.
- **Why:** revenue/reporting data, same visibility tier as audit logs.
- **Tested in:** `tests/rules/daily-summaries.test.ts`.

### `tenants/{tenantId}/cafeTables/{tableId}`

- **Read:** any tenant member (STAFF need these for order creation and
  the table-status board).
- **Write:** `false` — ADMIN-only Server Actions
  (`src/app/admin/tables/actions.ts`).
- **Tested in:** `tests/rules/cafe-tables.test.ts`.

### Everything else

- **Read/Write:** `false` via the catch-all `match /{document=**}`.
- **Why:** deny-by-default — any collection added later needs its own
  explicit rule before it's reachable from the client at all; forgetting
  to add one fails safe (no access) rather than unsafe (open access).
- **Tested in:** `tests/rules/deny-by-default.test.ts`, which uses a
  deliberately fake collection name (`notARealCollection`) so it never
  needs to move as real collections graduate to their own rule.

## Summary

Every collection the app's Server Actions actually write to
(confirmed by grepping every `adminDb.collection(...)`/`adminDb.doc(...)`
call site in `src/` and `scripts/`) has an explicit rule above — none
fall through to the deny-by-default catch-all unintentionally. No
collection allows a client-side write; every write path is a Server
Action using the Admin SDK, matching CLAUDE.md hard rule #3. The only
gap found and fixed in this review was `subscriptionPayments` lacking
its own dedicated test file (it was previously only implicitly
exercised, not explicitly proven) — added
`tests/rules/subscription-payments.test.ts`.

As of this review: 7 collection-scoped rules test files +
`deny-by-default.test.ts`, 35 rules tests total, all passing against
the Firebase emulator (`npm run test:rules`).

## The other layer: Server Actions

Firestore Security Rules only cover the client SDK's _direct_ reads
(and deny all direct writes). All actual mutations — and every read a
Server Component does for a page — go through a Server Action using
the Admin SDK, which bypasses Security Rules entirely by design
(CLAUDE.md hard rule #3). So rules alone don't prove cross-tenant
isolation for writes; the Server Actions themselves have to.

Audited every `actions.ts` file (grepped every `tenantId` usage) to
confirm the pattern holds everywhere: every ADMIN/STAFF-scoped action
derives `tenantId` from the verified session
(`requireTenantId(profile)` via `requireStaffOrAdmin()` /
`requireMenuAdmin()` / `requireTablesAdmin()`), never from client
input, and every Firestore path it touches is built as
`tenants/${tenantId}/...` with that server-derived id. A caller passing
a real document id that belongs to a _different_ tenant (e.g. another
tenant's `orderId`) simply gets "no such order in this tenant" — the
lookup happens under the caller's own tenant path, so a foreign-tenant
document is invisible there, not merely forbidden.

(`super-admin/actions.ts` is the one place `tenantId` _is_ a
client-supplied input — correctly so, since SUPER_ADMIN's whole job is
cross-tenant administration; the gate there is `requireRole(...,
['SUPER_ADMIN'])`, not a tenant match.)

This review found and fixed six gaps where a "doesn't exist in this
tenant" guard existed in the code but had no test proving it — i.e.
the cross-tenant isolation was implemented but unverified:

- `updateOrderItemQuantity`, `sendToKitchen` (`src/app/orders/actions.ts`)
- `cancelOrder` (`src/app/orders/billing-actions.ts`)
- `updateCategory` (had no tests at all before this review),
  `setMenuItemAvailability` (`src/app/admin/menu/actions.ts`)

Added the missing test for each (112 unit tests total now, up from
106). Every id-accepting Server Action in the app now has an explicit
test proving a foreign/nonexistent id is rejected.
