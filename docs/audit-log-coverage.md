# Audit log coverage (Phase 8)

Confirms every mutating Server Action writes an audit entry
(`logAudit()` for tenant-scoped actions, `logPlatformAudit()` for
SUPER_ADMIN actions affecting a tenant — both in
`src/lib/auth/audit.ts`), checked by grepping every `actions.ts` file
for `logAudit(`/`logPlatformAudit(` calls against every exported
function. Last reviewed **2026-10-03**.

## Orders (create/edit/cancel) — `src/app/orders/actions.ts`, `billing-actions.ts`

| Action                    | Audit action type     |
| ------------------------- | --------------------- |
| `createOrder`             | `ORDER_CREATED`       |
| `addOrderItem`            | `ORDER_ITEM_ADDED`    |
| `updateOrderItemQuantity` | `ORDER_ITEM_UPDATED`  |
| `sendToKitchen`           | `ORDER_KOT_SENT`      |
| `addPayment`              | `ORDER_PAYMENT_ADDED` |
| `cancelOrder`             | `ORDER_CANCELLED`     |

## Payments — covered above (`ORDER_PAYMENT_ADDED`) and below (`SUBSCRIPTION_PAYMENT_RECORDED`)

## Menu changes — `src/app/admin/menu/actions.ts`

| Action                    | Audit action type                                                |
| ------------------------- | ---------------------------------------------------------------- |
| `createCategory`          | `MENU_CATEGORY_CREATED`                                          |
| `updateCategory`          | `MENU_CATEGORY_UPDATED`                                          |
| `createMenuItem`          | `MENU_ITEM_CREATED`                                              |
| `updateMenuItem`          | `MENU_ITEM_UPDATED`                                              |
| `setMenuItemAvailability` | `MENU_ITEM_ENABLED` / `MENU_ITEM_DISABLED` (direction-dependent) |

## User changes — `src/app/admin/staff/actions.ts`, `src/app/admin/tables/actions.ts`, `src/app/admin/mfa/actions.ts`

| Action                 | Audit action type                                             |
| ---------------------- | ------------------------------------------------------------- |
| `inviteStaff`          | `STAFF_INVITED`                                               |
| `setStaffStatus`       | `STAFF_ACTIVATED` / `STAFF_DEACTIVATED` (direction-dependent) |
| `createTable`          | `TABLE_CREATED`                                               |
| `updateTable`          | `TABLE_UPDATED`                                               |
| `setTableActive`       | `TABLE_ACTIVATED` / `TABLE_DEACTIVATED` (direction-dependent) |
| `confirmMfaEnrollment` | `MFA_ENABLED` — **gap found and fixed this phase**            |
| `turnOffMfa`           | `MFA_DISABLED` — **gap found and fixed this phase**           |

`beginMfaEnrollment` intentionally has no audit entry — it only
generates and stores a not-yet-enabled secret, no security-relevant
state actually changes until `confirmMfaEnrollment` succeeds.

Tables are listed here (not under "menu changes") since they're an
operational/staffing concern (dine-in seating), not a user-account
change — grouped here only for this doc's organization; CLAUDE.md
doesn't classify them as either.

## Subscription changes — `src/app/super-admin/actions.ts`

| Action                      | Audit action type                                             |
| --------------------------- | ------------------------------------------------------------- |
| `createTenant`              | `TENANT_CREATED`                                              |
| `inviteTenantAdmin`         | `TENANT_ADMIN_INVITED`                                        |
| `setTenantStatus`           | `TENANT_ACTIVATED` / `TENANT_SUSPENDED` (direction-dependent) |
| `changeTenantPlan`          | `TENANT_PLAN_CHANGED`                                         |
| `setTenantExpiry`           | `TENANT_EXPIRY_CHANGED`                                       |
| `recordSubscriptionPayment` | `SUBSCRIPTION_PAYMENT_RECORDED`                               |

All six write into the _affected_ tenant's own `auditLogs` via
`logPlatformAudit()`, not the super admin's (who has no `auditLogs`
collection of their own) — so a tenant's ADMIN can see why their
account's state changed.

## Gap found and fixed this phase

`confirmMfaEnrollment` and `turnOffMfa` (`src/app/admin/mfa/actions.ts`)
had no audit entry at all before this review — turning two-factor
authentication on or off for an account is exactly the kind of
security-relevant "user change" this checklist exists to catch. Added
`MFA_ENABLED`/`MFA_DISABLED` audit entries and a new
`src/app/admin/mfa/actions.test.ts` (this file had no unit tests at
all before this phase).

Note: a SUPER_ADMIN enabling/disabling their own MFA still produces no
audit entry — `logAudit()` is a no-op for a profile with no `tenantId`
(SUPER_ADMIN accounts aren't tenant-scoped), and `platformAdmins/{uid}`
has no `auditLogs` subcollection in the schema. This is a pre-existing
architectural gap (there's no concept of a "platform-level audit log"
for a SUPER_ADMIN's own account actions, only for actions a SUPER_ADMIN
takes against a _tenant_). Low priority for the MVP pilot — there is
exactly one SUPER_ADMIN account in practice — but worth knowing before
scaling to multiple platform operators.

## Summary

Every one of the 24 state-changing Server Actions in the app (25
exported functions minus `beginMfaEnrollment`, which doesn't mutate
anything) writes an audit entry. No gaps remain in the
order/payment/menu/subscription categories; the one user-change gap
(MFA) found during this review is fixed.
