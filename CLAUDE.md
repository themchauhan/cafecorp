# Cafeteria POS SaaS — Claude Code project rules

Read at the start of every session. Follow it over any conflicting
instinct.

## What this project is

A multi-tenant web app sold to small cafeterias/cafes. Staff take
orders, send a kitchen ticket (KOT), and settle bills — replacing a
paper order pad and register.

Phases 1a–8 (the original MVP, see `docs/BRIEF.md`) deliberately
excluded online ordering, inventory, and staff attendance to ship
something real first. Phase 9 onward expands toward the full feature
set now being marketed (billing taxes/discounts, kitchen timers,
peak-hour reports, staff shifts/attendance, ingredient stock +
recipes, and QR at-table customer self-ordering) — see
`docs/phases/phase-9.md` onward as each lands. Two boundaries still
hold even as scope grows: **no delivery integration or third-party
ordering platforms** (QR ordering is strictly in-house, scoped to a
table at the tenant's own premises, not remote/delivery), and **no
online payment gateway** (rule 8) — "inventory" here means simple
stock-count tracking + recipes, not full costing/COGS/vendor
accounting.

Full MVP spec: `docs/BRIEF.md` (describes Phases 1a–8; not yet
updated for Phase 9+). Phase checklists: `docs/phases/phase-N.md` —
read only the current phase's file plus `phase-0.md`.

## Hard rules

1. **One phase at a time.** Don't start a later phase's work early.
2. **Tenant identity is server-derived, never client-supplied.** It
   lives only in a Firebase Auth custom claim (`tenantId`, `role`)
   written by the Admin SDK from a Next.js Server Action/Route
   Handler — never a Cloud Function, never read from a request body
   or Firestore document field the client could write.
3. **All Firestore writes to tenant-owned collections go through a
   Server Action using the Admin SDK — never a direct client write.**
   Security Rules for those collections are read-only
   (`allow write: if false`), scoped by the `tenantId`/`role` custom
   claims; mutations get their authorization and validation from the
   Server Action (`getSessionProfile()` + `requireRole()`), not from
   rules. See `src/lib/auth/session.ts`.
4. **No Cloud Functions.** Everything server-side runs in Next.js
   Server Actions/Route Handlers on Vercel, using the Admin SDK. This
   keeps the project on Firebase's free Spark plan — Cloud Functions
   with Firestore triggers require the Blaze plan.
5. **The Firebase Admin SDK service-account credentials never run in
   browser-reachable code.** Only the public client config (apiKey,
   authDomain, projectId, etc. — not secret) ships to the browser.
6. **Dummy data only in seeds/fixtures.**
7. **No hard deletes** on orders or payment records — soft-delete or
   a CANCELLED status only. No Server Action ever issues a Firestore
   `delete` on an order or payment.
8. **No online payment integration.** Payments are recorded manually
   (amount + mode + received-by), split payments allowed.
9. **Menu item prices are snapshotted per order line** at order time;
   a later price change never rewrites a past order's total.
10. **Admin/super-admin MFA is a custom TOTP implementation**
    (`otplib`), not Firebase's native MFA — native MFA requires
    upgrading to Identity Platform, a separate product/quota. The
    secret lives at a Firestore path Security Rules always deny
    client access to (`profiles/{uid}/private/mfa`) and is only ever
    read/written by the Admin SDK.
11. **Every feature ships with tests for the happy path and the
    cross-tenant failure path** before it's marked done.
12. **A Server Action never throws for an expected failure** (wrong
    role, inactive tenant, bad input, "no such X", ...) — it catches
    internally and returns `ActionResult<T>` from
    `src/lib/action-result.ts` (`runAction(async () => {...})` wraps
    the body). A thrown error loses its message once it crosses back
    into the render boundary in a production build (React strips it to
    a generic "Server Components render" error — see
    `docs/phases/phase-7.md`'s "Finding carried forward to Phase 8" and
    the `nextjs-server-action-error-redaction` memory for the full
    story), so only unexpected bugs should ever throw. Every client
    call site checks `result.ok` instead of using `try/catch`.

## Definition of done (every phase)

- [ ] `npm run build` and `npm run lint` succeed
- [ ] Security rules deploy cleanly to the Firebase emulator from a
      clean checkout
- [ ] Seed data loads and the feature is usable end to end
- [ ] Tests exist for: happy path, invalid input, cross-tenant access
      attempt
- [ ] Manual test steps written in the phase file and actually run
- [ ] Changed files, new env vars, and schema/rules changes
      summarized at the end of the session
- [ ] No secrets appear in any client-bundle-reachable file

## Tech stack

Next.js (App Router) + React + TypeScript (strict) + Tailwind CSS.
Firebase: Auth (custom claims for tenant/role), Firestore (client SDK
for live reads under read-only Security Rules; Admin SDK for every
write, from Server Actions/Route Handlers), Storage for
receipts/images if needed. Server Actions update per-tenant
`dailySummaries` aggregate docs in the same transaction as the order
write that caused them (Phase 6 reports), so reports never aggregate
raw order documents client-side. Deploy on Vercel (Mumbai/`bom1` where
available); Firebase resources in the closest available region
(`asia-south1` where supported). Vitest + Playwright +
`@firebase/rules-unit-testing` against the Firebase emulator suite for
Security Rules tests. KOT and receipts print via the browser print
dialog — no dedicated kitchen-display hardware assumed for the MVP.

## Working style

- Plan mode first for anything touching auth, security rules, or the
  data model.
- One phase = one branch.
- Confirm with the pilot cafeteria whether they use dine-in tables
  before building the tables feature (Phase 5) — don't assume.
