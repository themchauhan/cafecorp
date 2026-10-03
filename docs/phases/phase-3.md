# Phase 3 — Order creation and KOT

## Tasks

- [x] `orders` documents with an embedded `items[]` array: choose
      orderType, add items with quantities (`/orders`, `/orders/[id]`)
- [x] Price snapshotting: `priceSnapshot` copied from `menuItems` at
      order time, never re-read live — confirmed immutable even if the
      menu price changes after the line was added (`actions.test.ts`)
- [x] "Send to Kitchen" action: marks order `KOT_SENT`, generates a
      print-friendly KOT (item, qty, table/order type, time — no
      prices) at `/orders/[id]/kot`
- [x] Print via browser print dialog (`window.print()`; the nav chrome
      is `print:hidden` so only the ticket prints). On-screen "current
      KOTs" fallback at `/kitchen`, live via `onSnapshot`.
- [x] Only unavailable-flagged items are hidden from the order screen
      (the order-taking item picker queries `available == true`;
      already-added lines stay visible regardless)

**Scope notes / deviations from the original checklist:**

- **Table selection is deliberately absent.** `cafeTables` doesn't
  exist until Phase 5; `tableId` is always `null` for now, exactly as
  phase-5.md already anticipates ("Order creation (Phase 3) requires a
  table when order_type is DINE_IN" is listed as a **Phase 5** task,
  not this one). DINE_IN is selectable as an order type today, just
  without a table attached yet.
- **Per-line notes aren't exposed in the UI** yet, though the data
  model (`OrderLineItem.notes`) and the KOT rendering already support
  them — adding the input is a small follow-up, not a redesign.
- **Items can only be added/edited while an order is `OPEN`.** Once
  "Send to Kitchen" is pressed there's no "send a second KOT for more
  items" flow in this MVP — that's a real simplification worth
  revisiting with the pilot cafeteria, not an oversight.
- The kitchen board's live query filters by `status == 'KOT_SENT'`
  only (no `orderBy`), sorting client-side instead, so it never needs
  a composite Firestore index deployed.
- Logout now also calls the Firebase client SDK's `signOut()`, not
  just clearing the server session cookie — needed once client-side
  `onSnapshot` reads exist, so a "logged out" tab can't keep reading
  live tenant data on a stale client session.

## Tests

- [x] Happy path: create an order, add items, send KOT, item prices
      remain correct even if the menu price later changes
      (`actions.test.ts`; `e2e/orders.spec.ts` covers the same
      end-to-end and asserts no price ever renders on the KOT)
- [x] Cross-tenant: a user from Tenant B cannot read Tenant A's orders
      (`tests/rules/orders.test.ts`); `addOrderItem`/`updateOrderItemQuantity`
      reject an `orderId`/`menuItemId` that doesn't resolve under the
      caller's own tenant path (`actions.test.ts`)
- [x] An unavailable menu item is rejected server-side even if its id
      is submitted directly (`actions.test.ts`)
- [x] Adding the same menu item twice merges into one line (summed
      quantity) instead of duplicating it (`actions.test.ts`)

## Manual test steps (actually run, 2026-10-03)

Via the same Docker-based emulator workaround as prior phases (see
README):

1. `npm run test:rules` → 22/22 Security Rules tests pass (18 from
   prior phases + 4 new order tests).
2. `npm run test:e2e:ci` → 12/12 Playwright tests pass, including the
   2 new to this phase: staff building an order end-to-end to a
   price-free KOT, and the live kitchen board picking up a sent order.
3. `npm run lint`, `npm run typecheck`, `npm test` (50 unit tests),
   `npm run build` all pass on the host.

## Acceptance criteria

- Staff can create an order and generate a correct KOT with no prices
  shown to the kitchen
