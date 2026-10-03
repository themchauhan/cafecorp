import { redirect } from 'next/navigation';
import { Forbidden } from '@/components/forbidden';
import { adminDb } from '@/lib/firebase/admin';
import { AuthError, getSessionProfile, requireRole } from '@/lib/auth/session';
import type { CafeTable } from '@/app/admin/tables/types';
import { TableStatusBoard } from './table-status-board';

export default async function TableStatusPage() {
  const profile = await getSessionProfile();
  if (!profile) {
    redirect('/login');
  }

  try {
    requireRole(profile, ['ADMIN', 'STAFF']);
  } catch (error) {
    if (error instanceof AuthError) {
      return <Forbidden message={error.message} />;
    }
    throw error;
  }

  if (!profile.tenantId) {
    return <Forbidden message="No tenant on this account" />;
  }

  const snap = await adminDb
    .collection(`tenants/${profile.tenantId}/cafeTables`)
    .where('active', '==', true)
    .get();
  const tables: CafeTable[] = snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<CafeTable, 'id'>) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Tables</h1>
      {tables.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No active tables. An admin can add them under Admin &rarr; Tables.
        </p>
      ) : (
        <TableStatusBoard tenantId={profile.tenantId} tables={tables} />
      )}
    </main>
  );
}
