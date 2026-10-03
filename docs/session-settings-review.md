# Session settings review (Phase 8)

Reviews how this app issues, verifies, and invalidates sessions
(`src/app/api/session/route.ts`, `src/lib/auth/session.ts`). Last
reviewed **2026-10-03**.

## Cookie flags (`POST /api/session`)

```ts
response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_COOKIE_MAX_AGE_MS / 1000,
});
```

- **`httpOnly: true`** — the cookie is never readable from client-side
  JS, so an XSS bug can't exfiltrate the session.
- **`secure: process.env.NODE_ENV === 'production'`** — sent only over
  HTTPS in production; `false` in dev so `next dev` over plain HTTP
  still works locally. Vercel sets `NODE_ENV=production` automatically
  for deployed builds, so this doesn't need a manual env var.
- **`sameSite: 'lax'`** — not sent on cross-site requests except
  top-level navigation, which blocks the common CSRF pattern (a
  third-party page can't make the browser attach this cookie to a
  background `fetch`/`XHR` to this app). The login route itself takes
  no cookie as input anyway (`idToken` is verified against Firebase,
  not trusted from a cookie), so there's no CSRF surface on login
  either.
- **`path: '/'`** — available to the whole app, correct for a single
  session covering every route.
- **`maxAge`**: 5 days (`SESSION_COOKIE_MAX_AGE_MS`,
  `src/lib/auth/session.ts`). Matches the Firebase Admin SDK session
  cookie's own `expiresIn`, so the browser cookie and the signed
  cookie's embedded expiry agree. 5 days is a deliberate choice for a
  POS-style staff app — forcing a fresh login every shift would be
  friction with no real security benefit for an internal staff tool;
  it's short enough that a lost/stolen device self-heals within a
  work-week even with no other action taken.

## Verification (`getSessionProfile()`)

`adminAuth.verifySessionCookie(sessionCookie, true)` — the `true`
enables `checkRevoked`, so a session cookie stops working once
`adminAuth.revokeRefreshTokens(uid)` has been called for that user,
even though the cookie itself hasn't expired yet. This is what makes
logout, and the fix below, actually effective rather than merely
clearing the browser's copy of the cookie.

`tenantId`/`role` are decoded only from this verified cookie's custom
claims — never from a request body, header, or client-supplied field
(CLAUDE.md hard rule #2).

**A real but separate timing characteristic**, confirmed empirically
by scripting direct calls against the Auth emulator (unrelated to the
e2e bug below, documented here because it's worth knowing):
`checkRevoked` compares the session cookie's `iat` against the
account's `tokensValidAfterTime` — both integer-_second_ JWT
timestamps. If a login and a later revocation land in the **same
wall-clock second**, the comparison can't tell them apart and the
revocation isn't detected until a session check happens after that
second has passed. Measured roughly **1–1.1 seconds** of needed real
time between login and revocation for reliable detection (delays under
~900ms intermittently failed to register; everything at or above
~1.1s worked every time). A real admin can never click "Deactivate"
within the same second as the target account's login, so this isn't a
practical gap — there's no sub-second fix available for a system built
on integer-second JWT timestamps, and none is needed. The e2e test
keeps a documented wait between login and revocation for this reason,
even though it turned out not to be this phase's actual source of
flakiness (see below).

**The actual cause of the e2e test's flakiness**, found after the
timing fix above didn't resolve it even in full isolation (single
Playwright worker, no other tests running) — confirmed by adding
request/response-level logging and comparing against a raw `curl`
reproduction of the same scenario, which worked correctly every time:
`staffPage.goto('/')`, called when `staffPage` was **already sitting on
`/`** from its earlier login, did not reliably produce a fresh
request/response cycle through the app's Server Components at all —
`getSessionProfile()` was never even invoked for that navigation
(confirmed by exhaustive per-call logging that fired for every other
request in the test but not this one), yet Playwright's own
`response.status()` for the call reported `200`. Re-navigating to a
URL identical to the page's current one is not guaranteed to trigger a
genuine round-trip the way a real reload does. **Fixed** in the test
by navigating to a different page first (`/orders`) before navigating
back to `/`, forcing a real request. This is a Playwright/Chromium
navigation-semantics detail specific to the test, not a bug in the app
— the raw-HTTP and manual-browser reproductions both showed the
server's own logic (gate on `getSessionProfile()`, `redirect('/login')`
in `src/app/page.tsx`) behaving correctly throughout this
investigation.

## Revocation — gap found and fixed this phase

`DELETE /api/session` (self logout) already calls
`revokeRefreshTokens(uid)`. But **`setStaffStatus()`
(`src/app/admin/staff/actions.ts`) did not** — deactivating a staff
member only updated their Firestore `profiles/{uid}.status` field.
`getSessionProfile()` never reads that field at all (it only decodes
the cookie's own claims), so a deactivated account's _already-issued_
session cookie kept working for up to 5 days (the full `maxAge`) after
being deactivated, even though a _fresh_ login attempt was correctly
blocked (`POST /api/session` does check `profiles/{uid}.status` at
login time).

**Fixed**: `setStaffStatus()` now calls
`adminAuth.revokeRefreshTokens(uid)` whenever `status` is set to
`'DEACTIVATED'`, so `checkRevoked` fails on that account's next
request, subject to the one-second timing characteristic above —
deactivation takes effect within about a second, not eventually once
the cookie naturally expires. Covered by new tests in
`src/app/admin/staff/actions.test.ts` (revokes on deactivation, does
not revoke on reactivation).

Tenant suspension (`setTenantStatus`, `src/app/super-admin/actions.ts`)
was **not** changed to do the same, deliberately: the documented,
tested behavior for a suspended tenant is "restricted — read-only for
its staff" (`docs/phases/phase-7.md`'s acceptance criteria, exercised
by `e2e/super-admin.spec.ts`), not an immediate full logout. Every
mutating Server Action already calls `requireActiveTenant()`, which
re-checks the tenant's live status/expiry on every write regardless of
session cookie age — so writes are blocked immediately either way; only
reads of already-visible data remain available until the session
naturally expires, which is the intended behavior, not a gap.

## Summary

Cookie flags are appropriate for this app's threat model (internal
staff tool, not a public-facing consumer app). The one real gap —
deactivation not revoking an existing session — is fixed. No change
needed to session length, flags, or the tenant-suspension behavior.
