import { redirect } from 'next/navigation';
import { Forbidden } from '@/components/forbidden';
import { adminDb } from '@/lib/firebase/admin';
import {
  AuthError,
  getSessionProfile,
  requireRole,
  requireTenantId,
} from '@/lib/auth/session';
import { TableForm } from './table-form';
import { TableList } from './table-list';
import type { CafeTable } from './types';

export default async function TablesAdminPage() {
  const profile = await getSessionProfile();
  if (!profile) {
    redirect('/login');
  }

  let tenantId: string;
  try {
    requireRole(profile, ['ADMIN']);
    tenantId = requireTenantId(profile);
  } catch (error) {
    if (error instanceof AuthError) {
      return <Forbidden message={error.message} />;
    }
    throw error;
  }

  const snap = await adminDb.collection(`tenants/${tenantId}/cafeTables`).get();
  const tables: CafeTable[] = snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<CafeTable, 'id'>) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Tables</h1>
      <TableList tables={tables} />
      <TableForm />
    </main>
  );
}
