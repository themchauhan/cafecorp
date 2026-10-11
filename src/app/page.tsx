import type { ComponentType } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminDb } from '@/lib/firebase/admin';
import { getDisplayName, getSessionProfile } from '@/lib/auth/session';
import {
  AdminIcon,
  KitchenIcon,
  OrderIcon,
  ReportsIcon,
  TableIcon,
  TenantsIcon,
} from '@/components/icons';
import { KitchenSnapshot } from './kitchen/kitchen-snapshot';

const QUICK_ACTIONS: Record<
  'ADMIN' | 'STAFF' | 'SUPER_ADMIN',
  { href: string; label: string; hint: string; icon: ComponentType<{ size?: number; className?: string }> }[]
> = {
  STAFF: [
    { href: '/orders', label: 'Take an order', hint: 'Start a new order', icon: OrderIcon },
    { href: '/kitchen', label: 'Kitchen board', hint: 'Live tickets', icon: KitchenIcon },
    { href: '/tables', label: 'Tables', hint: 'Check table status', icon: TableIcon },
  ],
  ADMIN: [
    { href: '/orders', label: 'Take an order', hint: 'Start a new order', icon: OrderIcon },
    { href: '/kitchen', label: 'Kitchen board', hint: 'Live tickets', icon: KitchenIcon },
    { href: '/reports', label: 'Reports', hint: "Today's collections", icon: ReportsIcon },
    { href: '/admin', label: 'Admin', hint: 'Staff, menu, tables', icon: AdminIcon },
  ],
  SUPER_ADMIN: [
    { href: '/super-admin', label: 'Tenants', hint: 'Manage cafeterias', icon: TenantsIcon },
  ],
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default async function Home() {
  const profile = await getSessionProfile();
  if (!profile) {
    redirect('/login');
  }

  const actions = QUICK_ACTIONS[profile.role];
  const [tenantName, displayName] = await Promise.all([
    profile.tenantId
      ? adminDb
          .doc(`tenants/${profile.tenantId}`)
          .get()
          .then((snap) => (snap.data()?.name as string | undefined) ?? null)
      : Promise.resolve(null),
    getDisplayName(profile),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting()}
          {displayName ? `, ${displayName}` : ''}
        </h1>
        <p className="text-[var(--muted)]">
          {tenantName ? tenantName : 'CafeCorp platform'}
          {' · '}
          <span className="font-medium text-[var(--foreground)]">
            {profile.role}
          </span>
        </p>
      </div>

      {profile.tenantId && (profile.role === 'STAFF' || profile.role === 'ADMIN') && (
        <KitchenSnapshot tenantId={profile.tenantId} />
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="card flex min-h-28 flex-col justify-between gap-3 p-5 hover:border-[var(--color-brand-500)]"
          >
            <action.icon size={28} className="text-[var(--color-brand-600)]" />
            <span className="flex flex-col gap-0.5">
              <span className="text-lg font-bold">{action.label}</span>
              <span className="text-sm text-[var(--muted)]">{action.hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
