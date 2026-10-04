import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Forbidden } from '@/components/forbidden';
import { AuthError, getSessionProfile, requireRole } from '@/lib/auth/session';

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
    'card flex min-h-24 items-center justify-center p-5 text-center text-lg font-bold hover:border-[var(--color-brand-500)]';

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start gap-6 px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
      <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3">
        {profile.role === 'ADMIN' && (
          <>
            <Link href="/admin/staff" className={tileClassName}>
              Staff
            </Link>
            <Link href="/admin/menu" className={tileClassName}>
              Menu
            </Link>
            <Link href="/admin/tables" className={tileClassName}>
              Tables
            </Link>
            <Link href="/reports" className={tileClassName}>
              Reports
            </Link>
          </>
        )}
        {profile.role === 'SUPER_ADMIN' && (
          <Link href="/super-admin" className={tileClassName}>
            Tenants (platform)
          </Link>
        )}
        <Link href="/admin/mfa" className={tileClassName}>
          Two-factor authentication
        </Link>
      </div>
    </main>
  );
}
