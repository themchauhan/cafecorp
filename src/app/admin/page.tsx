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

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <ul className="flex flex-col gap-2 text-sm underline underline-offset-4">
        {profile.role === 'ADMIN' && (
          <>
            <li>
              <Link href="/admin/staff">Staff</Link>
            </li>
            <li>
              <Link href="/admin/menu">Menu</Link>
            </li>
            <li>
              <Link href="/admin/tables">Tables</Link>
            </li>
            <li>
              <Link href="/reports">Reports</Link>
            </li>
          </>
        )}
        {profile.role === 'SUPER_ADMIN' && (
          <li>
            <Link href="/super-admin">Tenants (platform)</Link>
          </li>
        )}
        <li>
          <Link href="/admin/mfa">Two-factor authentication</Link>
        </li>
      </ul>
    </main>
  );
}
