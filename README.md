# CafeCorp — Cafeteria POS

A multi-tenant order-taking, kitchen ticket (KOT), and billing app for
small cafeterias. See [`docs/BRIEF.md`](docs/BRIEF.md) for the full
product spec and [`docs/phases/`](docs/phases) for the build plan.
Project rules for anyone (human or Claude Code) working in this repo
live in [`CLAUDE.md`](CLAUDE.md) — read that first.

Stack: Next.js (App Router) + TypeScript + Tailwind CSS, Firebase
(Auth + Firestore), deployed on Vercel.

## Prerequisites

- Node.js 22+
- A JRE (Java 21+) — required to run the Firebase emulator suite
  locally. On macOS: `brew install openjdk` (or
  `brew install --cask temurin`), then follow the symlink
  instructions it prints. No Homebrew/JRE on hand? Any container with
  Node 22 + a JRE 21 works too — e.g.
  `docker run --rm -it -v "$PWD":/app -v /app/node_modules -w /app node:22-bookworm bash`,
  then install a JRE inside it before running the commands below. Use
  a _named_ volume for `node_modules` (as above, not a plain bind
  mount) so container-installed native deps don't leak back into your
  host `node_modules`.
- The Firebase CLI is a project dependency (`firebase-tools`) — no
  global install needed, it runs via `npm run emulators` etc.

## Local setup

```bash
git clone <this-repo>
cd cafeteria-management
npm install
cp .env.example .env.local
```

`.env.local` as copied works out of the box against the Firebase
emulator suite (`NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`) — no real
Firebase project needed for local dev.

In one terminal, start the emulators:

```bash
npm run emulators
```

This opens the Emulator UI at http://127.0.0.1:4000 (Auth on `9099`,
Firestore on `8080`).

In a second terminal, load dummy data:

```bash
npm run seed
```

This creates one dummy tenant (`demo-cafe`) and three logins:

| Role        | Email              | Password      |
| ----------- | ------------------ | ------------- |
| SUPER_ADMIN | super@cafecorp.app | `password123` |
| ADMIN       | admin@demo.cafe    | `password123` |
| STAFF       | staff@demo.cafe    | `password123` |

(`scripts/seed.ts` also creates `mfa-admin@demo.cafe` and
`target-staff@demo.cafe` — dedicated accounts the Phase 1c e2e tests
mutate, kept separate so they don't disturb the three above — plus a
second, mostly-empty tenant `lockout-test-cafe` with its own staff
login `staff@lockout-test.cafe` / `password123`, dedicated to the
Phase 7 suspend/reactivate e2e test.)

Then start the app in that same terminal:

```bash
npm run dev
```

Open http://localhost:3000 and sign in with one of the logins above.

### Using a real Firebase project (optional)

Only needed for staging/production, or to test against real Firebase
instead of the emulators. Create a project in the
[Firebase console](https://console.firebase.google.com), enable
Authentication and Firestore, then:

1. Set `.firebaserc`'s `projects.default` to your project id.
2. Fill in the `NEXT_PUBLIC_FIREBASE_*` values from Project Settings →
   General → Your apps.
3. Generate a service account key (Project Settings → Service
   Accounts) and fill in `FIREBASE_ADMIN_*`.
4. Set `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false`.
5. Provision the first SUPER_ADMIN:
   `npm run provision:super-admin -- --email you@example.com --name "Your Name"`
   (asks for confirmation before writing, since this grants
   platform-wide access).

Never commit real values for any of the above — `.env.local` is
git-ignored; only `.env.example` (no real values) is tracked.

## Scripts

| Script                            | What it does                                                                |
| --------------------------------- | --------------------------------------------------------------------------- |
| `npm run dev`                     | Start the Next.js dev server                                                |
| `npm run build`                   | Production build                                                            |
| `npm run lint`                    | ESLint                                                                      |
| `npm run format` / `format:check` | Prettier write / check                                                      |
| `npm run typecheck`               | `tsc --noEmit`                                                              |
| `npm test` / `test:watch`         | Vitest unit tests                                                           |
| `npm run emulators`               | Start the Firebase Auth + Firestore emulators                               |
| `npm run seed`                    | Load dummy tenant/users into the running emulators                          |
| `npm run test:rules`              | Run Firestore Security Rules tests against a throwaway emulator instance    |
| `npm run test:e2e`                | Playwright tests — needs `emulators` + `seed` already running               |
| `npm run test:e2e:ci`             | Same, but starts its own throwaway emulator + seeds it first (what CI runs) |

## Testing

- **Unit tests** (Vitest + React Testing Library) — component and
  logic tests, run against jsdom. `src/**/*.test.ts(x)`.
- **Security Rules tests** (`@firebase/rules-unit-testing`) — every
  tenant-owned collection needs a happy-path and a cross-tenant test
  here once its rules exist (CLAUDE.md hard rule). `tests/rules/`.
- **E2E smoke tests** (Playwright) — `e2e/`.

## CI

`.github/workflows/ci.yml` runs on every push/PR: install → format
check → lint → typecheck → unit tests → build, plus separate jobs for
Security Rules tests and the Playwright smoke test.

## Project structure

```
src/app/            Next.js App Router routes
src/components/     Shared UI components
src/lib/firebase/   Firebase client SDK (browser) and Admin SDK (server-only) init
src/lib/auth/       Session cookie, getSessionProfile()/requireRole()/requireActiveTenant(), audit log
scripts/            One-off scripts (seed, super-admin provisioning) — emulator-only, see scripts/lib/emulator-admin.ts
tests/rules/        Firestore Security Rules tests (emulator-backed)
e2e/                Playwright end-to-end tests
docs/BRIEF.md       Product spec
docs/phases/        Phase-by-phase build plan and acceptance criteria
firestore.rules     Security Rules — read-only per collection, all writes via Server Actions
firebase.json       Emulator suite config
```
