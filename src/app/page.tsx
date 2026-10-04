import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth/session';

const QUICK_ACTIONS: Record<
  'ADMIN' | 'STAFF' | 'SUPER_ADMIN',
  { href: string; label: string; hint: string }[]
> = {
  STAFF: [
    { href: '/orders', label: 'Take an order', hint: 'Start a new order' },
    { href: '/kitchen', label: 'Kitchen board', hint: 'Live tickets' },
    { href: '/tables', label: 'Tables', hint: 'Check table status' },
  ],
  ADMIN: [
    { href: '/orders', label: 'Take an order', hint: 'Start a new order' },
    { href: '/kitchen', label: 'Kitchen board', hint: 'Live tickets' },
    { href: '/reports', label: 'Reports', hint: "Today's collections" },
    { href: '/admin', label: 'Admin', hint: 'Staff, menu, tables' },
  ],
  SUPER_ADMIN: [
    { href: '/super-admin', label: 'Tenants', hint: 'Manage cafeterias' },
  ],
};

export default async function Home() {
  const profile = await getSessionProfile();
  if (!profile) {
    redirect('/login');
  }

  const actions = QUICK_ACTIONS[profile.role];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-[var(--muted)]">
          Signed in as{' '}
          <strong className="text-[var(--foreground)]">{profile.role}</strong>
          {profile.tenantId ? ` · tenant ${profile.tenantId}` : ' · platform'}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="card flex min-h-28 flex-col justify-end gap-1 p-5 hover:border-[var(--color-brand-500)]"
          >
            <span className="text-lg font-bold">{action.label}</span>
            <span className="text-sm text-[var(--muted)]">{action.hint}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
