import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// A build-time guard for Next.js bundling only; irrelevant (and
// throws by design) outside Next's webpack/turbopack resolution.
vi.mock('server-only', () => ({}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// The real module calls getAuth()/getFirestore() at import time, which
// throws without real Firebase env vars (Vitest doesn't load
// .env.local the way Next does). Components that need specific client
// SDK behavior (e.g. a login form) override this mock per test file.
vi.mock('@/lib/firebase/client', () => ({
  app: {},
  auth: {},
  db: {},
}));
