# Phase 1a — Project scaffold & tooling

## Tasks

- [ ] Next.js (App Router) + TypeScript (strict) + Tailwind CSS
- [ ] ESLint + Prettier configured; `npm run lint` clean
- [ ] Firebase CLI set up for local dev; emulator suite (Auth,
      Firestore, Functions) runs locally
- [ ] Base layout, nav shell (placeholder links only), 404/error pages
- [ ] `.env.example` with every variable the app needs, no real values
- [ ] CI: install, lint, typecheck, build, on every push
- [ ] `README.md`: local setup steps from clone to running app
- [ ] Vitest configured with one passing sample test
- [ ] Playwright configured with one passing smoke test
- [ ] `@firebase/rules-unit-testing` configured against the emulator,
      with one passing sample Security Rules test

## Acceptance criteria

- `npm run build` succeeds; `npm run lint` passes; CI is green
- A new developer can go from `git clone` to a running local app using
  only the README
