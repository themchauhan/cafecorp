import Link from 'next/link';
import type { SessionProfile } from '@/lib/auth/types';
import { LogoutButton } from './logout-button';

// Placeholder links only — routes land phase by phase (see
// docs/phases). None of these are role-gated yet beyond /admin.
const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/orders', label: 'Orders' },
  { href: '/kitchen', label: 'Kitchen' },
  { href: '/menu', label: 'Menu' },
  { href: '/tables', label: 'Tables' },
  { href: '/reports', label: 'Reports' },
  { href: '/admin', label: 'Admin' },
] as const;

export function Nav({ profile }: { profile: SessionProfile | null }) {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)] print:hidden">
      <nav className="mx-auto flex max-w-6xl items-center gap-2 px-4">
        <span className="py-3 pr-4 text-lg font-bold tracking-tight text-[var(--color-brand-600)]">
          CafeCorp
        </span>
        <ul className="flex flex-1 items-center gap-1 overflow-x-auto text-sm font-medium text-[var(--muted)]">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex min-h-12 items-center rounded-lg px-3 hover:bg-[var(--color-brand-50)] hover:text-[var(--color-brand-600)]"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        {profile ? (
          <div className="flex items-center gap-3 pl-2 text-sm text-[var(--muted)]">
            <span className="hidden font-semibold sm:inline">
              {profile.role}
            </span>
            <LogoutButton />
          </div>
        ) : (
          <Link href="/login" className="btn btn-sm btn-primary">
            Log in
          </Link>
        )}
      </nav>
    </header>
  );
}
