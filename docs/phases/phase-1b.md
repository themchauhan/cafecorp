# Phase 1b — Auth, roles, Security Rules, tenant guard, audit foundation

Highest-risk phase. Use plan mode before writing Security Rules or
touching custom claims.

## Tasks

- [x] Firestore collections: `tenants/{tenantId}`,
      `tenants/{tenantId}/profiles/{uid}`, `platformAdmins/{uid}`,
      `tenants/{tenantId}/auditLogs`
- [x] Firebase Auth wired up: login (`/login` + `POST /api/session`),
      logout (`DELETE /api/session`). Password reset deferred — no UI
      needs it yet; Firebase's `sendPasswordResetEmail` covers it
      whenever a reset-password page is added.
- [x] `profiles.role` values: ADMIN, STAFF (SUPER_ADMIN lives in
      `platformAdmins`, not a tenant's `profiles`)
- [x] `tenantId`/`role` **custom claims** are written only via the
      Admin SDK — in this phase, by `scripts/seed.ts` for the dummy
      accounts; `inviteStaff` (Phase 1c) is the first real Server
      Action to set them for a new user. Client code never sets them;
      no Cloud Functions (CLAUDE.md hard rule #4).
- [x] `getSessionProfile()` (`src/lib/auth/session.ts`) — the ONLY
      place `tenantId`/`role` are read from (decoded session-cookie
      claims)
- [x] `requireRole(...)` and `requireActiveTenant()` guards, used on
      `/admin` as the first protected route
- [x] Firestore Security Rules on `tenants`, `profiles`
      (+ `profiles/{uid}/private/*`, always denied), `auditLogs`:
      read-only, keyed off the `tenantId`/`role` custom claims;
      `allow write: if false` everywhere
- [x] `platformAdmins` collection + custom claim check for
      SUPER_ADMIN — not a nullable `tenantId` trick
- [x] Audit log helper: `logAudit(profile, action, targetType, targetId, meta)`
      (`src/lib/auth/audit.ts`) — not yet called anywhere, since
      Phase 1b has no mutations of its own; the first caller is
      Phase 1c's `inviteStaff`
- [x] Seed script (`scripts/seed.ts`) — one dummy tenant, one
      SUPER_ADMIN/ADMIN/STAFF login each
- [x] `tenants.status`, `plan`, `trialEndsAt`,
      `subscriptionEndsAt` fields exist even though enforcement UI
      comes in Phase 7

## Tests

- [x] Happy path: admin logs in, reaches `/` and `/admin`
      (`e2e/auth.spec.ts`)
- [x] Cross-tenant: a user from Tenant A cannot read Tenant B's
      `tenants`/`profiles` docs; no client write succeeds on any
      Phase 1b collection, even from its own tenant's ADMIN
      (`tests/rules/tenancy.test.ts`, run against the real Firestore
      emulator — 13/13 passing)
- [x] A forged `tenantId`/`role`/deactivated-account login attempt is
      rejected server-side (`POST /api/session` re-checks the
      `profiles` doc's `status`, not just the claim)
- [x] No Admin SDK service-account credentials in any client bundle
      (only `NEXT_PUBLIC_*` vars reach `src/lib/firebase/client.ts`;
      `src/lib/firebase/admin.ts` is guarded by `server-only`)
- [x] Role gating: STAFF gets a 403 on `/admin`, ADMIN gets in
      (`e2e/auth.spec.ts`)

## Manual test steps (actually run, 2026-10-03)

The host machine has no JRE, so the emulator was run in a `node:22`
Docker container with a Temurin 21 JRE added — see
[README.md](../../README.md) for the one-line fix if you hit the same
"no Java" error locally (`brew install openjdk`); Docker was only a
workaround for this session, not a project dependency.

1. `npm run test:rules` → 13/13 Security Rules tests pass against the
   real Firestore emulator.
2. `npm run test:e2e:ci` (emulator + `scripts/seed.ts` + Playwright) →
   5/5 pass: unauthenticated redirect to `/login`, 404 page, admin
   login → dashboard → logout, admin reaches `/admin` while staff gets
   a 403, wrong password shows `Firebase: Error (auth/wrong-password)`
   and does not sign in.
3. `npm run lint`, `npm run typecheck`, `npm test` (15 unit tests),
   `npm run build` all pass on the host (no emulator needed for
   these).

## Acceptance criteria

- Users can sign in/out; role-protected routes work; tenants cannot
  see each other's data (verified by test); no secrets in client
  bundles
