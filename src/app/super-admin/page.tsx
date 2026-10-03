import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Forbidden } from '@/components/forbidden';
import { adminDb } from '@/lib/firebase/admin';
import { AuthError, getSessionProfile, requireRole } from '@/lib/auth/session';
import { isTenantCurrentlyActive } from '@/lib/tenant';
import { CreateTenantForm } from './create-tenant-form';
import type { Tenant } from './types';

export default async function SuperAdminPage() {
  const profile = await getSessionProfile();
  if (!profile) {
    redirect('/login');
  }

  try {
    requireRole(profile, ['SUPER_ADMIN']);
  } catch (error) {
    if (error instanceof AuthError) {
      return <Forbidden message={error.message} />;
    }
    throw error;
  }

  const snap = await adminDb.collection('tenants').get();
  const tenants: Tenant[] = snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Tenant, 'id'>) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const activeCount = tenants.filter((t) => isTenantCurrentlyActive(t)).length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {activeCount} active of {tenants.length} total
        </p>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="text-zinc-500 dark:text-zinc-400">
          <tr>
            <th className="py-1 pr-4">Name</th>
            <th className="py-1 pr-4">Plan</th>
            <th className="py-1 pr-4">Status</th>
            <th className="py-1" />
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <tr
              key={tenant.id}
              className="border-t border-zinc-200 dark:border-zinc-800"
            >
              <td className="py-2 pr-4">{tenant.name}</td>
              <td className="py-2 pr-4">{tenant.plan}</td>
              <td className="py-2 pr-4">
                {isTenantCurrentlyActive(tenant)
                  ? 'Active'
                  : tenant.status === 'SUSPENDED'
                    ? 'Suspended'
                    : 'Expired'}
              </td>
              <td className="py-2">
                <Link
                  href={`/super-admin/${tenant.id}`}
                  className="underline underline-offset-4"
                >
                  Manage
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-lg font-medium">New tenant</h2>
        <CreateTenantForm />
      </section>
    </main>
  );
}
