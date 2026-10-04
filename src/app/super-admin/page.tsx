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
        <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
        <p className="text-sm text-[var(--muted)]">
          {activeCount} active of {tenants.length} total
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 pr-4 font-semibold">Name</th>
              <th className="px-4 py-3 pr-4 font-semibold">Plan</th>
              <th className="px-4 py-3 pr-4 font-semibold">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 pr-4 font-medium">{tenant.name}</td>
                <td className="px-4 py-3 pr-4">{tenant.plan}</td>
                <td className="px-4 py-3 pr-4">
                  {isTenantCurrentlyActive(tenant)
                    ? 'Active'
                    : tenant.status === 'SUSPENDED'
                      ? 'Suspended'
                      : 'Expired'}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/super-admin/${tenant.id}`}
                    className="font-semibold text-[var(--color-brand-600)] hover:underline"
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-lg font-semibold">New tenant</h2>
        <CreateTenantForm />
      </section>
    </main>
  );
}
