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
    <header className="border-b border-zinc-200 print:hidden dark:border-zinc-800">
      <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <span className="font-semibold tracking-tight">CafeCorp</span>
        <ul className="flex flex-1 gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="hover:text-zinc-900 dark:hover:text-zinc-50"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        {profile ? (
          <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <span>{profile.role}</span>
            <LogoutButton />
          </div>
        ) : (
          <Link href="/login" className="text-sm hover:underline">
            Log in
          </Link>
        )}
      </nav>
    </header>
  );
}
