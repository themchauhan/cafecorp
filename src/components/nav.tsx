'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Role, SessionProfile } from '@/lib/auth/types';
import { LogoutButton } from './logout-button';

// There's no standalone "/menu" browsing route: staff see the menu
// inline while building an order, and admins manage it via Admin →
// Menu (/admin/menu).
const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/orders', label: 'Orders' },
  { href: '/kitchen', label: 'Kitchen' },
  { href: '/tables', label: 'Tables' },
  { href: '/reports', label: 'Reports' },
  { href: '/admin', label: 'Admin' },
] as const;

// Mirrors each route's own requireRole() check (orders/page.tsx,
// kitchen/page.tsx, tables/page.tsx, reports/page.tsx, admin/page.tsx)
// — a link a role can't open just leads to a 403, so it shouldn't be
// in the nav for that role in the first place.
const VISIBLE_HREFS: Record<Role, readonly string[]> = {
  STAFF: ['/', '/orders', '/kitchen', '/tables'],
  ADMIN: ['/', '/orders', '/kitchen', '/tables', '/reports', '/admin'],
  SUPER_ADMIN: ['/', '/admin'],
};

export function Nav({
  profile,
  displayName,
}: {
  profile: SessionProfile | null;
  displayName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const identityLabel = displayName ?? profile?.role ?? '';
  const visibleLinks = profile
    ? NAV_LINKS.filter((link) =>
        VISIBLE_HREFS[profile.role].includes(link.href),
      )
    : NAV_LINKS;

  return (
    <header className="relative border-b border-[var(--border)] bg-[var(--surface)] print:hidden">
      <nav className="mx-auto flex max-w-6xl items-center gap-2 px-4">
        <Link
          href="/"
          className="flex items-center gap-2 py-3 pr-4 text-lg font-bold tracking-tight text-[var(--color-brand-600)]"
        >
          <Image
            src="/logo-mark.svg"
            alt=""
            width={28}
            height={28}
            className="rounded-md"
          />
          CafeCorp
        </Link>

        <ul className="hidden flex-1 items-center gap-1 text-sm font-medium text-[var(--muted)] sm:flex">
          {visibleLinks.map((link) => (
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

        <div className="hidden items-center gap-3 pl-2 text-sm text-[var(--muted)] sm:flex">
          {profile ? (
            <>
              <span className="flex flex-col items-end leading-tight">
                <span className="font-semibold text-[var(--foreground)]">
                  {identityLabel}
                </span>
                {displayName && <span className="text-xs">{profile.role}</span>}
              </span>
              <LogoutButton />
            </>
          ) : (
            <Link href="/login" className="btn btn-sm btn-primary">
              Log in
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="btn btn-icon btn-secondary ml-auto sm:hidden"
        >
          <span aria-hidden="true">{open ? '✕' : '☰'}</span>
        </button>
      </nav>

      {open && (
        <div
          onClick={() => setOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-40 sm:hidden"
        />
      )}

      {open && (
        <div className="absolute inset-x-0 top-full z-50 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-lg sm:hidden">
          <ul className="flex flex-col gap-1 text-sm font-medium text-[var(--muted)]">
            {visibleLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center rounded-lg px-3 hover:bg-[var(--color-brand-50)] hover:text-[var(--color-brand-600)]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-3">
            {profile ? (
              <>
                <span className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {identityLabel}
                  </span>
                  {displayName && (
                    <span className="text-xs text-[var(--muted)]">
                      {profile.role}
                    </span>
                  )}
                </span>
                <LogoutButton />
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="btn btn-primary w-full"
              >
                Log in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
