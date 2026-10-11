import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Forbidden } from '@/components/forbidden';
import { AuthError, getSessionProfile, requireRole } from '@/lib/auth/session';
import {
  AdminIcon,
  MenuBookIcon,
  PeopleIcon,
  ReportsIcon,
  ShieldIcon,
  TableIcon,
  TenantsIcon,
} from '@/components/icons';

export default async function AdminPage() {
  const profile = await getSessionProfile();
  if (!profile) {
    redirect('/login');
  }

  try {
    requireRole(profile, ['ADMIN', 'SUPER_ADMIN']);
  } catch (error) {
    if (error instanceof AuthError) {
      return <Forbidden message={error.message} />;
    }
    throw error;
  }

  const tileClassName =
    'card flex min-h-28 flex-col justify-between gap-3 p-5 hover:border-[var(--color-brand-500)]';
  const iconClassName = 'text-[var(--color-brand-600)]';

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start gap-6 px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
      <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3">
        {profile.role === 'ADMIN' && (
          <>
            <Link href="/admin/staff" className={tileClassName}>
              <PeopleIcon size={28} className={iconClassName} />
              <span className="flex flex-col gap-0.5">
                <span className="text-lg font-bold">Staff</span>
                <span className="text-sm text-[var(--muted)]">
                  Invite, activate, deactivate
                </span>
              </span>
            </Link>
            <Link href="/admin/menu" className={tileClassName}>
              <MenuBookIcon size={28} className={iconClassName} />
              <span className="flex flex-col gap-0.5">
                <span className="text-lg font-bold">Menu</span>
                <span className="text-sm text-[var(--muted)]">
                  Categories &amp; items
                </span>
              </span>
            </Link>
            <Link href="/admin/tables" className={tileClassName}>
              <TableIcon size={28} className={iconClassName} />
              <span className="flex flex-col gap-0.5">
                <span className="text-lg font-bold">Tables</span>
                <span className="text-sm text-[var(--muted)]">
                  Dine-in table setup
                </span>
              </span>
            </Link>
            <Link href="/reports" className={tileClassName}>
              <ReportsIcon size={28} className={iconClassName} />
              <span className="flex flex-col gap-0.5">
                <span className="text-lg font-bold">Reports</span>
                <span className="text-sm text-[var(--muted)]">
                  Collections &amp; trends
                </span>
              </span>
            </Link>
            <Link href="/admin/settings" className={tileClassName}>
              <AdminIcon size={28} className={iconClassName} />
              <span className="flex flex-col gap-0.5">
                <span className="text-lg font-bold">Settings</span>
                <span className="text-sm text-[var(--muted)]">
                  Tax rate &amp; more
                </span>
              </span>
            </Link>
          </>
        )}
        {profile.role === 'SUPER_ADMIN' && (
          <Link href="/super-admin" className={tileClassName}>
            <TenantsIcon size={28} className={iconClassName} />
            <span className="flex flex-col gap-0.5">
              <span className="text-lg font-bold">Tenants</span>
              <span className="text-sm text-[var(--muted)]">
                Manage cafeterias (platform)
              </span>
            </span>
          </Link>
        )}
        <Link href="/admin/mfa" className={tileClassName}>
          <ShieldIcon size={28} className={iconClassName} />
          <span className="flex flex-col gap-0.5">
            <span className="text-lg font-bold">Two-factor auth</span>
            <span className="text-sm text-[var(--muted)]">
              Secure this account
            </span>
          </span>
        </Link>
      </div>
    </main>
  );
}
