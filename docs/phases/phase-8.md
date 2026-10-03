# Phase 8 — Security hardening and pilot readiness

This phase gates real customer/order data. Do not proceed to a real
pilot until every item below is checked.

## Tasks

- [x] Fix expected Server Action errors being shown to users as a
      generic message in production (React redacts any thrown error's
      `message` once it crosses the Server Components render boundary
      in a `next build` — see the Phase 7 doc's "Finding carried
      forward to Phase 8" section for the full root cause). Every
      `actions.ts` now catches its own expected failures and returns
      `ActionResult<T>` (`src/lib/action-result.ts`) instead of
      throwing, and every client call site checks `result.ok` instead
      of `catch (err) { setError(err.message) }`. See `CLAUDE.md` hard
      rule #12.
- [x] Review Security Rules and authorization for every collection;
      write down the review, don't just eyeball it — see
      `docs/security-rules-review.md`. Found and fixed one gap
      (`subscriptionPayments` had no dedicated rules test).
- [x] Systematically test cross-tenant access across every collection
      and route — covered at both layers: Security Rules tests (client
      SDK direct access) and Server Action unit tests (the Admin-SDK
      write path, which bypasses rules). Found and fixed six Server
      Action test gaps — see `docs/security-rules-review.md`'s
      "Server Actions" section.
- [x] Audit events exist for: order create/edit/cancel, payment,
      menu changes, user changes, subscription changes — see
      `docs/audit-log-coverage.md`. Found and fixed one gap: enabling/
      disabling MFA wrote no audit entry at all.
- [~] Firestore backup/recovery procedure documented and tested
  (scheduled export to Cloud Storage + a real restore, not just a
  backup) — procedure fully documented in
  `docs/firestore-backup-recovery.md`, but **not yet tested**: no
  real Firebase project exists yet (CLAUDE.md rule #6, dummy data
  only), so there's nothing to back up or restore. Tracked as an
  explicit open item in that doc, to be done before a real pilot
  starts — not something that can be completed from this dev
  environment.
- [x] Secure session settings reviewed (cookie flags, session length)
      — see `docs/session-settings-review.md`. Found and fixed a real
      gap: deactivating a staff member didn't revoke their existing
      session, so they could keep using the app for up to 5 days after
      being deactivated.
- [x] Admin MFA confirmed working for all admin accounts before pilot
      — `e2e/staff-and-mfa.spec.ts`'s "admin can enroll TOTP MFA and
      must then use it to log in" test exercises the full enroll →
      confirm → log out → log back in with a TOTP code flow against a
      real Firebase emulator (not mocked). The gate itself
      (`MFA_ROLES = ['ADMIN', 'SUPER_ADMIN']` in
      `src/app/admin/mfa/actions.ts`, and the same check in
      `src/app/api/session/route.ts`) is role-based, not tied to one
      specific seeded account, so this generalizes to every real
      ADMIN/SUPER_ADMIN account, not just the test fixture. Before a
      real pilot: each real admin should actually enroll their own
      device at onboarding — that's a one-time manual action per
      person, not something to automate or skip.
- [ ] Pilot runs with dummy data first; only after sign-off does a
      small controlled pilot with a real cafeteria begin

## Acceptance criteria

- Documented security test checklist passes
- Backups/recovery tested at least once
- Pilot can complete the real workflow without using real order/
  customer data prematurely
