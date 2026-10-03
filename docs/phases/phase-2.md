# Phase 2 — Menu setup

## Tasks

- [x] `menuCategories` and `menuItems` subcollections + Security Rules
      (read-only, any tenant member — STAFF need these in Phase 3;
      writes always `false`, go through `src/app/admin/menu/actions.ts`)
- [x] Create/edit categories with sort order (`/admin/menu`, ADMIN only)
- [x] Create/edit menu items: name, category, price, vegFlag,
      available toggle, description
- [x] Menu list view, filterable by category and availability
      (`/admin/menu`'s item table — client-side filters)

## Tests

- [x] Happy path: create a category, add an item, toggle availability
      (`e2e/menu.spec.ts`; `actions.test.ts` covers the same at the
      unit level, including the default-available-on-create behavior)
- [x] Cross-tenant: Tenant A cannot see or edit Tenant B's menu
      (`tests/rules/menu.test.ts` — read denial; writes are denied for
      every client regardless of tenant, enforced at the Server Action
      layer by always deriving `tenantId` from the session, never a
      client-supplied category/item id)
- [x] A `categoryId` that doesn't belong to the caller's tenant is
      rejected when creating or editing a menu item
      (`actions.test.ts`)

## Acceptance criteria

- Owner/admin can manage a full menu with categories, prices, and
  availability, ready to be picked into an order in Phase 3

## Manual test steps (actually run, 2026-10-03)

Via the same Docker-based emulator workaround as prior phases (see
README):

1. `npm run test:rules` → 18/18 Security Rules tests pass (14 from
   prior phases + 4 new menu tests).
2. `npm run test:e2e:ci` → 10/10 Playwright tests pass, including the
   2 new to this phase: an admin adding a category + item and toggling
   its availability, and staff getting a 403 on `/admin/menu`.
3. `npm run lint`, `npm run typecheck`, `npm test` (36 unit tests),
   `npm run build` all pass on the host.
